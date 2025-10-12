import type { ImagePlaceholder } from './placeholder-images';

export type CardType = 'Creature' | 'Land' | 'Spell' | 'Artifact';

export interface Card {
  id: string;
  name: string;
  type: CardType;
  manaCost: number;
  attack?: number;
  defense?: number;
  description: string;
  image: ImagePlaceholder;
  tapped: boolean;
  isAttacking: boolean;
  canAttack: boolean;
  summoningSickness: boolean;
}

export interface Player {
  hp: number;
  mana: number;
  maxMana: number;
  deck: Card[];
  hand: Card[];
  battlefield: Card[];
  graveyard: Card[];
}

export interface GameState {
  gameId: number;
  turn: number;
  activePlayer: 'player' | 'opponent';
  phase: 'main' | 'combat' | 'end' | 'game-over';
  winner?: 'player' | 'opponent';
  player: Player;
  opponent: Player;
  log: { turn: number; message: string }[];
  isThinking: boolean;
}
