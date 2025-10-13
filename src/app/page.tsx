'use client';

import { useState, useEffect } from 'react';
import GameBoard from '@/components/game/GameBoard';
import { cn } from '@/lib/utils';

export default function Home() {
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'b') {
        event.preventDefault();
        setIsHeaderVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-body">
      <header
        className={cn(
          "p-2 bg-primary text-primary-foreground shadow-md sticky top-0 z-20 flex items-center justify-between transition-all duration-300 overflow-hidden",
          !isHeaderVisible && "-translate-y-full h-0 p-0"
        )}
      >
        <div className="w-1/3"></div>
        <h1 className="text-xl md:text-2xl font-headline font-bold text-center w-1/3">Mana Clash</h1>
        <div className="w-1/3 flex justify-end items-center gap-2">
        </div>
      </header>
      <main className="flex-grow flex items-center justify-center">
        <GameBoard />
      </main>
    </div>
  );
}
