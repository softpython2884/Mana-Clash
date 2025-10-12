'use client';
import type { Card as CardType } from '@/lib/types';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ManaIcon } from '../icons/ManaIcon';
import { Swords, Shield } from 'lucide-react';

interface GameCardProps {
  card: CardType;
  isPlayable?: boolean;
  onClick?: () => void;
  inHand?: boolean;
}

export default function GameCard({ card, isPlayable = false, onClick, inHand = false }: GameCardProps) {
  const { name, manaCost, image, description, attack, defense, type, tapped, isAttacking } = card;

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
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold shrink-0">
              {manaCost}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-grow relative">
          <Image
            src={image.imageUrl}
            alt={image.description}
            width={180}
            height={120}
            data-ai-hint={image.imageHint}
            className="w-full h-full object-cover"
          />
        </CardContent>
        <CardFooter className="p-2 flex-shrink-0 min-h-[70px] flex flex-col items-start bg-secondary/30">
          <p className="text-xs font-bold text-muted-foreground">{type}</p>
          <CardDescription className="text-xs leading-tight mt-1 text-card-foreground/80">
            {description}
          </CardDescription>
          {type === 'Creature' && (
            <div className="flex justify-end items-center w-full mt-auto pt-1">
              <div className="flex items-center gap-2 text-sm font-bold">
                <div className="flex items-center gap-1 text-red-600">
                  <Swords size={14} />
                  <span>{attack}</span>
                </div>
                <div className="flex items-center gap-1 text-blue-700">
                  <Shield size={14} />
                  <span>{defense}</span>
                </div>
              </div>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
