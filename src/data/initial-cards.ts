import { PlaceHolderImages } from '@/lib/placeholder-images';
import type { Card, CardType, BiomeType } from '@/lib/types';

const getImage = (id: string) => {
  const img = PlaceHolderImages.find((p) => p.id === id);
  if (!img) {
    throw new Error(`Image with id "${id}" not found.`);
  }
  return img;
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
  
  // Creatures - Rare
  createCard('knight', 'Chevalier Vaillant', 'Creature', 3, "Compétence: Peut forcer un adversaire à l'attaquer.", { attack: 2, health: 2, armor: 3, criticalHitChance: 5, preferredBiome: 'Sanctuary', skill: { type: 'taunt', used: false }, rarity: 'Rare', element: 'Light' }),
  createCard('wizard', 'Sorcier Érudit', 'Creature', 4, "Maîtrise les arcanes.", { attack: 4, health: 3, armor: 0, criticalHitChance: 10, preferredBiome: 'Ice', rarity: 'Rare', element: 'Water' }),
  createCard('cleric', 'Clerc du Sanctuaire', 'Creature', 2, 'Compétence: Soigne 3 PV à une créature.', { attack: 1, health: 3, armor: 1, preferredBiome: 'Sanctuary', skill: { type: 'heal', value: 3, target: 'any_creature', used: false }, rarity: 'Rare', element: 'Light' }),
  createCard('vampire', 'Vampire Maudit', 'Creature', 4, 'Vol de vie (se soigne de la moitié des dégâts infligés).', { attack: 4, health: 3, armor: 1, preferredBiome: 'Swamp', skill: { type: 'lifesteal', used: false }, rarity: 'Rare', element: 'Shadow' }),
  createCard('sage', 'Sage Oublié', 'Creature', 3, 'Compétence: Piochez une carte.', { attack: 2, health: 2, armor: 0, skill: { type: 'draw', used: false }, rarity: 'Rare', element: 'Neutral' }),
  createCard('elemental_fire', 'Élémentaire de Feu', 'Creature', 3, "Incinère ses ennemis.", { attack: 4, health: 2, armor: 0, criticalHitChance: 15, preferredBiome: 'Volcano', rarity: 'Rare', element: 'Fire' }),
  createCard('elemental_water', 'Élémentaire d\'Eau', 'Creature', 3, "Vague déferlante.", { attack: 2, health: 4, armor: 1, criticalHitChance: 5, preferredBiome: 'Ice', rarity: 'Rare', element: 'Water' }),
  createCard('elemental_earth', 'Élémentaire de Terre', 'Creature', 3, "Mur de pierre vivant.", { attack: 1, health: 5, armor: 2, criticalHitChance: 0, preferredBiome: 'Forest', rarity: 'Rare', element: 'Earth' }),
  createCard('fallen_shaman', 'Chaman Déchu', 'Creature', 2, "Compétence: Sacrifiez cette créature pour soigner un allié de 75% de ses PV restants.", { attack: 1, health: 3, armor: 0, skill: { type: 'sacrifice', target: 'friendly_creature', used: false }, rarity: 'Rare', element: 'Shadow' }),


  // Creatures - Epic
  createCard('dragon', 'Jeune Dragon', 'Creature', 5, "Un souffle de feu dévastateur.", { attack: 5, health: 4, armor: 3, criticalHitChance: 20, preferredBiome: 'Volcano', rarity: 'Epic', element: 'Fire' }),
  createCard('golem', 'Golem de Pierre', 'Creature', 6, "Une masse de roche animée, lente mais résistante.", { attack: 3, health: 8, armor: 4, criticalHitChance: 0, preferredBiome: 'Mountain', taunt: true, rarity: 'Epic', element: 'Earth' }),
  createCard('griffon', 'Griffon majestueux', 'Creature', 5, "Une bête ailée rapide et puissante.", { attack: 4, health: 4, armor: 2, criticalHitChance: 15, preferredBiome: 'Mountain', rarity: 'Epic', element: 'Air' }),
  createCard('minotaur', 'Minotaure Enragé', 'Creature', 6, "Charge furieusement ses ennemis.", { attack: 6, health: 5, armor: 3, criticalHitChance: 25, preferredBiome: 'Mountain', rarity: 'Epic', element: 'Earth' }),
  
  // Creatures - Legendary
  createCard('hydra', 'Hydre des marais', 'Creature', 7, "Une créature terrifiante à plusieurs têtes.", { attack: 6, health: 8, armor: 3, criticalHitChance: 10, preferredBiome: 'Swamp', rarity: 'Legendary', element: 'Shadow' }),
  createCard('phoenix', 'Phénix Immortel', 'Creature', 8, "Renaît de ses cendres une fois par partie.", { attack: 5, health: 5, armor: 2, criticalHitChance: 30, preferredBiome: 'Volcano', rarity: 'Legendary', element: 'Fire' }), // Need to implement rebirth skill

  // Special Summon Creatures (Combos)
  createCard('berlin_wall', 'Mur de Berlin', 'SpecialSummon', 0, "Provocation. Solide comme le roc, mais en béton.", { attack: 2, health: 15, armor: 8, taunt: true, rarity: 'Epic', element: 'Neutral' }),
  createCard('china_wall', 'Muraille de Chine', 'SpecialSummon', 0, "Provocation. Visible depuis l'espace, infranchissable sur terre.", { attack: 4, health: 30, armor: 10, taunt: true, rarity: 'Legendary', element: 'Neutral' }),

  // Lands
  createCard('forest_land', 'Forêt', 'Land', 0, "Joue cette carte pour augmenter ton mana maximum de 1."),
  createCard('mountain_land', 'Montagne', 'Land', 0, "Joue cette carte pour augmenter ton mana maximum de 1."),
  createCard('swamp_land', 'Marais', 'Land', 0, "Joue cette carte pour augmenter ton mana maximum de 1."),

  // Spells
  createCard('berserk_rage', "Rage du Berserker", 'Spell', 1, "Donne +3 en attaque à une créature pour 1 tour.", { skill: { type: 'buff_attack', value: 3, duration: 1, target: 'friendly_creature', used: false }}),
  createCard('stoneskin', "Peau de pierre", 'Spell', 2, "Donne +4 en armure à une créature pour 2 tours.", { skill: { type: 'buff_armor', value: 4, duration: 2, target: 'friendly_creature', used: false }}),
  createCard('lightning_bolt', "Foudre", 'Spell', 3, "Inflige 6 points de dégâts à une créature ciblée.", { skill: { type: 'damage', value: 6, target: 'opponent_creature', used: false }}),


  // Potions
  createCard('health_potion', 'Potion de soin', 'Potion', 2, "Vous regagnez 5 points de vie."),
  createCard('mana_potion', 'Potion de mana', 'Potion', 0, "Vous gagnez 2 points de mana pour ce tour."),

  // Enchantments
  createCard('strength_enchantment', 'Enchantement de Force', 'Enchantment', 3, "Donne +1 en attaque à une créature de façon permanente.", { skill: { type: 'buff_attack', value: 1, duration: 99, target: 'friendly_creature', used: false }}),

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
            skill: cardTemplate.skill ? { ...cardTemplate.skill, used: false } : undefined,
            buffs: [],
            duration: cardTemplate.duration,
        });
      }
    }
  };

  // Player/Opponent Deck Composition
  addCards('goblin', 3);
  addCards('elf', 3);
  addCards('elemental_fire', 2);
  addCards('elemental_water', 2);
  addCards('elemental_earth', 3);

  addCards('knight', 2);
  addCards('cleric', 2);
  addCards('sage', 2);
  addCards('vampire', 1);
  addCards('fallen_shaman', 2);
  
  addCards('golem', 1);
  addCards('griffon', 1);
  addCards('minotaur', 1);
  addCards('dragon', 1);

  addCards('hydra', 1);
  addCards('phoenix', 1);
  
  addCards('health_potion', 1);
  addCards('mana_potion', 1);
  addCards('berserk_rage', 2);
  addCards('stoneskin', 1);
  addCards('lightning_bolt', 1);
  addCards('strength_enchantment', 1);
  addCards('defense_totem', 1);
  
  addCards('forest_land', 2);
  addCards('mountain_land', 2);
  addCards('swamp_land', 2);

  addCards('forest_biome', 1);
  addCards('ice_biome', 1);


  // Shuffle deck
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck.slice(0, 40); // 40 card deck
};

    
