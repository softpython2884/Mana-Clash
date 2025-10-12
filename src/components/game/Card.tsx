'use client';
import type { Card as CardType, BiomeType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Swords, Shield, Heart, Zap, Mountain, Trees, Snowflake, Flame, Sun, ShieldQuestion, X } from 'lucide-react';

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
  showSkill?: boolean; // Show the skill icon
}

const biomeIcon: Record<BiomeType, React.ElementType> = {
    Forest: Trees,
    Mountain: Mountain,
    Ice: Snowflake,
    Volcano: Flame,
    Desert: Sun,
    Sanctuary: Sun,
    Swamp: Trees 
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


export default function GameCard({ card, isPlayable = false, onClick, onSkillClick, inHand = false, isActiveBiome = false, isAttacking = false, isTargeted = false, isTargetable = false, showSkill = false }: GameCardProps) {
  const { name, manaCost, description, attack, health, armor, type, tapped, canAttack, criticalHitChance, preferredBiome, biome, taunt } = card;

  const Icon = preferredBiome ? biomeIcon[preferredBiome] : null;
  const borderClass = biome ? biomeColor[biome] : '';

  const handleSkillClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click event from firing
    if(onSkillClick) {
      onSkillClick();
    }
  }

  return (
    <div
      className={cn(
        "relative transition-all duration-300 ease-in-out",
        inHand && "hover:-translate-y-4 hover:z-10",
        tapped && 'transform rotate-12 scale-95 opacity-70',
        isActiveBiome && 'ring-4 ring-white'
      )}
      onClick={onClick}
    >
      <Card
        className={cn(
          'w-[150px] h-[210px] md:w-[180px] md:h-[252px] flex flex-col overflow-hidden select-none bg-card-foreground/5 dark:bg-card-foreground/10 backdrop-blur-sm',
          isPlayable && 'cursor-pointer ring-4 ring-primary ring-offset-2 ring-offset-background shadow-lg shadow-primary/50',
          canAttack && !tapped && 'cursor-pointer ring-4 ring-orange-500 ring-offset-2 ring-offset-background shadow-lg shadow-orange-500/50 animate-pulse',
          isAttacking && 'ring-4 ring-destructive ring-offset-2 ring-offset-background shadow-lg shadow-destructive/50', // Red border for selected attacker
          isTargetable && 'cursor-pointer ring-4 ring-yellow-400', // Highlight for potential targets
          onClick && "cursor-pointer",
          type === 'Biome' && `border-4 ${borderClass}`,
          taunt && 'shadow-lg shadow-blue-500/50'
        )}
      >
        <CardHeader className="p-2 flex-shrink-0">
          <CardTitle className="flex justify-between items-center text-sm md:text-base font-headline truncate">
            <span className="truncate mr-2 text-card-foreground">{name}</span>
            {manaCost > 0 && (
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[hsl(var(--mana))] text-white text-xs font-bold shrink-0">
                {manaCost}
                </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 flex-grow flex flex-col justify-center items-center text-center">
            <p className="text-xs font-bold text-muted-foreground">{type}</p>
             <CardDescription className="text-xs leading-tight mt-2 text-card-foreground/80">
                {description}
            </CardDescription>
            {taunt && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 text-blue-400 font-bold text-xs bg-black/50 px-2 py-1 rounded-full"><ShieldQuestion size={12}/> PROVOCATION</div>}
            {isTargeted && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <X className="w-16 h-16 text-red-500" />
              </div>
            )}
        </CardContent>
        <CardFooter className="p-2 flex-shrink-0 min-h-[50px] flex flex-col items-start bg-secondary/30">
          {type === 'Creature' && (
            <div className='w-full'>
                {criticalHitChance !== undefined && criticalHitChance > 0 && (
                    <div className="absolute top-14 right-2 flex items-center gap-1 text-[hsl(var(--debuff))]" title="Chance de coup critique">
                        <Zap size={14} />
                        <span>{criticalHitChance}%</span>
                    </div>
                )}
                <div className="flex justify-around items-center w-full text-sm font-bold">
                    <div className="flex items-center gap-1 text-[hsl(var(--hp))]" title="Dégâts">
                        <Swords size={14} />
                        <span>{attack}</span>
                    </div>
                    <div className="flex items-center gap-1 text-blue-400" title="Résistance">
                        <Shield size={14} />
                        <span>{armor}</span>
                    </div>
                </div>
                <div className='w-full px-2 mt-1'>
                    <div className="w-full bg-red-900 rounded-full h-2.5 dark:bg-red-800 relative">
                        <div className="bg-red-500 h-2.5 rounded-full" style={{width: `${health ? (health / card.initialHealth!) * 100 : 0}%`}}></div>
                        <span className='absolute inset-0 text-white text-[10px] font-bold text-center w-full leading-tight'>{health || 0} / {card.initialHealth || 0}</span>
                    </div>
                </div>
            </div>
          )}
          {preferredBiome && Icon && (
            <div className="absolute top-20 right-2" title={`Biome préféré : ${preferredBiome}`}>
                <Icon size={18} className="text-white/70"/>
            </div>
          )}
          {showSkill && card.skill && (
            <div className="absolute bottom-1 left-1" onClick={handleSkillClick}>
              <div className='p-1 bg-black/50 rounded-full cursor-pointer hover:bg-black/80 transition-colors'>
                {card.skill.type === 'taunt' && <ShieldQuestion className='w-6 h-6 text-yellow-400'/>}
              </div>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
