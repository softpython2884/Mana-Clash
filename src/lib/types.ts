'use client';
import type { ImagePlaceholder } from './placeholder-images';

export type CardType = 'Creature' | 'Land' | 'Spell' | 'Artifact' | 'Biome' | 'Enchantment' | 'Potion' | 'SpecialSummon' | 'Trap' | 'Ritual';
export type GamePhase = 'main' | 'combat' | 'targeting' | 'spell_targeting' | 'post_mulligan' | 'end' | 'game-over';
export type BiomeType = 'Forest' | 'Mountain' | 'Swamp' | 'Desert' | 'Ice' | 'Volcano' | 'Sanctuary';

export type SkillType = 
  | 'taunt' 
  | 'heal' 
  | 'lifesteal' 
  | 'draw' 
  | 'buff_attack' 
  | 'buff_armor' 
  | 'global_buff_armor'
  | 'magic_shield'
  | 'counter_spell'
  | 'double_attack'
  | 'poison'
  | 'stealth'
  | 'summon'
  | 'damage'
  | 'sacrifice';

export type SkillTarget = 'self' | 'friendly_creature' | 'any_creature' | 'player' | 'opponent_creature';
export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';
export type ElementType = 'Fire' | 'Water' | 'Earth' | 'Air' | 'Shadow' | 'Light' | 'Neutral';


export interface CardSkill {
  type: SkillType;
  used: boolean;
  value?: number; // e.g., amount to heal or damage
  duration?: number; // for buffs
  target?: SkillTarget;
  cooldown?: number;
  currentCooldown?: number;
  onCooldown?: boolean;
}

export interface Buff {
    type: 'attack' | 'armor' | 'crit';
    value: number;
    duration: number; // in turns. Infinity for permanent
    source: 'spell' | 'artifact' | 'biome';
}

export interface Card {
  id: string;
  name: string;
  type: CardType;
  manaCost: number;
  rarity?: Rarity;
  element?: ElementType;
  attack?: number;
  health?: number;
  initialHealth?: number;
  armor?: number;
  description: string;
  lore?: string;
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
  duration?: number; // For artifacts
  skillJustUsed?: boolean; // For visual feedback
}

export interface Player {
  id: 'player' | 'opponent';
  hp: number;
  mana: number;
  maxMana: number;
  deck: Card[];
  hand: Card[];
  battlefield: Card[];
  graveyard: Card[];
  biomeChanges: number;
  hasRedrawn: boolean; // Mulligan flag for the game
}
export type LogType = 
    | 'game_start'
    | 'game_over'
    | 'phase'
    | 'play'
    | 'draw'
    | 'combat'
    | 'damage'
    | 'heal'
    | 'buff'
    | 'debuff'
    | 'destroy'
    | 'skill'
    | 'spell'
    | 'mana'
    | 'biome'
    | 'info';

export interface LogEntry {
  type: LogType;
  turn: number;
  message: string;
}


export interface GameState {
  gameId: number;
  turn: number;
  activePlayer: 'player' | 'opponent';
  phase: GamePhase;
  winner?: 'player' | 'opponent';
  player: Player;
  opponent: Player;
  log: LogEntry[];
  isThinking: boolean;
  activeBiome: Card | null;
  selectedCardId: string | null;
  selectedAttackerId: string | null;
  selectedDefenderId: string | null;
  spellBeingCast: Card | null; // For spells or skills that require a target
}

    