'use client';
import type { GameState, Card, Player, GamePhase, Buff, LogEntry } from './types';
import { createDeck, allCards } from '@/data/initial-cards';

const MAX_HAND_SIZE = 5;
const MAX_BATTLEFIELD_SIZE = 6;

export type GameAction =
  | { type: 'INITIALIZE_GAME' }
  | { type: 'RESTART_GAME' }
  | { type: 'DRAW_CARD'; player: 'player' | 'opponent'; count: number }
  | { type: 'PLAY_CARD'; cardId: string }
  | { type: 'CHANGE_BIOME'; cardId: string; player: 'player' | 'opponent' }
  | { type: 'SELECT_CARD'; cardId: string }
  | { type: 'SELECT_ATTACKER'; cardId: string }
  | { type: 'SELECT_DEFENDER'; cardId: string | 'opponent' }
  | { type: 'DECLARE_ATTACK' }
  | { type: 'CAST_SPELL_ON_TARGET'; targetId: string }
  | { type: 'PASS_TURN' }
  | { type: 'MEDITATE' }
  | { type: 'REDRAW_HAND' }
  | { type: 'EXECUTE_OPPONENT_TURN' }
  | { type: 'LOG_MESSAGE'; log: LogEntry }
  | { type: 'CHANGE_PHASE', phase: GamePhase }
  | { type: 'ACTIVATE_SKILL', cardId: string, targetId?: string };

const drawCards = (player: Player, count: number): Player => {
  const cardsToDrawCount = Math.max(0, MAX_HAND_SIZE - player.hand.length);
  const actualCount = Math.min(count, cardsToDrawCount);
  
  if (actualCount === 0) {
    return player;
  }

  const drawnCards = player.deck.slice(0, actualCount);
  const newDeck = player.deck.slice(actualCount);
  const newHand = [...player.hand, ...drawnCards];

  return { ...player, deck: newDeck, hand: newHand };
};

const createInitialPlayer = (id: 'player' | 'opponent'): Player => ({
    id,
    hp: 20, mana: 0, maxMana: 0, deck: [], hand: [], battlefield: [], graveyard: [], biomeChanges: 2, hasRedrawn: false,
});

const applyBiomeBuffs = (battlefield: Card[], biome: Card | null): Card[] => {
    if (!biome || !biome.biome) return battlefield;

    return battlefield.map(card => {
        // Create a new card object to avoid mutation
        const newCard = { ...card, buffs: card.buffs.filter(b => b.source !== 'biome') };
        
        if (newCard.type === 'Creature' && newCard.preferredBiome === biome.biome) {
            switch (biome.biome) {
                case 'Forest':
                    newCard.buffs.push({ type: 'armor', value: 1, duration: Infinity, source: 'biome' });
                    break;
                case 'Desert':
                case 'Mountain': // Let's group desert and mountain for attack
                    newCard.buffs.push({ type: 'attack', value: 1, duration: Infinity, source: 'biome' });
                    break;
                case 'Volcano':
                     newCard.buffs.push({ type: 'crit', value: 10, duration: Infinity, source: 'biome' });
                    break;
                case 'Ice':
                     newCard.buffs.push({ type: 'attack', value: 1, duration: Infinity, source: 'biome' });
                     newCard.buffs.push({ type: 'armor', value: 1, duration: Infinity, source: 'biome' });
                    break;
                // Sanctuary is handled at end of turn
            }
        }
        return newCard;
    });
};


export const getInitialState = (): GameState => {
  const defaultBiomeCard = allCards.find(c => c.id === 'forest_biome');
  if (!defaultBiomeCard) {
      throw new Error("Default biome card not found");
  }
  const initialState: GameState = {
    gameId: 0,
    turn: 1,
    activePlayer: 'player',
    phase: 'main',
    player: createInitialPlayer('player'),
    opponent: createInitialPlayer('opponent'),
    log: [],
    isThinking: false,
    activeBiome: { ...defaultBiomeCard, tapped: false, isAttacking: false, canAttack: false, summoningSickness: false, initialHealth: defaultBiomeCard.health, buffs: [] },
    winner: undefined,
    selectedCardId: null,
    selectedAttackerId: null,
    selectedDefenderId: null,
    spellBeingCast: null,
  };
  
  return initialState;
};

const shuffleAndDeal = (): Omit<GameState, 'gameId'> => {
    let player = createInitialPlayer('player');
    let opponent = createInitialPlayer('opponent');

    player.deck = createDeck();
    opponent.deck = createDeck();

    player = drawCards(player, 5);
    opponent = drawCards(opponent, 5);
    
    const defaultBiomeCard = allCards.find(c => c.id === 'forest_biome');
    
    return {
        turn: 1,
        activePlayer: 'player',
        phase: 'main',
        player: player,
        opponent: opponent,
        winner: undefined,
        log: [{ type: 'game_start', turn: 1, message: "Le match commence!" }],
        isThinking: false,
        activeBiome: defaultBiomeCard ? { ...defaultBiomeCard, tapped: false, isAttacking: false, canAttack: false, summoningSickness: false, initialHealth: defaultBiomeCard.health, buffs: []} : null,
        selectedCardId: null,
        selectedAttackerId: null,
        selectedDefenderId: null,
        spellBeingCast: null,
    }
}

const resolveDamage = (attacker: Card, defender: Card, log: GameState['log'], turn: number, owner: Player): { attacker: Card, defender: Card, owner: Player, log: GameState['log']} => {
    const newLog = [...log];
    const newAttacker = {...attacker};
    const newDefender = {...defender};
    const newOwner = {...owner};

    const totalAttack = (newAttacker.attack || 0) + (newAttacker.buffs?.filter(b => b.type === 'attack').reduce((acc, b) => acc + b.value, 0) || 0);
    const totalArmor = (newDefender.armor || 0) + (newDefender.buffs?.filter(b => b.type === 'armor').reduce((acc, b) => acc + b.value, 0) || 0);
    const totalCritChance = (newAttacker.criticalHitChance || 0) + (newAttacker.buffs?.filter(b => b.type === 'crit').reduce((acc, b) => acc + b.value, 0) || 0);

    const isCritical = Math.random() * 100 < totalCritChance;
    let damageDealt = totalAttack;
    
    newLog.push({ type: 'combat', turn, message: `${newAttacker.name} attaque avec ${damageDealt} points de dégâts.` });

    if (isCritical) {
        newLog.push({ type: 'combat', turn, message: `💥 Coup critique ! L'armure de ${newDefender.name} est ignorée.` });
        newDefender.health = (newDefender.health || 0) - damageDealt;
        newLog.push({ type: 'damage', turn, message: `${newDefender.name} subit ${damageDealt} dégâts directs. PV restants: ${newDefender.health}` });
    } else {
        const damageAfterArmor = Math.max(0, damageDealt - totalArmor);
        const absorbedDamage = damageDealt - damageAfterArmor;

        if (absorbedDamage > 0) {
            newDefender.armor = Math.max(0, totalArmor - damageDealt);
            newLog.push({ type: 'combat', turn, message: `${newDefender.name} absorbe ${absorbedDamage} dégâts. Armure restante: ${newDefender.armor}` });
        }
        
        if (damageAfterArmor > 0) {
            newDefender.health = (newDefender.health || 0) - damageAfterArmor;
            newLog.push({ type: 'damage', turn, message: `${newDefender.name} subit ${damageAfterArmor} dégâts. PV restants: ${newDefender.health}` });
        }
    }

    if (newAttacker.skill?.type === 'lifesteal') {
        const healedAmount = Math.ceil(damageDealt / 2);
        newOwner.hp = Math.min(20, newOwner.hp + healedAmount);
        newLog.push({ type: 'heal', turn, message: `Vol de vie: ${newAttacker.name} soigne son propriétaire de ${healedAmount} PV.` });
    }

    return { attacker: newAttacker, defender: newDefender, owner: newOwner, log: newLog };
};


const opponentAI = (state: GameState): GameState => {
  let tempState = { ...state };
  let opponent = { ...tempState.opponent };
  let player = { ...tempState.player };
  let log = [...tempState.log];
  const turn = tempState.turn;

  // --- Main Phase ---

  // Decide whether to redraw hand
  const handValue = opponent.hand.reduce((sum, card) => sum + (card.attack || 0) + (card.health || 0), 0);
  if (!opponent.hasRedrawn && handValue < 5 && opponent.hand.length > 3) {
      log.push({ type: 'info', turn, message: 'Adversaire choisit de piocher une nouvelle main.' });
      return gameReducer(tempState, { type: 'REDRAW_HAND' });
  }
  
  // Decide whether to meditate
  if (opponent.hand.length < 2 && opponent.graveyard.length > 2 && opponent.mana < 4) {
    log.push({ type: 'info', turn, message: 'Adversaire choisit de méditer.' });
    // This action will trigger a PASS_TURN with the meditate flag, so we can stop here.
    return gameReducer(tempState, { type: 'MEDITATE' });
  }


  // 1. Play Land if possible
  const landPlayedThisTurn = opponent.battlefield.some((c: Card) => c.type === 'Land' && c.summoningSickness);
  if (!landPlayedThisTurn) {
      const landInHand = opponent.hand.find((c: Card) => c.type === 'Land');
      if (landInHand) {
          log.push({ type: 'play', turn: tempState.turn, message: `Adversaire joue ${landInHand.name}.` });
          opponent.battlefield = [...opponent.battlefield, { ...landInHand, summoningSickness: true, buffs: [] }];
          opponent.hand = opponent.hand.filter((c: Card) => c.id !== landInHand.id);
          opponent.maxMana += 1;
          opponent.mana = opponent.maxMana;
      }
  }

  // 2. Play Creatures to establish board presence
  let playedCardInLoop = true;
  while(playedCardInLoop) {
      playedCardInLoop = false;
      const currentCreatureCount = opponent.battlefield.filter((c: Card) => c.type === 'Creature').length;
      
      // Objective: have at least 2 creatures if possible
      if (currentCreatureCount < 2 && opponent.hand.length > 0 && opponent.battlefield.length < MAX_BATTLEFIELD_SIZE) {
          const playableCreatures = opponent.hand
              .filter((c: Card) => c.type === 'Creature' && c.manaCost <= opponent.mana)
              .sort((a: Card, b: Card) => a.manaCost - b.manaCost); // Prioritize cheaper creatures to fill the board

          if (playableCreatures.length > 0) {
              const cardToPlay = playableCreatures[0];
              log.push({ type: 'play', turn: tempState.turn, message: `Adversaire joue ${cardToPlay.name}.` });
              let newCardOnField = { ...cardToPlay, summoningSickness: true, canAttack: false, buffs: [] };
              opponent.battlefield = [...opponent.battlefield, newCardOnField];
              opponent.hand = opponent.hand.filter((c: Card) => c.id !== cardToPlay.id);
              opponent.mana -= cardToPlay.manaCost;
              
              opponent.battlefield = applyBiomeBuffs(opponent.battlefield, tempState.activeBiome);
              playedCardInLoop = true; // A card was played, so we try again to meet the objective
          }
      }
  }
  
  // 3. Play other valuable cards (Artifacts, expensive creatures)
  let playedValuableCard = true;
  while(playedValuableCard) {
      playedValuableCard = false;
      if (opponent.battlefield.length >= MAX_BATTLEFIELD_SIZE) break;

      const playableCards = opponent.hand
          .filter((c: Card) => (c.type === 'Creature' || c.type === 'Artifact') && c.manaCost <= opponent.mana)
          .sort((a: Card, b: Card) => b.manaCost - a.manaCost);

      if (playableCards.length > 0) {
          const cardToPlay = playableCards[0];
          log.push({ type: 'play', turn: tempState.turn, message: `Adversaire joue ${cardToPlay.name}.` });
          let newCardOnField = { ...cardToPlay, summoningSickness: true, canAttack: false, buffs: [] };
          opponent.battlefield = [...opponent.battlefield, newCardOnField];
          opponent.hand = opponent.hand.filter((c: Card) => c.id !== cardToPlay.id);
          opponent.mana -= cardToPlay.manaCost;
          
          opponent.battlefield = applyBiomeBuffs(opponent.battlefield, tempState.activeBiome);
          playedValuableCard = true; // A card was played, so we try again
      }
  }

  // --- Combat Phase ---
  let attackers = opponent.battlefield.filter((c: Card) => c.type === 'Creature' && c.canAttack && !c.tapped);
  const playerTauntCreatures = player.battlefield.filter((c: Card) => c.taunt && !c.tapped);
  
  if (attackers.length > 0) {
    log.push({ type: 'phase', turn: tempState.turn, message: `Adversaire passe en phase de combat.` });
  }

  attackers.forEach((attacker: Card) => {
      let targetId: string | 'player' | null = null;
      let attackerCard = opponent.battlefield.find(c => c.id === attacker.id);
      if (!attackerCard) return; // Should not happen

      if(playerTauntCreatures.length > 0) {
          targetId = playerTauntCreatures.sort((a,b) => (a.health || 0) - (b.health || 0))[0].id;
      } else {
        const potentialBlockers = player.battlefield.filter((c: Card) => c.type === 'Creature' && !c.tapped);
        if (potentialBlockers.length > 0) {
           const killableTarget = potentialBlockers.find(p => (p.health || 0) <= ((attackerCard?.attack || 0) - (p.armor || 0)) );
           if(killableTarget) {
               targetId = killableTarget.id;
           } else {
              targetId = 'player'; 
           }
        } else {
          targetId = 'player';
        }
      }

      if (targetId) {
          if (targetId === 'player' && player.battlefield.filter(c => c.type === 'Creature' && !c.tapped).length > 0) {
              let defenderToAttack = player.battlefield.filter(c => c.type === 'Creature').sort((a,b) => (b.attack || 0) - (a.attack || 0))[0];
              targetId = defenderToAttack.id;
          }

          let defenderCard = player.battlefield.find((c: Card) => c.id === targetId);
          let newAttacker = { ...attackerCard }; // Work with a copy

          if (targetId === 'player') {
            log.push({ type: 'combat', turn: tempState.turn, message: `Adversaire: ${newAttacker.name} attaque le joueur directement.` });
            const totalAttack = (newAttacker.attack || 0) + (newAttacker.buffs?.filter(b => b.type === 'attack').reduce((acc, b) => acc + b.value, 0) || 0);
            player.hp -= totalAttack;
            log.push({ type: 'damage', turn: tempState.turn, message: `Joueur subit ${totalAttack} dégâts. PV restants: ${player.hp}.` });
          } else if (defenderCard) {
            let newDefender = { ...defenderCard }; // Work with a copy
            log.push({ type: 'combat', turn: tempState.turn, message: `Adversaire: ${newAttacker.name} attaque ${newDefender.name}.` });
            
            const combatResult = resolveDamage(newAttacker, newDefender, log, tempState.turn, opponent);
            
            opponent.battlefield = opponent.battlefield.map(c => c.id === newAttacker.id ? combatResult.attacker : c);
            player.battlefield = player.battlefield.map(c => c.id === newDefender.id ? combatResult.defender : c);
            opponent = combatResult.owner;
            log = combatResult.log;

            // Check for riposte only if defender survives
            const finalDefenderState = player.battlefield.find(c => c.id === newDefender.id);
            if (finalDefenderState && (finalDefenderState.health || 0) > 0) {
               log.push({ type: 'combat', turn, message: `${finalDefenderState.name} riposte !` });
               const riposteResult = resolveDamage(finalDefenderState, newAttacker, log, tempState.turn, player);
               
               opponent.battlefield = opponent.battlefield.map(c => c.id === newAttacker.id ? riposteResult.defender : c);
               player.battlefield = player.battlefield.map(c => c.id === finalDefenderState.id ? riposteResult.attacker : c);
               player = riposteResult.owner;
               log = riposteResult.log;
            }
          }
          
          opponent.battlefield = opponent.battlefield.map(c => c.id === attacker.id ? {...c, tapped: true, canAttack: false} : c);
      }
  });

    const updateField = (p: Player, owner: string): Player => {
        const graveyard = [...p.graveyard];
        const remainingCreatures = p.battlefield.filter(c => {
            if ((c.health || 0) <= 0) {
                log.push({ type: 'destroy', turn: tempState.turn, message: `${c.name} (${owner}) est détruit.` });
                graveyard.push({...c, health: c.initialHealth, buffs: []});
                return false;
            }
            return true;
        });
        return {...p, battlefield: remainingCreatures, graveyard};
    };

    player = updateField(player, "Joueur");
    opponent = updateField(opponent, "Adversaire");

    if (player.hp <= 0) {
        tempState.winner = 'opponent';
        tempState.phase = 'game-over';
        log.push({ type: 'game_over', turn: tempState.turn, message: "Le joueur a été vaincu."})
    } else if (opponent.hp <= 0) {
        tempState.winner = 'player';
        tempState.phase = 'game-over';
        log.push({ type: 'game_over', turn: tempState.turn, message: "L'adversaire a été vaincu."})
    }

  tempState.player = player;
  tempState.opponent = opponent;
  tempState.log = log;

  return tempState;
};

const resolvePlayerCombat = (state: GameState): GameState => {
    let newState = {...state};
    let { player, opponent, selectedAttackerId, selectedDefenderId, log, turn } = newState;

    const attackerCard = player.battlefield.find((c: Card) => c.id === selectedAttackerId);
    if (!attackerCard) return state;

    let finalLog = [...log];
    let finalPlayer = { ...player };
    let finalOpponent = { ...opponent };

    if (selectedDefenderId === 'opponent') {
        finalLog.push({ type: 'combat', turn: turn, message: `Joueur: ${attackerCard.name} attaque l'adversaire directement !` });
        const totalAttack = (attackerCard.attack || 0) + (attackerCard.buffs?.filter(b => b.type === 'attack').reduce((acc, b) => acc + b.value, 0) || 0);
        finalOpponent.hp -= totalAttack;
        finalLog.push({ type: 'damage', turn: turn, message: `Adversaire subit ${totalAttack} dégâts. PV restants: ${finalOpponent.hp}.` });
    } else {
        const defenderCard = opponent.battlefield.find((c: Card) => c.id === selectedDefenderId);
        if (!defenderCard) return state;
        
        let newAttacker = { ...attackerCard };
        let newDefender = { ...defenderCard };

        finalLog.push({ type: 'combat', turn: turn, message: `Joueur: ${newAttacker.name} attaque ${newDefender.name}.` });

        // --- Perform Combat ---
        const combatResult = resolveDamage(newAttacker, newDefender, finalLog, turn, finalPlayer);
        newAttacker = combatResult.attacker;
        newDefender = combatResult.defender;
        finalPlayer = combatResult.owner;
        finalLog = combatResult.log;

        
        // --- Riposte (Retaliation) ---
        if ((newDefender.health || 0) > 0) {
            finalLog.push({ type: 'combat', turn: turn, message: `${newDefender.name} riposte !` });
            let riposteResult = resolveDamage(newDefender, newAttacker, finalLog, turn, finalOpponent);
            newAttacker = riposteResult.defender;
            newDefender = riposteResult.attacker;
            finalOpponent = riposteResult.owner;
            finalLog = riposteResult.log;
        }


        // --- Update battlefield from copies ---
        finalOpponent.battlefield = finalOpponent.battlefield.map(c => c.id === newDefender.id ? newDefender : c);
        finalPlayer.battlefield = finalPlayer.battlefield.map(c => c.id === newAttacker.id ? newAttacker : c);
    }
    
    // --- Tap the attacker ---
    finalPlayer.battlefield = finalPlayer.battlefield.map(c => {
        if (c.id === selectedAttackerId) {
            return { ...c, tapped: true, canAttack: false };
        }
        return c;
    });

    // --- Clean up dead cards ---
    const cleanBattlefield = (p: Player, ownerName: string) => {
        const graveyard = [...p.graveyard];
        const battlefield = p.battlefield.filter(c => {
            if ((c.health || 0) <= 0) {
                finalLog.push({ type: 'destroy', turn: turn, message: `${c.name} (${ownerName}) est détruit.` });
                graveyard.push({ ...c, health: c.initialHealth, buffs: [] });
                return false;
            }
            return true;
        });
        return { ...p, battlefield, graveyard };
    };

    finalPlayer = cleanBattlefield(finalPlayer, "Joueur");
    finalOpponent = cleanBattlefield(finalOpponent, "Adversaire");
    
    // --- Check for winner ---
    let winner;
    if (finalOpponent.hp <= 0) {
        winner = 'player';
        finalLog.push({ type: 'game_over', turn: turn, message: "L'adversaire a été vaincu."})
    } else if (finalPlayer.hp <= 0) {
        winner = 'opponent';
        finalLog.push({ type: 'game_over', turn: turn, message: "Le joueur a été vaincu."})
    }

    return {
      ...newState,
      log: finalLog,
      player: finalPlayer,
      opponent: finalOpponent,
      winner,
      phase: winner ? 'game-over' : 'combat',
      selectedAttackerId: null,
      selectedDefenderId: null,
    };
}


export function gameReducer(state: GameState, action: GameAction): GameState {
  if (state.phase === 'game-over' && action.type !== 'RESTART_GAME' && action.type !== 'INITIALIZE_GAME') {
    return state;
  }

  // Helper to remove skillJustUsed flag from all cards
  const clearSkillFeedback = (player: Player): Player => ({
    ...player,
    battlefield: player.battlefield.map(c => ({ ...c, skillJustUsed: false })),
  });
  
  const stateWithClearedFeedback = {
    ...state,
    player: clearSkillFeedback(state.player),
    opponent: clearSkillFeedback(state.opponent),
  };


  switch (action.type) {
    case 'INITIALIZE_GAME': {
        const initialState = shuffleAndDeal();
        const player = {
            ...initialState.player,
            maxMana: 1,
            mana: 1,
        };
        return {
            ...state,
            ...initialState,
            gameId: Date.now(),
            player,
        };
    }

    case 'RESTART_GAME': {
      const initialState = shuffleAndDeal();
       const player = {
            ...initialState.player,
            maxMana: 1,
            mana: 1,
        };
      return {
        ...state,
        ...initialState,
        gameId: Date.now(),
        player,
      };
    }

    case 'DRAW_CARD': {
        const { player: playerKey, count } = action;
        let playerToUpdate = {...stateWithClearedFeedback[playerKey]};
        const updatedPlayer = drawCards(playerToUpdate, count);
        let log = [...stateWithClearedFeedback.log];
        if (updatedPlayer.hand.length === playerToUpdate.hand.length && count > 0) {
          log.push({ type: 'info', turn: stateWithClearedFeedback.turn, message: `${playerKey === 'player' ? "Votre" : "Sa"} main est pleine, la carte est défaussée.`});
        }
        return {
            ...stateWithClearedFeedback,
            [playerKey]: updatedPlayer,
            log
        };
    }

    case 'LOG_MESSAGE':
      if (!action.log) return state;
      return {
        ...state,
        log: [...state.log, action.log],
      };

    case 'SELECT_CARD': {
        if (stateWithClearedFeedback.activePlayer !== 'player' || stateWithClearedFeedback.phase !== 'main') return stateWithClearedFeedback;
        if (stateWithClearedFeedback.selectedCardId && stateWithClearedFeedback.selectedCardId === action.cardId) {
            return { ...stateWithClearedFeedback, selectedCardId: null }; // Deselect
        } else {
            return { ...stateWithClearedFeedback, selectedCardId: action.cardId };
        }
    }

    case 'ACTIVATE_SKILL': {
        if (stateWithClearedFeedback.activePlayer !== 'player' || stateWithClearedFeedback.phase !== 'main') return stateWithClearedFeedback;
        let player = {...stateWithClearedFeedback.player};
        let log = [...stateWithClearedFeedback.log];
        const cardIndex = player.battlefield.findIndex((c:Card) => c.id === action.cardId);
        if (cardIndex === -1) return stateWithClearedFeedback;

        let card = {...player.battlefield[cardIndex]};
        if (!card.skill || card.skill.used || card.summoningSickness || card.tapped) return stateWithClearedFeedback;
        
        let logEntry: LogEntry | null = null;

        switch(card.skill.type) {
            case 'taunt':
                card.taunt = true;
                logEntry = { type: 'skill', turn: stateWithClearedFeedback.turn, message: `Joueur active la compétence Provocation de ${card.name}!` };
                break;
            case 'heal':
                if(action.targetId) {
                    const targetIndex = player.battlefield.findIndex((c:Card) => c.id === action.targetId);
                    if (targetIndex > -1) {
                        const targetCard = {...player.battlefield[targetIndex]};
                        targetCard.health = Math.min(targetCard.initialHealth || 0, (targetCard.health || 0) + (card.skill.value || 0));
                        player.battlefield[targetIndex] = targetCard;
                        logEntry = { type: 'heal', turn: stateWithClearedFeedback.turn, message: `${card.name} soigne ${targetCard.name} de ${card.skill.value} PV.` };
                    }
                } else {
                  // For now, let's assume self-heal if no target
                  card.health = Math.min(card.initialHealth || 0, (card.health || 0) + (card.skill.value || 0));
                  logEntry = { type: 'heal', turn: stateWithClearedFeedback.turn, message: `${card.name} se soigne de ${card.skill.value} PV.` };
                }
                break;
            case 'draw':
                const drawnState = gameReducer(stateWithClearedFeedback, { type: 'DRAW_CARD', player: 'player', count: 1 });
                player = drawnState.player;
                log = drawnState.log;
                logEntry = { type: 'draw', turn: stateWithClearedFeedback.turn, message: `${card.name} fait piocher une carte.` };
                break;
            default:
                return stateWithClearedFeedback;
        }
        
        card.skill.used = true;
        card.tapped = true;
        card.skillJustUsed = true; // For visual feedback

        player.battlefield[cardIndex] = card;
        return { 
            ...stateWithClearedFeedback,
            player,
            log: logEntry ? [...log, logEntry] : log,
            selectedCardId: null, // Deselect card after using skill
        };
    }

    case 'CHANGE_PHASE':
        if (stateWithClearedFeedback.activePlayer === 'player') {
             if (action.phase === 'combat' && stateWithClearedFeedback.player.battlefield.filter(c => c.canAttack && !c.tapped).length === 0) {
                 return { ...stateWithClearedFeedback, log: [...stateWithClearedFeedback.log, { type: 'info', turn: stateWithClearedFeedback.turn, message: "Aucune créature ne peut attaquer."}] };
             }
              else if (action.phase === 'main') {
                return { ...stateWithClearedFeedback, phase: 'main', selectedAttackerId: null, selectedDefenderId: null, selectedCardId: null };
            } else {
                return { ...stateWithClearedFeedback, phase: action.phase, log: [...stateWithClearedFeedback.log, { type: 'phase', turn: stateWithClearedFeedback.turn, message: `Phase de ${action.phase}.`}] };
            }
        }
        return stateWithClearedFeedback;

    case 'CHANGE_BIOME': {
        const { cardId, player: playerKey } = action;
        const player = {...stateWithClearedFeedback[playerKey]};

        const cardFromHand = player.hand.find((c: Card) => c.id === cardId);

        if (player.biomeChanges <= 0 || !cardFromHand || cardFromHand.type !== 'Biome') return stateWithClearedFeedback;

        const newHand = player.hand.filter((c: Card) => c.id !== cardId);
        const oldBiome = stateWithClearedFeedback.activeBiome;
        const newGraveyard = oldBiome ? [...player.graveyard, oldBiome] : player.graveyard;
        
        const newPlayerState = {
          ...player,
          hand: newHand,
          graveyard: newGraveyard,
          mana: player.mana + 1,
          biomeChanges: player.biomeChanges - 1,
        };
        
        const newActiveBiome = cardFromHand;
        
        let newState = {
            ...stateWithClearedFeedback,
            [playerKey]: newPlayerState,
            activeBiome: newActiveBiome,
            log: [...stateWithClearedFeedback.log, { type: 'biome', turn: stateWithClearedFeedback.turn, message: `${playerKey === 'player' ? 'Joueur' : 'Adversaire'} change le biome pour ${newActiveBiome.name} et gagne 1 mana.` }]
        };

        // Apply buffs to all creatures on the board
        newState.player.battlefield = applyBiomeBuffs(newState.player.battlefield, newActiveBiome);
        newState.opponent.battlefield = applyBiomeBuffs(newState.opponent.battlefield, newActiveBiome);
        return newState;
    }

    case 'PLAY_CARD': {
      if (state.activePlayer !== 'player' || (state.phase !== 'main' && state.phase !== 'post_mulligan')) return state;
      
      let player = {...state.player};
      const cardIndex = player.hand.findIndex((c: Card) => c.id === action.cardId);
      if (cardIndex === -1) return state;

      const card = player.hand[cardIndex];
      let hasPlayedLand = player.battlefield.some((c: Card) => c.type === 'Land' && c.summoningSickness);

      if (card.type === 'Land' && hasPlayedLand) {
        return { ...state, log: [...state.log, { type: 'info', turn: state.turn, message: "Vous ne pouvez jouer qu'un terrain par tour." }]};
      }
      if (card.manaCost > player.mana) {
        return { ...state, log: [...state.log, { type: 'info', turn: state.turn, message: "Pas assez de mana." }]};
      }
      const battlefieldCardCount = player.battlefield.filter((c: Card) => c.type === 'Creature' || c.type === 'Artifact').length;
      if ((card.type === 'Creature' || card.type === 'Artifact') && battlefieldCardCount >= MAX_BATTLEFIELD_SIZE) {
        return { ...state, log: [...state.log, { type: 'info', turn: state.turn, message: "Vous avez trop de cartes sur le terrain." }]};
      }
      if (card.type === 'Biome') {
          return gameReducer(state, { type: 'CHANGE_BIOME', cardId: card.id, player: 'player' });
      }
      
      const newHand = player.hand.filter((c: Card) => c.id !== card.id);
      const newMana = player.mana - card.manaCost;
      let newLog = [...state.log, { type: 'play', turn: state.turn, message: `Joueur joue ${card.name}.` }];
      
      let newPlayerState = {...player, hand: newHand, mana: newMana};
      let tempNewState: GameState = {...state, log: newLog };

      const newCardState: Card = { ...card, summoningSickness: true, canAttack: false, buffs: [] };

      if (card.type === 'Land') {
        newPlayerState.battlefield = [...newPlayerState.battlefield, newCardState];
        newPlayerState.maxMana = newPlayerState.maxMana + 1;
        newPlayerState.mana = newPlayerState.maxMana;
      } else if (card.type === 'Creature' || card.type === 'Artifact') {
        newPlayerState.battlefield = [...newPlayerState.battlefield, newCardState];
        newPlayerState.battlefield = applyBiomeBuffs(newPlayerState.battlefield, tempNewState.activeBiome);

        if (card.type === 'Artifact' && card.skill?.type === 'global_buff_armor') {
            newPlayerState.battlefield = newPlayerState.battlefield.map((c: Card) => {
                if (c.type === 'Creature') {
                    return {...c, buffs: [...c.buffs, { type: 'armor', value: card.skill.value || 0, duration: card.skill.duration || 0, source: 'artifact' }]};
                }
                return c;
            });
            tempNewState.log.push({ type: 'buff', turn: state.turn, message: `${card.name} donne +${card.skill.value} armure à toutes les créatures.` });
        }
      } else if (card.type === 'Spell' || card.type === 'Enchantment' || card.type === 'Potion') {
        if (card.skill?.target === 'opponent_creature') {
            return {
                ...tempNewState,
                player: newPlayerState,
                phase: 'spell_targeting',
                spellBeingCast: card,
            };
        }
        if(card.id.startsWith('health_potion')) {
            newPlayerState.hp = Math.min(20, newPlayerState.hp + 5);
            tempNewState.log.push({ type: 'heal', turn: state.turn, message: `Joueur se soigne de 5 PV.` });
        } else if (card.id.startsWith('mana_potion')) {
            newPlayerState.mana = newPlayerState.mana + 2;
            tempNewState.log.push({ type: 'mana', turn: state.turn, message: `Joueur gagne 2 mana.` });
        } else if (card.skill?.target === 'friendly_creature' && tempNewState.selectedCardId) {
            const targetIndex = newPlayerState.battlefield.findIndex((c: Card) => c.id === tempNewState.selectedCardId);
            if (targetIndex > -1) {
                const targetCard = {...newPlayerState.battlefield[targetIndex]};
                let newBuffs = [...targetCard.buffs];
                if (card.skill.type === 'buff_attack') {
                    newBuffs.push({ type: 'attack', value: card.skill.value || 0, duration: card.skill.duration || 0, source: 'spell' });
                }
                if (card.skill.type === 'buff_armor') {
                    newBuffs.push({ type: 'armor', value: card.skill.value || 0, duration: card.skill.duration || 0, source: 'spell' });
                }
                targetCard.buffs = newBuffs;
                newPlayerState.battlefield[targetIndex] = targetCard;
                tempNewState.log.push({ type: 'spell', turn: state.turn, message: `${card.name} est lancé sur ${targetCard.name}.` });
            }
        }
        newPlayerState.graveyard = [...newPlayerState.graveyard, card];
      }

      const finalState = {
        ...tempNewState,
        player: newPlayerState,
        selectedCardId: null,
      };

      if (state.phase === 'post_mulligan') {
        return gameReducer(finalState, { type: 'PASS_TURN' });
      }

      return finalState;
    }
    
    case 'SELECT_ATTACKER': {
        if (stateWithClearedFeedback.phase !== 'combat' || stateWithClearedFeedback.activePlayer !== 'player') return stateWithClearedFeedback;
        const card = stateWithClearedFeedback.player.battlefield.find(c => c.id === action.cardId);
        if (!card || !card.canAttack || card.tapped) return stateWithClearedFeedback;

        return {
            ...stateWithClearedFeedback,
            phase: 'targeting',
            selectedAttackerId: action.cardId,
            selectedDefenderId: null,
        };
    }

    case 'SELECT_DEFENDER': {
        if (stateWithClearedFeedback.phase !== 'targeting' || stateWithClearedFeedback.activePlayer !== 'player') return stateWithClearedFeedback;
        const opponentHasTaunt = stateWithClearedFeedback.opponent.battlefield.some(c => c.taunt && !c.tapped);
        const opponentHasCreatures = stateWithClearedFeedback.opponent.battlefield.filter(c => c.type === 'Creature' && !c.tapped).length > 0;
        
        if (action.cardId === 'opponent') {
            if (opponentHasTaunt) {
                return { ...stateWithClearedFeedback, log: [...stateWithClearedFeedback.log, { type: 'info', turn: stateWithClearedFeedback.turn, message: "Vous devez attaquer une créature avec Provocation."}] };
            }
            if (opponentHasCreatures) {
                return { ...stateWithClearedFeedback, log: [...stateWithClearedFeedback.log, { type: 'info', turn: stateWithClearedFeedback.turn, message: "Vous ne pouvez pas attaquer le joueur directement s'il a des créatures."}] };
            }
            return { ...stateWithClearedFeedback, selectedDefenderId: 'opponent' };
        }
      
        const targetCard = stateWithClearedFeedback.opponent.battlefield.find(c => c.id === action.cardId);
        if(!targetCard || targetCard.type !== 'Creature') return stateWithClearedFeedback;

        if(opponentHasTaunt && !targetCard.taunt) {
            return { ...stateWithClearedFeedback, log: [...stateWithClearedFeedback.log, { type: 'info', turn: stateWithClearedFeedback.turn, message: "Vous devez attaquer une créature avec Provocation."}] };
        }

        return { ...stateWithClearedFeedback, selectedDefenderId: action.cardId };
    }

    case 'CAST_SPELL_ON_TARGET': {
      if (stateWithClearedFeedback.phase !== 'spell_targeting' || !stateWithClearedFeedback.spellBeingCast || stateWithClearedFeedback.activePlayer !== 'player') return stateWithClearedFeedback;

      const { targetId } = action;
      const spell = stateWithClearedFeedback.spellBeingCast;
      let opponent = { ...stateWithClearedFeedback.opponent };
      let log = [...stateWithClearedFeedback.log];
      const turn = stateWithClearedFeedback.turn;

      const targetIndex = opponent.battlefield.findIndex(c => c.id === targetId);
      if (targetIndex === -1) {
        return { ...stateWithClearedFeedback, phase: 'main', spellBeingCast: null }; // Invalid target
      }

      let targetCard = { ...opponent.battlefield[targetIndex] };

      log.push({ type: 'spell', turn, message: `${stateWithClearedFeedback.player.id} lance ${spell.name} sur ${targetCard.name}.` });

      if (spell.skill?.type === 'damage') {
        targetCard.health = (targetCard.health || 0) - (spell.skill.value || 0);
        log.push({ type: 'damage', turn, message: `${targetCard.name} subit ${spell.skill.value} dégâts. PV restants: ${targetCard.health}` });
      }

      opponent.battlefield[targetIndex] = targetCard;

      const updateField = (p: Player, owner: string): Player => {
        let graveyard = [...p.graveyard];
        const remainingCreatures = p.battlefield.filter(c => {
          if ((c.health || 0) <= 0) {
            log.push({ type: 'destroy', turn, message: `${c.name} (${owner}) est détruit.` });
            graveyard.push({ ...c, health: c.initialHealth, buffs: [] });
            return false;
          }
          return true;
        });
        return { ...p, battlefield: remainingCreatures, graveyard };
      };

      opponent = updateField(opponent, "Adversaire");

      let player = { ...stateWithClearedFeedback.player };
      player.graveyard = [...player.graveyard, spell];

      return {
        ...stateWithClearedFeedback,
        opponent,
        player,
        log,
        phase: 'main',
        spellBeingCast: null,
      };
    }

    case 'DECLARE_ATTACK': {
        if (stateWithClearedFeedback.phase !== 'targeting' || stateWithClearedFeedback.activePlayer !== 'player' || !stateWithClearedFeedback.selectedAttackerId || !stateWithClearedFeedback.selectedDefenderId) return stateWithClearedFeedback;
        return resolvePlayerCombat(stateWithClearedFeedback);
    }
    
    case 'MEDITATE': {
      if (state.activePlayer !== 'player') return state;
      const player = state.player;
      if (player.graveyard.length === 0) {
        return {
          ...state,
          log: [...state.log, { type: 'info', turn: state.turn, message: 'Le cimetière est vide, impossible de méditer.' }]
        };
      }
      return gameReducer(state, { type: 'PASS_TURN' });
    }

    case 'REDRAW_HAND': {
      const activePlayerKey = state.activePlayer;
      let player = { ...state[activePlayerKey] };
      
      if (player.hasRedrawn) return state;

      // Shuffle hand back into deck
      player.deck.push(...player.hand);
      player.hand = [];
      for (let i = player.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [player.deck[i], player.deck[j]] = [player.deck[j], player.deck[i]];
      }

      // Draw 5 new cards
      player = drawCards(player, 5);
      player.hasRedrawn = true;

      return {
        ...state,
        [activePlayerKey]: player,
        phase: 'post_mulligan',
        log: [...state.log, { type: 'draw', turn: state.turn, message: `${activePlayerKey === 'player' ? 'Joueur' : 'Adversaire'} pioche une nouvelle main.` }]
      };
    }

    case 'PASS_TURN': {
      if (stateWithClearedFeedback.phase === 'game-over') return stateWithClearedFeedback;
      
      const currentPlayerKey = stateWithClearedFeedback.activePlayer;
      const nextPlayerKey = currentPlayerKey === 'player' ? 'opponent' : 'player';
      
      let currentPlayer = {...stateWithClearedFeedback[currentPlayerKey]};
      let currentLog = [...stateWithClearedFeedback.log];

      // Handle "Meditate" action before passing the turn
      if (state.phase === 'main' && (state.log.at(-1)?.message.includes('méditer') || action.type === 'MEDITATE')) {
        if(currentPlayer.graveyard.length > 0 && currentPlayer.hand.length < MAX_HAND_SIZE) {
          const randomIndex = Math.floor(Math.random() * currentPlayer.graveyard.length);
          const cardFromGraveyard = currentPlayer.graveyard[randomIndex];
          currentPlayer.hand.push(cardFromGraveyard);
          currentPlayer.graveyard.splice(randomIndex, 1);
          currentLog.push({type: 'draw', turn: stateWithClearedFeedback.turn, message: `${currentPlayerKey === 'player' ? 'Joueur' : 'Adversaire'} récupère ${cardFromGraveyard.name} du cimetière.`})
        }
      }

      let artifactsToRemove: string[] = [];
      let updatedBattlefield = currentPlayer.battlefield.map((c: Card) => {
        let newCard = {...c};
        if (c.type === 'Creature') {
          newCard.buffs = c.buffs.map((b: Buff) => ({ ...b, duration: b.duration - 1 })).filter((b: Buff) => b.duration > 0 || b.source === 'biome' || b.duration === Infinity);
        }
        if (c.type === 'Artifact') {
            newCard.duration = (c.duration || 0) - 1;
            if(newCard.duration <= 0) {
              artifactsToRemove.push(c.id);
              if (c.skill?.type === 'global_buff_armor') {
                  currentPlayer.battlefield.forEach((creature: Card) => {
                      if (creature.type === 'Creature') {
                          creature.buffs = creature.buffs.filter(b => b.source !== 'artifact');
                      }
                  });
              }
            }
        }
        return newCard;
      });

      let graveyardAdditions: Card[] = [];
      if(artifactsToRemove.length > 0){
        graveyardAdditions = updatedBattlefield.filter((c: Card) => artifactsToRemove.includes(c.id));
        updatedBattlefield = updatedBattlefield.filter((c: Card) => !artifactsToRemove.includes(c.id));
      }

      if (stateWithClearedFeedback.activeBiome?.biome === 'Sanctuary') {
          updatedBattlefield = updatedBattlefield.map((c: Card) => {
              if (c.type === 'Creature' && c.preferredBiome === 'Sanctuary' && c.health < c.initialHealth) {
                   const newHealth = Math.min(c.initialHealth!, (c.health || 0) + 1);
                   return {...c, health: newHealth};
              }
              return c;
          });
      }

      currentPlayer.battlefield = updatedBattlefield.map((c: Card) => ({
        ...c,
        tapped: false,
        summoningSickness: c.type === 'Creature' ? false : c.summoningSickness,
        canAttack: c.type === 'Creature',
        isAttacking: false,
        skill: c.skill ? { ...c.skill, used: false } : undefined,
      }));
      currentPlayer.graveyard = [...currentPlayer.graveyard, ...graveyardAdditions];
      currentPlayer.biomeChanges = 2;
      currentPlayer.hasRedrawn = false; // Reset mulligan flag for the turn


      const nextTurnNumber = nextPlayerKey === 'player' ? stateWithClearedFeedback.turn + 1 : stateWithClearedFeedback.turn;
      const drawState = gameReducer({...stateWithClearedFeedback, [currentPlayerKey]: currentPlayer, log: currentLog }, { type: 'DRAW_CARD', player: nextPlayerKey, count: 1 });
      let nextPlayerState = drawState[nextPlayerKey];
      
      nextPlayerState.maxMana = Math.min(10, nextPlayerState.maxMana + 1);
      nextPlayerState.mana = nextPlayerState.maxMana;
      
      let finalState = {
        ...stateWithClearedFeedback,
        turn: nextTurnNumber,
        activePlayer: nextPlayerKey,
        phase: 'main',
        selectedCardId: null,
        selectedAttackerId: null,
        selectedDefenderId: null,
        spellBeingCast: null,
        [currentPlayerKey]: currentPlayer,
        [nextPlayerKey]: nextPlayerState,
        log: [...drawState.log, { type: 'phase', turn: nextTurnNumber, message: `Début du tour de ${nextPlayerKey === 'player' ? 'Joueur' : "l'Adversaire"}.` }],
        isThinking: nextPlayerKey === 'opponent',
      };
      
      if(artifactsToRemove.length > 0) {
        finalState.log.push({ type: 'info', turn: finalState.turn, message: `L'effet de ${graveyardAdditions.map(c => c.name).join(', ')} se termine.` });
      }
      
      return finalState;
    }
    
    case 'EXECUTE_OPPONENT_TURN': {
      if (stateWithClearedFeedback.activePlayer !== 'opponent') return stateWithClearedFeedback;
      const finalStateFromAI = opponentAI(stateWithClearedFeedback);
      
      if(finalStateFromAI.phase === 'post_mulligan') {
        const playableCards = finalStateFromAI.opponent.hand.filter(c => c.manaCost <= finalStateFromAI.opponent.mana && c.type !== 'Spell');
        if (playableCards.length > 0) {
            const cardToPlay = playableCards.sort((a, b) => b.manaCost - a.manaCost)[0];
            const stateAfterPlay = gameReducer(finalStateFromAI, {type: 'PLAY_CARD', cardId: cardToPlay.id});
            return {
              ...stateAfterPlay,
              isThinking: false
            }
        }
        return gameReducer({...finalStateFromAI, isThinking: false }, {type: 'PASS_TURN'});
      }
      
      // If AI decided to meditate, it already called PASS_TURN, so we just return the new state
      if (finalStateFromAI.activePlayer === 'player') {
          return {
              ...finalStateFromAI,
              isThinking: false
          };
      }
      
      const passTurnAction: GameAction = { type: 'PASS_TURN' };
      
      let stateAfterAI = {
        ...finalStateFromAI,
        isThinking: false
      };

      return gameReducer(stateAfterAI, passTurnAction);
    }

    default:
      return stateWithClearedFeedback;
  }
}
