'use client';

import { Heart } from 'lucide-react';
import { ManaIcon } from '../icons/ManaIcon';
import { cn } from '@/lib/utils';

interface PlayerStatsProps {
  hp: number;
  mana: number;
  maxMana: number;
  isOpponent?: boolean;
}

export default function PlayerStats({ hp, mana, maxMana, isOpponent = false }: PlayerStatsProps) {
  return (
    <div className={cn("flex gap-4 items-center p-2 rounded-lg bg-card/50 backdrop-blur-sm", isOpponent ? 'flex-row-reverse' : '')}>
      <div className="flex items-center gap-2 text-lg font-bold text-red-500">
        <Heart className="w-6 h-6 fill-current" />
        <span>{hp}</span>
      </div>
      <div className="flex items-center gap-2 text-lg font-bold text-blue-500">
        <ManaIcon className="w-6 h-6" />
        <span>{mana} / {maxMana}</span>
      </div>
    </div>
  );
}
