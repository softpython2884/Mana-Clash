'use client';
import type { Card } from '@/lib/types';
import GameCard from './Card';
import { Card as UICard, CardHeader, CardTitle, CardContent } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { GameState } from '@/lib/types';
import { Button } from '../ui/button';

interface PlayerInventoryProps {
    structures: Card[];
    onActivateSkill: (cardId: string) => void;
    mana: number;
    phase: GameState['phase'];
    activePlayer: GameState['activePlayer'];
}

export default function PlayerInventory({ structures, onActivateSkill, mana, phase, activePlayer }: PlayerInventoryProps) {

  const handleSkillClick = (cardId: string, requiredMana: number) => {
    if (activePlayer === 'player' && phase === 'main' && mana >= requiredMana) {
        onActivateSkill(cardId);
    }
  }

  return (
    <UICard className="h-full bg-black/30 backdrop-blur-sm border-white/10 flex flex-col">
      <CardHeader>
        <CardTitle className="text-center font-headline text-lg">Structures</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden">
        <ScrollArea className="h-full pr-4">
          <div className="flex flex-col gap-4">
            {structures.length === 0 && (
                <div className="text-center text-muted-foreground mt-10">Aucune structure active.</div>
            )}
            {structures.map((card) => {
                const requiredManaForSkill = card.skill?.type === 'global_buff_armor' ? 8 : 0;
                const canActivate = activePlayer === 'player' && phase === 'main' && mana >= requiredManaForSkill && !card.skill?.onCooldown;
              return (
                <div key={card.id} className="relative">
                    <GameCard 
                        card={card} 
                        isStructure
                    />
                    {card.skill?.type === 'global_buff_armor' && (
                        <Button 
                            onClick={() => handleSkillClick(card.id, requiredManaForSkill)}
                            disabled={!canActivate}
                            className="absolute bottom-10 left-1/2 -translate-x-1/2 w-3/4"
                        >
                            Activer ({requiredManaForSkill} Mana)
                        </Button>
                    )}
                    {card.skill?.type === 'revive' && (
                         <Button 
                            onClick={() => onActivateSkill(card.id)}
                            disabled={activePlayer !== 'player' || phase !== 'main' || (card.uses !== undefined && card.uses <= 0)}
                            className="absolute bottom-10 left-1/2 -translate-x-1/2 w-3/4"
                        >
                            Marquer une créature
                        </Button>
                    )}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </UICard>
  );
}
