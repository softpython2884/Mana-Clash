'use client';
import type { GameState, Card, Player, GamePhase, Buff } from './types';
import { createDeck, allCards } from '@/data/initial-cards';

const MAX_HAND_SIZE = 5;
const MAX_BATTLEFIELD_SIZE = 6;

export type GameAction =
  | { type: 'INITIALIZE_GAME' }
  | { type: 'RESTART_GAME' }
  | { type: 'DRAW_CARD'; player: 'player' | 'opponent'; count: number }
  | { type: 'PLAY_CARD'; cardId: string }
  | { type: 'CHANGE_BIOME'; card: Card; player: 'player' | 'opponent' }
  | { type: 'SELECT_CARD'; cardId: string }
  | { type: 'SELECT_ATTACKER'; cardId: string }
  | { type: 'SELECT_DEFENDER'; cardId: string | 'opponent' }
  | { type: 'DECLARE_ATTACK' }
  | { type: 'PASS_TURN' }
  | { type: 'EXECUTE_OPPONENT_TURN' }
  | { type: 'LOG_MESSAGE'; message: string }
  | { type: 'CHANGE_PHASE', phase: GamePhase }
  | { type: 'ACTIVATE_SKILL', cardId: string, targetId?: string };

const drawCards = (player: Player, count: number, log: GameState['log'], turn: number): { player: Player, log: GameState['log'] } => {
  const cardsToDrawCount = Math.max(0, MAX_HAND_SIZE - player.hand.length);
  const actualCount = Math.min(count, cardsToDrawCount);
  
  if (actualCount === 0) {
    if (player.hand.length >= MAX_HAND_SIZE) {
      log.push({ turn, message: `${player.id === 'player' ? "Votre" : "Sa"} main est pleine, la carte est défaussée.`});
    }
    return { player, log };
  }

  const drawnCards = player.deck.slice(0, actualCount);
  const newDeck = player.deck.slice(actualCount);
  const newHand = [...player.hand, ...drawnCards];

  return { player: { ...player, deck: newDeck, hand: newHand }, log };
};

const createInitialPlayer = (id: 'player' | 'opponent'): Player => ({
    id,
    hp: 20, mana: 0, maxMana: 0, deck: [], hand: [], battlefield: [], graveyard: [], biomeChanges: 2,
});

const applyBiomeBuffs = (battlefield: Card[], biome: Card | null): Card[] => {
    if (!biome || !biome.biome) return battlefield;

    return battlefield.map(card => {
        // Remove old biome buffs first
        card.buffs = card.buffs.filter(b => b.source !== 'biome');
        
        if (card.type === 'Creature' && card.preferredBiome === biome.biome) {
            switch (biome.biome) {
                case 'Forest':
                    card.buffs.push({ type: 'armor', value: 1, duration: Infinity, source: 'biome' });
                    break;
                case 'Desert':
                case 'Mountain': // Let's group desert and mountain for attack
                    card.buffs.push({ type: 'attack', value: 1, duration: Infinity, source: 'biome' });
                    break;
                case 'Volcano':
                     card.buffs.push({ type: 'crit', value: 10, duration: Infinity, source: 'biome' });
                    break;
                case 'Ice':
                     card.buffs.push({ type: 'attack', value: 1, duration: Infinity, source: 'biome' });
                     card.buffs.push({ type: 'armor', value: 1, duration: Infinity, source: 'biome' });
                    break;
                // Sanctuary is handled at end of turn
            }
        }
        return card;
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
  };
  
  return initialState;
};

const shuffleAndDeal = (state: GameState): GameState => {
    let newState = JSON.parse(JSON.stringify(state));
    
    let player = createInitialPlayer('player');
    let opponent = createInitialPlayer('opponent');

    player.deck = createDeck();
    opponent.deck = createDeck();

    let initialLog = [{ turn: 1, message: "Le match commence!" }];

    const { player: playerAfterDraw, log: logAfterPlayerDraw } = drawCards(player, 5, initialLog, 1);

    const { player: opponentAfterDraw, log: logAfterOpponentDraw } = drawCards(opponent, 5, logAfterPlayerDraw, 1);
    
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
        activeBiome: defaultBiomeCard ? { ...defaultBiomeCard, tapped: false, isAttacking: false, canAttack: false, summoningSickness: false, initialHealth: defaultBiomeCard.health, buffs: []} : null,
        selectedCardId: null,
        selectedAttackerId: null,
        selectedDefenderId: null,
    }
}

const resolveDamage = (attacker: Card, defender: Card, log: any[], turn: number, owner: Player) => {
    const totalAttack = (attacker.attack || 0) + (attacker.buffs?.filter(b => b.type === 'attack').reduce((acc, b) => acc + b.value, 0) || 0);
    const totalArmor = (defender.armor || 0) + (defender.buffs?.filter(b => b.type === 'armor').reduce((acc, b) => acc + b.value, 0) || 0);
    const totalCritChance = (attacker.criticalHitChance || 0) + (attacker.buffs?.filter(b => b.type === 'crit').reduce((acc, b) => acc + b.value, 0) || 0);


    const isCritical = Math.random() * 100 < totalCritChance;
    let damageDealt = totalAttack;
    
    log.push({ turn, message: `${attacker.name} attaque avec ${damageDealt} points de dégâts.` });

    if (isCritical) {
        log.push({ turn, message: `💥 Coup critique ! L'armure de ${defender.name} est ignorée.` });
        defender.health = (defender.health || 0) - damageDealt;
        log.push({ turn, message: `${defender.name} subit ${damageDealt} dégâts directs. PV restants: ${defender.health}` });
    } else {
        const damageAfterArmor = Math.max(0, damageDealt - totalArmor);
        const absorbedDamage = damageDealt - damageAfterArmor;

        if (absorbedDamage > 0) {
            defender.armor = Math.max(0, totalArmor - damageDealt);
            log.push({ turn, message: `${defender.name} absorbe ${absorbedDamage} dégâts. Armure restante: ${defender.armor}` });
        }
        
        if (damageAfterArmor > 0) {
            defender.health = (defender.health || 0) - damageAfterArmor;
            log.push({ turn, message: `${defender.name} subit ${damageAfterArmor} dégâts. PV restants: ${defender.health}` });
        }
    }

    if (attacker.skill?.type === 'lifesteal') {
        const healedAmount = Math.ceil(damageDealt / 2);
        owner.hp = Math.min(20, owner.hp + healedAmount);
        log.push({ turn, message: `Vol de vie: ${attacker.name} soigne son propriétaire de ${healedAmount} PV.` });
    }

    return { attacker, defender };
};


const opponentAI = (state: GameState): GameState => {
  let tempState = JSON.parse(JSON.stringify(state)); 
  let opponent = tempState.opponent;
  let player = tempState.player;
  let log = tempState.log;
  const turn = tempState.turn;

  if (opponent.biomeChanges > 0) {
      const biomeCardInHand = opponent.hand.find((c: Card) => c.type === 'Biome' && c.biome !== tempState.activeBiome?.biome);
      if (biomeCardInHand) {
        tempState = gameReducer(tempState, { type: 'CHANGE_BIOME', card: biomeCardInHand, player: 'opponent' });
        opponent = tempState.opponent; // refresh reference
        log = tempState.log;
      }
  }

  const landPlayedThisTurn = opponent.battlefield.some((c: Card) => c.type === 'Land' && c.summoningSickness);
  if (!landPlayedThisTurn) {
      const landInHand = opponent.hand.find((c: Card) => c.type === 'Land');
      if (landInHand) {
          log.push({ turn: tempState.turn, message: `Adversaire joue ${landInHand.name}.` });
          opponent.battlefield.push({ ...landInHand, summoningSickness: true, buffs: [] });
          opponent.hand = opponent.hand.filter((c: Card) => c.id !== landInHand.id);
          opponent.maxMana += 1;
          opponent.mana = opponent.maxMana;
      }
  }

  let playedCard = true;
  while(playedCard) {
      const currentCreatureCount = opponent.battlefield.filter((c: Card) => c.type === 'Creature' || c.type === 'Artifact').length;
      if (currentCreatureCount >= MAX_BATTLEFIELD_SIZE) {
          playedCard = false;
          continue;
      }

      const playableCards = opponent.hand
          .filter((c: Card) => (c.type === 'Creature' || c.type === 'Artifact') && c.manaCost <= opponent.mana)
          .sort((a: Card, b: Card) => b.manaCost - a.manaCost); 

      if (playableCards.length > 0) {
          const cardToPlay = playableCards[0];
          log.push({ turn: tempState.turn, message: `Adversaire joue ${cardToPlay.name}.` });
          let newCardOnField = { ...cardToPlay, summoningSickness: true, canAttack: false, buffs: [] };
          opponent.battlefield.push(newCardOnField);
          opponent.hand = opponent.hand.filter((c: Card) => c.id !== cardToPlay.id);
          opponent.mana -= cardToPlay.manaCost;

          // Re-apply biome buffs for the new card
          tempState.opponent.battlefield = applyBiomeBuffs(opponent.battlefield, tempState.activeBiome);
      } else {
          playedCard = false;
      }
  }
  
  let attackers = opponent.battlefield.filter((c: Card) => c.type === 'Creature' && c.canAttack && !c.tapped);
  const playerTauntCreatures = player.battlefield.filter((c: Card) => c.taunt && !c.tapped);
  
  attackers.forEach((attacker: Card) => {
      let targetId: string | 'player' | null = null;
      let targetPlayerCard: Card | undefined = undefined;
      
      if(playerTauntCreatures.length > 0) {
          targetPlayerCard = playerTauntCreatures.sort((a,b) => (a.health || 0) - (b.health || 0))[0];
          targetId = targetPlayerCard.id;
      } else {
        let potentialBlockers = player.battlefield.filter((c: Card) => c.type === 'Creature' && !c.tapped);
        if (potentialBlockers.length > 0) {
           let killableTarget = potentialBlockers.find(p => (p.health || 0) <= (attacker.attack || 0));
           if(killableTarget) {
               targetPlayerCard = killableTarget;
           } else {
               targetPlayerCard = potentialBlockers.sort((a,b) => (b.attack || 0) - (a.attack || 0))[0];
           }
           targetId = targetPlayerCard.id;
        } else {
          targetId = 'player';
        }
      }

      if (targetId) {
          const attackerInBattlefield = opponent.battlefield.find((c: Card) => c.id === attacker.id);
          if (!attackerInBattlefield) return;

          if (targetId === 'player') {
            log.push({ turn: tempState.turn, message: `Adversaire: ${attacker.name} attaque le joueur directement.` });
            const totalAttack = (attacker.attack || 0) + (attacker.buffs?.filter(b => b.type === 'attack').reduce((acc, b) => acc + b.value, 0) || 0);
            player.hp -= totalAttack;
            log.push({ turn: tempState.turn, message: `Joueur subit ${totalAttack} dégâts. PV restants: ${player.hp}.` });
          } else if(targetPlayerCard) {
            const defenderInPlayerField = player.battlefield.find((c: Card) => c.id === targetPlayerCard!.id);
            if (!defenderInPlayerField) return;

            log.push({ turn: tempState.turn, message: `Adversaire: ${attacker.name} attaque ${defenderInPlayerField.name}.` });
            
            const defenderHealthBefore = defenderInPlayerField.health || 0;
            const attackResult = resolveDamage(attackerInBattlefield, defenderInPlayerField, log, tempState.turn, opponent);
            
            if((defenderInPlayerField.health || 0) > 0 && (defenderInPlayerField.health || 0) < defenderHealthBefore) {
               log.push({ turn, message: `${defenderInPlayerField.name} riposte !` });
               resolveDamage(defenderInPlayerField, attackerInBattlefield, log, tempState.turn, player);
            } else if ((defenderInPlayerField.health || 0) <= 0) {
               log.push({ turn, message: `${defenderInPlayerField.name} est détruit avant de pouvoir riposter.` });
            }
          }
          
          attackerInBattlefield.tapped = true;
          attackerInBattlefield.canAttack = false;
      }
  });

    const updateField = (p: Player, owner: string): Player => {
        const remainingCreatures = p.battlefield.filter(c => {
            if ((c.health || 0) <= 0) {
                log.push({ turn: tempState.turn, message: `${c.name} (${owner}) est détruit.` });
                p.graveyard.push({...c, health: c.initialHealth, buffs: []});
                return false;
            }
            return true;
        });
        return {...p, battlefield: remainingCreatures};
    };

    tempState.player = updateField(player, "Joueur");
    tempState.opponent = updateField(opponent, "Adversaire");

    if (tempState.player.hp <= 0) {
        tempState.winner = 'opponent';
        tempState.phase = 'game-over';
        log.push({ turn: tempState.turn, message: "Le joueur a été vaincu."})
    } else if (tempState.opponent.hp <= 0) {
        tempState.winner = 'player';
        tempState.phase = 'game-over';
        log.push({ turn: tempState.turn, message: "L'adversaire a été vaincu."})
    }

  return tempState;
};

const resolvePlayerCombat = (state: GameState): GameState => {
    let newState = JSON.parse(JSON.stringify(state));
    let { player, opponent, log, turn, selectedAttackerId, selectedDefenderId } = newState;

    const attacker = player.battlefield.find((c: Card) => c.id === selectedAttackerId);
    if (!attacker) return state;

    attacker.tapped = true;
    attacker.canAttack = false;

    if (selectedDefenderId === 'opponent') {
        log.push({ turn, message: `Joueur: ${attacker.name} attaque l'adversaire directement !` });
        const totalAttack = (attacker.attack || 0) + (attacker.buffs?.filter(b => b.type === 'attack').reduce((acc, b) => acc + b.value, 0) || 0);
        opponent.hp -= totalAttack;
        log.push({ turn, message: `Adversaire subit ${totalAttack} dégâts. PV restants: ${opponent.hp}.` });
    } 
    else {
        const defender = opponent.battlefield.find((c: Card) => c.id === selectedDefenderId);
        if (!defender) return state;
        
        log.push({ turn, message: `Joueur: ${attacker.name} attaque ${defender.name}.` });
        
        const defenderHealthBefore = defender.health || 0;
        resolveDamage(attacker, defender, log, turn, player);
        
        if ((defender.health || 0) > 0 && (defender.health || 0) < defenderHealthBefore) {
            log.push({ turn, message: `${defender.name} riposte !` });
            resolveDamage(defender, attacker, log, turn, opponent);
        } else if ((defender.health || 0) <= 0) {
            log.push({ turn, message: `${defender.name} est détruit avant de pouvoir riposter.` });
        }
    }

    const updateField = (p: Player, owner: string): Player => {
        const remainingCreatures = p.battlefield.filter(c => {
            if ((c.health || 0) <= 0) {
                log.push({ turn, message: `${c.name} (${owner}) est détruit.` });
                p.graveyard.push({...c, health: c.initialHealth, buffs: []});
                return false;
            }
            return true;
        });
        return {...p, battlefield: remainingCreatures};
    };
    
    newState.player = updateField(player, "Joueur");
    newState.opponent = updateField(opponent, "Adversaire");

    let winner;
    if (newState.opponent.hp <= 0) {
        winner = 'player';
        log.push({ turn, message: "L'adversaire a été vaincu."})
    } else if (newState.player.hp <= 0) {
        winner = 'opponent';
        log.push({ turn, message: "Le joueur a été vaincu."})
    }


    return {
      ...newState,
      winner,
      phase: winner ? 'game-over' : 'combat',
      selectedAttackerId: null,
      selectedDefenderId: null,
    };
}


export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'INITIALIZE_GAME': {
        let newState = getInitialState();
        newState = shuffleAndDeal(newState);
        newState.player.maxMana = 1;
        newState.player.mana = 1;
        return newState;
    }

    case 'RESTART_GAME': {
      let newState = getInitialState();
      newState = shuffleAndDeal(newState);
      newState.player.maxMana = 1;
      newState.player.mana = 1;
      return newState;
    }

    case 'DRAW_CARD': {
        const { player: playerKey, count } = action;
        const { player, log } = drawCards(state[playerKey], count, state.log, state.turn);
        return {
            ...state,
            [playerKey]: player,
            log
        };
    }

    case 'LOG_MESSAGE':
      if (!action.message) return state;
      return {
        ...state,
        log: [...state.log, { turn: state.turn, message: action.message }],
      };

    case 'SELECT_CARD': {
        if (state.activePlayer !== 'player' || state.phase !== 'main') return state;
        if (state.selectedCardId && state.selectedCardId === action.cardId) {
            return { ...state, selectedCardId: null }; // Deselect
        }
        return { ...state, selectedCardId: action.cardId };
    }

    case 'ACTIVATE_SKILL': {
        if (state.activePlayer !== 'player') return state;
        let player = { ...state.player };
        const cardIndex = player.battlefield.findIndex(c => c.id === action.cardId);
        if (cardIndex === -1) return state;

        const card = player.battlefield[cardIndex];
        if (!card.skill || card.skill.used || card.summoningSickness || card.tapped) return state;
        
        let logMessage = '';

        switch(card.skill.type) {
            case 'taunt':
                card.taunt = true;
                card.skill.used = true;
                card.tapped = true;
                logMessage = `Joueur active la compétence Provocation de ${card.name}!`;
                break;
            case 'heal':
                if(action.targetId) {
                    const targetIndex = player.battlefield.findIndex(c => c.id === action.targetId);
                    if (targetIndex > -1) {
                        const targetCard = player.battlefield[targetIndex];
                        targetCard.health = Math.min(targetCard.initialHealth || 0, (targetCard.health || 0) + (card.skill.value || 0));
                        card.skill.used = true;
                        card.tapped = true;
                        logMessage = `${card.name} soigne ${targetCard.name} de ${card.skill.value} PV.`;
                    }
                }
                break;
            case 'draw':
                const { player: playerAfterDraw, log: logAfterDraw } = drawCards(player, 1, state.log, state.turn);
                player = playerAfterDraw;
                state.log = logAfterDraw;
                card.skill.used = true;
                card.tapped = true;
                logMessage = `${card.name} fait piocher une carte.`;
                break;
            default:
                return state;
        }

        player.battlefield[cardIndex] = card;
        return { 
            ...state, 
            player,
            selectedCardId: null, // Deselect card after using skill
            log: [...state.log, { turn: state.turn, message: logMessage }]
        };
    }

    case 'CHANGE_PHASE':
        if (state.activePlayer === 'player') {
             if (action.phase === 'combat' && state.player.battlefield.filter(c => c.canAttack && !c.tapped).length === 0) {
                 return { ...state, log: [...state.log, { turn: state.turn, message: "Aucune créature ne peut attaquer."}] };
             }
              if (action.phase === 'main') {
                return { ...state, phase: 'main', selectedAttackerId: null, selectedDefenderId: null, selectedCardId: null };
            }
             return { ...state, phase: action.phase, log: [...state.log, { turn: state.turn, message: `Phase de ${action.phase}.`}] };
        }
        return state;

    case 'CHANGE_BIOME': {
        const { card, player: playerKey } = action;
        let newState = JSON.parse(JSON.stringify(state));
        let player = newState[playerKey];
        if (player.biomeChanges <= 0) return state;

        if (!card || card.type !== 'Biome') return state;

        const newHand = player.hand.filter((c: Card) => c.id !== card.id);
        const oldBiome = newState.activeBiome;
        const newGraveyard = oldBiome ? [...player.graveyard, oldBiome] : player.graveyard;
        
        player.hand = newHand;
        player.graveyard = newGraveyard;
        player.mana = player.mana + 1;
        player.biomeChanges = player.biomeChanges - 1;
        
        newState.activeBiome = card;
        newState.log = [...state.log, { turn: state.turn, message: `${playerKey === 'player' ? 'Joueur' : 'Adversaire'} change le biome pour ${card.name} et gagne 1 mana.` }];

        // Apply buffs to all creatures on the board
        newState.player.battlefield = applyBiomeBuffs(newState.player.battlefield, card);
        newState.opponent.battlefield = applyBiomeBuffs(newState.opponent.battlefield, card);

        return newState;
    }

    case 'PLAY_CARD': {
      if (state.activePlayer !== 'player' || state.phase !== 'main') return state;
      let newState = { ...state };
      let player = { ...newState.player };
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
      const battlefieldCardCount = player.battlefield.filter(c => c.type === 'Creature' || c.type === 'Artifact').length;
      if ((card.type === 'Creature' || card.type === 'Artifact') && battlefieldCardCount >= MAX_BATTLEFIELD_SIZE) {
        return { ...state, log: [...state.log, { turn: state.turn, message: "Vous avez trop de cartes sur le terrain." }] };
      }
      if (card.type === 'Biome') {
          return gameReducer(state, { type: 'CHANGE_BIOME', card: card, player: 'player' });
      }
      
      const newHand = player.hand.filter(c => c.id !== card.id);
      player.hand = newHand;
      player.mana -= card.manaCost;
      let newLog = [...state.log, { turn: state.turn, message: `Joueur joue ${card.name}.` }];
      
      const newCardState: Card = { ...card, summoningSickness: true, canAttack: false, buffs: [] };

      if (card.type === 'Land') {
        player.battlefield.push(newCardState);
        player.maxMana = player.maxMana + 1;
        player.mana = player.maxMana;
      } else if (card.type === 'Creature' || card.type === 'Artifact') {
        player.battlefield.push(newCardState);
         newState.player = player;
         newState.player.battlefield = applyBiomeBuffs(player.battlefield, newState.activeBiome);

        if (card.type === 'Artifact' && card.skill?.type === 'global_buff_armor') {
            player.battlefield.forEach(c => {
                if (c.type === 'Creature') {
                    c.buffs.push({ type: 'armor', value: card.skill.value || 0, duration: card.skill.duration || 0, source: 'artifact' });
                }
            });
            newLog.push({ turn: state.turn, message: `${card.name} donne +${card.skill.value} armure à toutes les créatures.` });
        }
      } else if (card.type === 'Spell' || card.type === 'Enchantment' || card.type === 'Potion') {
        if(card.id.startsWith('health_potion')) {
            player.hp = Math.min(20, player.hp + 5);
            newLog.push({ turn: state.turn, message: `Joueur se soigne de 5 PV.` });
        } else if (card.id.startsWith('mana_potion')) {
            player.mana = player.mana + 2;
            newLog.push({ turn: state.turn, message: `Joueur gagne 2 mana.` });
        } else if (card.skill?.target === 'friendly_creature' && state.selectedCardId) {
            const targetIndex = player.battlefield.findIndex(c => c.id === state.selectedCardId);
            if (targetIndex > -1) {
                const targetCard = player.battlefield[targetIndex];
                if (card.skill.type === 'buff_attack') {
                    targetCard.buffs.push({ type: 'attack', value: card.skill.value || 0, duration: card.skill.duration || 0, source: 'spell' });
                }
                if (card.skill.type === 'buff_armor') {
                    targetCard.buffs.push({ type: 'armor', value: card.skill.value || 0, duration: card.skill.duration || 0, source: 'spell' });
                }
                newLog.push({ turn: state.turn, message: `${card.name} est lancé sur ${targetCard.name}.` });
            }
        }
        player.graveyard.push(card);
      }

      return { ...newState, player, log: newLog, selectedCardId: null };
    }
    
    case 'SELECT_ATTACKER': {
        if (state.phase !== 'combat' || state.activePlayer !== 'player') return state;
        const card = state.player.battlefield.find(c => c.id === action.cardId);
        if (!card || !card.canAttack || card.tapped) return state;

        return {
            ...state,
            phase: 'targeting',
            selectedAttackerId: action.cardId,
            selectedDefenderId: null,
        };
    }

    case 'SELECT_DEFENDER': {
        if (state.phase !== 'targeting' || state.activePlayer !== 'player') return state;
        const opponentHasTaunt = state.opponent.battlefield.some(c => c.taunt && !c.tapped);
        
        if (action.cardId === 'opponent') {
            const opponentHasCreatures = state.opponent.battlefield.filter(c => c.type === 'Creature').length > 0;
            if (opponentHasTaunt) {
                return { ...state, log: [...state.log, { turn: state.turn, message: "Vous devez attaquer une créature avec Provocation."}] };
            }
            if (opponentHasCreatures) {
                return { ...state, log: [...state.log, { turn: state.turn, message: "Vous ne pouvez pas attaquer le joueur directement s'il a des créatures."}] };
            }
            return { ...state, selectedDefenderId: 'opponent' };
        }
      
        const targetCard = state.opponent.battlefield.find(c => c.id === action.cardId);
        if(!targetCard || targetCard.type !== 'Creature') return state;

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

      const currentPlayerKey = newState.activePlayer;
      const nextPlayerKey = currentPlayerKey === 'player' ? 'opponent' : 'player';
      
      let artifactsToRemove: string[] = [];
      newState[currentPlayerKey].battlefield.forEach((c: Card) => {
        if (c.type === 'Creature') {
          c.buffs = c.buffs.map((b: Buff) => ({ ...b, duration: b.duration - 1 })).filter((b: Buff) => b.duration > 0 || b.source === 'biome');
        }
        if (c.type === 'Artifact') {
            c.duration = (c.duration || 0) - 1;
            if(c.duration <= 0) {
              artifactsToRemove.push(c.id);
              newState.log.push({ turn: newState.turn, message: `L'effet de ${c.name} se termine.` });
              if (c.skill?.type === 'global_buff_armor') {
                  newState[currentPlayerKey].battlefield.forEach((creature: Card) => {
                      if (creature.type === 'Creature') {
                          creature.buffs = creature.buffs.filter(b => b.source !== 'artifact');
                      }
                  });
              }
            }
        }
      });
      if(artifactsToRemove.length > 0){
        newState[currentPlayerKey].battlefield = newState[currentPlayerKey].battlefield.filter((c: Card) => !artifactsToRemove.includes(c.id));
      }

      if (newState.activeBiome?.biome === 'Sanctuary') {
          newState[currentPlayerKey].battlefield.forEach((c: Card) => {
              if (c.type === 'Creature' && c.preferredBiome === 'Sanctuary' && c.health < c.initialHealth) {
                  c.health = Math.min(c.initialHealth, (c.health || 0) + 1);
                   newState.log.push({ turn: newState.turn, message: `${c.name} est soigné de 1 PV par le Sanctuaire.` });
              }
          });
      }


      newState[currentPlayerKey].battlefield = newState[currentPlayerKey].battlefield.map((c: Card) => ({
        ...c,
        tapped: false,
        summoningSickness: c.type === 'Creature' ? false : c.summoningSickness,
        canAttack: c.type === 'Creature',
        isAttacking: false,
        skill: c.skill ? { ...c.skill, used: false } : undefined,
      }));
       newState[currentPlayerKey].biomeChanges = 2;


      const nextTurnNumber = nextPlayerKey === 'player' ? newState.turn + 1 : newState.turn;
      
      newState.turn = nextTurnNumber;
      newState.activePlayer = nextPlayerKey;
      newState.phase = 'main';
      newState.selectedCardId = null;
      newState.selectedAttackerId = null;
      newState.selectedDefenderId = null;
      
      const { player: nextPlayerAfterDraw, log: logAfterDraw } = drawCards(newState[nextPlayerKey], 1, newState.log, nextTurnNumber);
      newState[nextPlayerKey] = nextPlayerAfterDraw;
      newState.log = [...logAfterDraw, { turn: nextTurnNumber, message: `Début du tour de ${nextPlayerKey === 'player' ? 'Joueur' : "l'Adversaire"}.` }];

      let nextPlayerState = newState[nextPlayerKey];
      nextPlayerState.maxMana = Math.min(10, nextPlayerState.maxMana + 1);
      nextPlayerState.mana = nextPlayerState.maxMana;
      
      newState[nextPlayerKey] = nextPlayerState;
      
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
