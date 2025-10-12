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
  // Creatures
  createCard('goblin', 'Gobelin Féroce', 'Creature', 1, "Une petite créature vicieuse.", { attack: 2, health: 1, armor: 0, criticalHitChance: 10, preferredBiome: 'Mountain' }),
  createCard('knight', 'Chevalier Vaillant', 'Creature', 3, "Compétence: Peut forcer un adversaire à l'attaquer.", { attack: 2, health: 2, armor: 3, criticalHitChance: 5, preferredBiome: 'Sanctuary', skill: { type: 'taunt', used: false } }),
  createCard('elf', 'Elfe Archer', 'Creature', 2, "Tire des flèches précises.", { attack: 3, health: 1, armor: 1, criticalHitChance: 15, preferredBiome: 'Forest' }),
  createCard('wizard', 'Sorcier Érudit', 'Creature', 4, "Maîtrise les arcanes.", { attack: 4, health: 3, armor: 0, criticalHitChance: 10, preferredBiome: 'Ice' }),
  createCard('dragon', 'Jeune Dragon', 'Creature', 5, "Un souffle de feu dévastateur.", { attack: 5, health: 4, armor: 3, criticalHitChance: 20, preferredBiome: 'Volcano' }),
  createCard('golem', 'Golem de Pierre', 'Creature', 6, "Une masse de roche animée, lente mais résistante.", { attack: 3, health: 8, armor: 4, criticalHitChance: 0, preferredBiome: 'Mountain', taunt: true }),
  createCard('cleric', 'Clerc du Sanctuaire', 'Creature', 2, 'Compétence: Soigne 3 PV à une créature.', { attack: 1, health: 3, armor: 1, preferredBiome: 'Sanctuary', skill: { type: 'heal', value: 3, target: 'any_creature', used: false }}),
  createCard('vampire', 'Vampire Maudit', 'Creature', 4, 'Vol de vie (se soigne de la moitié des dégâts infligés).', { attack: 4, health: 3, armor: 1, preferredBiome: 'Swamp', skill: { type: 'lifesteal', used: false }}),
  createCard('sage', 'Sage Oublié', 'Creature', 3, 'Compétence: Piochez une carte.', { attack: 2, health: 2, armor: 0, skill: { type: 'draw', used: false }}),

  // Lands
  createCard('forest_land', 'Forêt', 'Land', 0, "Joue cette carte pour augmenter ton mana maximum de 1."),
  createCard('mountain_land', 'Montagne', 'Land', 0, "Joue cette carte pour augmenter ton mana maximum de 1."),
  createCard('swamp_land', 'Marais', 'Land', 0, "Joue cette carte pour augmenter ton mana maximum de 1."),

  // Spells
  createCard('berserk_rage', "Rage du Berserker", 'Spell', 1, "Donne +3 en attaque à une créature pour 1 tour.", { skill: { type: 'buff_attack', value: 3, duration: 1, target: 'friendly_creature', used: false }}),
  createCard('stoneskin', "Peau de pierre", 'Spell', 2, "Donne +4 en armure à une créature pour 2 tours.", { skill: { type: 'buff_armor', value: 4, duration: 2, target: 'friendly_creature', used: false }}),

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
            id: `${cardTemplate.id}-${i}`,
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
  addCards('knight', 2);
  addCards('elf', 2);
  addCards('wizard', 1);
  addCards('golem', 1);
  addCards('cleric', 1);
  addCards('vampire', 1);
  addCards('sage', 1);
  
  addCards('health_potion', 1);
  addCards('mana_potion', 1);
  addCards('berserk_rage', 1);
  addCards('stoneskin', 1);
  addCards('strength_enchantment', 1);
  addCards('defense_totem', 1);
  
  addCards('forest_land', 2);
  addCards('mountain_land', 2);
  addCards('swamp_land', 2);

  addCards('forest_biome', 1);
  addCards('ice_biome', 1);
  addCards('volcano_biome', 1);


  // Shuffle deck
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck.slice(0, 25); // 25 card deck
};
