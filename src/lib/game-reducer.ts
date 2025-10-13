'use client';
import type { GameState, Card, Player, GamePhase, Buff, LogEntry, ElementType } from './types';
import { createDeck, allCards } from '@/data/initial-cards';

const MAX_HAND_SIZE = 7;
const MAX_BATTLEFIELD_SIZE = 7;

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
  | { type: 'END_SPELL_ANIMATION' }
  | { type: 'CLEAN_BATTLEFIELD' }
  | { type: 'PAUSE_GAME' }
  | { type: 'ACTIVATE_FOCUS_DRAW' };

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
    hp: 20, mana: 0, maxMana: 0, deck: [], hand: [], battlefield: [], graveyard: [], biomeChanges: 2, hasRedrawn: false, focusDrawNextTurn: false,
});

const applyGlobalEnchantmentEffects = (player: Player): Player => {
    const enchantments = player.battlefield.filter(c => c.type === 'Enchantment');
    if (enchantments.length === 0) {
        // If no enchantments, return a version of the player with enchantment buffs removed
        return {
            ...player,
            battlefield: player.battlefield.map(card => ({
                ...card,
                buffs: card.buffs.filter(b => b.source !== 'enchantment')
            }))
        };
    }

    const newBattlefield = player.battlefield.map(card => {
        if (card.type !== 'Creature') return card;

        let newCard = { ...card };
        // First, clear existing enchantment buffs to avoid stacking duplicates
        newCard.buffs = newCard.buffs.filter(b => b.source !== 'enchantment');

        for (const enchantment of enchantments) {
            if (enchantment.element === newCard.element) {
                if (enchantment.id.startsWith('fire_aura')) {
                    newCard.buffs.push({ type: 'attack', value: 1, duration: Infinity, source: 'enchantment' });
                }
                if (enchantment.id.startsWith('ice_shield')) {
                    newCard.buffs.push({ type: 'armor', value: 1, duration: Infinity, source: 'enchantment' });
                }
                if (enchantment.id.startsWith('forest_heart')) {
                    // This is tricky. Let's just grant a buff that we can check elsewhere if needed
                    // For now, let's represent it as an armor buff for simplicity until we can add health buffs
                    newCard.buffs.push({ type: 'armor', value: 1, duration: Infinity, source: 'enchantment' });
                }
                if (enchantment.id.startsWith('shadow_link') && !newCard.skill) {
                    newCard.skill = { type: 'lifesteal', used: false };
                }
            }
        }
        return newCard;
    });

    return { ...player, battlefield: newBattlefield };
};


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
  const defaultBiomeCard: Card = {
    id: 'forest_biome-initial',
    name: 'Forêt',
    type: 'Biome',
    manaCost: 0,
    description: 'Le biome de départ.',
    image: { id: 'forest_biome', description: 'A forest biome card.', imageUrl: 'https://picsum.photos/seed/forest_biome/300/400', imageHint: 'forest biome' },
    biome: 'Forest',
    tapped: false,
    isAttacking: false,
    canAttack: false,
    summoningSickness: false,
    buffs: []
  };

  const initialState: GameState = {
    gameId: 0,
    turn: 1,
    activePlayer: 'player',
    phase: 'main',
    player: createInitialPlayer('player'),
    opponent: createInitialPlayer('opponent'),
    log: [],
    isThinking: false,
    activeBiome: defaultBiomeCard,
    winner: undefined,
    selectedCardId: null,
    selectedAttackerId: null,
    selectedDefenderId: null,
    spellBeingCast: null,
    combatAnimation: null,
    spellAnimation: null,
  };
  
  return initialState;
};

const shuffleAndDeal = (state: GameState): Omit<GameState, 'gameId'> => {
    let player = createInitialPlayer('player');
    let opponent = createInitialPlayer('opponent');

    player.deck = createDeck('player');
    opponent.deck = createDeck('opponent');
    
    const defaultBiomeCard: Card = {
      id: 'forest_biome-initial',
      name: 'Forêt',
      type: 'Biome',
      manaCost: 0,
      description: 'Le biome de départ.',
      image: { id: 'forest_biome', description: 'A forest biome card.', imageUrl: 'https://picsum.photos/seed/forest_biome/300/400', imageHint: 'forest biome' },
      biome: 'Forest',
      tapped: false,
      isAttacking: false,
      canAttack: false,
      summoningSickness: false,
      buffs: []
    };
    const activeBiome = defaultBiomeCard;

    player = drawCardsWithBiomeAffinity(player, 7, activeBiome).player;
    opponent = drawCardsWithBiomeAffinity(opponent, 7, activeBiome).player;
    
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
        spellAnimation: null,
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
    
    if (isCritical) {
        damageDealt = Math.floor(damageDealt * 1.5);
        newLog.push({ type: 'combat', turn, message: `💥 Coup critique !` });
    }

    newLog.push({ type: 'combat', turn, message: `${newAttacker.name} attaque avec ${damageDealt} points de dégâts.` });

    if ('battlefield' in newDefender) { // It's a player
        newDefender.hp -= damageDealt;
        newLog.push({ type: 'damage', turn, message: `${newDefender.id === 'player' ? 'Joueur' : 'Adversaire'} subit ${damageDealt} dégâts. PV restants: ${newDefender.hp}`, target: newDefender.id });
    } else { // It's a card
        const totalArmor = (newDefender.armor || 0) + (newDefender.buffs?.filter(b => b.type === 'armor').reduce((acc, b) => acc + b.value, 0) || 0);
        const defenderOwnerKey = newAttackerOwner.id === 'player' ? 'opponent' : 'player';

        if (isCritical) {
            newLog.push({ type: 'combat', turn, message: `L'armure de ${newDefender.name} est ignorée.` });
            newDefender.health = (newDefender.health || 0) - damageDealt;
            newLog.push({ type: 'damage', turn, message: `${newDefender.name} subit ${damageDealt} dégâts directs. PV restants: ${newDefender.health}`, target: defenderOwnerKey });
        } else {
            const damageAfterArmor = Math.max(0, damageDealt - totalArmor);
            const absorbedDamage = damageDealt - damageAfterArmor;

            if (absorbedDamage > 0) {
                newDefender.armor = Math.max(0, totalArmor - damageDealt);
                newLog.push({ type: 'combat', turn, message: `${newDefender.name} absorbe ${absorbedDamage} dégâts. Armure restante: ${newDefender.armor}`, target: defenderOwnerKey });
            }
            
            if (damageAfterArmor > 0) {
                newDefender.health = (newDefender.health || 0) - damageAfterArmor;
                newLog.push({ type: 'damage', turn, message: `${newDefender.name} subit ${damageAfterArmor} dégâts. PV restants: ${newDefender.health}`, target: defenderOwnerKey });
            }
        }
    }

    if (newAttacker.skill?.type === 'lifesteal') {
        const healedAmount = Math.ceil(damageDealt / 2);
        newAttackerOwner.hp = Math.min(20, newAttackerOwner.hp + healedAmount);
        newLog.push({ type: 'heal', turn, message: `Vol de vie: ${newAttacker.name} soigne son propriétaire de ${healedAmount} PV.`, target: newAttackerOwner.id });
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
  
  let actionsTaken = 0;
  const MAX_ACTIONS_PER_TURN = 10; // To prevent infinite loops

  while (actionsTaken < MAX_ACTIONS_PER_TURN) {
    let actionFound = false;

    // --- PRIORITIES ---

    // 1. SURVIVAL: Heal if HP is low
    if (opponent.hp <= 10) {
      const healthPotion = opponent.hand.find(c => c.id.startsWith('health_potion') && c.manaCost <= opponent.mana);
      if (healthPotion) {
        if(applyAction({ type: 'PLAY_CARD', cardId: healthPotion.id })) {
           actionFound = true;
           actionsTaken++;
           continue;
        }
      }
    }
    
    // 2. BOARD PRESENCE: Play creatures if board is weak
    const opponentCreaturesOnBoard = opponent.battlefield.filter(c => c.type === 'Creature').length;
    if (opponentCreaturesOnBoard < 2) {
        const creaturesInHand = opponent.hand
            .filter(c => c.type === 'Creature' && c.manaCost <= opponent.mana)
            .sort((a, b) => b.manaCost - a.manaCost); // Play strongest first
        if (creaturesInHand.length > 0) {
            if (applyAction({ type: 'PLAY_CARD', cardId: creaturesInHand[0].id })) {
                actionFound = true;
                actionsTaken++;
                continue;
            }
        }
    }

    // --- STANDARD ACTIONS ---

    // 3. Play Land if possible
    const landPlayedThisTurn = opponent.battlefield.some(c => c.type === 'Land' && c.summoningSickness);
    if (!landPlayedThisTurn) {
      const landInHand = opponent.hand.find(c => c.type === 'Land');
      if (landInHand) {
        if(applyAction({ type: 'PLAY_CARD', cardId: landInHand.id })) {
            actionFound = true;
            actionsTaken++;
            continue; // Re-evaluate state after a significant action
        }
      }
    }
    
    // 4. Use Mana Potion if it allows playing a better card this turn
    const manaPotion = opponent.hand.find(c => c.id.startsWith('mana_potion') && c.manaCost <= opponent.mana);
    if (manaPotion) {
      const potentialMana = opponent.mana - manaPotion.manaCost + 2;
      const powerfulCard = opponent.hand.find(c => c.type === 'Creature' && c.manaCost > opponent.mana && c.manaCost <= potentialMana);
      if (powerfulCard) {
        if(applyAction({ type: 'PLAY_CARD', cardId: manaPotion.id })) {
            actionFound = true;
            actionsTaken++;
            continue;
        }
      }
    }

    // 5. Use spells and skills strategically
    // Offensive spells to remove high-threat targets
    const damageSpells = opponent.hand.filter(c => c.type === 'Spell' && (c.skill?.type === 'damage' || c.skill?.type === 'damage_and_heal') && c.manaCost <= opponent.mana);
    if (damageSpells.length > 0) {
        const killableTargets = player.battlefield.filter(t => t.type === 'Creature' && damageSpells.some(spell => (t.health || 0) <= (spell.skill?.value || 0)));
        if (killableTargets.length > 0) {
            const bestTarget = killableTargets.sort((a, b) => (b.attack || 0) - (a.attack || 0))[0];
            const bestSpell = damageSpells.find(spell => (bestTarget.health || 0) <= (spell.skill?.value || 0));
            if (bestSpell) {
                if(applyAction({ type: 'PLAY_CARD', cardId: bestSpell.id })) {
                   if(applyAction({ type: 'CAST_SPELL_ON_TARGET', targetId: bestTarget.id })) {
                       actionFound = true;
                       actionsTaken++;
                       continue;
                   }
                }
            }
        }
    }
    
    // Buff spells before combat
    const buffSpells = opponent.hand.filter(c => c.type === 'Spell' && (c.skill?.type === 'buff_attack' || c.skill?.type === 'buff_attack_and_armor' || c.skill?.type === 'buff_armor') && c.manaCost <= opponent.mana);
    if (buffSpells.length > 0) {
        const attackers = opponent.battlefield.filter(c => c.type === 'Creature' && !c.tapped && !c.summoningSickness);
        if (attackers.length > 0) {
            const bestTarget = attackers.sort((a,b) => (b.attack || 0) - (a.attack || 0))[0];
            if(applyAction({ type: 'PLAY_CARD', cardId: buffSpells[0].id })) {
                if(applyAction({ type: 'CAST_SPELL_ON_TARGET', targetId: bestTarget.id })) {
                    actionFound = true;
                    actionsTaken++;
                    continue;
                }
            }
        }
    }

    // Use creature skills
    const activatableSkills = opponent.battlefield.filter(c => c.skill && !c.skill.onCooldown && !c.tapped && !c.summoningSickness);
    for (const card of activatableSkills) {
        if (card.skill?.type === 'draw') {
            if (opponent.hand.length < MAX_HAND_SIZE) {
                if(applyAction({ type: 'ACTIVATE_SKILL', cardId: card.id })) {
                    actionFound = true;
                    break;
                }
            }
        } else if (card.skill?.type === 'taunt') {
            if (!card.taunt) {
                 if(applyAction({ type: 'ACTIVATE_SKILL', cardId: card.id })) {
                    actionFound = true;
                    break;
                 }
            }
        } else if (card.skill?.type === 'sacrifice') {
          // Heal a valuable ally that is damaged
          const valuableAllies = opponent.battlefield.filter(c => c.id !== card.id && c.type === 'Creature' && (c.health || 0) < (c.initialHealth || 0) && (c.attack || 0) >= 4);
          if (valuableAllies.length > 0) {
            const targetToHeal = valuableAllies.sort((a,b) => (a.initialHealth! - a.health!) - (b.initialHealth! - b.health!))[0]; // Heal the most damaged one
            if(applyAction({type: 'ACTIVATE_SKILL', cardId: card.id, targetId: targetToHeal.id})) {
                actionFound = true;
                break;
            }
          }
        }
    }
     if(actionFound) { actionsTaken++; continue; }
     
    // 6. LAST RESORT: Sacrifice non-essential cards for health
    if (opponent.hp <= 8 && !opponent.hand.some(c => c.id.startsWith('health_potion'))) {
        const sacrificableCards = opponent.hand.filter(c => 
            c.type !== 'Creature' && 
            c.skill?.type !== 'heal' && 
            !c.id.startsWith('health_potion')
        );

        if (sacrificableCards.length > 0) {
            const cardsToSacrifice = sacrificableCards.slice(0, 2); // Sacrifice up to 2 cards
            const healthGain = cardsToSacrifice.length * 3;

            opponent.hp = Math.min(20, opponent.hp + healthGain);
            opponent.hand = opponent.hand.filter(c => !cardsToSacrifice.find(sac => sac.id === c.id));
            opponent.graveyard.push(...cardsToSacrifice);
            
            log.push({ type: 'heal', turn, message: `Dernier recours: L'IA sacrifie ${cardsToSacrifice.length} cartes pour regagner ${healthGain} PV.`, target: 'opponent' });
            actionFound = true;
            actionsTaken++;
            continue;
        }
    }

    // 7. Play other cards (creatures/artifacts/enchantments) to establish board presence
    if (opponent.battlefield.length < MAX_BATTLEFIELD_SIZE) {
        const hasCreatures = opponent.battlefield.some(c => c.type === 'Creature');
        const playableCards = opponent.hand
            .filter(c => {
                if (c.manaCost > opponent.mana) return false;
                // Don't play an enchantment if there are no creatures on the board
                if (c.type === 'Enchantment' && !hasCreatures) return false;
                return c.type === 'Creature' || c.type === 'Artifact' || c.type === 'Enchantment';
            })
            .sort((a, b) => {
                // Prioritize creatures if the board is empty
                if (!hasCreatures) {
                    if (a.type === 'Creature' && b.type !== 'Creature') return -1;
                    if (a.type !== 'Creature' && b.type === 'Creature') return 1;
                }
                // Otherwise, play the highest mana cost card
                return b.manaCost - a.manaCost;
            });
    
        if (playableCards.length > 0) {
            if (applyAction({ type: 'PLAY_CARD', cardId: playableCards[0].id })) {
                actionFound = true;
                actionsTaken++;
                continue;
            }
        }
    }

    // If no action was found in this loop, break to avoid infinite loop
    if (!actionFound) {
      break;
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
    combatLog.push({ type: 'phase', turn: combatState.turn, message: `Adversaire passe en phase de combat.`, target: 'opponent' });
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
            targetId = 'player';
        } else {
            // Can't kill anything, decide if it's worth attacking the player or a creature
            if (combatPlayer.hp < totalAttack) { // Lethal
                targetId = 'player';
            } else {
                // If AI creature would die and player creature would live, it's a bad trade, don't attack
                const weakestBlocker = potentialBlockers.sort((a, b) => (a.attack || 0) - (b.attack || 0))[0];
                const riposteDamage = (weakestBlocker.attack || 0) - (attackerCard.armor || 0);
                if (riposteDamage < (attackerCard.health || 0)) {
                    targetId = 'player'; // Attack player if the trade is bad or there are no blockers
                }
            }
        }
      }

      if (targetId) {
          combatState.combatAnimation = { attackerId: attackerCard.id, defenderId: targetId };
          let defender: Card | Player | undefined = targetId === 'player' ? combatPlayer : combatPlayer.battlefield.find(c => c.id === targetId);
          if (!defender) continue;
          
          const combatResult = resolveDamage(attackerCard, defender, combatLog, combatState.turn, combatOpponent);
          
          combatOpponent = combatResult.attackerOwner;

          if (targetId === 'player') {
              combatPlayer = combatResult.defender as Player;
          } else {
              combatPlayer.battlefield = combatPlayer.battlefield.map(c => c.id === targetId ? combatResult.defender as Card : c);

              // Riposte
              const finalDefenderState = combatPlayer.battlefield.find(c => c.id === targetId);
              if (finalDefenderState && (finalDefenderState.health || 0) > 0 && !finalDefenderState.tapped) {
                 combatLog.push({ type: 'combat', turn, message: `${finalDefenderState.name} riposte !`, target: 'player' });
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
      combatLog.push({ type: 'game_over', turn: combatState.turn, message: "Le joueur a été vaincu.", target: 'player' })
  } else if (combatOpponent.hp <= 0) {
      combatState.winner = 'player';
      combatState.phase = 'game-over';
      combatLog.push({ type: 'game_over', turn: combatState.turn, message: "L'adversaire a été vaincu.", target: 'opponent' })
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
    newState.combatAnimation = { attackerId: attackerCard.id, defenderId: selectedDefenderId as string | 'opponent' };

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

        finalLog.push({ type: 'combat', turn: turn, message: `Joueur: ${newAttacker.name} attaque ${newDefender.name}.`, target: 'player' });

        // --- Perform Combat ---
        const combatResult = resolveDamage(newAttacker, newDefender, finalLog, turn, finalPlayer);
        newAttacker = combatResult.attacker;
        newDefender = combatResult.defender as Card;
        finalPlayer = combatResult.attackerOwner;
        finalLog = combatResult.log;

        
        // --- Riposte (Retaliation) ---
        if ((newDefender.health || 0) > 0) {
            finalLog.push({ type: 'combat', turn: turn, message: `${newDefender.name} riposte !`, target: 'opponent' });
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
        finalLog.push({ type: 'game_over', turn: turn, message: "L'adversaire a été vaincu.", target: 'player'})
    } else if (finalPlayer.hp <= 0) {
        winner = 'opponent';
        finalLog.push({ type: 'game_over', turn: turn, message: "Le joueur a été vaincu.", target: 'opponent'})
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
                log.push({ type: 'play', turn, message: `L'entité ${newCard.name} est invoquée !`, target: activePlayerKey });
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
        let player = { ...initialState.player };
        
        player.maxMana = 1;
        player.mana = 1;
        
        const newState = {
            ...state,
            ...initialState,
            gameId: Date.now(),
            player,
        };
        
        return {
            ...newState,
            log: [...newState.log, { type: 'phase', turn: 1, message: "Début du tour de Joueur."}]
        }
    }

    case 'RESTART_GAME': {
        const initialState = shuffleAndDeal(state);
        let player = { ...initialState.player };
        
        player.maxMana = 1;
        player.mana = 1;
        
        const newState = {
            ...state,
            ...initialState,
            gameId: Date.now(),
            player,
        };

        return {
            ...newState,
            log: [...newState.log, { type: 'phase', turn: 1, message: "Début du tour de Joueur."}]
        }
    }
    
    case 'END_COMBAT_ANIMATION': {
        return {
            ...state,
            combatAnimation: null
        }
    }
    
    case 'END_SPELL_ANIMATION': {
        return {
            ...state,
            spellAnimation: null
        }
    }

    case 'CLEAN_BATTLEFIELD': {
        const clean = (p: Player, ownerKey: 'player' | 'opponent'): { player: Player, log: LogEntry[] } => {
            const graveyard = [...p.graveyard];
            let log = [] as LogEntry[];
            const battlefield = p.battlefield.filter(c => {
                if ((c.health || 0) <= 0) {
                    graveyard.push({ ...c, health: c.initialHealth, buffs: [] });
                    log.push({ type: 'destroy', turn: state.turn, message: `${c.name} est détruit.`, target: ownerKey });
                    return false;
                }
                return true;
            });
            return { player: { ...p, battlefield, graveyard }, log };
        };

        const { player, log: playerLog } = clean(state.player, 'player');
        const { player: opponent, log: opponentLog } = clean(state.opponent, 'opponent');
        
        return { ...state, player, opponent, log: [...state.log, ...playerLog, ...opponentLog] };
    }


    case 'DRAW_CARD': {
        const { player: playerKey, count } = action;
        let playerToUpdate = {...stateWithClearedFlags[playerKey]};
        const { player: updatedPlayer, drawnCard } = drawCardsWithBiomeAffinity(playerToUpdate, count, stateWithClearedFlags.activeBiome);
        let log = [...stateWithClearedFlags.log];
        if (updatedPlayer.hand.length > playerToUpdate.hand.length) {
            const message = `${playerKey === 'player' ? 'Joueur' : 'Adversaire'} pioche ${count > 1 ? count + ' cartes' : (drawnCard?.name || 'une carte')}.`
            log.push({ type: 'draw', turn: stateWithClearedFlags.turn, message: message, target: playerKey });
        }
        else if (count > 0) {
          log.push({ type: 'info', turn: stateWithClearedFlags.turn, message: `${playerKey === 'player' ? "Votre" : "Sa"} main est pleine, la carte est défaussée.`, target: playerKey});
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
                logEntry = { type: 'skill', turn: stateWithClearedFlags.turn, message: `${activePlayerKey === 'player' ? 'Joueur' : 'Adversaire'} active la compétence Provocation de ${cardToUpdate.name}!`, target: activePlayerKey };
                break;
            case 'draw':
                const { player: drawnPlayer, drawnCard } = drawCardsWithBiomeAffinity(player, 1, stateWithClearedFlags.activeBiome);
                player = drawnPlayer;
                logEntry = { type: 'draw', turn: stateWithClearedFlags.turn, message: `${cardToUpdate.name} fait piocher ${drawnCard?.name || 'une carte'}.`, target: activePlayerKey };
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
      const battlefieldCardCount = player.battlefield.filter((c: Card) => c.type === 'Creature' || c.type === 'Artifact' || c.type === 'Enchantment').length;
      if ((card.type === 'Creature' || card.type === 'Artifact' || card.type === 'Enchantment') && battlefieldCardCount >= MAX_BATTLEFIELD_SIZE) {
        return { ...state, log: [...state.log, { type: 'info', turn: state.turn, message: "Vous avez trop de cartes sur le terrain." }]};
      }
      if (card.type === 'Biome') {
          return gameReducer(state, { type: 'CHANGE_BIOME', cardId: card.id, player: activePlayerKey });
      }
       if (card.type === 'Enchantment' && !player.battlefield.some(c => c.type === 'Creature')) {
        return { ...state, log: [...state.log, { type: 'info', turn: state.turn, message: "Vous devez avoir une créature pour jouer un enchantement." }]};
      }
      
      const newHand = player.hand.filter((c: Card) => c.id !== card.id);
      const newMana = player.mana - card.manaCost;
      let newLog = [...state.log, { type: 'play', turn: state.turn, message: `${activePlayerKey === 'player' ? 'Joueur' : 'Adversaire'} joue ${card.name}.`, target: activePlayerKey }];
      
      let newPlayerState = {...player, hand: newHand, mana: newMana};
      let tempNewState: GameState = {...state, log: newLog };

      const newCardState: Card = { ...card, summoningSickness: true, canAttack: false, buffs: [], isEntering: true };

      if (card.type === 'Land') {
        newPlayerState.battlefield = [...newPlayerState.battlefield, newCardState];
        newPlayerState.maxMana = newPlayerState.maxMana + 1;
        newPlayerState.mana = newPlayerState.mana; // Mana from land is available next turn, but let's give it now
      } else if (card.type === 'Creature' || card.type === 'Artifact' || card.type === 'Enchantment') {
        newPlayerState.battlefield = [...newPlayerState.battlefield, newCardState];
        
        let updatedPlayerWithEffects = { ...newPlayerState };

        if (card.type === 'Enchantment') {
            updatedPlayerWithEffects = applyGlobalEnchantmentEffects(updatedPlayerWithEffects);
        } else {
             updatedPlayerWithEffects.battlefield = applyBiomeBuffs(updatedPlayerWithEffects.battlefield, tempNewState.activeBiome);
        }
        
        newPlayerState = updatedPlayerWithEffects;

        if (card.type === 'Artifact' && card.skill?.type === 'global_buff_armor') {
            newPlayerState.battlefield = newPlayerState.battlefield.map((c: Card) => {
                if (c.type === 'Creature') {
                    return {...c, buffs: [...c.buffs, { type: 'armor', value: card.skill.value || 0, duration: card.skill.duration || 0, source: 'artifact' }]};
                }
                return c;
            });
            tempNewState.log.push({ type: 'buff', turn: state.turn, message: `${card.name} donne +${card.skill.value} armure à toutes les créatures.` });
        }
      } else if (card.type === 'Spell' || card.type === 'Potion') {
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
            tempNewState.log.push({ type: 'heal', turn: state.turn, message: `${activePlayerKey === 'player' ? 'Joueur' : 'Adversaire'} se soigne de 5 PV.`, target: activePlayerKey });
        } else if (card.id.startsWith('mana_potion')) {
            newPlayerState.mana = newPlayerState.mana + 2;
            tempNewState.log.push({ type: 'mana', turn: state.turn, message: `${activePlayerKey === 'player' ? 'Joueur' : 'Adversaire'} gagne 2 mana.`, target: activePlayerKey });
        }
        newPlayerState.graveyard = [...newPlayerState.graveyard, card];
      }

      let finalState: GameState = {
        ...tempNewState,
        [activePlayerKey]: newPlayerState,
        selectedCardId: null,
      };

      if (card.type === 'Creature' || card.type === 'Artifact' || card.type === 'Enchantment') {
          finalState = checkForCombos(finalState);
          // Re-apply enchantments in case a fusion happened
          const playerWithEnchantments = applyGlobalEnchantmentEffects(finalState[activePlayerKey]);
          finalState = { ...finalState, [activePlayerKey]: playerWithEnchantments };
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
      log.push({ type: 'spell', turn, message: `${ownerName} utilise ${spellOrSkillCaster.name} sur ${target.name}.`, target: activePlayerKey });
    
      let targetCard = { ...target };
      let activePlayerObject = activePlayerKey === 'player' ? player : opponent;
    
      // Apply skill/spell effect
      switch (spellOrSkillCaster.skill?.type) {
        case 'damage':
          targetCard.health = (targetCard.health || 0) - (spellOrSkillCaster.skill.value || 0);
          log.push({ type: 'damage', turn, message: `${targetCard.name} subit ${spellOrSkillCaster.skill.value} dégâts. PV restants: ${targetCard.health}`, target: targetOwnerKey });
          break;
        case 'damage_and_heal':
            targetCard.health = (targetCard.health || 0) - (spellOrSkillCaster.skill.value || 0);
            activePlayerObject.hp = Math.min(20, activePlayerObject.hp + (spellOrSkillCaster.skill.heal || 0));
            log.push({ type: 'damage', turn, message: `${targetCard.name} subit ${spellOrSkillCaster.skill.value} dégâts. PV restants: ${targetCard.health}`, target: targetOwnerKey });
            log.push({ type: 'heal', turn, message: `${ownerName} se soigne de ${spellOrSkillCaster.skill.heal} PV.`, target: activePlayerKey });
            break;
        case 'buff_attack':
          targetCard.buffs.push({ type: 'attack', value: spellOrSkillCaster.skill.value || 0, duration: spellOrSkillCaster.skill.duration || Infinity, source: 'spell' });
          log.push({ type: 'buff', turn, message: `${targetCard.name} gagne +${spellOrSkillCaster.skill.value} en attaque.`, target: targetOwnerKey });
          break;
        case 'buff_armor':
          targetCard.buffs.push({ type: 'armor', value: spellOrSkillCaster.skill.value || 0, duration: spellOrSkillCaster.skill.duration || Infinity, source: 'spell' });
          log.push({ type: 'buff', turn, message: `${targetCard.name} gagne +${spellOrSkillCaster.skill.value} en armure.`, target: targetOwnerKey });
          break;
        case 'buff_attack_and_armor':
            targetCard.buffs.push({ type: 'attack', value: spellOrSkillCaster.skill.attack || 0, duration: spellOrSkillCaster.skill.duration || Infinity, source: 'spell' });
            targetCard.buffs.push({ type: 'armor', value: spellOrSkillCaster.skill.armor || 0, duration: spellOrSkillCaster.skill.duration || Infinity, source: 'spell' });
            log.push({ type: 'buff', turn, message: `${targetCard.name} gagne +${spellOrSkillCaster.skill.attack} en attaque et +${spellOrSkillCaster.skill.armor} en armure.`, target: targetOwnerKey });
            break;
        case 'heal':
          targetCard.health = Math.min(targetCard.initialHealth || 0, (targetCard.health || 0) + (spellOrSkillCaster.skill.value || 0));
          log.push({ type: 'heal', turn, message: `${spellOrSkillCaster.name} soigne ${targetCard.name} de ${spellOrSkillCaster.skill.value} PV.`, target: targetOwnerKey });
          break;
        case 'sacrifice':
            const sacrificedCard = stateWithClearedFlags[activePlayerKey].battlefield.find(c => c.id === spellOrSkillCaster.id);
            if (sacrificedCard && sacrificedCard.health) {
                // The skill heals for a percentage of the *target's* remaining health, not the sacrificed unit's health
                const healAmount = Math.floor((targetCard.health || 0) * 0.75);
                targetCard.health = Math.min(targetCard.initialHealth!, (targetCard.health || 0) + healAmount);
                log.push({ type: 'heal', turn, message: `${sacrificedCard.name} est sacrifié et soigne ${targetCard.name} de ${healAmount} PV.`, target: targetOwnerKey });
                
                let playerToUpdate = activePlayerKey === 'player' ? player : opponent;
                playerToUpdate.battlefield = playerToUpdate.battlefield.filter(c => c.id !== sacrificedCard.id);
                playerToUpdate.graveyard.push(sacrificedCard);

                if (activePlayerKey === 'player') player = playerToUpdate;
                else opponent = playerToUpdate;
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
    
      const updateField = (p: Player, ownerKey: 'player' | 'opponent'): { player: Player, log: LogEntry[] } => {
        let graveyard = [...p.graveyard];
        let log: LogEntry[] = [];
        const remainingCreatures = p.battlefield.filter(c => {
          if ((c.health || 0) <= 0) {
            log.push({ type: 'destroy', turn, message: `${c.name} est détruit.`, target: ownerKey });
            graveyard.push({ ...c, health: c.initialHealth, buffs: [] });
            return false;
          }
          return true;
        });
        return { player: { ...p, battlefield: remainingCreatures, graveyard }, log };
      };
    
      const { player: updatedOpponent, log: opponentLog } = updateField(opponent, "opponent");
      opponent = updatedOpponent;
      log.push(...opponentLog);
      
      const { player: updatedPlayer, log: playerLog } = updateField(player, "player");
      player = updatedPlayer;
      log.push(...playerLog);
    
      return {
        ...stateWithClearedFlags,
        opponent,
        player,
        log,
        phase: 'main',
        spellBeingCast: null,
        selectedCardId: null,
        spellAnimation: { targetId }
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

      if (player.hand.length === 0 || player.mana < 1) return state;

      const handSizeBeforeRedraw = player.hand.length;

      // Deduct mana
      player.mana -= 1;

      // Shuffle hand back into deck
      player.deck.push(...player.hand);
      player.hand = [];
      for (let i = player.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [player.deck[i], player.deck[j]] = [player.deck[j], player.deck[i]];
      }

      // Draw the same number of cards
      player = drawCardsWithBiomeAffinity(player, handSizeBeforeRedraw, state.activeBiome).player;

      const logMessage: LogEntry = { type: 'draw', turn: state.turn, message: `${activePlayerKey === 'player' ? 'Joueur' : 'Adversaire'} change sa main pour 1 mana.`, target: activePlayerKey };

      return {
        ...state,
        [activePlayerKey]: player,
        log: [...state.log, logMessage],
        phase: 'main',
      };
    }

    case 'ACTIVATE_FOCUS_DRAW': {
        if (state.activePlayer !== 'player' || state.phase !== 'main' || state.player.hand.length !== 1) {
            return state;
        }
        return {
            ...state,
            player: { ...state.player, focusDrawNextTurn: true },
            log: [...state.log, { type: 'skill', turn: state.turn, message: "Joueur se concentre pour sa prochaine pioche.", target: 'player' }]
        };
    }

    case 'PASS_TURN': {
      if (stateWithClearedFlags.phase === 'game-over') return stateWithClearedFlags;
      
      const currentPlayerKey = stateWithClearedFlags.activePlayer;
      const nextPlayerKey = currentPlayerKey === 'player' ? 'opponent' : 'player';
      
      let currentPlayer = {...stateWithClearedFlags[currentPlayerKey]};
      let currentLog = [...stateWithClearedFlags.log];

      // Handle "Meditate" action before passing the turn
      if (state.phase === 'main' && (state.log.at(-1)?.message.includes('Méditer') || action.type === 'MEDITATE')) {
        if(currentPlayer.graveyard.length > 0 && currentPlayer.hand.length < MAX_HAND_SIZE) {
          const randomIndex = Math.floor(Math.random() * currentPlayer.graveyard.length);
          const cardFromGraveyard = currentPlayer.graveyard[randomIndex];
          currentPlayer.hand.push(cardFromGraveyard);
          currentPlayer.graveyard.splice(randomIndex, 1);
          currentLog.push({type: 'draw', turn: stateWithClearedFlags.turn, message: `${currentPlayerKey === 'player' ? 'Joueur' : 'Adversaire'} récupère ${cardFromGraveyard.name} du cimetière.`, target: currentPlayerKey})
        }
      }

      // AI auto-focus draw
      if (currentPlayerKey === 'opponent' && currentPlayer.hand.length <= 2) {
          currentPlayer.focusDrawNextTurn = true;
          currentLog.push({ type: 'skill', turn: stateWithClearedFlags.turn, message: "L'adversaire se concentre for sa prochaine pioche.", target: 'opponent' });
      }

      let artifactsToRemove: string[] = [];
      let updatedBattlefield = currentPlayer.battlefield.map((c: Card) => {
        let newCard = {...c};
        if (c.type === 'Creature') {
          newCard.buffs = c.buffs.map((b: Buff) => ({ ...b, duration: b.duration - 1 })).filter((b: Buff) => b.duration > 0 || b.source === 'biome' || b.duration === Infinity || b.source === 'enchantment');
        
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

      const enchantments = currentPlayer.battlefield.filter(c => c.type === 'Enchantment' && c.id.startsWith('divine_light'));
      if(enchantments.length > 0) {
        updatedBattlefield = updatedBattlefield.map((c: Card) => {
            if (c.type === 'Creature' && c.element === 'Light' && c.health < c.initialHealth) {
                 const newHealth = Math.min(c.initialHealth!, (c.health || 0) + enchantments.length);
                 currentLog.push({type: 'heal', turn: stateWithClearedFlags.turn, message: `Lumière Divine soigne ${c.name} de ${enchantments.length} PV.`, target: currentPlayerKey});
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
      const drawCount = nextPlayer.focusDrawNextTurn ? 3 : 1;
      const { player: drawnPlayer } = drawCardsWithBiomeAffinity(nextPlayer, drawCount, state.activeBiome);
      nextPlayer = drawnPlayer;
      if (drawCount > 1) {
          nextPlayer.focusDrawNextTurn = false;
          currentLog.push({ type: 'draw', turn: nextTurnNumber, message: `${nextPlayerKey === 'player' ? 'Joueur' : "L'Adversaire"} pioche 3 cartes grâce à sa concentration.`, target: nextPlayerKey})
      }
      
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
        finalState.log.push({ type: 'info', turn: finalState.turn, message: `L'effet de ${graveyardAdditions.map(c => c.name).join(', ')} se termine.`, target: currentPlayerKey });
      }
      
      // We need to call the DRAW_CARD action to get the log message for the single draw
      if (drawCount === 1) {
          finalState = gameReducer(finalState, { type: 'DRAW_CARD', player: nextPlayerKey, count: 1});
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
