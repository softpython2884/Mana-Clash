'use client';
import type { GameState, Card, Player, GamePhase } from './types';
import { createDeck, allCards } from '@/data/initial-cards';
import { useToast } from "@/hooks/use-toast";

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

const drawCards = (player: Player, count: number): Player => {
  const drawnCards = player.deck.slice(0, count);
  const newDeck = player.deck.slice(count);
  const newHand = [...player.hand, ...drawnCards];
  return { ...player, deck: newDeck, hand: newHand };
};

const createInitialPlayer = (): Player => ({
    hp: 20, mana: 0, maxMana: 0, deck: [], hand: [], battlefield: [], graveyard: [], biomeChanges: 2,
});


export const getInitialState = (): GameState => {
  const defaultBiomeCard = allCards.find(c => c.id === 'forest_biome');
  if (!defaultBiomeCard) {
      throw new Error("Default biome card not found");
  }
  return {
    gameId: 0,
    turn: 1,
    activePlayer: 'player',
    phase: 'main',
    player: createInitialPlayer(),
    opponent: createInitialPlayer(),
    log: [],
    isThinking: false,
    activeBiome: { ...defaultBiomeCard, tapped: false, isAttacking: false, canAttack: false, summoningSickness: false, initialHealth: defaultBiomeCard.health },
  };
};

const shuffleAndDeal = (): Partial<GameState> => {
    const playerDeck = createDeck();
    const opponentDeck = createDeck();

    let player = drawCards({ ...createInitialPlayer(), deck: playerDeck }, 5);
    let opponent = drawCards({ ...createInitialPlayer(), deck: opponentDeck }, 5);
    
    const defaultBiomeCard = allCards.find(c => c.id === 'forest_biome');
    
    return {
        gameId: Date.now(),
        turn: 1,
        activePlayer: 'player',
        phase: 'main',
        player,
        opponent,
        winner: undefined,
        log: [{ turn: 1, message: "Le match commence!" }],
        activeBiome: defaultBiomeCard ? { ...defaultBiomeCard, tapped: false, isAttacking: false, canAttack: false, summoningSickness: false, initialHealth: defaultBiomeCard.health} : null,
    }
}

// --- AI LOGIC ---
const opponentAI = (state: GameState): GameState => {
  let tempState = JSON.parse(JSON.stringify(state)); // Deep copy to simulate changes
  let opponent = tempState.opponent;
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
          opponent.maxMana += 1;
          opponent.mana = opponent.maxMana; // Mana is refilled when land is played in this simple AI
      }
  }

  // 3. Play Creature Cards
  let playedCreature = true;
  while(playedCreature) {
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
  let attackers = opponent.battlefield.filter(c => c.type === 'Creature' && !c.summoningSickness && !c.tapped);
  if (attackers.length > 0) {
      log.push({ turn: tempState.turn, message: `Adversaire attaque avec ${attackers.map(a => a.name).join(', ')}.` });
      // The rest of the combat logic is handled by the DECLARE_ATTACK reducer logic, but we need to simulate it for the AI's opponent (the player)
      tempState = resolveCombat(tempState, attackers, 'opponent');
  }

  tempState.opponent = opponent;
  tempState.log = log;

  return tempState;
};

// A generalized combat resolution function
const resolveCombat = (state: GameState, attackers: Card[], attackingPlayer: 'player' | 'opponent'): GameState => {
    let defenderPlayerKey = attackingPlayer === 'player' ? 'opponent' : 'player';
    let attackerPlayerKey = attackingPlayer;

    let newState = JSON.parse(JSON.stringify(state)); // Deep copy for safety
    let attackerState = newState[attackerPlayerKey];
    let defenderState = newState[defenderPlayerKey];
    let newLog = newState.log;

    const availableBlockers = defenderState.battlefield.filter((c: Card) => c.type === 'Creature' && !c.tapped);
    let unblockedAttackers = [...attackers];

    // --- Defender AI Blocking Logic (if defender is AI, otherwise it's manual) ---
    if (defenderPlayerKey === 'opponent') { // Simple AI blocking
        attackers.sort((a, b) => (b.attack || 0) - (a.attack || 0)); // Prioritize blocking strongest attackers

        for (const attacker of attackers) {
            // Find a blocker that can survive or trade favorably
            let bestBlocker = availableBlockers.find(b => (b.health || 0) > (attacker.attack || 0) || ((b.attack || 0) >= (attacker.health || 0)));
            if (!bestBlocker && availableBlockers.length > 0) {
                // If no favorable trade, use the beefiest blocker available
                bestBlocker = availableBlockers.sort((a,b) => (b.health || 0) - (a.health || 0))[0];
            }

            if (bestBlocker) {
                newLog.push({ turn: newState.turn, message: `${bestBlocker.name} bloque ${attacker.name}.` });
                
                const attackerDmg = attacker.attack || 0;
                const blockerDmg = bestBlocker.attack || 0;

                // Damage resolution
                bestBlocker.health -= attackerDmg;
                attacker.health -= blockerDmg;

                const blockerIndexInAvailable = availableBlockers.findIndex(b => b.id === bestBlocker!.id);
                if (blockerIndexInAvailable > -1) {
                    availableBlockers.splice(blockerIndexInAvailable, 1);
                }
                unblockedAttackers = unblockedAttackers.filter(a => a.id !== attacker.id);
            }
        }
    }
     // If player is defender, blocking needs a new UI flow. For now, we assume AI blocking or no blocking.

    // --- Damage Phase ---
    // Blocked creatures damage each other (already simulated above)
    // Unblocked creatures damage the player
    if (unblockedAttackers.length > 0) {
        const totalDamage = unblockedAttackers.reduce((sum, c) => sum + (c.attack || 0), 0);
        defenderState.hp -= totalDamage;
        newLog.push({ turn: newState.turn, message: `${defenderPlayerKey} subit ${totalDamage} dégâts.` });
    }

    // --- Post-combat state update ---
    // Update health and handle deaths for both sides
    const updateField = (battlefield: Card[], graveyard: Card[]): Card[] => {
        return battlefield.filter(c => {
            if ((c.health || 0) <= 0) {
                newLog.push({ turn: newState.turn, message: `${c.name} est détruit.` });
                graveyard.push({...c, health: c.initialHealth}); // Add to graveyard, reset health
                return false;
            }
            return true;
        });
    };
    
    // We need to map health changes back to the original battlefield arrays in newState
    newState[attackerPlayerKey].battlefield = newState[attackerPlayerKey].battlefield.map((c: Card) => {
        const combatant = attackers.find(a => a.id === c.id);
        return combatant || c;
    });
     newState[defenderPlayerKey].battlefield = newState[defenderPlayerKey].battlefield.map((c: Card) => {
        // This part is tricky as blockers aren't passed in. For now, we rely on the direct mutation in the AI logic.
        // A better implementation would pass combat pairs.
        return c;
    });

    newState[attackerPlayerKey].battlefield = updateField(newState[attackerPlayerKey].battlefield, attackerState.graveyard);
    newState[defenderPlayerKey].battlefield = updateField(newState[defenderPlayerKey].battlefield, defenderState.graveyard);

    // Tap attackers
    newState[attackerPlayerKey].battlefield = newState[attackerPlayerKey].battlefield.map((c:Card) => 
        attackers.some(a => a.id === c.id) ? { ...c, tapped: true, isAttacking: false } : c
    );

    const winner = defenderState.hp <= 0 ? attackerPlayerKey : undefined;

    return {
      ...newState,
      log: newLog,
      phase: winner ? 'game-over' : 'main',
      winner,
    };
}


export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'INITIALIZE_GAME':
        const initialState = getInitialState();
        return {
            ...initialState,
            ...shuffleAndDeal(),
        };

    case 'RESTART_GAME':
      return {
          ...getInitialState(),
          ...shuffleAndDeal(),
      };

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
        return resolveCombat(state, attackers, 'player');
    }

    case 'PASS_TURN': {
      if (state.phase === 'game-over') return state;
      const isPlayerTurn = state.activePlayer === 'player';
      
      if (isPlayerTurn && state.phase === 'combat' && state.player.battlefield.some(c => c.isAttacking)) {
          return state; // Prevent passing turn while declaring attackers
      }

      let newState = { ...state };
      
      const current = isPlayerTurn ? 'player' : 'opponent';
      newState[current].battlefield = newState[current].battlefield.map(c => ({
        ...c,
        tapped: false,
        summoningSickness: false,
        canAttack: c.type === 'Creature',
      }));
      newState[current].biomeChanges = 2;


      const nextPlayer = isPlayerTurn ? 'opponent' : 'player';
      const nextTurnNumber = isPlayerTurn ? state.turn : state.turn + 1;
      
      newState[nextPlayer].maxMana = Math.min(10, newState[nextPlayer].maxMana + 1);
      newState[nextPlayer].mana = newState[nextPlayer].maxMana;

      const drawnCard = newState[nextPlayer].deck[0];
      if(drawnCard) {
          newState[nextPlayer].deck = newState[nextPlayer].deck.slice(1);
          newState[nextPlayer].hand = [...newState[nextPlayer].hand, drawnCard];
      }

      return {
        ...newState,
        turn: nextTurnNumber,
        activePlayer: nextPlayer,
        phase: 'main',
        log: [...state.log, { turn: nextTurnNumber, message: `Début du tour de ${nextPlayer === 'player' ? 'Joueur' : 'l\'Adversaire'}.` }],
        isThinking: nextPlayer === 'opponent',
      };
    }
    
    case 'EXECUTE_OPPONENT_TURN': {
      if (state.activePlayer !== 'opponent') return state;
      const finalStateFromAI = opponentAI(state);
      
      // After AI has "thought", pass the turn back to the player
      const passTurnAction: GameAction = { type: 'PASS_TURN' };
      
      // Combine the state from the AI with the PASS_TURN logic.
      // This is a bit complex because PASS_TURN itself has logic.
      // The simplest way is to apply AI state, then apply pass_turn reducer.
      
      // First, get the state after the AI's actions.
      let stateAfterAI = {
        ...finalStateFromAI,
        isThinking: false
      };

      // Then, run the PASS_TURN reducer on this new state.
      return gameReducer(stateAfterAI, passTurnAction);
    }

    default:
      return state;
  }
}
