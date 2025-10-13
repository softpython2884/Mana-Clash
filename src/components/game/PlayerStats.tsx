'use client';

import { Heart, X } from 'lucide-react';
import { ManaIcon } from '../icons/ManaIcon';
import { cn } from '@/lib/utils';

interface PlayerStatsProps {
  hp: number;
  mana: number;
  maxMana: number;
  isOpponent?: boolean;
  isTargetable?: boolean;
  isTargeted?: boolean;
  onClick?: () => void;
  isBeingAttacked?: boolean;
}

export default function PlayerStats({ hp, mana, maxMana, isOpponent = false, isTargetable = false, isTargeted = false, onClick, isBeingAttacked = false }: PlayerStatsProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative flex gap-4 items-center p-2 rounded-xl bg-card/50 backdrop-blur-sm transition-all shadow-lg",
        isOpponent ? 'flex-row-reverse' : '',
        isTargetable && 'cursor-pointer ring-2 ring-yellow-400',
        isTargeted && 'ring-2 ring-red-500',
        isBeingAttacked && 'animate-shake-quick'
      )}
    >
      <div className="flex items-center gap-2 text-lg font-bold text-[hsl(var(--hp))]">
        <Heart className="w-6 h-6 fill-current" />
        <span>{hp}</span>
      </div>
      <div className="flex items-center gap-2 text-lg font-bold text-[hsl(var(--mana))]">
        <ManaIcon className="w-6 h-6" />
        <span>{mana} / {maxMana}</span>
      </div>
       {isTargeted && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
            <X className="w-16 h-16 text-red-500" />
        </div>
      )}
    </div>
  );
}
