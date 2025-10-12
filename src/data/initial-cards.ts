import { PlaceHolderImages } from '@/lib/placeholder-images';
import type { Card, CardType } from '@/lib/types';

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
  attack?: number,
  defense?: number,
  criticalHitChance?: number
): Omit<Card, 'tapped' | 'isAttacking' | 'canAttack' | 'summoningSickness'> => ({
  id: id,
  name,
  type,
  manaCost,
  description,
  attack,
  defense,
  criticalHitChance,
  image: getImage(id),
});

export const allCards: Omit<Card, 'tapped' | 'isAttacking' | 'canAttack' | 'summoningSickness'>[] = [
  // Creatures
  createCard('goblin', 'Gobelin Féroce', 'Creature', 1, "Une petite créature vicieuse qui aime attaquer en groupe.", 1, 1, 10),
  createCard('knight', 'Chevalier Vaillant', 'Creature', 3, "Un défenseur loyal qui protège son maître jusqu'à la mort.", 2, 3, 5),
  createCard('elf', 'Elfe Archer', 'Creature', 2, "Tire des flèches précises depuis les ombres de la forêt.", 2, 1, 15),
  createCard('wizard', 'Sorcier Érudit', 'Creature', 4, "Maîtrise les arcanes pour dérouter ses ennemis.", 3, 3, 10),
  createCard('dragon', 'Jeune Dragon', 'Creature', 5, "Un souffle de feu qui peut renverser le cours de la bataille.", 4, 4, 20),
  
  // Lands
  createCard('forest', 'Forêt', 'Land', 0, "Joue cette carte pour augmenter ton mana maximum de 1."),
  createCard('mountain', 'Montagne', 'Land', 0, "Joue cette carte pour augmenter ton mana maximum de 1."),
  createCard('swamp', 'Marais', 'Land', 0, "Joue cette carte pour augmenter ton mana maximum de 1."),

  // Spells & Artifacts
  createCard('potion', 'Potion de soin', 'Spell', 2, "Vous regagnez 5 points de vie."),
  createCard('artifact', 'Amulette de pouvoir', 'Artifact', 3, "Vos créatures gagnent +1/+0."),
];

export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  const addCards = (id: string, count: number) => {
    const cardTemplate = allCards.find(c => c.image.id === id);
    if (cardTemplate) {
      for (let i = 0; i < count; i++) {
        deck.push({ 
            ...cardTemplate, 
            id: `${cardTemplate.id}-${i}-${Math.random()}`,
            tapped: false,
            isAttacking: false,
            canAttack: false,
            summoningSickness: false,
        });
      }
    }
  };

  // Player/Opponent Deck Composition
  addCards('goblin', 4);
  addCards('knight', 3);
  addCards('elf', 3);
  addCards('wizard', 2);
  addCards('dragon', 1);
  
  addCards('potion', 2);
  
  addCards('forest', 5);
  addCards('mountain', 5);
  addCards('swamp', 5);

  // Shuffle deck
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck.slice(0, 30); // 30 card deck
};
