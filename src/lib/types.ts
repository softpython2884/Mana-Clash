'use client';
import type { ImagePlaceholder } from './placeholder-images';

export type CardType = 'Creature' | 'Land' | 'Spell' | 'Artifact' | 'Biome';
export type GamePhase = 'main' | 'combat' | 'targeting' | 'end' | 'game-over';
export type BiomeType = 'Forest' | 'Mountain' | 'Swamp' | 'Desert' | 'Ice' | 'Volcano' | 'Sanctuary';

export type SkillType = 'taunt' | 'heal' | 'lifesteal' | 'draw' | 'buff_attack' | 'buff_armor';
export type SkillTarget = 'self' | 'friendly_creature' | 'any_creature' | 'player' | 'opponent_creature';


export interface CardSkill {
  type: SkillType;
  used: boolean;
  value?: number; // e.g., amount to heal or damage
  duration?: number; // for buffs
  target?: SkillTarget;
}

export interface Buff {
    type: 'attack' | 'armor';
    value: number;
    duration: number;
}

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
  skill?: CardSkill;
  buffs: Buff[];
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
  selectedCardId: string | null;
  selectedAttackerId: string | null;
  selectedDefenderId: string | null;
}
