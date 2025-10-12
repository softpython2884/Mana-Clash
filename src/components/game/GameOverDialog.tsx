'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface GameOverDialogProps {
  winner?: 'player' | 'opponent';
  onRestart: () => void;
}

export default function GameOverDialog({ winner, onRestart }: GameOverDialogProps) {
  if (!winner) return null;

  const isPlayerWinner = winner === 'player';

  return (
    <AlertDialog open={!!winner}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-headline text-3xl text-center">
            {isPlayerWinner ? 'Victoire !' : 'Défaite'}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            {isPlayerWinner
              ? 'Félicitations ! Vous avez vaincu votre adversaire.'
              : "Votre adversaire a été plus fort cette fois. Ne baissez pas les bras !"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex justify-center mt-4">
          <Button onClick={onRestart}>
            Rejouer
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
