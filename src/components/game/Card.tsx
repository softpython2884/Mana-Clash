'use client';
import type { Card as CardType, BiomeType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Swords, Shield, Heart, Zap, Mountain, Trees, Snowflake, Flame, Sun, ShieldQuestion, X, BrainCircuit, Sparkles, PlusCircle, Timer, Skull } from 'lucide-react';
import { Badge } from '../ui/badge';

interface GameCardProps {
  card: CardType;
  isPlayable?: boolean;
  onClick?: () => void;
  onSkillClick?: () => void;
  inHand?: boolean;
  isActiveBiome?: boolean;
  isAttacking?: boolean; // Card is selected to be an attacker
  isTargeted?: boolean;  // Card is selected as a defender target
  isTargetable?: boolean; // Card can be targeted by an attacker
  isLethal?: boolean; // If the current targeted attack would be lethal
  showSkill?: boolean; // Show the skill icon
  isEntering?: boolean; // To animate card entry
}

const biomeIcon: Record<BiomeType, React.ElementType> = {
    Forest: Trees,
    Mountain: Mountain,
    Ice: Snowflake,
    Volcano: Flame,
    Desert: Sun,
    Sanctuary: Sun,
    Swamp: BrainCircuit 
};

const biomeColor: Record<BiomeType, string> = {
    Forest: 'border-biome-forest',
    Mountain: 'border-gray-500',
    Ice: 'border-biome-ice',
    Volcano: 'border-biome-volcano',
    Desert: 'border-biome-desert',
    Sanctuary: 'border-biome-sanctuary',
    Swamp: 'border-green-800'
};


export default function GameCard({ card, isPlayable = false, onClick, onSkillClick, inHand = false, isActiveBiome = false, isAttacking = false, isTargeted = false, isTargetable = false, isLethal = false, showSkill = false, isEntering = false }: GameCardProps) {
  const { name, manaCost, description, attack, health, armor, type, tapped, canAttack, criticalHitChance, preferredBiome, biome, taunt, buffs, duration } = card;

  const Icon = preferredBiome ? biomeIcon[preferredBiome] : null;
  const borderClass = biome ? biomeColor[biome] : '';

  const handleSkillClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click event from firing
    if(onSkillClick) {
      onSkillClick();
    }
  }

  const totalAttack = (attack || 0) + (buffs?.filter(b => b.type === 'attack').reduce((acc, b) => acc + b.value, 0) || 0);
  const totalArmor = (armor || 0) + (buffs?.filter(b => b.type === 'armor').reduce((acc, b) => acc + b.value, 0) || 0);
  const totalCritChance = (criticalHitChance || 0) + (buffs?.filter(b => b.type === 'crit').reduce((acc, b) => acc + b.value, 0) || 0);


  return (
    <div
      className={cn(
        "relative transition-all duration-300 ease-in-out shadow-lg hover:shadow-2xl rounded-xl",
        inHand && "hover:-translate-y-6 hover:z-10",
        tapped && 'transform rotate-12 scale-95 opacity-70',
        isActiveBiome && 'ring-4 ring-white',
        isEntering && 'animate-boing'
      )}
      onClick={onClick}
    >
      <Card
        className={cn(
          'w-[120px] h-[168px] sm:w-[150px] sm:h-[210px] md:w-[180px] md:h-[252px] flex flex-col overflow-hidden select-none bg-card-foreground/5 dark:bg-card-foreground/10 backdrop-blur-md rounded-xl transition-all',
          isPlayable && 'cursor-pointer ring-4 ring-primary ring-offset-2 ring-offset-background shadow-lg shadow-primary/50',
          canAttack && !tapped && 'cursor-pointer ring-4 ring-orange-500 ring-offset-2 ring-offset-background shadow-lg shadow-orange-500/50 animate-pulse',
          isAttacking && 'ring-4 ring-red-500 ring-offset-2 ring-offset-background shadow-lg shadow-red-500/50', // Red border for selected attacker
          isTargetable && 'cursor-pointer ring-4 ring-yellow-400 animate-pulse', // Highlight for potential targets
          onClick && "cursor-pointer",
          type === 'Biome' && `border-4 ${borderClass}`,
          taunt && 'shadow-lg shadow-blue-500/50 ring-2 ring-blue-500'
        )}
      >
        <CardHeader className="p-2 flex-shrink-0">
          <CardTitle className="flex justify-between items-center text-xs md:text-base font-headline truncate">
            <span className="truncate mr-2 text-card-foreground">{name}</span>
            {manaCost > 0 && (
                <div className="flex items-center justify-center w-5 h-5 md:w-6 md:h-6 rounded-full bg-[hsl(var(--mana))] text-white text-xs font-bold shrink-0">
                {manaCost}
                </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 flex-grow flex flex-col justify-center items-center text-center">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground">{type}</p>
             <CardDescription className="text-[10px] sm:text-xs leading-tight mt-1 sm:mt-2 text-card-foreground/80">
                {description}
            </CardDescription>
            {taunt && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 text-blue-400 font-bold text-[10px] sm:text-xs bg-black/50 px-2 py-1 rounded-full"><ShieldQuestion size={12}/> PROVOCATION</div>}
            {isTargeted && (
              <div className="absolute inset-0 bg-red-800/60 flex items-center justify-center animate-pulse rounded-xl">
                {isLethal ? <Skull className="w-10 h-10 sm:w-16 sm:h-16 text-white" /> : <X className="w-10 h-10 sm:w-16 sm:h-16 text-white" />}
              </div>
            )}
            <div className="absolute top-14 sm:top-16 left-1 sm:left-2 flex flex-col gap-1">
              {buffs?.map((buff, i) => (
                <Badge key={i} variant="secondary" className={cn(
                  "px-1 py-0 text-[9px] sm:text-xs animate-fade-in",
                  buff.type === 'attack' ? 'bg-red-500/80' : 'bg-blue-500/80',
                  buff.type === 'crit' && 'bg-yellow-500/80'
                )}>
                  {buff.type === 'attack' && <Swords size={10} className="mr-1"/>}
                  {buff.type === 'armor' && <Shield size={10} className="mr-1"/>}
                  {buff.type === 'crit' && <Zap size={10} className="mr-1"/>}
                  +{buff.value}{buff.type === 'crit' && '%'}{buff.duration !== Infinity && ` (${buff.duration}t)`}
                </Badge>
              ))}
            </div>
        </CardContent>
        <CardFooter className="p-2 flex-shrink-0 min-h-[40px] sm:min-h-[50px] flex flex-col items-start bg-secondary/30">
          {type === 'Creature' && (
            <div className='w-full'>
                {totalCritChance > 0 && (
                    <div className="absolute top-12 right-1 sm:top-14 sm:right-2 flex items-center gap-1 text-[hsl(var(--debuff))]" title="Chance de coup critique">
                        <Zap size={12} className="sm:hidden" />
                        <Zap size={14} className="hidden sm:inline-flex" />
                        <span className="text-xs">{totalCritChance}%</span>
                    </div>
                )}
                <div className="flex justify-around items-center w-full text-xs sm:text-sm font-bold">
                    <div className="flex items-center gap-1 text-[hsl(var(--hp))]" title="Dégâts">
                        <Swords size={12} className="sm:hidden" />
                        <Swords size={14} className="hidden sm:inline-flex" />
                        <span>{totalAttack}</span>
                    </div>
                    <div className="flex items-center gap-1 text-blue-400" title="Résistance">
                        <Shield size={12} className="sm:hidden" />
                        <Shield size={14} className="hidden sm:inline-flex" />
                        <span>{totalArmor}</span>
                    </div>
                </div>
                <div className='w-full px-2 mt-1'>
                    <div className="w-full bg-red-900 rounded-full h-2 sm:h-2.5 dark:bg-red-800 relative">
                        <div className="bg-red-500 h-2 sm:h-2.5 rounded-full" style={{width: `${health ? (health / card.initialHealth!) * 100 : 0}%`}}></div>
                        <span className='absolute inset-0 text-white text-[8px] sm:text-[10px] font-bold text-center w-full leading-tight'>{health || 0} / {card.initialHealth || 0}</span>
                    </div>
                </div>
            </div>
          )}
          {type === 'Artifact' && duration !== undefined && (
             <div className="flex items-center gap-2 text-sm sm:text-lg font-bold text-white">
                <Timer size={20} className="sm:hidden"/>
                <Timer size={24} className="hidden sm:inline-flex"/>
                <span className="text-xs sm:text-base">{duration} tours</span>
            </div>
          )}
          {preferredBiome && Icon && (
            <div className="absolute top-16 sm:top-20 right-2" title={`Biome préféré : ${preferredBiome}`}>
                <Icon size={18} className="text-white/70"/>
            </div>
          )}
          {showSkill && card.skill && (
            <div className="absolute bottom-1 left-1" onClick={handleSkillClick}>
              <div className='p-1 bg-black/50 rounded-full cursor-pointer hover:bg-black/80 transition-colors'>
                {card.skill.type === 'taunt' && <ShieldQuestion className='w-5 h-5 sm:w-6 sm:h-6 text-yellow-400'/>}
                {card.skill.type === 'heal' && <PlusCircle className='w-5 h-5 sm:w-6 sm:h-6 text-green-400'/>}
                {card.skill.type === 'lifesteal' && <Heart className='w-5 h-5 sm:w-6 sm:h-6 text-red-400'/>}
                {card.skill.type === 'draw' && <Sparkles className='w-5 h-5 sm:w-6 sm:h-6 text-blue-400'/>}
              </div>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

    