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
  | { type: 'ACTIVATE_SKILL', cardId: string, targetId?: string }
  | { type: 'END_COMBAT_ANIMATION' }
  | { type: 'CLEAN_BATTLEFIELD' }
  | { type: 'PAUSE_GAME' };

const drawCardsWithBiomeAffinity = (player: Player, count: number, activeBiome: Card | null): { player: Player, drawnCard?: Card } => {
    let newDeck = [...player.deck];
    let newHand = [...player.hand];
    let drawnCard: Card | undefined;

    for (let i = 0; i < count; i++) {
        if (newHand.length >= MAX_HAND_SIZE) break;
        if (newDeck.length === 0) break;

        const cardsToProbe = newDeck.slice(0, 5);
        let cardToDraw: Card;
        let cardIndexInDeck: number;

        if (activeBiome?.biome && cardsToProbe.length > 0) {
            const biomeMatchingCards = cardsToProbe.filter(c => c.preferredBiome === activeBiome.biome);
            if (biomeMatchingCards.length > 0) {
                cardToDraw = biomeMatchingCards[Math.floor(Math.random() * biomeMatchingCards.length)];
                cardIndexInDeck = newDeck.findIndex(c => c.id === cardToDraw.id);
            } else {
                cardToDraw = newDeck[0];
                cardIndexInDeck = 0;
            }
        } else {
            cardToDraw = newDeck[0];
            cardIndexInDeck = 0;
        }
        
        drawnCard = cardToDraw;
        newHand.push(drawnCard);
        newDeck.splice(cardIndexInDeck, 1);
    }

    return { player: { ...player, deck: newDeck, hand: newHand }, drawnCard };
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
    combatAnimation: null,
  };
  
  return initialState;
};

const shuffleAndDeal = (state: GameState): Omit<GameState, 'gameId'> => {
    let player = createInitialPlayer('player');
    let opponent = createInitialPlayer('opponent');

    player.deck = createDeck();
    opponent.deck = createDeck();
    
    const defaultBiomeCard = allCards.find(c => c.id === 'forest_biome');
    const activeBiome = defaultBiomeCard ? { ...defaultBiomeCard, tapped: false, isAttacking: false, canAttack: false, summoningSickness: false, initialHealth: defaultBiomeCard.health, buffs: []} : null;

    player = drawCardsWithBiomeAffinity(player, 5, activeBiome).player;
    opponent = drawCardsWithBiomeAffinity(opponent, 5, activeBiome).player;
    
    return {
        turn: 1,
        activePlayer: 'player',
        phase: 'main',
        player: player,
        opponent: opponent,
        winner: undefined,
        log: [{ type: 'game_start', turn: 1, message: "Le match commence!" }],
        isThinking: false,
        activeBiome: activeBiome,
        selectedCardId: null,
        selectedAttackerId: null,
        selectedDefenderId: null,
        spellBeingCast: null,
        combatAnimation: null,
    }
}

const resolveDamage = (attacker: Card, defender: Card | Player, log: GameState['log'], turn: number, attackerOwner: Player): { attacker: Card, defender: Card | Player, attackerOwner: Player, log: GameState['log']} => {
    const newLog = [...log];
    const newAttacker = {...attacker};
    let newDefender = {...defender};
    const newAttackerOwner = {...attackerOwner};

    const totalAttack = (newAttacker.attack || 0) + (newAttacker.buffs?.filter(b => b.type === 'attack').reduce((acc, b) => acc + b.value, 0) || 0);
    const totalCritChance = (newAttacker.criticalHitChance || 0) + (newAttacker.buffs?.filter(b => b.type === 'crit').reduce((acc, b) => acc + b.value, 0) || 0);

    const isCritical = Math.random() * 100 < totalCritChance;
    let damageDealt = totalAttack;
    
    newLog.push({ type: 'combat', turn, message: `${newAttacker.name} attaque avec ${damageDealt} points de dégâts.` });

    if ('battlefield' in newDefender) { // It's a player
        newDefender.hp -= damageDealt;
        newLog.push({ type: 'damage', turn, message: `${newDefender.id === 'player' ? 'Joueur' : 'Adversaire'} subit ${damageDealt} dégâts. PV restants: ${newDefender.hp}` });
    } else { // It's a card
        const totalArmor = (newDefender.armor || 0) + (newDefender.buffs?.filter(b => b.type === 'armor').reduce((acc, b) => acc + b.value, 0) || 0);

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
    }

    if (newAttacker.skill?.type === 'lifesteal') {
        const healedAmount = Math.ceil(damageDealt / 2);
        newAttackerOwner.hp = Math.min(20, newAttackerOwner.hp + healedAmount);
        newLog.push({ type: 'heal', turn, message: `Vol de vie: ${newAttacker.name} soigne son propriétaire de ${healedAmount} PV.` });
    }

    return { attacker: newAttacker, defender: newDefender, attackerOwner: newAttackerOwner, log: newLog };
};


const opponentAI = (state: GameState): GameState => {
  let tempState = { ...state };

  // --- Main Phase ---
  // Create a mutable copy of players for the duration of the AI's turn planning
  let opponent = { ...tempState.opponent };
  let player = { ...tempState.player };
  let log = [...tempState.log];
  const turn = tempState.turn;

  // Function to apply an action and update the temporary state
  const applyAction = (action: GameAction): boolean => {
    // We need to create a temporary state for the reducer to work on
    const tempReducerState = { ...tempState, opponent, player, log, activePlayer: 'opponent' as const };
    const newState = gameReducer(tempReducerState, action);

    // Check if the action resulted in a change (e.g., a log entry was added, or state changed)
    const wasSuccessful = newState.log.length > log.length || JSON.stringify(newState.opponent) !== JSON.stringify(opponent) || JSON.stringify(newState.player) !== JSON.stringify(player);
    
    if (wasSuccessful) {
        opponent = newState.opponent;
        player = newState.player;
        log = newState.log;
        tempState = { ...newState, opponent, player, log };
        return true;
    }
    return false;
  };

  // 1. Play Land if possible
  const landPlayedThisTurn = opponent.battlefield.some(c => c.type === 'Land' && c.summoningSickness);
  if (!landPlayedThisTurn) {
    const landInHand = opponent.hand.find(c => c.type === 'Land');
    if (landInHand) {
      applyAction({ type: 'PLAY_CARD', cardId: landInHand.id });
    }
  }

  // 2. Survival & Healing (HIGHEST PRIORITY)
  if (opponent.hp <= 10) {
    // Use health potion from hand
    const healthPotion = opponent.hand.find(c => c.id.startsWith('health_potion') && c.manaCost <= opponent.mana);
    if (healthPotion) {
      if(applyAction({ type: 'PLAY_CARD', cardId: healthPotion.id })) {
         // Potion used, re-evaluate state
      }
    }
    
    // Use healing light from hand
    const healingLight = opponent.hand.find(c => c.id.startsWith('healing_light') && c.manaCost <= opponent.mana);
    const mostDamagedCreature = [...opponent.battlefield].filter(c => c.type === 'Creature' && c.health < c.initialHealth).sort((a,b) => (a.health/a.initialHealth) - (b.health/b.initialHealth))[0];
    if(healingLight && mostDamagedCreature) {
        if(applyAction({ type: 'PLAY_CARD', cardId: healingLight.id })) {
            applyAction({ type: 'CAST_SPELL_ON_TARGET', targetId: mostDamagedCreature.id });
        }
    }

    // Use Cleric to heal the most damaged ally
    const clerics = opponent.battlefield.filter(c => c.id.startsWith('cleric') && c.skill && !c.skill.onCooldown && !c.tapped && !c.summoningSickness);
    if (clerics.length > 0 && mostDamagedCreature) {
      const cleric = clerics[0];
      applyAction({ type: 'ACTIVATE_SKILL', cardId: cleric.id, targetId: mostDamagedCreature.id });
    }
  }

  // 3. Use Mana Potion if it allows playing a better card
  const manaPotion = opponent.hand.find(c => c.id.startsWith('mana_potion') && c.manaCost <= opponent.mana);
  if (manaPotion) {
    const potentialMana = opponent.mana - manaPotion.manaCost + 2;
    const powerfulCard = opponent.hand.find(c => c.type === 'Creature' && c.manaCost > opponent.mana && c.manaCost <= potentialMana);
    if (powerfulCard) {
      applyAction({ type: 'PLAY_CARD', cardId: manaPotion.id });
    }
  }

  // 4. Use spells and skills strategically
  // Offensive spells
  const damageSpells = opponent.hand.filter(c => c.type === 'Spell' && (c.skill?.type === 'damage' || c.skill?.type === 'damage_and_heal') && c.manaCost <= opponent.mana);
  for (const spell of damageSpells) {
      const killableTargets = player.battlefield.filter(t => t.type === 'Creature' && (t.health || 0) <= (spell.skill?.value || 0));
      if (killableTargets.length > 0) {
          const bestTarget = killableTargets.sort((a, b) => (b.attack || 0) - (a.attack || 0))[0];
          if(applyAction({ type: 'PLAY_CARD', cardId: spell.id })) {
             applyAction({ type: 'CAST_SPELL_ON_TARGET', targetId: bestTarget.id });
          }
      }
  }
  
  // Buff spells before combat
  const buffSpells = opponent.hand.filter(c => c.type === 'Spell' && (c.skill?.type === 'buff_attack' || c.skill?.type === 'buff_attack_and_armor' || c.skill?.type === 'buff_armor') && c.manaCost <= opponent.mana);
  for (const spell of buffSpells) {
      const attackers = opponent.battlefield.filter(c => c.type === 'Creature' && !c.tapped && !c.summoningSickness);
      if (attackers.length > 0) {
          const bestTarget = attackers.sort((a,b) => (b.attack || 0) - (a.attack || 0))[0];
           if(applyAction({ type: 'PLAY_CARD', cardId: spell.id })) {
               applyAction({ type: 'CAST_SPELL_ON_TARGET', targetId: bestTarget.id });
           }
      }
  }

  // Use creature skills
  const activatableSkills = opponent.battlefield.filter(c => c.skill && !c.skill.onCooldown && !c.tapped && !c.summoningSickness);
  for (const card of activatableSkills) {
      if (card.skill?.type === 'draw') {
          if (opponent.hand.length < MAX_HAND_SIZE) {
              applyAction({ type: 'ACTIVATE_SKILL', cardId: card.id });
          }
      } else if (card.skill?.type === 'taunt') {
          if (!card.taunt) {
              applyAction({ type: 'ACTIVATE_SKILL', cardId: card.id });
          }
      } else if (card.skill?.type === 'sacrifice') {
        const valuableAllies = opponent.battlefield.filter(c => c.id !== card.id && c.type === 'Creature' && c.health < c.initialHealth / 2 && (c.attack || 0) > 3);
        if (valuableAllies.length > 0) {
          const target = valuableAllies[0];
          applyAction({type: 'ACTIVATE_SKILL', cardId: card.id, targetId: target.id});
        }
      }
  }

  // 5. Play creatures/artifacts to establish board presence
  let playedCard = true;
  while(playedCard) {
    playedCard = false;
    if (opponent.battlefield.length >= MAX_BATTLEFIELD_SIZE) break;

    const playableCards = opponent.hand
      .filter(c => (c.type === 'Creature' || c.type === 'Artifact') && c.manaCost <= opponent.mana)
      .sort((a, b) => b.manaCost - a.manaCost); 

    if (playableCards.length > 0) {
      if(applyAction({ type: 'PLAY_CARD', cardId: playableCards[0].id })) {
        playedCard = true;
      }
    }
  }
  
  // Update the main state with the results of all actions
  tempState.opponent = opponent;
  tempState.player = player;
  tempState.log = log;

  // --- Combat Phase ---
  let combatState = { ...tempState };
  let combatOpponent = { ...combatState.opponent };
  let combatPlayer = { ...combatState.player };
  let combatLog = [...combatState.log];

  let attackers = combatOpponent.battlefield.filter((c: Card) => c.type === 'Creature' && c.canAttack && !c.tapped);
  const playerTauntCreatures = combatPlayer.battlefield.filter((c: Card) => c.taunt && !c.tapped);

  if (attackers.length > 0) {
    combatLog.push({ type: 'phase', turn: combatState.turn, message: `Adversaire passe en phase de combat.` });
  }

  for (const attacker of attackers) {
      let targetId: string | 'opponent' | null = null;
      let attackerCard = combatOpponent.battlefield.find(c => c.id === attacker.id);
      if (!attackerCard) continue;

      if(playerTauntCreatures.length > 0) {
          targetId = playerTauntCreatures.sort((a,b) => (a.health || 0) - (b.health || 0))[0].id;
      } else {
        const potentialBlockers = combatPlayer.battlefield.filter(c => c.type === 'Creature' && !c.tapped);
        const totalAttack = (attackerCard.attack || 0) + (attackerCard.buffs?.filter(b => b.type === 'attack').reduce((acc, b) => acc + b.value, 0) || 0);

        // Can I kill something?
        const killableTargets = potentialBlockers.filter(p => (p.health || 0) <= totalAttack - (p.armor || 0));
        if (killableTargets.length > 0) {
            // Target the killable creature with the highest attack
            targetId = killableTargets.sort((a, b) => (b.attack || 0) - (a.attack || 0))[0].id;
        } else if (potentialBlockers.length === 0) {
            // No blockers, attack player
            targetId = 'opponent';
        } else {
            // Can't kill anything, decide if it's worth attacking the player or a creature
            if (combatPlayer.hp < totalAttack) { // Lethal
                targetId = 'opponent';
            } else {
                // If AI creature would die and player creature would live, it's a bad trade, don't attack
                const weakestBlocker = potentialBlockers.sort((a, b) => (a.attack || 0) - (b.attack || 0))[0];
                const riposteDamage = (weakestBlocker.attack || 0) - (attackerCard.armor || 0);
                if (riposteDamage < (attackerCard.health || 0)) {
                    targetId = 'opponent'; // Attack player if the trade is bad or there are no blockers
                }
            }
        }
      }

      if (targetId) {
          combatState.combatAnimation = { attackerId: attackerCard.id, defenderId: targetId };
          let defender: Card | Player | undefined = targetId === 'opponent' ? combatPlayer : combatPlayer.battlefield.find(c => c.id === targetId);
          if (!defender) continue;
          
          const combatResult = resolveDamage(attackerCard, defender, combatLog, combatState.turn, combatOpponent);
          
          combatOpponent = combatResult.attackerOwner;

          if (targetId === 'opponent') {
              combatPlayer = combatResult.defender as Player;
          } else {
              combatPlayer.battlefield = combatPlayer.battlefield.map(c => c.id === targetId ? combatResult.defender as Card : c);

              // Riposte
              const finalDefenderState = combatPlayer.battlefield.find(c => c.id === targetId);
              if (finalDefenderState && (finalDefenderState.health || 0) > 0 && !finalDefenderState.tapped) {
                 combatLog.push({ type: 'combat', turn, message: `${finalDefenderState.name} riposte !` });
                 const riposteResult = resolveDamage(finalDefenderState, combatResult.attacker, combatLog, combatState.turn, combatPlayer);
                 combatOpponent.battlefield = combatOpponent.battlefield.map(c => c.id === attacker.id ? riposteResult.defender as Card : c);
                 combatPlayer = riposteResult.attackerOwner as Player;
                 combatLog = riposteResult.log;
              }
          }
          combatOpponent.battlefield = combatOpponent.battlefield.map(c => c.id === attacker.id ? {...c, tapped: true, canAttack: false} : c);
          combatLog = combatResult.log;
      }
  }
  
  // Final state after combat
  combatState.player = combatPlayer;
  combatState.opponent = combatOpponent;
  combatState.log = combatLog;

  if (combatPlayer.hp <= 0) {
      combatState.winner = 'opponent';
      combatState.phase = 'game-over';
      combatLog.push({ type: 'game_over', turn: combatState.turn, message: "Le joueur a été vaincu."})
  } else if (combatOpponent.hp <= 0) {
      combatState.winner = 'player';
      combatState.phase = 'game-over';
      combatLog.push({ type: 'game_over', turn: combatState.turn, message: "L'adversaire a été vaincu."})
  }

  return combatState;
};

const resolvePlayerCombat = (state: GameState): GameState => {
    let newState = {...state};
    let { player, opponent, selectedAttackerId, selectedDefenderId, log, turn } = newState;

    const attackerCard = player.battlefield.find((c: Card) => c.id === selectedAttackerId);
    if (!attackerCard) return state;

    let finalLog = [...log];
    let finalPlayer = { ...player };
    let finalOpponent = { ...opponent };
    let combatAnimation = { attackerId: attackerCard.id, defenderId: selectedDefenderId as string | 'opponent' };

    if (selectedDefenderId === 'opponent') {
        const combatResult = resolveDamage(attackerCard, finalOpponent, finalLog, turn, finalPlayer);
        finalOpponent = combatResult.defender as Player;
        finalPlayer = combatResult.attackerOwner;
        finalLog = combatResult.log;
    } else {
        const defenderCard = opponent.battlefield.find((c: Card) => c.id === selectedDefenderId);
        if (!defenderCard) return state;
        
        let newAttacker = { ...attackerCard };
        let newDefender = { ...defenderCard };

        finalLog.push({ type: 'combat', turn: turn, message: `Joueur: ${newAttacker.name} attaque ${newDefender.name}.` });

        // --- Perform Combat ---
        const combatResult = resolveDamage(newAttacker, newDefender, finalLog, turn, finalPlayer);
        newAttacker = combatResult.attacker;
        newDefender = combatResult.defender as Card;
        finalPlayer = combatResult.attackerOwner;
        finalLog = combatResult.log;

        
        // --- Riposte (Retaliation) ---
        if ((newDefender.health || 0) > 0) {
            finalLog.push({ type: 'combat', turn: turn, message: `${newDefender.name} riposte !` });
            let riposteResult = resolveDamage(newDefender, newAttacker, finalLog, turn, finalOpponent);
            newAttacker = riposteResult.defender as Card;
            newDefender = riposteResult.attacker;
            finalOpponent = riposteResult.attackerOwner;
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
    
    // --- Check for more attackers ---
    const hasMoreAttackers = finalPlayer.battlefield.some(c => c.canAttack && !c.tapped);
    let nextPhase: GamePhase = 'combat';
    if (!hasMoreAttackers) {
        nextPhase = 'main';
    }


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
      phase: winner ? 'game-over' : nextPhase,
      selectedAttackerId: null,
      selectedDefenderId: null,
      combatAnimation,
    };
}

type FusionRecipe = {
  result: string;
  components: string[];
};

const fusions: FusionRecipe[] = [
    { result: 'berlin_wall', components: ['elemental_earth', 'elemental_earth', 'elemental_earth'] },
    { result: 'china_wall', components: ['berlin_wall', 'berlin_wall'] },
    { result: 'iron_colossus', components: ['golem', 'minotaur'] },
    { result: 'ancient_dragon', components: ['dragon', 'phoenix'] },
    { result: 'elemental_avatar', components: ['elemental_fire', 'elemental_water', 'elemental_earth'] },
    { result: 'supreme_shadow', components: ['vampire', 'ruin_specter'] },
    { result: 'world_tree', components: ['oak_druid', 'elemental_earth'] },
    { result: 'judgment_angel', components: ['cleric', 'archmage_elements'] },
    { result: 'stone_titan', components: ['golem', 'berlin_wall'] },
    { result: 'chimera', components: ['griffon', 'ancestral_basilisk'] },
];

const checkForCombos = (state: GameState): GameState => {
    let player = { ...state.player };
    let opponent = { ...state.opponent };
    let log = [...state.log];
    const turn = state.turn;
    const activePlayerKey = state.activePlayer;
    let activePlayerObject = activePlayerKey === 'player' ? player : opponent;

    for (const fusion of fusions) {
        const battlefieldCardIds = activePlayerObject.battlefield.map(c => c.id.split('-')[0]);
        let tempBattlefield = [...activePlayerObject.battlefield];
        let canFuse = true;
        let componentsToFuse: Card[] = [];

        for (const componentId of fusion.components) {
            const index = tempBattlefield.findIndex(c => c.id.startsWith(componentId));
            if (index !== -1) {
                componentsToFuse.push(tempBattlefield[index]);
                tempBattlefield.splice(index, 1);
            } else {
                canFuse = false;
                break;
            }
        }

        if (canFuse) {
            log.push({ type: 'spell', turn, message: `${componentsToFuse.map(c => c.name).join(' et ')} fusionnent !` });

            const idsToRemove = componentsToFuse.map(c => c.id);
            activePlayerObject.battlefield = activePlayerObject.battlefield.filter(c => !idsToRemove.includes(c.id));
            activePlayerObject.graveyard.push(...componentsToFuse.map(c => ({ ...c, health: c.initialHealth, buffs: [] })));

            const fusionResultTemplate = allCards.find(c => c.id === fusion.result);
            if (fusionResultTemplate) {
                const newCard: Card = {
                    ...fusionResultTemplate,
                    id: `${fusionResultTemplate.id}-${Math.random().toString(36).substring(7)}`,
                    health: fusionResultTemplate.initialHealth,
                    tapped: false,
                    isAttacking: false,
                    canAttack: false,
                    summoningSickness: true,
                    buffs: [],
                    isEntering: true,
                };
                activePlayerObject.battlefield.push(newCard);
                log.push({ type: 'play', turn, message: `L'entité ${newCard.name} est invoquée !` });
            }
        }
    }
    
    if (activePlayerKey === 'player') {
        player = activePlayerObject;
    } else {
        opponent = activePlayerObject;
    }

    return { ...state, player, opponent, log };
};

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (state.phase === 'game-over' && action.type !== 'RESTART_GAME' && action.type !== 'INITIALIZE_GAME') {
    return state;
  }

  // Helper to remove skillJustUsed and isEntering flags from all cards
  const clearFlags = (player: Player): Player => ({
    ...player,
    battlefield: player.battlefield.map(c => ({ ...c, skillJustUsed: false, isEntering: false })),
  });
  
  const stateWithClearedFlags = {
    ...state,
    player: clearFlags(state.player),
    opponent: clearFlags(state.opponent),
  };


  switch (action.type) {
    case 'INITIALIZE_GAME': {
        const initialState = shuffleAndDeal(state);
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
      const initialState = shuffleAndDeal(state);
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
    
    case 'END_COMBAT_ANIMATION': {
        return {
            ...state,
            combatAnimation: null
        }
    }

    case 'CLEAN_BATTLEFIELD': {
        const clean = (p: Player): Player => {
            const graveyard = [...p.graveyard];
            const battlefield = p.battlefield.filter(c => {
                if ((c.health || 0) <= 0) {
                    graveyard.push({ ...c, health: c.initialHealth, buffs: [] });
                    return false;
                }
                return true;
            });
            return { ...p, battlefield, graveyard };
        };

        const player = clean(state.player);
        const opponent = clean(state.opponent);
        return { ...state, player, opponent };
    }


    case 'DRAW_CARD': {
        const { player: playerKey, count } = action;
        let playerToUpdate = {...stateWithClearedFlags[playerKey]};
        const { player: updatedPlayer } = drawCardsWithBiomeAffinity(playerToUpdate, count, stateWithClearedFlags.activeBiome);
        let log = [...stateWithClearedFlags.log];
        if (updatedPlayer.hand.length === playerToUpdate.hand.length && count > 0) {
          log.push({ type: 'info', turn: stateWithClearedFlags.turn, message: `${playerKey === 'player' ? "Votre" : "Sa"} main est pleine, la carte est défaussée.`});
        }
        return {
            ...stateWithClearedFlags,
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
        if (stateWithClearedFlags.activePlayer !== 'player') return stateWithClearedFlags;
        
        const cardOnBattlefield = state.player.battlefield.find(c => c.id === action.cardId);

        if (stateWithClearedFlags.phase === 'spell_targeting' && cardOnBattlefield) {
            const spell = stateWithClearedFlags.spellBeingCast;
            if (spell?.skill?.target === 'friendly_creature' || spell?.skill?.target === 'any_creature') {
                return gameReducer(stateWithClearedFlags, { type: 'CAST_SPELL_ON_TARGET', targetId: action.cardId });
            }
        }
        
        if (stateWithClearedFlags.phase === 'main' && cardOnBattlefield) {
            if (stateWithClearedFlags.selectedCardId && stateWithClearedFlags.selectedCardId === action.cardId) {
                return { ...stateWithClearedFlags, selectedCardId: null }; // Deselect
            } else {
                return { ...stateWithClearedFlags, selectedCardId: action.cardId };
            }
        }
        
        return stateWithClearedFlags;
    }

    case 'ACTIVATE_SKILL': {
        if (stateWithClearedFlags.phase !== 'main') return stateWithClearedFlags;
        const activePlayerKey = stateWithClearedFlags.activePlayer;
        const activePlayerObject = stateWithClearedFlags[activePlayerKey];
        const card = activePlayerObject.battlefield.find((c: Card) => c.id === action.cardId);

        if (!card || !card.skill || card.skill.used || card.summoningSickness || card.tapped || card.skill.onCooldown) return stateWithClearedFlags;
        
        // If skill requires a target, change phase to spell_targeting
        if (card.skill.target && card.skill.target !== 'self' && card.skill.target !== 'player') {
            // For the player, just set the state to targeting. The GameBoard will handle the click.
            if (activePlayerKey === 'player') {
                return {
                    ...stateWithClearedFlags,
                    phase: 'spell_targeting',
                    spellBeingCast: card, // Using this to hold the skill-caster
                    selectedCardId: action.cardId // Keep the caster selected
                };
            } else { // AI targeting logic comes from opponentAI, which calls CAST_SPELL_ON_TARGET
                if (!action.targetId) return stateWithClearedFlags; // Should not happen if AI is coded correctly
                const tempState = {...stateWithClearedFlags, spellBeingCast: card};
                return gameReducer(tempState, { type: 'CAST_SPELL_ON_TARGET', targetId: action.targetId });
            }
        }

        // --- Logic for skills that don't need a target (or target self/player) ---
        let player = { ...activePlayerObject };
        let log = [...stateWithClearedFlags.log];
        const cardIndex = player.battlefield.findIndex((c: Card) => c.id === action.cardId);
        let cardToUpdate = { ...player.battlefield[cardIndex] };
        
        let logEntry: LogEntry | null = null;
        
        switch(cardToUpdate.skill?.type) {
            case 'taunt':
                cardToUpdate.taunt = true;
                logEntry = { type: 'skill', turn: stateWithClearedFlags.turn, message: `${activePlayerKey === 'player' ? 'Joueur' : 'Adversaire'} active la compétence Provocation de ${cardToUpdate.name}!` };
                break;
            case 'draw':
                const { player: drawnPlayer, drawnCard } = drawCardsWithBiomeAffinity(player, 1, stateWithClearedFlags.activeBiome);
                player = drawnPlayer;
                logEntry = { type: 'draw', turn: stateWithClearedFlags.turn, message: `${cardToUpdate.name} fait piocher ${drawnCard?.name || 'une carte'}.` };
                break;
            default:
                return stateWithClearedFlags;
        }
        
        cardToUpdate.skill.used = true;
        cardToUpdate.tapped = true;
        if (cardToUpdate.skill.cooldown) {
            cardToUpdate.skill.onCooldown = true;
            cardToUpdate.skill.currentCooldown = cardToUpdate.skill.cooldown;
        }
        cardToUpdate.skillJustUsed = true; // For visual feedback

        player.battlefield[cardIndex] = cardToUpdate;
        
        return { 
            ...stateWithClearedFlags,
            [activePlayerKey]: player,
            log: logEntry ? [...log, logEntry] : log,
            selectedCardId: null,
        };
    }

    case 'CHANGE_PHASE':
        if (stateWithClearedFlags.activePlayer === 'player') {
             if (action.phase === 'combat' && stateWithClearedFlags.player.battlefield.filter(c => c.canAttack && !c.tapped).length === 0) {
                 return { ...stateWithClearedFlags, log: [...stateWithClearedFlags.log, { type: 'info', turn: stateWithClearedFlags.turn, message: "Aucune créature ne peut attaquer."}] };
             }
              else if (action.phase === 'main') {
                return { ...stateWithClearedFlags, phase: 'main', selectedAttackerId: null, selectedDefenderId: null, selectedCardId: null, spellBeingCast: null };
            } else {
                return { ...stateWithClearedFlags, phase: action.phase, log: [...stateWithClearedFlags.log, { type: 'phase', turn: stateWithClearedFlags.turn, message: `Phase de ${action.phase}.`}] };
            }
        }
        return stateWithClearedFlags;

    case 'CHANGE_BIOME': {
        const { cardId, player: playerKey } = action;
        const player = {...stateWithClearedFlags[playerKey]};

        const cardFromHand = player.hand.find((c: Card) => c.id === cardId);

        if (player.biomeChanges <= 0 || !cardFromHand || cardFromHand.type !== 'Biome') return stateWithClearedFlags;

        const newHand = player.hand.filter((c: Card) => c.id !== cardId);
        const oldBiome = stateWithClearedFlags.activeBiome;
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
            ...stateWithClearedFlags,
            [playerKey]: newPlayerState,
            activeBiome: newActiveBiome,
            log: [...stateWithClearedFlags.log, { type: 'biome', turn: stateWithClearedFlags.turn, message: `${playerKey === 'player' ? 'Joueur' : 'Adversaire'} change le biome pour ${newActiveBiome.name} et gagne 1 mana.` }]
        };

        // Apply buffs to all creatures on the board
        newState.player.battlefield = applyBiomeBuffs(newState.player.battlefield, newActiveBiome);
        newState.opponent.battlefield = applyBiomeBuffs(newState.opponent.battlefield, newActiveBiome);
        return newState;
    }

    case 'PLAY_CARD': {
      let activePlayerKey = state.activePlayer;
      if ((state.phase !== 'main' && state.phase !== 'post_mulligan')) return state;
      
      let player = {...state[activePlayerKey]};
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
          return gameReducer(state, { type: 'CHANGE_BIOME', cardId: card.id, player: activePlayerKey });
      }
      
      const newHand = player.hand.filter((c: Card) => c.id !== card.id);
      const newMana = player.mana - card.manaCost;
      let newLog = [...state.log, { type: 'play', turn: state.turn, message: `${activePlayerKey === 'player' ? 'Joueur' : 'Adversaire'} joue ${card.name}.` }];
      
      let newPlayerState = {...player, hand: newHand, mana: newMana};
      let tempNewState: GameState = {...state, log: newLog };

      const newCardState: Card = { ...card, summoningSickness: true, canAttack: false, buffs: [], isEntering: true };

      if (card.type === 'Land') {
        newPlayerState.battlefield = [...newPlayerState.battlefield, newCardState];
        newPlayerState.maxMana = newPlayerState.maxMana + 1;
        newPlayerState.mana = newPlayerState.mana; // Mana from land is available next turn, but let's give it now
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
        if (card.skill?.target) {
            return {
                ...tempNewState,
                [activePlayerKey]: newPlayerState,
                phase: 'spell_targeting',
                spellBeingCast: card,
            };
        }
        if(card.id.startsWith('health_potion')) {
            newPlayerState.hp = Math.min(20, newPlayerState.hp + 5);
            tempNewState.log.push({ type: 'heal', turn: state.turn, message: `${activePlayerKey === 'player' ? 'Joueur' : 'Adversaire'} se soigne de 5 PV.` });
        } else if (card.id.startsWith('mana_potion')) {
            newPlayerState.mana = newPlayerState.mana + 2;
            tempNewState.log.push({ type: 'mana', turn: state.turn, message: `${activePlayerKey === 'player' ? 'Joueur' : 'Adversaire'} gagne 2 mana.` });
        }
        newPlayerState.graveyard = [...newPlayerState.graveyard, card];
      }

      let finalState: GameState = {
        ...tempNewState,
        [activePlayerKey]: newPlayerState,
        selectedCardId: null,
      };

      if (card.type === 'Creature' || card.type === 'Artifact') {
          finalState = checkForCombos(finalState);
      }

      if (state.phase === 'post_mulligan') {
        return gameReducer(finalState, { type: 'PASS_TURN' });
      }

      return finalState;
    }
    
    case 'SELECT_ATTACKER': {
        if (stateWithClearedFlags.phase !== 'combat' || stateWithClearedFlags.activePlayer !== 'player') return stateWithClearedFlags;
        const card = stateWithClearedFlags.player.battlefield.find(c => c.id === action.cardId);
        if (!card || !card.canAttack || card.tapped) return stateWithClearedFlags;

        return {
            ...stateWithClearedFlags,
            phase: 'targeting',
            selectedAttackerId: action.cardId,
            selectedDefenderId: null,
        };
    }

    case 'SELECT_DEFENDER': {
        if (stateWithClearedFlags.phase !== 'targeting' || stateWithClearedFlags.activePlayer !== 'player') return stateWithClearedFlags;
        const opponentHasTaunt = stateWithClearedFlags.opponent.battlefield.some(c => c.taunt && !c.tapped);
        const opponentHasCreatures = stateWithClearedFlags.opponent.battlefield.filter(c => c.type === 'Creature' && !c.tapped).length > 0;
        
        if (action.cardId === 'opponent') {
            if (opponentHasTaunt) {
                return { ...stateWithClearedFlags, log: [...stateWithClearedFlags.log, { type: 'info', turn: stateWithClearedFlags.turn, message: "Vous devez attaquer une créature avec Provocation."}] };
            }
            if (opponentHasCreatures) {
                return { ...stateWithClearedFlags, log: [...stateWithClearedFlags.log, { type: 'info', turn: stateWithClearedFlags.turn, message: "Vous ne pouvez pas attaquer le joueur directement s'il a des créatures."}] };
            }
            return { ...stateWithClearedFlags, selectedDefenderId: 'opponent' };
        }
      
        const targetCard = stateWithClearedFlags.opponent.battlefield.find(c => c.id === action.cardId);
        if(!targetCard || targetCard.type !== 'Creature') return stateWithClearedFlags;

        if(opponentHasTaunt && !targetCard.taunt) {
            return { ...stateWithClearedFlags, log: [...stateWithClearedFlags.log, { type: 'info', turn: stateWithClearedFlags.turn, message: "Vous devez attaquer une créature avec Provocation."}] };
        }

        return { ...stateWithClearedFlags, selectedDefenderId: action.cardId };
    }

    case 'CAST_SPELL_ON_TARGET': {
      if (stateWithClearedFlags.phase !== 'spell_targeting' || !stateWithClearedFlags.spellBeingCast) return stateWithClearedFlags;
    
      const { targetId } = action;
      const spellOrSkillCaster = stateWithClearedFlags.spellBeingCast;
      const activePlayerKey = stateWithClearedFlags.activePlayer;
    
      let player = { ...stateWithClearedFlags.player };
      let opponent = { ...stateWithClearedFlags.opponent };
      let log = [...stateWithClearedFlags.log];
      const turn = stateWithClearedFlags.turn;
    
      let target: Card | undefined;
      let targetOwnerKey: 'player' | 'opponent' | undefined;
    
      const findTarget = (p: Player, key: 'player'|'opponent') => {
        const found = p.battlefield.find(c => c.id === targetId);
        if (found) {
            target = found;
            targetOwnerKey = key;
        }
      }

      if (spellOrSkillCaster.skill?.target === 'opponent_creature') {
        findTarget(activePlayerKey === 'player' ? opponent : player, activePlayerKey === 'player' ? 'opponent' : 'player');
      } else if (spellOrSkillCaster.skill?.target === 'friendly_creature') {
        findTarget(activePlayerKey === 'player' ? player : opponent, activePlayerKey);
      } else if (spellOrSkillCaster.skill?.target === 'any_creature') {
        findTarget(player, 'player');
        if (!target) {
            findTarget(opponent, 'opponent');
        }
      }
    
      if (!target || !targetOwnerKey) {
        return { ...stateWithClearedFlags, phase: 'main', spellBeingCast: null, selectedCardId: null };
      }
    
      const ownerName = activePlayerKey === 'player' ? 'Joueur' : 'Adversaire';
      log.push({ type: 'spell', turn, message: `${ownerName} utilise ${spellOrSkillCaster.name} sur ${target.name}.` });
    
      let targetCard = { ...target };
      let activePlayerObject = activePlayerKey === 'player' ? player : opponent;
    
      // Apply skill/spell effect
      switch (spellOrSkillCaster.skill?.type) {
        case 'damage':
          targetCard.health = (targetCard.health || 0) - (spellOrSkillCaster.skill.value || 0);
          log.push({ type: 'damage', turn, message: `${targetCard.name} subit ${spellOrSkillCaster.skill.value} dégâts. PV restants: ${targetCard.health}` });
          break;
        case 'damage_and_heal':
            targetCard.health = (targetCard.health || 0) - (spellOrSkillCaster.skill.value || 0);
            activePlayerObject.hp = Math.min(20, activePlayerObject.hp + (spellOrSkillCaster.skill.heal || 0));
            log.push({ type: 'damage', turn, message: `${targetCard.name} subit ${spellOrSkillCaster.skill.value} dégâts. PV restants: ${targetCard.health}` });
            log.push({ type: 'heal', turn, message: `${ownerName} se soigne de ${spellOrSkillCaster.skill.heal} PV.` });
            break;
        case 'buff_attack':
          targetCard.buffs.push({ type: 'attack', value: spellOrSkillCaster.skill.value || 0, duration: spellOrSkillCaster.skill.duration || Infinity, source: 'spell' });
          log.push({ type: 'buff', turn, message: `${targetCard.name} gagne +${spellOrSkillCaster.skill.value} en attaque.` });
          break;
        case 'buff_armor':
          targetCard.buffs.push({ type: 'armor', value: spellOrSkillCaster.skill.value || 0, duration: spellOrSkillCaster.skill.duration || Infinity, source: 'spell' });
          log.push({ type: 'buff', turn, message: `${targetCard.name} gagne +${spellOrSkillCaster.skill.value} en armure.` });
          break;
        case 'buff_attack_and_armor':
            targetCard.buffs.push({ type: 'attack', value: spellOrSkillCaster.skill.attack || 0, duration: spellOrSkillCaster.skill.duration || Infinity, source: 'spell' });
            targetCard.buffs.push({ type: 'armor', value: spellOrSkillCaster.skill.armor || 0, duration: spellOrSkillCaster.skill.duration || Infinity, source: 'spell' });
            log.push({ type: 'buff', turn, message: `${targetCard.name} gagne +${spellOrSkillCaster.skill.attack} en attaque et +${spellOrSkillCaster.skill.armor} en armure.` });
            break;
        case 'heal':
          targetCard.health = Math.min(targetCard.initialHealth || 0, (targetCard.health || 0) + (spellOrSkillCaster.skill.value || 0));
          log.push({ type: 'heal', turn, message: `${spellOrSkillCaster.name} soigne ${targetCard.name} de ${spellOrSkillCaster.skill.value} PV.` });
          break;
        case 'sacrifice':
             const sacrificedCard = stateWithClearedFlags[activePlayerKey].battlefield.find(c => c.id === spellOrSkillCaster.id);
            if (sacrificedCard && sacrificedCard.health) {
                const healAmount = Math.floor(sacrificedCard.health * 0.75);
                targetCard.health = Math.min(targetCard.initialHealth!, (targetCard.health || 0) + healAmount);
                log.push({ type: 'heal', turn, message: `${sacrificedCard.name} est sacrifié et soigne ${targetCard.name} de ${healAmount} PV.` });

                if (activePlayerKey === 'player') {
                    player.battlefield = player.battlefield.filter(c => c.id !== sacrificedCard.id);
                    player.graveyard.push(sacrificedCard);
                } else {
                    opponent.battlefield = opponent.battlefield.filter(c => c.id !== sacrificedCard.id);
                    opponent.graveyard.push(sacrificedCard);
                }
            }
            break;
      }
    
      // Update the target card on the correct battlefield
      if (targetOwnerKey === 'player') {
        player.battlefield = player.battlefield.map(c => c.id === targetId ? targetCard : c);
      } else {
        opponent.battlefield = opponent.battlefield.map(c => c.id === targetId ? targetCard : c);
      }
    
      // Mark skill as used and tap the creature if it was a creature skill
      const isFromCreature = stateWithClearedFlags[activePlayerKey].battlefield.some(c => c.id === spellOrSkillCaster.id);
      if (isFromCreature) {
        let activePlayerBattlefield = activePlayerKey === 'player' ? player.battlefield : opponent.battlefield;
        const casterIndex = activePlayerBattlefield.findIndex(c => c.id === spellOrSkillCaster.id);

        // Caster might have been sacrificed
        if (casterIndex > -1) {
          let casterCard = { ...activePlayerBattlefield[casterIndex] };
          casterCard.tapped = true;
          if (casterCard.skill) {
             casterCard.skill.used = true;
             if (casterCard.skill.cooldown) {
                casterCard.skill.onCooldown = true;
                casterCard.skill.currentCooldown = casterCard.skill.cooldown;
             }
          }
          casterCard.skillJustUsed = true;
          if (activePlayerKey === 'player') {
              player.battlefield[casterIndex] = casterCard;
          } else {
              opponent.battlefield[casterIndex] = casterCard;
          }
        }

      } else { // It was a spell from hand, move to graveyard
        if (activePlayerKey === 'player') {
            player.graveyard = [...player.graveyard, spellOrSkillCaster];
        } else {
            opponent.graveyard = [...opponent.graveyard, spellOrSkillCaster];
        }
      }
    
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
      player = updateField(player, "Joueur");
    
      return {
        ...stateWithClearedFlags,
        opponent,
        player,
        log,
        phase: 'main',
        spellBeingCast: null,
        selectedCardId: null
      };
    }

    case 'DECLARE_ATTACK': {
        if (stateWithClearedFlags.phase !== 'targeting' || stateWithClearedFlags.activePlayer !== 'player' || !stateWithClearedFlags.selectedAttackerId || !stateWithClearedFlags.selectedDefenderId) return stateWithClearedFlags;
        return resolvePlayerCombat(stateWithClearedFlags);
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
      
      if (state.turn !== 1 || player.hasRedrawn) return state;

      // Shuffle hand back into deck
      player.deck.push(...player.hand);
      player.hand = [];
      for (let i = player.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [player.deck[i], player.deck[j]] = [player.deck[j], player.deck[i]];
      }

      // Draw 5 new cards
      player = drawCardsWithBiomeAffinity(player, 5, state.activeBiome).player;
      player.hasRedrawn = true;

      const logMessage = activePlayerKey === 'player' 
        ? { type: 'draw' as const, turn: state.turn, message: 'Joueur pioche une nouvelle main.' }
        : { type: 'draw' as const, turn: state.turn, message: 'Adversaire pioche une nouvelle main.' };


      return {
        ...state,
        [activePlayerKey]: player,
        phase: 'post_mulligan',
        log: [...state.log, logMessage]
      };
    }

    case 'PASS_TURN': {
      if (stateWithClearedFlags.phase === 'game-over') return stateWithClearedFlags;
      
      const currentPlayerKey = stateWithClearedFlags.activePlayer;
      const nextPlayerKey = currentPlayerKey === 'player' ? 'opponent' : 'player';
      
      let currentPlayer = {...stateWithClearedFlags[currentPlayerKey]};
      let currentLog = [...stateWithClearedFlags.log];

      // Handle "Meditate" action before passing the turn
      if (state.phase === 'main' && (state.log.at(-1)?.message.includes('méditer') || action.type === 'MEDITATE')) {
        if(currentPlayer.graveyard.length > 0 && currentPlayer.hand.length < MAX_HAND_SIZE) {
          const randomIndex = Math.floor(Math.random() * currentPlayer.graveyard.length);
          const cardFromGraveyard = currentPlayer.graveyard[randomIndex];
          currentPlayer.hand.push(cardFromGraveyard);
          currentPlayer.graveyard.splice(randomIndex, 1);
          currentLog.push({type: 'draw', turn: stateWithClearedFlags.turn, message: `${currentPlayerKey === 'player' ? 'Joueur' : 'Adversaire'} récupère ${cardFromGraveyard.name} du cimetière.`})
        }
      }

      let artifactsToRemove: string[] = [];
      let updatedBattlefield = currentPlayer.battlefield.map((c: Card) => {
        let newCard = {...c};
        if (c.type === 'Creature') {
          newCard.buffs = c.buffs.map((b: Buff) => ({ ...b, duration: b.duration - 1 })).filter((b: Buff) => b.duration > 0 || b.source === 'biome' || b.duration === Infinity);
        
          if (newCard.skill?.onCooldown) {
            newCard.skill.currentCooldown = (newCard.skill.currentCooldown || 0) - 1;
            if (newCard.skill.currentCooldown <= 0) {
              newCard.skill.onCooldown = false;
            }
          }
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

      if (stateWithClearedFlags.activeBiome?.biome === 'Sanctuary') {
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


      const nextTurnNumber = nextPlayerKey === 'player' ? stateWithClearedFlags.turn + 1 : stateWithClearedFlags.turn;
      
      const intermediateState = {...stateWithClearedFlags, [currentPlayerKey]: currentPlayer, log: currentLog };
      
      let nextPlayer = { ...intermediateState[nextPlayerKey] };
      const { player: drawnPlayer } = drawCardsWithBiomeAffinity(nextPlayer, 1, state.activeBiome);
      nextPlayer = drawnPlayer;
      
      nextPlayer.maxMana = Math.min(10, (nextPlayer.maxMana || 0) + 1);
      nextPlayer.mana = nextPlayer.maxMana;
      
      let finalState = {
        ...stateWithClearedFlags,
        turn: nextTurnNumber,
        activePlayer: nextPlayerKey,
        phase: 'main',
        selectedCardId: null,
        selectedAttackerId: null,
        selectedDefenderId: null,
        spellBeingCast: null,
        [currentPlayerKey]: currentPlayer,
        [nextPlayerKey]: nextPlayer,
        log: [...intermediateState.log, { type: 'phase', turn: nextTurnNumber, message: `Début du tour de ${nextPlayerKey === 'player' ? 'Joueur' : "l'Adversaire"}.` }],
        isThinking: nextPlayerKey === 'opponent',
      };
      
      if(artifactsToRemove.length > 0) {
        finalState.log.push({ type: 'info', turn: finalState.turn, message: `L'effet de ${graveyardAdditions.map(c => c.name).join(', ')} se termine.` });
      }
      
      return finalState;
    }
    
    case 'EXECUTE_OPPONENT_TURN': {
      if (stateWithClearedFlags.activePlayer !== 'opponent') return stateWithClearedFlags;
      
      let finalStateFromAI = opponentAI(stateWithClearedFlags);
      
      if (finalStateFromAI.phase === 'post_mulligan') {
          const playableCards = finalStateFromAI.opponent.hand.filter(c => c.manaCost <= finalStateFromAI.opponent.mana && (c.type === 'Creature' || c.type === 'Artifact' || c.type === 'Land'));
          if (playableCards.length > 0) {
              const cardToPlay = playableCards.sort((a, b) => b.manaCost - a.manaCost)[0];
              const stateAfterPlay = gameReducer(finalStateFromAI, {type: 'PLAY_CARD', cardId: cardToPlay.id});
              return {
                ...stateAfterPlay,
                isThinking: false
              };
          }
          // If no card can be played after mulligan, pass the turn.
           const stateAfterPass = gameReducer({...finalStateFromAI, isThinking: false }, {type: 'PASS_TURN'});
            return {
                ...stateAfterPass,
                isThinking: false
            };
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
      return stateWithClearedFlags;
  }
}

    