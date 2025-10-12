'use client';
import type { ImagePlaceholder } from './placeholder-images';

export type CardType = 'Creature' | 'Land' | 'Spell' | 'Artifact' | 'Biome';
export type GamePhase = 'main' | 'combat' | 'targeting' | 'end' | 'game-over';
export type BiomeType = 'Forest' | 'Mountain' | 'Swamp' | 'Desert' | 'Ice' | 'Volcano' | 'Sanctuary';


export interface Card {
  id: string;
  name: string;
  type: CardType;
  manaCost: number;
  attack?: number;
  health?: number;
  initialHealth?: number;
  armor?: number;
  description: string;
  image: ImagePlaceholder;
  tapped: boolean;
  isAttacking: boolean; // Will be used to show the "selected attacker" state
  canAttack: boolean;
  summoningSickness: boolean;
  criticalHitChance?: number;
  biome?: BiomeType;
  preferredBiome?: BiomeType;
  taunt?: boolean;
}

export interface Player {
  hp: number;
  mana: number;
  maxMana: number;
  deck: Card[];
  hand: Card[];
  battlefield: Card[];
  graveyard: Card[];
  biomeChanges: number;
}

export interface GameState {
  gameId: number;
  turn: number;
  activePlayer: 'player' | 'opponent';
  phase: GamePhase;
  winner?: 'player' | 'opponent';
  player: Player;
  opponent: Player;
  log: { turn: number; message: string }[];
  isThinking: boolean;
  activeBiome: Card | null;
  selectedAttackerId: string | null;
  selectedDefenderId: string | null;
}
