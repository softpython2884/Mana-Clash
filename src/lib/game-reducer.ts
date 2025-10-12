'use client';
import type { GameState, Card, Player, GamePhase } from './types';
import { createDeck } from '@/data/initial-cards';
import { useToast } from "@/hooks/use-toast";

export type GameAction =
  | { type: 'INITIALIZE_GAME' }
  | { type: 'RESTART_GAME' }
  | { type: 'DRAW_CARD'; player: 'player' | 'opponent' }
  | { type: 'PLAY_CARD'; cardId: string }
  | { type: 'TOGGLE_ATTACKER'; cardId: string }
  | { type: 'DECLARE_ATTACK' }
  | { type: 'RESOLVE_COMBAT'; blocks: { attackerId: string, blockerId: string }[] }
  | { type: 'PASS_TURN' }
  | { type: 'OPPONENT_TURN_START' }
  | { type: 'OPPONENT_ACTION'; action: () => GameState }
  | { type: 'OPPONENT_TURN_END' }
  | { type: 'LOG_MESSAGE'; message: string }
  | { type: 'CHANGE_PHASE', phase: GamePhase };

const drawCards = (player: Player, count: number): Player => {
  const drawnCards = player.deck.slice(0, count);
  const newDeck = player.deck.slice(count);
  const newHand = [...player.hand, ...drawnCards];
  return { ...player, deck: newDeck, hand: newHand };
};

const createInitialPlayer = (): Player => ({
    hp: 20, mana: 0, maxMana: 0, deck: [], hand: [], battlefield: [], graveyard: []
});


export const getInitialState = (): GameState => {
  return {
    gameId: 0,
    turn: 1,
    activePlayer: 'player',
    phase: 'main',
    player: createInitialPlayer(),
    opponent: createInitialPlayer(),
    log: [],
    isThinking: false,
  };
};

const shuffleAndDeal = (): Partial<GameState> => {
    const playerDeck = createDeck();
    const opponentDeck = createDeck();

    let player = drawCards({ ...createInitialPlayer(), deck: playerDeck }, 5);
    let opponent = drawCards({ ...createInitialPlayer(), deck: opponentDeck }, 5);
    
    return {
        gameId: Date.now(),
        turn: 1,
        activePlayer: 'player',
        phase: 'main',
        player,
        opponent,
        log: [{ turn: 1, message: "Le match commence!" }],
    }
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
             return { ...state, phase: action.phase, log: [...state.log, { turn: state.turn, message: `Phase de ${action.phase === 'combat' ? 'combat' : 'principale'}.`}] };
        }
        return state;

    case 'PLAY_CARD': {
      if (state.activePlayer !== 'player' || state.phase !== 'main') return state;
      const player = state.player;
      const cardIndex = player.hand.findIndex(c => c.id === action.cardId);
      if (cardIndex === -1) return state;

      const card = player.hand[cardIndex];
      let landPlayedThisTurn = player.battlefield.some(c => c.type === 'Land' && c.summoningSickness);

      if (card.type === 'Land' && landPlayedThisTurn) {
        return { ...state, log: [...state.log, { turn: state.turn, message: "Vous ne pouvez jouer qu'un terrain par tour." }] };
      }
      if (card.manaCost > player.mana) {
        return { ...state, log: [...state.log, { turn: state.turn, message: "Pas assez de mana." }] };
      }
      
      const newHand = player.hand.filter(c => c.id !== card.id);
      let newPlayerState = { ...player, hand: newHand };
      let newLog = state.log;
      
      if (card.type === 'Land') {
        newPlayerState.battlefield = [...player.battlefield, { ...card, summoningSickness: true }];
        newPlayerState.maxMana = player.maxMana + 1;
        // Tapping lands is not necessary with this logic
        // newPlayerState.mana = newPlayerState.maxMana;
        newLog = [...state.log, { turn: state.turn, message: `Joueur joue ${card.name}.` }];
      } else if (card.type === 'Creature') {
        newPlayerState.battlefield = [...player.battlefield, { ...card, summoningSickness: true, canAttack: false }];
        newPlayerState.mana -= card.manaCost;
        newLog = [...state.log, { turn: state.turn, message: `Joueur invoque ${card.name}.` }];
      } else if (card.type === 'Spell') {
        // Simple spell effect for now: heal
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
        let attackers = state.player.battlefield.filter(c => c.isAttacking);
        if (attackers.length === 0) {
             return { ...state, phase: 'main', log: [...state.log, { turn: state.turn, message: "Aucun attaquant déclaré." }] };
        }

        let newLog = [...state.log, { turn: state.turn, message: `Joueur attaque avec ${attackers.map(c=>c.name).join(', ')}.`}];

        let playerBattlefield = [...state.player.battlefield];
        let opponentBattlefield = [...state.opponent.battlefield];
        let playerGraveyard = [...state.player.graveyard];
        let opponentGraveyard = [...state.opponent.graveyard];
        let opponentHp = state.opponent.hp;

        const availableBlockers = opponentBattlefield.filter(c => c.type === 'Creature' && !c.tapped);
        let unblockedAttackers = [...attackers];

        if (availableBlockers.length > 0) {
            // Simple AI blocking logic: block the strongest attacker with the best available blocker
            attackers.sort((a, b) => (b.attack || 0) - (a.attack || 0));
            
            for (const attacker of attackers) {
                // Find a blocker that can survive or trade
                let bestBlocker = availableBlockers.find(b => (b.defense || 0) >= (attacker.attack || 0));
                // If not, find any blocker
                if (!bestBlocker && availableBlockers.length > 0) {
                    bestBlocker = availableBlockers.sort((a,b) => (b.attack || 0) - (a.attack || 0))[0];
                }

                if (bestBlocker) {
                    newLog.push({ turn: state.turn, message: `${bestBlocker.name} bloque ${attacker.name}.` });

                    const attackerRemainingHp = (attacker.defense || 0) - (bestBlocker.attack || 0);
                    const blockerRemainingHp = (bestBlocker.defense || 0) - (attacker.attack || 0);

                    if (attackerRemainingHp <= 0) {
                        newLog.push({ turn: state.turn, message: `${attacker.name} est détruit.` });
                        playerBattlefield = playerBattlefield.filter(c => c.id !== attacker.id);
                        playerGraveyard.push(attacker);
                    } else {
                        const attackerIndex = playerBattlefield.findIndex(c => c.id === attacker.id);
                        if(attackerIndex > -1) playerBattlefield[attackerIndex].defense = attackerRemainingHp;
                    }
                    
                    if (blockerRemainingHp <= 0) {
                        newLog.push({ turn: state.turn, message: `${bestBlocker.name} est détruit.` });
                        opponentBattlefield = opponentBattlefield.filter(c => c.id !== bestBlocker!.id);
                        opponentGraveyard.push(bestBlocker);
                    } else {
                         const blockerIndex = opponentBattlefield.findIndex(c => c.id === bestBlocker!.id);
                         if(blockerIndex > -1) opponentBattlefield[blockerIndex].defense = blockerRemainingHp;
                    }
                    
                    // Remove blocker and attacker from their respective groups for this combat phase
                    unblockedAttackers = unblockedAttackers.filter(a => a.id !== attacker.id);
                    const blockerIndexInAvailable = availableBlockers.findIndex(b => b.id === bestBlocker!.id);
                    if (blockerIndexInAvailable > -1) {
                        availableBlockers.splice(blockerIndexInAvailable, 1);
                    }
                }
            }
        }
        
        if (unblockedAttackers.length > 0) {
            const totalUnblockedDamage = unblockedAttackers.reduce((sum, c) => sum + (c.attack || 0), 0);
            opponentHp -= totalUnblockedDamage;
            newLog.push({ turn: state.turn, message: `L'adversaire subit ${totalUnblockedDamage} points de dégâts non bloqués.` });
        }

        const finalPlayerBattlefield = playerBattlefield.map(c => ({...c, isAttacking: false, tapped: attackers.some(a => a.id === c.id) ? true : c.tapped}));
        
        const winner = opponentHp <= 0 ? 'player' : undefined;

        return {
            ...state,
            player: {...state.player, battlefield: finalPlayerBattlefield, graveyard: playerGraveyard},
            opponent: {...state.opponent, hp: opponentHp, battlefield: opponentBattlefield, graveyard: opponentGraveyard},
            log: newLog,
            phase: winner ? 'game-over' : 'main',
            winner,
        }
    }

    case 'PASS_TURN': {
      if (state.phase === 'game-over') return state;
      const isPlayerTurn = state.activePlayer === 'player';
      const nextPlayer = isPlayerTurn ? 'opponent' : 'player';
      
      let newState = { ...state };
      
      // Untap current player's creatures and reset summoning sickness
      const current = isPlayerTurn ? 'player' : 'opponent';
      newState[current].battlefield = newState[current].battlefield.map(c => ({
        ...c,
        tapped: false,
        summoningSickness: false,
        canAttack: c.type === 'Creature',
      }));

      // Next player starts their turn
      const next = isPlayerTurn ? 'opponent' : 'player';
      const nextTurnNumber = isPlayerTurn ? state.turn : state.turn + 1;
      
      // Increase max mana
      newState[next].maxMana = Math.min(10, newState[next].maxMana + 1);
      // Refill mana
      newState[next].mana = newState[next].maxMana;

      // Draw a card
      const drawnCard = newState[next].deck[0];
      if(drawnCard) {
          newState[next].deck = newState[next].deck.slice(1);
          newState[next].hand = [...newState[next].hand, drawnCard];
      }

      return {
        ...newState,
        turn: nextTurnNumber,
        activePlayer: nextPlayer,
        phase: 'main',
        log: [...state.log, { turn: nextTurnNumber, message: `Début du tour de ${next === 'player' ? 'Joueur' : 'l\'Adversaire'}.` }],
        isThinking: nextPlayer === 'opponent',
      };
    }
    
    case 'OPPONENT_ACTION': {
        const nextState = action.action();
        return {...nextState, isThinking: false};
    }

    default:
      return state;
  }
}
