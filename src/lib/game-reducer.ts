'use client';
import type { GameState, Card, Player, GamePhase } from './types';
import { createDeck, allCards } from '@/data/initial-cards';
import { useToast } from "@/hooks/use-toast";

const MAX_HAND_SIZE = 7;
const MAX_BATTLEFIELD_SIZE = 6;

export type GameAction =
  | { type: 'INITIALIZE_GAME' }
  | { type: 'RESTART_GAME' }
  | { type: 'DRAW_CARD'; player: 'player' | 'opponent' }
  | { type: 'PLAY_CARD'; cardId: string }
  | { type: 'CHANGE_BIOME'; cardId: string; player: 'player' | 'opponent' }
  | { type: 'TOGGLE_ATTACKER'; cardId: string }
  | { type: 'DECLARE_ATTACK' }
  | { type: 'RESOLVE_COMBAT'; blocks: { attackerId: string, blockerId: string }[] }
  | { type: 'PASS_TURN' }
  | { type: 'EXECUTE_OPPONENT_TURN' }
  | { type: 'LOG_MESSAGE'; message: string }
  | { type: 'CHANGE_PHASE', phase: GamePhase };

const drawCards = (player: Player, count: number, log: GameState['log'], turn: number): { player: Player, log: GameState['log'] } => {
  const drawnCards = player.deck.slice(0, count);
  const newDeck = player.deck.slice(count);
  
  const newHand = [...player.hand];
  const newGraveyard = [...player.graveyard];
  let newLog = [...log];

  drawnCards.forEach(card => {
    if (newHand.length < MAX_HAND_SIZE) {
      newHand.push(card);
    } else {
      newGraveyard.push(card);
      newLog.push({ turn, message: `Main pleine, ${card.name} est défaussée.` });
    }
  });

  return { player: { ...player, deck: newDeck, hand: newHand, graveyard: newGraveyard }, log: newLog };
};

const createInitialPlayer = (): Player => ({
    hp: 20, mana: 0, maxMana: 0, deck: [], hand: [], battlefield: [], graveyard: [], biomeChanges: 2,
});


export const getInitialState = (): GameState => {
  const defaultBiomeCard = allCards.find(c => c.id === 'forest_biome');
  if (!defaultBiomeCard) {
      throw new Error("Default biome card not found");
  }
  const initialState = {
    gameId: 0,
    turn: 1,
    activePlayer: 'player' as 'player' | 'opponent',
    phase: 'main' as GamePhase,
    player: createInitialPlayer(),
    opponent: createInitialPlayer(),
    log: [],
    isThinking: false,
    activeBiome: { ...defaultBiomeCard, tapped: false, isAttacking: false, canAttack: false, summoningSickness: false, initialHealth: defaultBiomeCard.health },
    winner: undefined,
  };

  const playerDeck = createDeck();
  const opponentDeck = createDeck();

  initialState.player = { ...initialState.player, deck: playerDeck };
  initialState.opponent = { ...initialState.opponent, deck: opponentDeck };
  
  return initialState;
};

const shuffleAndDeal = (state: GameState): GameState => {
    let newState = JSON.parse(JSON.stringify(state));
    
    const playerDeck = createDeck();
    const opponentDeck = createDeck();

    let initialLog = [{ turn: 1, message: "Le match commence!" }];

    const { player: playerAfterDraw, log: logAfterPlayerDraw } = drawCards({ ...createInitialPlayer(), deck: playerDeck }, 5, initialLog, 1);
    const { player: opponentAfterDraw, log: logAfterOpponentDraw } = drawCards({ ...createInitialPlayer(), deck: opponentDeck }, 5, logAfterPlayerDraw, 1);
    
    const defaultBiomeCard = allCards.find(c => c.id === 'forest_biome');
    
    return {
        ...newState,
        gameId: Date.now(),
        turn: 1,
        activePlayer: 'player',
        phase: 'main',
        player: playerAfterDraw,
        opponent: opponentAfterDraw,
        winner: undefined,
        log: logAfterOpponentDraw,
        activeBiome: defaultBiomeCard ? { ...defaultBiomeCard, tapped: false, isAttacking: false, canAttack: false, summoningSickness: false, initialHealth: defaultBiomeCard.health} : null,
    }
}

// --- COMBAT DAMAGE RESOLUTION ---
const resolveDamage = (attacker: Card, defender: Card, log: any[], turn: number) => {
    const isCritical = Math.random() * 100 < (attacker.criticalHitChance || 0);
    let damageDealt = attacker.attack || 0;
    
    if (isCritical) {
        log.push({ turn, message: `💥 Coup critique de ${attacker.name}!` });
        // Critical hits ignore armor
        defender.health = (defender.health || 0) - damageDealt;
    } else {
        const remainingArmor = (defender.armor || 0) - damageDealt;
        if (remainingArmor < 0) {
            defender.armor = 0;
            defender.health = (defender.health || 0) + remainingArmor;
        } else {
            defender.armor = remainingArmor;
        }
    }
    return { attacker, defender };
};


// --- AI LOGIC ---
const opponentAI = (state: GameState): GameState => {
  let tempState = JSON.parse(JSON.stringify(state)); // Deep copy to simulate changes
  let opponent = tempState.opponent;
  let player = tempState.player;
  let log = tempState.log;

  // 1. Play Biome Card
  if (opponent.biomeChanges > 0) {
      const biomeCardInHand = opponent.hand.find(c => c.type === 'Biome');
      if (biomeCardInHand && biomeCardInHand.biome !== tempState.activeBiome?.biome) {
          log.push({ turn: tempState.turn, message: `Adversaire change le biome pour ${biomeCardInHand.name}.` });
          tempState.activeBiome = biomeCardInHand;
          opponent.hand = opponent.hand.filter(c => c.id !== biomeCardInHand.id);
          opponent.graveyard.push(biomeCardInHand); // Biomes are consumed
          opponent.mana += 1;
          opponent.biomeChanges -= 1;
      }
  }

  // 2. Play Land Card
  const landPlayedThisTurn = opponent.battlefield.some(c => c.type === 'Land' && c.summoningSickness);
  if (!landPlayedThisTurn) {
      const landInHand = opponent.hand.find(c => c.type === 'Land');
      if (landInHand) {
          log.push({ turn: tempState.turn, message: `Adversaire joue ${landInHand.name}.` });
          opponent.battlefield.push({ ...landInHand, summoningSickness: true });
          opponent.hand = opponent.hand.filter(c => c.id !== landInHand.id);
      }
  }

  // 3. Play Creature Cards
  let playedCreature = true;
  while(playedCreature) {
      const currentCreatureCount = opponent.battlefield.filter(c => c.type === 'Creature').length;
      if (currentCreatureCount >= MAX_BATTLEFIELD_SIZE) {
          playedCreature = false;
          continue;
      }

      const playableCreatures = opponent.hand
          .filter(c => c.type === 'Creature' && c.manaCost <= opponent.mana)
          .sort((a, b) => b.manaCost - a.manaCost); // Play most expensive first

      if (playableCreatures.length > 0) {
          const creatureToPlay = playableCreatures[0];
          log.push({ turn: tempState.turn, message: `Adversaire invoque ${creatureToPlay.name}.` });
          opponent.battlefield.push({ ...creatureToPlay, summoningSickness: true, canAttack: false });
          opponent.hand = opponent.hand.filter(c => c.id !== creatureToPlay.id);
          opponent.mana -= creatureToPlay.manaCost;
      } else {
          playedCreature = false;
      }
  }
  
  // 4. Declare Attack
  let attackers = opponent.battlefield.filter(c => c.type === 'Creature' && c.canAttack && !c.tapped);
  const playerHasTaunt = player.battlefield.some(c => c.type === 'Creature' && c.taunt && !c.tapped);

  if (attackers.length > 0) {
      log.push({ turn: tempState.turn, message: `Adversaire passe en phase d'attaque.` });
      
      attackers.forEach(attacker => {
          // If there are taunt creatures, the attacker MUST target one of them.
          // For AI, we'll just simplify and mark it as attacking. The combat logic will handle blocks.
          const playerTauntCreatures = player.battlefield.filter((c: Card) => c.type === 'Creature' && c.taunt && !c.tapped);
          const playerHasBlockers = player.battlefield.filter((c: Card) => c.type === 'Creature' && !c.tapped).length > 0;

          // Simple AI: always attack if possible
          if (!playerHasTaunt && !playerHasBlockers) {
              log.push({ turn: tempState.turn, message: `${attacker.name} attaque le joueur directement.` });
              attacker.isAttacking = true;
          } else {
               log.push({ turn: tempState.turn, message: `${attacker.name} se prépare à attaquer.` });
               attacker.isAttacking = true;
          }
      });
      
      // Simulate combat against player
      tempState = resolveCombat(tempState, 'opponent');
  }

  tempState.opponent = opponent;
  tempState.player = player;
  tempState.log = log;

  return tempState;
};

// A generalized combat resolution function
const resolveCombat = (state: GameState, attackingPlayer: 'player' | 'opponent'): GameState => {
    let defenderPlayerKey = attackingPlayer === 'player' ? 'opponent' : 'player';
    let attackerPlayerKey = attackingPlayer;

    let newState = JSON.parse(JSON.stringify(state)); // Deep copy for safety
    let attackerState = newState[attackerPlayerKey];
    let defenderState = newState[defenderPlayerKey];
    let newLog = newState.log;

    const attackers = attackerState.battlefield.filter((c: Card) => c.isAttacking);
    
    const defendingTauntCreatures = defenderState.battlefield.filter((c: Card) => c.type === 'Creature' && c.taunt && !c.tapped);
    let potentialBlockers = defenderState.battlefield.filter((c: Card) => c.type === 'Creature' && !c.tapped);
    
    const attackersTargetingTaunt = attackers.filter(attacker => {
        return defendingTauntCreatures.length > 0;
    });

    const unblockedAttackers = new Set(attackers);

    // --- AI/Player Blocking Logic ---
    attackers.forEach(attacker => {
        let blocker = null;
        let possibleBlockersForThisAttacker = defendingTauntCreatures.length > 0 ? defendingTauntCreatures : potentialBlockers;
        
        if (defenderPlayerKey === 'opponent') { // AI blocking logic
            // Simple AI: find a blocker that can survive or trade
            blocker = possibleBlockersForThisAttacker.find(b => (b.health || 0) > (attacker.attack || 0) && (b.attack || 0) >= (attacker.health || 0));
            if (!blocker) {
                // Or find a blocker that can trade
                blocker = possibleBlockersForThisAttacker.find(b => (b.attack || 0) >= (attacker.health || 0));
            }
             if (!blocker && possibleBlockersForThisAttacker.length > 0) {
                // Otherwise, just use the strongest available blocker
                blocker = possibleBlockersForThisAttacker.sort((a,b) => (b.attack || 0) - (a.attack || 0))[0];
            }
        }
        // Manual player blocking would be handled by a new action type before calling resolveCombat.
        // For now, AI vs Player is simplified.

        if (blocker) {
            newLog.push({ turn: newState.turn, message: `${blocker.name} bloque ${attacker.name}.` });
            resolveDamage(attacker, blocker, newLog, newState.turn);
            resolveDamage(blocker, attacker, newLog, newState.turn);
            // Remove blocker from available pool for this turn
            potentialBlockers = potentialBlockers.filter(b => b.id !== blocker.id);
            unblockedAttackers.delete(attacker);
        }
    });

    // --- Damage Phase for Unblocked Attackers ---
    unblockedAttackers.forEach(attacker => {
        const canAttackPlayer = defenderState.battlefield.filter((c: Card) => c.type === 'Creature').length === 0;

        if (defendingTauntCreatures.length > 0) {
             newLog.push({ turn: newState.turn, message: `${attacker.name} doit attaquer une créature avec Provocation, mais aucune n'a bloqué ! (Attaque annulée)` });
        } else if (!canAttackPlayer && attackingPlayer === 'player') {
             // This logic is tricky. If there are blockers but they chose not to block.
             // Standard TCG rules mean the attack goes through to the player.
             const totalDamage = attacker.attack || 0;
             defenderState.hp -= totalDamage;
             newLog.push({ turn: newState.turn, message: `${defenderPlayerKey === 'player' ? 'Joueur' : 'Adversaire'} subit ${totalDamage} dégâts de ${attacker.name}.` });
        } else {
             const totalDamage = attacker.attack || 0;
             defenderState.hp -= totalDamage;
             newLog.push({ turn: newState.turn, message: `${defenderPlayerKey === 'player' ? 'Joueur' : 'Adversaire'} subit ${totalDamage} dégâts de ${attacker.name}.` });
        }
    });

    // --- Post-combat state update ---
    const updateField = (playerStateToUpdate: Player): Player => {
        const remainingCreatures = playerStateToUpdate.battlefield.filter(c => {
            if ((c.health || 0) <= 0) {
                newLog.push({ turn: newState.turn, message: `${c.name} est détruit.` });
                playerStateToUpdate.graveyard.push({...c, health: c.initialHealth});
                return false;
            }
            return true;
        });
        return {...playerStateToUpdate, battlefield: remainingCreatures};
    };
    
    attackerState = updateField(attackerState);
    defenderState = updateField(defenderState);
    
    // Tap attackers and remove attacking status
    attackerState.battlefield = attackerState.battlefield.map((c:Card) => 
        c.isAttacking ? { ...c, tapped: true, isAttacking: false, canAttack: false } : c
    );

    const winner = defenderState.hp <= 0 ? attackerPlayerKey : undefined;

    return {
      ...newState,
      [attackerPlayerKey]: attackerState,
      [defenderPlayerKey]: defenderState,
      log: newLog,
      phase: winner ? 'game-over' : 'main', // Go back to main phase after combat
      winner,
    };
}


export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'INITIALIZE_GAME': {
        let newState = getInitialState();
        newState = shuffleAndDeal(newState);
        // Start game
        newState.player.maxMana = 1;
        newState.player.mana = 1;
        return newState;
    }

    case 'RESTART_GAME': {
      let newState = getInitialState();
      newState = shuffleAndDeal(newState);
       // Start game
      newState.player.maxMana = 1;
      newState.player.mana = 1;
      return newState;
    }

    case 'LOG_MESSAGE':
      if (!action.message) return state;
      return {
        ...state,
        log: [...state.log, { turn: state.turn, message: action.message }],
      };

    case 'CHANGE_PHASE':
        if (state.activePlayer === 'player') {
             if (action.phase === 'combat' && state.player.battlefield.filter(c => c.canAttack && !c.tapped).length === 0) {
                 return { ...state, log: [...state.log, { turn: state.turn, message: "Aucune créature ne peut attaquer."}] };
             }
             return { ...state, phase: action.phase, log: [...state.log, { turn: state.turn, message: `Phase de ${action.phase === 'combat' ? 'combat' : 'principale'}.`}] };
        }
        return state;

    case 'CHANGE_BIOME': {
        const { cardId, player: playerKey } = action;
        const player = state[playerKey];
        if (player.biomeChanges <= 0) return state;

        const card = player.hand.find(c => c.id === cardId);
        if (!card || card.type !== 'Biome') return state;

        const newHand = player.hand.filter(c => c.id !== card.id);
        const oldBiome = state.activeBiome;
        const newGraveyard = oldBiome ? [...player.graveyard, oldBiome] : player.graveyard;

        const newState = { ...state };
        newState[playerKey] = {
            ...player,
            hand: newHand,
            graveyard: newGraveyard,
            mana: player.mana + 1,
            biomeChanges: player.biomeChanges - 1,
        };

        return {
            ...newState,
            activeBiome: card,
            log: [...state.log, { turn: state.turn, message: `${playerKey === 'player' ? 'Joueur' : 'Adversaire'} change le biome pour ${card.name} et gagne 1 mana.` }]
        };
    }

    case 'PLAY_CARD': {
      if (state.activePlayer !== 'player' || state.phase !== 'main') return state;
      const player = state.player;
      const cardIndex = player.hand.findIndex(c => c.id === action.cardId);
      if (cardIndex === -1) return state;

      const card = player.hand[cardIndex];
      let hasPlayedLand = player.battlefield.some(c => c.type === 'Land' && c.summoningSickness);

      if (card.type === 'Land' && hasPlayedLand) {
        return { ...state, log: [...state.log, { turn: state.turn, message: "Vous ne pouvez jouer qu'un terrain par tour." }] };
      }
      if (card.manaCost > player.mana) {
        return { ...state, log: [...state.log, { turn: state.turn, message: "Pas assez de mana." }] };
      }
      if (card.type === 'Creature' && player.battlefield.filter(c => c.type === 'Creature').length >= MAX_BATTLEFIELD_SIZE) {
        return { ...state, log: [...state.log, { turn: state.turn, message: "Vous avez trop de créatures sur le terrain." }] };
      }
      if (card.type === 'Biome') {
          return gameReducer(state, { type: 'CHANGE_BIOME', cardId: card.id, player: 'player' });
      }
      
      const newHand = player.hand.filter(c => c.id !== card.id);
      let newPlayerState = { ...player, hand: newHand };
      let newLog = state.log;
      
      const newCardState: Card = { ...card, summoningSickness: true, canAttack: false };

      if (card.type === 'Land') {
        newPlayerState.battlefield = [...player.battlefield, newCardState];
        newPlayerState.maxMana = player.maxMana + 1;
        newLog = [...state.log, { turn: state.turn, message: `Joueur joue ${card.name}.` }];
      } else if (card.type === 'Creature') {
        newPlayerState.battlefield = [...player.battlefield, newCardState];
        newPlayerState.mana -= card.manaCost;
        newLog = [...state.log, { turn: state.turn, message: `Joueur invoque ${card.name}.` }];
      } else if (card.type === 'Spell') {
        newPlayerState.hp = Math.min(20, player.hp + 5);
        newPlayerState.graveyard = [...player.graveyard, card];
        newPlayerState.mana -= card.manaCost;
        newLog = [...state.log, { turn: state.turn, message: `Joueur lance ${card.name} et se soigne.` }];
      }

      return { ...state, player: newPlayerState, log: newLog };
    }
    
    case 'TOGGLE_ATTACKER': {
        if (state.phase !== 'combat' || state.activePlayer !== 'player') return state;
        const card = state.player.battlefield.find(c => c.id === action.cardId);
        if (!card || !card.canAttack || card.tapped) return state;

        const newBattlefield = state.player.battlefield.map(c => 
            c.id === action.cardId ? {...c, isAttacking: !c.isAttacking} : c
        );
        return {...state, player: {...state.player, battlefield: newBattlefield}};
    }

    case 'DECLARE_ATTACK': {
        if (state.phase !== 'combat' || state.activePlayer !== 'player') return state;
        const attackers = state.player.battlefield.filter(c => c.isAttacking);
        if (attackers.length === 0) {
             return { ...state, phase: 'main', log: [...state.log, { turn: state.turn, message: "Aucun attaquant déclaré." }] };
        }
        const opponentTauntCreatures = state.opponent.battlefield.filter((c: Card) => c.type === 'Creature' && c.taunt && !c.tapped);
        if (opponentTauntCreatures.length > 0) {
            const isAttackingTaunt = attackers.some(attacker => {
                // This is a simplified check. A real implementation would need target selection.
                // For now, we assume if taunt exists, any attack is validly directed towards the taunt group.
                return true; 
            });
            if (!isAttackingTaunt) {
                 return { ...state, log: [...state.log, { turn: state.turn, message: "Vous devez attaquer une créature avec Provocation." }] };
            }
        }

        return resolveCombat(state, 'player');
    }

    case 'PASS_TURN': {
      if (state.phase === 'game-over') return state;
      let newState = JSON.parse(JSON.stringify(state));

      // Untap current player's creatures and reset states
      const currentPlayerKey = newState.activePlayer;
      newState[currentPlayerKey].battlefield = newState[currentPlayerKey].battlefield.map((c: Card) => ({
        ...c,
        tapped: false,
        summoningSickness: false,
        canAttack: c.type === 'Creature',
        isAttacking: false, // Ensure this is reset
      }));
       newState[currentPlayerKey].biomeChanges = 2;


      // Switch to next player
      const nextPlayerKey = currentPlayerKey === 'player' ? 'opponent' : 'player';
      const nextTurnNumber = nextPlayerKey === 'player' ? newState.turn + 1 : newState.turn;
      
      newState.turn = nextTurnNumber;
      newState.activePlayer = nextPlayerKey;
      newState.phase = 'main';
      
      // Draw card for the new turn player
      const { player: nextPlayerAfterDraw, log: logAfterDraw } = drawCards(newState[nextPlayerKey], 1, newState.log, nextTurnNumber);
      newState[nextPlayerKey] = nextPlayerAfterDraw;
      newState.log = [...logAfterDraw, { turn: nextTurnNumber, message: `Début du tour de ${nextPlayerKey === 'player' ? 'Joueur' : 'l\'Adversaire'}.` }];

      // Next player gets mana
      let nextPlayerState = newState[nextPlayerKey];
      nextPlayerState.maxMana = Math.min(10, nextPlayerState.maxMana + 1);
      nextPlayerState.mana = nextPlayerState.maxMana;
      
      newState[nextPlayerKey] = nextPlayerState;
      
      // Set AI thinking state
      newState.isThinking = nextPlayerKey === 'opponent';

      return newState;
    }
    
    case 'EXECUTE_OPPONENT_TURN': {
      if (state.activePlayer !== 'opponent') return state;
      const finalStateFromAI = opponentAI(state);
      
      const passTurnAction: GameAction = { type: 'PASS_TURN' };
      
      let stateAfterAI = {
        ...finalStateFromAI,
        isThinking: false
      };

      return gameReducer(stateAfterAI, passTurnAction);
    }

    default:
      return state;
  }
}

    