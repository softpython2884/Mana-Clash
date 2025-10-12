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
  | { type: 'SELECT_CARD'; cardId: string }
  | { type: 'SELECT_ATTACKER'; cardId: string }
  | { type: 'SELECT_DEFENDER'; cardId: string | 'opponent' }
  | { type: 'DECLARE_ATTACK' }
  | { type: 'PASS_TURN' }
  | { type: 'EXECUTE_OPPONENT_TURN' }
  | { type: 'LOG_MESSAGE'; message: string }
  | { type: 'CHANGE_PHASE', phase: GamePhase }
  | { type: 'ACTIVATE_SKILL', cardId: string };

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
    selectedCardId: null,
    selectedAttackerId: null,
    selectedDefenderId: null,
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
        selectedCardId: null,
        selectedAttackerId: null,
        selectedDefenderId: null,
    }
}

// --- COMBAT DAMAGE RESOLUTION ---
const resolveDamage = (attacker: Card, defender: Card, log: any[], turn: number) => {
    const isCritical = Math.random() * 100 < (attacker.criticalHitChance || 0);
    let damageDealt = attacker.attack || 0;
    
    if (isCritical) {
        log.push({ turn, message: `💥 Coup critique de ${attacker.name}!` });
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
  const playerTauntCreatures = player.battlefield.filter((c: Card) => c.taunt && !c.tapped);
  
  attackers.forEach(attacker => {
      let target: Card | 'player' | null = null;
      
      // Must attack taunt creatures first
      if(playerTauntCreatures.length > 0) {
          // Attack the taunt creature with the lowest health
          target = playerTauntCreatures.sort((a,b) => (a.health || 0) - (b.health || 0))[0];
      } else if (player.battlefield.filter((c: Card) => !c.tapped).length > 0) {
           // Simple version: if there are creatures, attack the one it can kill
           let potentialBlockers = player.battlefield.filter((c: Card) => !c.tapped);
           let killableTarget = potentialBlockers.find(p => (p.health || 0) <= (attacker.attack || 0));
           if(killableTarget) {
               target = killableTarget;
           } else {
               // Or attack the one with highest attack
               target = potentialBlockers.sort((a,b) => (b.attack || 0) - (a.attack || 0))[0];
           }
      } else {
        // No creatures to block, attack player
        target = 'player';
      }

      if (target) {
          if (target === 'player') {
            log.push({ turn: tempState.turn, message: `${attacker.name} attaque le joueur directement.` });
            player.hp -= attacker.attack || 0;
          } else {
            log.push({ turn: tempState.turn, message: `${attacker.name} attaque ${target.name}.` });
            resolveDamage(attacker, target, log, tempState.turn);
            resolveDamage(target, attacker, log, tempState.turn);
          }
          
          attacker.tapped = true;
          attacker.canAttack = false;
      }
  });

   // Post-combat cleanup
    const updateField = (p: Player): Player => {
        const remainingCreatures = p.battlefield.filter(c => {
            if ((c.health || 0) <= 0) {
                log.push({ turn: tempState.turn, message: `${c.name} est détruit.` });
                p.graveyard.push({...c, health: c.initialHealth});
                return false;
            }
            return true;
        });
        return {...p, battlefield: remainingCreatures};
    };

    tempState.player = updateField(player);
    tempState.opponent = updateField(opponent);

    if (tempState.player.hp <= 0) {
        tempState.winner = 'opponent';
        tempState.phase = 'game-over';
    }

  return tempState;
};

// A generalized combat resolution function for the player
const resolvePlayerCombat = (state: GameState): GameState => {
    let newState = JSON.parse(JSON.stringify(state));
    let { player, opponent, log, turn, selectedAttackerId, selectedDefenderId } = newState;

    const attacker = player.battlefield.find((c: Card) => c.id === selectedAttackerId);
    if (!attacker) return state;

    // Tap attacker immediately
    attacker.tapped = true;
    attacker.canAttack = false;

    // Case 1: Attacking the opponent directly
    if (selectedDefenderId === 'opponent') {
        log.push({ turn, message: `Joueur: ${attacker.name} attaque l'adversaire directement !` });
        opponent.hp -= attacker.attack || 0;
    } 
    // Case 2: Attacking a creature
    else {
        const defender = opponent.battlefield.find((c: Card) => c.id === selectedDefenderId);
        if (!defender) return state; // Should not happen with proper targeting
        
        log.push({ turn, message: `Joueur: ${attacker.name} attaque ${defender.name}.` });
        
        // Resolve damage
        resolveDamage(attacker, defender, log, turn);
        // Defender strikes back
        resolveDamage(defender, attacker, log, turn);
    }


    // Post-combat cleanup for both battlefields
    const updateField = (p: Player): Player => {
        const remainingCreatures = p.battlefield.filter(c => {
            if ((c.health || 0) <= 0) {
                log.push({ turn, message: `${c.name} est détruit.` });
                p.graveyard.push({...c, health: c.initialHealth});
                return false;
            }
            return true;
        });
        return {...p, battlefield: remainingCreatures};
    };
    
    newState.player = updateField(player);
    newState.opponent = updateField(opponent);

    const winner = newState.opponent.hp <= 0 ? 'player' : (newState.player.hp <= 0 ? 'opponent' : undefined);

    return {
      ...newState,
      winner,
      phase: winner ? 'game-over' : 'combat', // Return to combat phase to allow more attacks
      selectedAttackerId: null,
      selectedDefenderId: null,
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

    case 'SELECT_CARD': {
        if (state.activePlayer !== 'player' || state.phase !== 'main') return state;
        return { ...state, selectedCardId: action.cardId };
    }

    case 'ACTIVATE_SKILL': {
        if (state.activePlayer !== 'player' || state.phase !== 'main') return state;
        let player = { ...state.player };
        const cardIndex = player.battlefield.findIndex(c => c.id === action.cardId);
        if (cardIndex === -1) return state;

        const card = player.battlefield[cardIndex];
        if (!card.skill || card.skill.used) return state;
        
        if (card.skill.type === 'taunt') {
            card.taunt = true;
            card.skill.used = true;
        }

        player.battlefield[cardIndex] = card;
        return { 
            ...state, 
            player,
            selectedCardId: null, // Deselect card after using skill
            log: [...state.log, { turn: state.turn, message: `Joueur active la compétence Provocation de ${card.name}!`}]
        };
    }

    case 'CHANGE_PHASE':
        if (state.activePlayer === 'player') {
             if (action.phase === 'combat' && state.player.battlefield.filter(c => c.canAttack && !c.tapped).length === 0) {
                 return { ...state, log: [...state.log, { turn: state.turn, message: "Aucune créature ne peut attaquer."}] };
             }
              if (action.phase === 'main') { // Reset selection when cancelling combat
                return { ...state, phase: 'main', selectedAttackerId: null, selectedDefenderId: null, selectedCardId: null };
            }
             return { ...state, phase: action.phase, log: [...state.log, { turn: state.turn, message: `Phase de ${action.phase}.`}] };
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
    
    case 'SELECT_ATTACKER': {
        if (state.phase !== 'combat' || state.activePlayer !== 'player') return state;
        const card = state.player.battlefield.find(c => c.id === action.cardId);
        if (!card || !card.canAttack || card.tapped) return state;

        return {
            ...state,
            phase: 'targeting',
            selectedAttackerId: action.cardId,
            selectedDefenderId: null, // Reset defender selection
        };
    }

    case 'SELECT_DEFENDER': {
      if (state.phase !== 'targeting' || state.activePlayer !== 'player') return state;
      const opponentHasTaunt = state.opponent.battlefield.some(c => c.taunt && !c.tapped);

      // If targeting opponent directly
      if (action.cardId === 'opponent') {
        if (opponentHasTaunt) {
           return { ...state, log: [...state.log, { turn: state.turn, message: "Vous devez attaquer une créature avec Provocation."}] };
        }
        return { ...state, selectedDefenderId: 'opponent' };
      }
      
      // If targeting a creature
      const targetCard = state.opponent.battlefield.find(c => c.id === action.cardId);
      if(!targetCard) return state;

      if(opponentHasTaunt && !targetCard.taunt) {
        return { ...state, log: [...state.log, { turn: state.turn, message: "Vous devez attaquer une créature avec Provocation."}] };
      }

      return { ...state, selectedDefenderId: action.cardId };
    }


    case 'DECLARE_ATTACK': {
        if (state.phase !== 'targeting' || state.activePlayer !== 'player' || !state.selectedAttackerId || !state.selectedDefenderId) return state;
        return resolvePlayerCombat(state);
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
        isAttacking: false,
        taunt: c.skill?.type === 'taunt' ? false : c.taunt, // Reset taunt if it was an activated skill
        skill: c.skill ? { ...c.skill, used: false } : undefined,
      }));
       newState[currentPlayerKey].biomeChanges = 2;


      // Switch to next player
      const nextPlayerKey = currentPlayerKey === 'player' ? 'opponent' : 'player';
      const nextTurnNumber = nextPlayerKey === 'player' ? newState.turn + 1 : newState.turn;
      
      newState.turn = nextTurnNumber;
      newState.activePlayer = nextPlayerKey;
      newState.phase = 'main';
      newState.selectedCardId = null;
      newState.selectedAttackerId = null;
      newState.selectedDefenderId = null;
      
      // Draw card for the new turn player
      const { player: nextPlayerAfterDraw, log: logAfterDraw } = drawCards(newState[nextPlayerKey], 1, newState.log, nextTurnNumber);
      newState[nextPlayerKey] = nextPlayerAfterDraw;
      newState.log = [...logAfterDraw, { turn: nextTurnNumber, message: `Début du tour de ${nextPlayerKey === 'player' ? 'Joueur' : "l'Adversaire"}.` }];

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
