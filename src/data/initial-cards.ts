'use client';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import type { Card, CardType, BiomeType } from '@/lib/types';

const getImage = (id: string) => {
  // Not using images for now
  return { id: 'placeholder', description: 'Placeholder', imageUrl: 'https://placehold.co/300x400', imageHint: 'placeholder' };
};

const createCard = (
  id: string,
  name: string,
  type: CardType,
  manaCost: number,
  description: string,
  options: Partial<Omit<Card, 'id'|'name'|'type'|'manaCost'|'description'|'image'|'buffs'>> = {}
): Omit<Card, 'tapped' | 'isAttacking' | 'canAttack' | 'summoningSickness'> => ({
  id: id,
  name,
  type,
  manaCost,
  description,
  image: getImage(id),
  initialHealth: options.health,
  buffs: [],
  ...options,
});


export const allCards: Omit<Card, 'tapped' | 'isAttacking' | 'canAttack' | 'summoningSickness'>[] = [
  // Creatures - Common
  createCard('goblin', 'Gobelin Féroce', 'Creature', 1, "Une petite créature vicieuse.", { attack: 2, health: 1, armor: 0, criticalHitChance: 10, preferredBiome: 'Mountain', rarity: 'Common', element: 'Fire' }),
  createCard('elf', 'Elfe Archer', 'Creature', 2, "Tire des flèches précises.", { attack: 3, health: 1, armor: 1, criticalHitChance: 15, preferredBiome: 'Forest', rarity: 'Common', element: 'Earth' }),
  createCard('wild_wolf', 'Loup Sauvage', 'Creature', 2, "Rapide et mortel, il chasse en meute.", { attack: 3, health: 2, armor: 0, rarity: 'Common', preferredBiome: 'Forest', element: 'Neutral' }),
  createCard('human_soldier', 'Soldat Humain', 'Creature', 2, "Entraîné et discipliné, un soldat fiable.", { attack: 2, health: 2, armor: 1, rarity: 'Common', preferredBiome: 'Sanctuary', element: 'Neutral' }),
  createCard('swamp_serpent', 'Serpent des Marais', 'Creature', 1, "Attaque sournoisement depuis les eaux troubles.", { attack: 1, health: 2, armor: 0, rarity: 'Common', preferredBiome: 'Swamp', element: 'Water' }),
  createCard('guard_dog', 'Chien de Garde', 'Creature', 2, "Loyal et protecteur.", { attack: 2, health: 3, armor: 0, rarity: 'Common', element: 'Neutral' }),
  createCard('giant_rat', 'Rat Géant', 'Creature', 1, "Un nuisible plus gros et plus agressif que la normale.", { attack: 2, health: 1, armor: 0, rarity: 'Common', element: 'Shadow' }),
  createCard('fragile_skeleton', 'Squelette Fragile', 'Creature', 1, "Se brise facilement, mais continue de se battre.", { attack: 1, health: 1, armor: 0, rarity: 'Common', element: 'Shadow' }),
  createCard('minor_spirit', 'Esprit Mineur', 'Creature', 1, "Une faible entité ectoplasmique.", { attack: 1, health: 2, armor: 0, rarity: 'Common', element: 'Shadow' }),
  createCard('brave_peasant', 'Paysan Courageux', 'Creature', 1, "N'a pas grand-chose, mais défend sa terre.", { attack: 1, health: 1, armor: 0, rarity: 'Common', element: 'Neutral' }),
  createCard('wandering_monk', 'Moine Errant', 'Creature', 2, "Un combattant ascétique et discipliné.", { attack: 2, health: 2, armor: 1, rarity: 'Common', element: 'Light' }),
  createCard('cave_bat', 'Chauve-Souris des Cavernes', 'Creature', 1, "Rapide et difficile à attraper.", { attack: 1, health: 1, armor: 0, rarity: 'Common', element: 'Air' }),
  createCard('desert_lizard', 'Lézard du Désert', 'Creature', 2, "Adapté à la chaleur extrême.", { attack: 3, health: 1, armor: 0, rarity: 'Common', preferredBiome: 'Desert', element: 'Fire' }),
  createCard('ice_fish', 'Poisson-Glace', 'Creature', 2, "Étrangement capable de survivre hors de l'eau glacée.", { attack: 2, health: 2, armor: 0, rarity: 'Common', preferredBiome: 'Ice', element: 'Water' }),
  createCard('black_raven', 'Corbeau Noir', 'Creature', 1, "Un sombre présage qui vole dans le ciel.", { attack: 1, health: 1, armor: 0, rarity: 'Common', element: 'Air' }),
  createCard('barbarian_orc', 'Orque Barbare', 'Creature', 3, "Brute épaisse qui frappe fort.", { attack: 4, health: 3, armor: 0, rarity: 'Common', preferredBiome: 'Mountain', element: 'Fire' }),
  createCard('sylvan_archer', 'Archère Sylvestre', 'Creature', 3, "Une archère elfe encore plus expérimentée.", { attack: 3, health: 2, armor: 1, rarity: 'Common', preferredBiome: 'Forest', element: 'Earth' }),
  
  // Creatures - Rare
  createCard('knight', 'Chevalier Vaillant', 'Creature', 3, "Compétence: Peut forcer un adversaire à l'attaquer.", { attack: 2, health: 2, armor: 3, criticalHitChance: 5, preferredBiome: 'Sanctuary', skill: { type: 'taunt', used: false, cooldown: 3 }, rarity: 'Rare', element: 'Light' }),
  createCard('wizard', 'Sorcier Érudit', 'Creature', 4, "Maîtrise les arcanes.", { attack: 4, health: 3, armor: 0, criticalHitChance: 10, preferredBiome: 'Ice', rarity: 'Rare', element: 'Water' }),
  createCard('cleric', 'Clerc du Sanctuaire', 'Creature', 2, 'Compétence: Soigne 3 PV à une créature.', { attack: 1, health: 3, armor: 1, preferredBiome: 'Sanctuary', skill: { type: 'heal', value: 3, target: 'any_creature', used: false, cooldown: 2 }, rarity: 'Rare', element: 'Light' }),
  createCard('vampire', 'Vampire Maudit', 'Creature', 4, 'Vol de vie (se soigne de la moitié des dégâts infligés).', { attack: 4, health: 3, armor: 1, preferredBiome: 'Swamp', skill: { type: 'lifesteal', used: false }, rarity: 'Rare', element: 'Shadow' }),
  createCard('sage', 'Sage Oublié', 'Creature', 3, 'Compétence: Piochez une carte.', { attack: 2, health: 2, armor: 0, skill: { type: 'draw', used: false, cooldown: 4 }, rarity: 'Rare', element: 'Neutral' }),
  createCard('elemental_fire', 'Élémentaire de Feu', 'Creature', 3, "Incinère ses ennemis.", { attack: 4, health: 2, armor: 0, criticalHitChance: 15, preferredBiome: 'Volcano', rarity: 'Rare', element: 'Fire' }),
  createCard('elemental_water', 'Élémentaire d\'Eau', 'Creature', 3, "Vague déferlante.", { attack: 2, health: 4, armor: 1, criticalHitChance: 5, preferredBiome: 'Ice', rarity: 'Rare', element: 'Water' }),
  createCard('elemental_earth', 'Élémentaire de Terre', 'Creature', 3, "Mur de pierre vivant.", { attack: 1, health: 5, armor: 2, criticalHitChance: 0, preferredBiome: 'Forest', rarity: 'Rare', element: 'Earth' }),
  createCard('fallen_shaman', 'Chaman Déchu', 'Creature', 2, "Compétence: Sacrifiez cette créature pour soigner un allié de 75% de ses PV restants.", { attack: 1, health: 3, armor: 0, skill: { type: 'sacrifice', target: 'friendly_creature', used: false, cooldown: 0 }, rarity: 'Rare', element: 'Shadow' }),
  createCard('knowledge_priest', 'Prêtre du Savoir', 'Creature', 2, 'Compétence: Piochez une carte.', { attack: 1, health: 2, armor: 0, skill: { type: 'draw', used: false, cooldown: 3 }, rarity: 'Rare', element: 'Neutral' }),
  createCard('shadow_assassin', 'Assassin des Ombres', 'Creature', 4, "Attaque depuis l'ombre avec une précision mortelle.", { attack: 5, health: 2, armor: 0, criticalHitChance: 25, rarity: 'Rare', element: 'Shadow' }),
  createCard('oak_druid', 'Druide du Chêne', 'Creature', 3, "Protecteur de la forêt, il gagne en force près des siens.", { attack: 2, health: 3, armor: 2, preferredBiome: 'Forest', rarity: 'Rare', element: 'Earth' }),
  createCard('desert_warrior', 'Guerrier du Désert', 'Creature', 3, "Endurci par le soleil, il frappe rapidement.", { attack: 4, health: 2, armor: 1, preferredBiome: 'Desert', rarity: 'Rare', element: 'Fire' }),
  createCard('ice_guardian', 'Gardien de Glace', 'Creature', 4, "Une statue de glace animée qui protège les terres gelées.", { attack: 2, health: 5, armor: 3, preferredBiome: 'Ice', rarity: 'Rare', element: 'Water' }),

  // Creatures - Epic
  createCard('dragon', 'Jeune Dragon', 'Creature', 5, "Un souffle de feu dévastateur.", { attack: 5, health: 4, armor: 3, criticalHitChance: 20, preferredBiome: 'Volcano', rarity: 'Epic', element: 'Fire' }),
  createCard('golem', 'Golem de Pierre', 'Creature', 6, "Une masse de roche animée, lente mais résistante.", { attack: 3, health: 8, armor: 4, criticalHitChance: 0, preferredBiome: 'Mountain', taunt: true, rarity: 'Epic', element: 'Earth' }),
  createCard('griffon', 'Griffon Majestueux', 'Creature', 5, "Une bête ailée rapide et puissante.", { attack: 4, health: 4, armor: 2, criticalHitChance: 15, preferredBiome: 'Mountain', rarity: 'Epic', element: 'Air' }),
  createCard('minotaur', 'Minotaure Enragé', 'Creature', 6, "Charge furieusement ses ennemis.", { attack: 6, health: 5, armor: 3, criticalHitChance: 25, preferredBiome: 'Mountain', rarity: 'Epic', element: 'Earth' }),
  createCard('ruin_specter', 'Spectre des Ruines', 'Creature', 5, "Hante les lieux oubliés, aspirant la vie.", { attack: 5, health: 4, armor: 1, rarity: 'Epic', element: 'Shadow' }),
  createCard('ancestral_basilisk', 'Basilic Ancestral', 'Creature', 7, "Son regard pétrifie les plus courageux.", { attack: 5, health: 7, armor: 5, rarity: 'Epic', element: 'Earth' }),
  
  // Creatures - Legendary
  createCard('hydra', 'Hydre des Marais', 'Creature', 7, "Une créature terrifiante à plusieurs têtes.", { attack: 6, health: 8, armor: 3, criticalHitChance: 10, preferredBiome: 'Swamp', rarity: 'Legendary', element: 'Shadow' }),
  createCard('phoenix', 'Phénix Immortel', 'Creature', 8, "Renaît de ses cendres une fois par partie.", { attack: 5, health: 5, armor: 2, criticalHitChance: 30, preferredBiome: 'Volcano', rarity: 'Legendary', element: 'Fire' }), // Need to implement rebirth skill
  createCard('archmage_elements', 'Archimage des Éléments', 'Creature', 9, "Maîtrise absolue sur le feu, l'eau et la terre.", { attack: 7, health: 7, armor: 4, rarity: 'Legendary', element: 'Neutral' }),
  createCard('abyss_lord', 'Seigneur des Abysses', 'Creature', 10, "Une puissance destructrice venue des profondeurs.", { attack: 10, health: 10, armor: 5, rarity: 'Legendary', element: 'Shadow' }),

  // Special Summon Creatures (Combos)
  createCard('berlin_wall', 'Mur de Berlin', 'SpecialSummon', 0, "Provocation. Solide comme le roc, mais en béton.", { attack: 2, health: 15, armor: 8, taunt: true, rarity: 'Epic', element: 'Neutral' }),
  createCard('china_wall', 'Muraille de Chine', 'SpecialSummon', 0, "Provocation. Visible depuis l'espace, infranchissable sur terre.", { attack: 4, health: 30, armor: 10, taunt: true, rarity: 'Legendary', element: 'Neutral' }),
  createCard('iron_colossus', 'Colosse de Fer', 'SpecialSummon', 0, "Fusion de Golem et Minotaure. Une force inarrêtable.", { attack: 8, health: 12, armor: 6, taunt: true, rarity: 'Legendary', element: 'Earth' }),
  createCard('ancient_dragon', 'Dragon Ancien', 'SpecialSummon', 0, "Fusion de Dragon et Phénix. La renaissance du feu.", { attack: 9, health: 9, armor: 5, criticalHitChance: 25, rarity: 'Legendary', element: 'Fire' }),
  createCard('elemental_avatar', 'Avatar Élémentaire', 'SpecialSummon', 0, "Fusion des trois élémentaires. L'équilibre des puissances.", { attack: 7, health: 15, armor: 7, rarity: 'Legendary', element: 'Neutral' }),
  createCard('supreme_shadow', 'Ombre Suprême', 'SpecialSummon', 0, "Fusion de Vampire et Spectre. Maître de la non-vie.", { attack: 8, health: 8, armor: 3, skill: { type: 'lifesteal', used: false }, rarity: 'Legendary', element: 'Shadow' }),
  createCard('world_tree', 'Arbre-Monde', 'SpecialSummon', 0, "Fusion de Druide et Élémentaire de Terre. La vie incarnée.", { attack: 5, health: 20, armor: 10, rarity: 'Legendary', element: 'Earth' }),
  createCard('judgment_angel', 'Ange du Jugement', 'SpecialSummon', 0, "Fusion de Clerc et Archimage. La justice divine.", { attack: 10, health: 10, armor: 8, skill: { type: 'heal', value: 5, target: 'player', used: false, cooldown: 3 }, rarity: 'Legendary', element: 'Light' }),
  createCard('stone_titan', 'Titan de Pierre', 'SpecialSummon', 0, "Fusion de Golem et Mur de Berlin. La défense absolue.", { attack: 6, health: 25, armor: 12, taunt: true, rarity: 'Legendary', element: 'Neutral' }),
  createCard('chimera', 'Chimère', 'SpecialSummon', 0, "Fusion de Griffon et Basilic. Une monstruosité parfaite.", { attack: 9, health: 11, armor: 6, criticalHitChance: 15, rarity: 'Legendary', element: 'Neutral' }),
  
  // Lands
  createCard('forest_land', 'Forêt', 'Land', 0, "Joue cette carte pour augmenter ton mana maximum de 1."),
  createCard('mountain_land', 'Montagne', 'Land', 0, "Joue cette carte pour augmenter ton mana maximum de 1."),
  createCard('swamp_land', 'Marais', 'Land', 0, "Joue cette carte pour augmenter ton mana maximum de 1."),
  createCard('desert_land', 'Désert', 'Land', 0, "Joue cette carte pour augmenter ton mana maximum de 1."),
  createCard('ice_land', 'Glace', 'Land', 0, "Joue cette carte pour augmenter ton mana maximum de 1."),
  createCard('plains_land', 'Plaine', 'Land', 0, "Joue cette carte pour augmenter ton mana maximum de 1."),

  // Spells
  createCard('berserk_rage', "Rage du Berserker", 'Spell', 1, "Donne +3 en attaque à une créature pour 1 tour.", { skill: { type: 'buff_attack', value: 3, duration: 1, target: 'friendly_creature', used: false }}),
  createCard('stoneskin', "Peau de pierre", 'Spell', 2, "Donne +4 en armure à une créature pour 2 tours.", { skill: { type: 'buff_armor', value: 4, duration: 2, target: 'friendly_creature', used: false }}),
  createCard('lightning_bolt', "Foudre", 'Spell', 3, "Inflige 6 points de dégâts à une créature ciblée.", { skill: { type: 'damage', value: 6, target: 'opponent_creature', used: false }}),
  createCard('frostbolt', "Éclair de Givre", 'Spell', 1, "Inflige 2 points de dégâts à une créature.", { skill: { type: 'damage', value: 2, target: 'opponent_creature', used: false }}),
  createCard('shadow_bolt', "Trait de l'Ombre", 'Spell', 2, "Inflige 3 points de dégâts à une créature et vous soigne de 2 PV.", { skill: { type: 'damage_and_heal', value: 3, heal: 2, target: 'opponent_creature', used: false }}),
  createCard('healing_light', "Lumière Guérisseuse", 'Spell', 2, "Soigne 5 PV à une créature.", { skill: { type: 'heal', value: 5, target: 'any_creature', used: false }}),
  createCard('giant_growth', "Croissance Gigantesque", 'Spell', 3, "Donne +3/+3 à une créature pour 1 tour.", { skill: { type: 'buff_attack_and_armor', attack: 3, armor: 3, duration: 1, target: 'friendly_creature', used: false }}),


  // Potions
  createCard('health_potion', 'Potion de Soin', 'Potion', 2, "Vous regagnez 5 points de vie."),
  createCard('mana_potion', 'Potion de Mana', 'Potion', 0, "Vous gagnez 2 points de mana pour ce tour."),
  createCard('strength_potion', 'Potion de Force', 'Potion', 1, "Donne +2 en attaque à une créature pour ce tour.", { skill: { type: 'buff_attack', value: 2, duration: 1, target: 'friendly_creature', used: false }}),
  createCard('endurance_potion', 'Potion d’Endurance', 'Potion', 1, "Donne +2 en armure à une créature pour ce tour.", { skill: { type: 'buff_armor', value: 2, duration: 1, target: 'friendly_creature', used: false }}),
  createCard('speed_potion', 'Potion de Vitesse', 'Potion', 1, "Piochez une carte.", { skill: { type: 'draw', used: false }}),
  createCard('concentration_potion', 'Potion de Concentration', 'Potion', 2, "Vos sorts coûtent 1 de moins ce tour-ci."), // Needs specific reducer logic
  createCard('shadow_potion', 'Potion d’Ombre', 'Potion', 3, "Détruit une créature avec 3 PV ou moins.", { skill: { type: 'damage', value: 99, target: 'opponent_creature', used: false }}), // Needs check
  createCard('fire_potion', 'Potion de Feu', 'Potion', 2, "Inflige 2 dégâts à toutes les créatures adverses.", { skill: { type: 'damage', value: 2, target: 'opponent_creature', used: false }}), // Needs AoE logic
  createCard('resurrection_potion', 'Potion de Résurrection', 'Potion', 4, "Ramène une créature aléatoire de votre cimetière sur le champ de bataille.", { skill: { type: 'resurrect', used: false }}),

  // Enchantments
  createCard('strength_enchantment', 'Enchantement de Force', 'Enchantment', 3, "Donne +1 en attaque à une créature de façon permanente.", { skill: { type: 'buff_attack', value: 1, duration: 99, target: 'friendly_creature', used: false }}),
  createCard('kings_blessing', "Bénédiction des Rois", 'Enchantment', 4, "Donne +2/+2 à une créature de façon permanente.", { skill: { type: 'buff_attack_and_armor', attack: 2, armor: 2, duration: 99, target: 'friendly_creature', used: false }}),
  createCard('fire_aura', "Aura de Feu", 'Enchantment', 3, "+1 attaque à toutes vos créatures de type Feu.", { element: 'Fire' }), // Needs reducer logic
  createCard('ice_shield', "Bouclier de Glace", 'Enchantment', 3, "+1 armure à toutes vos créatures de type Eau.", { element: 'Water' }), // Needs reducer logic
  createCard('forest_heart', "Cœur de la Forêt", 'Enchantment', 3, "Vos créatures de type Terre gagnent +1 PV.", { element: 'Earth' }), // Needs reducer logic
  createCard('divine_light', "Lumière Divine", 'Enchantment', 4, "Vos créatures de type Lumière se soignent de 1 PV à la fin de votre tour.", { element: 'Light' }), // Needs reducer logic
  createCard('shadow_link', "Lien des Ombres", 'Enchantment', 4, "Vos créatures de type Ombre ont Vol de vie.", { element: 'Shadow' }), // Needs reducer logic

  // Artifacts
  createCard('defense_totem', 'Totem de Défense', 'Artifact', 4, "Donne +1 d'armure à toutes vos créatures alliées. Dure 3 tours.", { skill: { type: 'global_buff_armor', value: 1, duration: 3, used: false }, duration: 3 }),

  // Biomes
  createCard('forest_biome', 'Biome Forêt', 'Biome', 0, "Change le biome actuel en Forêt.", { biome: 'Forest' }),
  createCard('desert_biome', 'Biome Désert', 'Biome', 0, "Change le biome actuel en Désert.", { biome: 'Desert' }),
  createCard('ice_biome', 'Biome Glace', 'Biome', 0, "Change le biome actuel en Glace.", { biome: 'Ice' }),
  createCard('volcano_biome', 'Biome Volcan', 'Biome', 0, "Change le biome actuel en Volcan.", { biome: 'Volcano' }),
  createCard('sanctuary_biome', 'Biome Sanctuaire', 'Biome', 0, "Change le biome actuel en Sanctuaire.", { biome: 'Sanctuary' }),
];

export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  const addCards = (id: string, count: number) => {
    const cardTemplate = allCards.find(c => c.id === id);
    if (cardTemplate) {
      for (let i = 0; i < count; i++) {
        deck.push({ 
            ...cardTemplate, 
            id: `${cardTemplate.id}-${i}-${Math.random().toString(36).substring(7)}`,
            health: cardTemplate.initialHealth,
            tapped: false,
            isAttacking: false,
            canAttack: false,
            summoningSickness: false,
            taunt: cardTemplate.taunt,
            skill: cardTemplate.skill ? { ...cardTemplate.skill, used: false, onCooldown: false, currentCooldown: 0 } : undefined,
            buffs: [],
            duration: cardTemplate.duration,
        });
      }
    }
  };

  // Player/Opponent Deck Composition
  addCards('goblin', 2);
  addCards('elf', 2);
  addCards('wild_wolf', 2);
  addCards('human_soldier', 2);
  addCards('swamp_serpent', 2);
  addCards('guard_dog', 1);
  addCards('giant_rat', 2);
  addCards('fragile_skeleton', 2);
  addCards('minor_spirit', 1);
  addCards('brave_peasant', 1);
  addCards('wandering_monk', 1);
  addCards('cave_bat', 2);
  addCards('desert_lizard', 2);
  addCards('ice_fish', 1);
  addCards('black_raven', 1);
  addCards('barbarian_orc', 2);
  addCards('sylvan_archer', 2);

  // Rares
  addCards('knight', 1);
  addCards('wizard', 1);
  addCards('cleric', 2);
  addCards('vampire', 1);
  addCards('sage', 1);
  addCards('elemental_fire', 1);
  addCards('elemental_water', 1);
  addCards('elemental_earth', 2);
  addCards('fallen_shaman', 1);
  addCards('knowledge_priest', 2);
  addCards('shadow_assassin', 1);
  addCards('oak_druid', 1);
  addCards('desert_warrior', 1);
  addCards('ice_guardian', 1);
  
  // Epics
  addCards('golem', 1);
  addCards('griffon', 1);
  addCards('dragon', 1);
  addCards('minotaur', 1);
  addCards('ruin_specter', 1);
  addCards('ancestral_basilisk', 1);
  
  // Legendaries
  addCards('hydra', 1);
  addCards('phoenix', 1);
  addCards('archmage_elements', 1);
  addCards('abyss_lord', 1);
  
  // Spells, Potions, etc.
  addCards('health_potion', 1);
  addCards('mana_potion', 1);
  addCards('berserk_rage', 1);
  addCards('stoneskin', 1);
  addCards('lightning_bolt', 1);
  addCards('frostbolt', 2);
  addCards('shadow_bolt', 1);
  addCards('healing_light', 1);
  addCards('giant_growth', 1);

  addCards('strength_enchantment', 1);
  addCards('kings_blessing', 1);
  addCards('defense_totem', 1);
  
  // Lands & Biomes
  addCards('forest_land', 2);
  addCards('mountain_land', 2);
  addCards('swamp_land', 2);
  addCards('desert_land', 1);
  addCards('ice_land', 1);
  addCards('plains_land', 2);

  addCards('forest_biome', 1);
  addCards('ice_biome', 1);


  // Shuffle deck
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck.slice(0, 70); // 70 card deck
};
