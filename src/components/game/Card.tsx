'use client';
import type { Card as CardType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Swords, Shield, Heart, Zap } from 'lucide-react';

interface GameCardProps {
  card: CardType;
  isPlayable?: boolean;
  onClick?: () => void;
  inHand?: boolean;
}

export default function GameCard({ card, isPlayable = false, onClick, inHand = false }: GameCardProps) {
  const { name, manaCost, description, attack, defense, type, tapped, isAttacking, criticalHitChance } = card;

  return (
    <div
      className={cn(
        "relative transition-all duration-300 ease-in-out",
        inHand && "hover:-translate-y-4 hover:z-10",
        tapped && 'transform rotate-12 scale-95 opacity-70',
        isAttacking && 'border-4 border-red-500 shadow-lg shadow-red-500/50'
      )}
      onClick={onClick}
    >
      <Card
        className={cn(
          'w-[150px] h-[210px] md:w-[180px] md:h-[252px] flex flex-col overflow-hidden select-none bg-card-foreground/5 dark:bg-card-foreground/10 backdrop-blur-sm',
          isPlayable && 'cursor-pointer ring-4 ring-accent ring-offset-2 ring-offset-background shadow-lg shadow-accent/50 animate-pulse',
          onClick && "cursor-pointer"
        )}
      >
        <CardHeader className="p-2 flex-shrink-0">
          <CardTitle className="flex justify-between items-center text-sm md:text-base font-headline truncate">
            <span className="truncate mr-2 text-card-foreground">{name}</span>
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[hsl(var(--mana))] text-white text-xs font-bold shrink-0">
              {manaCost}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 flex-grow flex flex-col justify-center items-center text-center">
            <p className="text-xs font-bold text-muted-foreground">{type}</p>
             <CardDescription className="text-xs leading-tight mt-2 text-card-foreground/80">
                {description}
            </CardDescription>
        </CardContent>
        <CardFooter className="p-2 flex-shrink-0 min-h-[70px] flex flex-col items-start bg-secondary/30">
          {type === 'Creature' && (
            <div className="flex justify-around items-center w-full mt-auto pt-1 text-sm font-bold">
              <div className="flex items-center gap-1 text-[#EF4444]" title="Dégâts">
                <Swords size={14} />
                <span>{attack}</span>
              </div>
              <div className="flex items-center gap-1 text-[#22C55E]" title="Vie">
                <Heart size={14} />
                <span>{defense}</span>
              </div>
              <div className="flex items-center gap-1 text-[#3B82F6]" title="Résistance">
                <Shield size={14} />
                <span>{defense}</span>
              </div>
              <div className="flex items-center gap-1 text-[#FACC15]" title="Chance de coup critique">
                <Zap size={14} />
                <span>{criticalHitChance}%</span>
              </div>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
