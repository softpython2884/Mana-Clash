'use client';
import { useReducer, useEffect, useMemo, useState } from 'react';
import { gameReducer, getInitialState } from '@/lib/game-reducer';
import type { Card } from '@/lib/types';
import GameCard from './Card';
import PlayerStats from './PlayerStats';
import GameOverDialog from './GameOverDialog';
import { Button } from '@/components/ui/button';
import { Swords, RotateCcw, ScrollText } from 'lucide-react';
import { Card as UICard, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';

export default function GameBoard() {
  const [state, dispatch] = useReducer(gameReducer, getInitialState());
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
    dispatch({ type: 'INITIALIZE_GAME' });
  }, []);

  const { gameId, turn, activePlayer, phase, player, opponent, winner, log, isThinking } = state;
  
  // Opponent AI logic
  useEffect(() => {
    if (activePlayer === 'opponent' && phase !== 'game-over' && isThinking) {
      const opponentTurn = async () => {
        await new Promise(res => setTimeout(res, 1000));
        
        let tempState = {...state};

        const playLand = () => {
          const landInHand = tempState.opponent.hand.find(c => c.type === 'Land');
          if (landInHand) {
              const landPlayedThisTurn = tempState.opponent.battlefield.some(c => c.type === 'Land' && c.summoningSickness);
              if (!landPlayedThisTurn) {
                const newHand = tempState.opponent.hand.filter(c => c.id !== landInHand.id);
                const newMaxMana = tempState.opponent.maxMana + 1;
                tempState = {
                  ...tempState,
                  opponent: {
                    ...tempState.opponent,
                    hand: newHand,
                    battlefield: [...tempState.opponent.battlefield, { ...landInHand, summoningSickness: true }],
                    maxMana: newMaxMana,
                    mana: newMaxMana,
                  },
                  log: [...tempState.log, { turn: tempState.turn, message: `Adversaire joue ${landInHand.name}.` }]
                };
              }
          }
        };

        const playCreature = () => {
          const playableCreatures = tempState.opponent.hand.filter(c => c.type === 'Creature' && c.manaCost <= tempState.opponent.mana);
          if (playableCreatures.length > 0) {
            const creatureToPlay = playableCreatures[Math.floor(Math.random() * playableCreatures.length)];
            const newHand = tempState.opponent.hand.filter(c => c.id !== creatureToPlay.id);
            tempState = {
              ...tempState,
              opponent: {
                ...tempState.opponent,
                hand: newHand,
                battlefield: [...tempState.opponent.battlefield, { ...creatureToPlay, summoningSickness: true, canAttack: false }],
                mana: tempState.opponent.mana - creatureToPlay.manaCost,
              },
              log: [...tempState.log, { turn: tempState.turn, message: `Adversaire invoque ${creatureToPlay.name}.` }]
            };
          }
        };

        const attack = () => {
            const attackers = tempState.opponent.battlefield.filter(c => c.canAttack && !c.summoningSickness && !c.tapped);
            if (attackers.length > 0) {
                const totalDamage = attackers.reduce((sum, c) => sum + (c.attack || 0), 0);
                const newPlayerHp = tempState.player.hp - totalDamage;
                const newOpponentBattlefield = tempState.opponent.battlefield.map(c => attackers.some(a => a.id === c.id) ? { ...c, tapped: true } : c);
                const winner = newPlayerHp <= 0 ? 'opponent' : undefined;
                tempState = {
                    ...tempState,
                    player: { ...tempState.player, hp: newPlayerHp },
                    opponent: { ...tempState.opponent, battlefield: newOpponentBattlefield },
                    log: [...tempState.log, { turn: tempState.turn, message: `Adversaire attaque avec ${attackers.length} créature(s) pour ${totalDamage} dégâts.` }],
                    phase: winner ? 'game-over' : tempState.phase,
                    winner,
                };
            }
        };
        
        playLand();
        await new Promise(res => setTimeout(res, 500));
        playCreature();
        await new Promise(res => setTimeout(res, 500));
        attack();
        await new Promise(res => setTimeout(res, 1000));

        dispatch({ type: 'OPPONENT_ACTION', action: () => tempState });
        dispatch({ type: 'PASS_TURN' });
      };

      opponentTurn();
    }
  }, [activePlayer, phase, gameId, isThinking, state]);
  
  const handlePlayCard = (cardId: string) => {
    dispatch({ type: 'PLAY_CARD', cardId });
  };
  
  const handleToggleAttacker = (cardId: string) => {
    dispatch({ type: 'TOGGLE_ATTACKER', cardId });
  };

  const handlePhaseAction = () => {
    if (activePlayer !== 'player') return;
    if (phase === 'main') {
      const hasAttackers = player.battlefield.some(c => c.canAttack);
      if (hasAttackers) {
          dispatch({ type: 'LOG_MESSAGE', message: 'Phase d\'attaque. Sélectionnez vos attaquants.' });
          const newState = gameReducer(state, { type: 'LOG_MESSAGE', message: 'Phase d\'attaque. Sélectionnez vos attaquants.' });
          // This is a bit of a hack to change phase
          Object.assign(state, { ...newState, phase: 'combat' });
          // Force re-render if needed
          dispatch({ type: 'LOG_MESSAGE', message: '' }); 
      } else {
          dispatch({ type: 'PASS_TURN' });
      }
    } else if (phase === 'combat') {
      dispatch({ type: 'DECLARE_ATTACK' });
    }
  };

  const MemoizedPlayerHand = useMemo(() => player.hand.map((card) => (
      <GameCard
          key={card.id}
          card={card}
          isPlayable={activePlayer === 'player' && phase === 'main' && card.manaCost <= player.mana && (card.type !== 'Land' || !player.battlefield.some(c=>c.type === 'Land' && c.summoningSickness))}
          onClick={() => handlePlayCard(card.id)}
          inHand
      />
  )), [player.hand, activePlayer, phase, player.mana, player.battlefield]);

  const MemoizedPlayerBattlefield = useMemo(() => player.battlefield.map((card) => (
      <GameCard
          key={card.id}
          card={card}
          onClick={() => phase === 'combat' && handleToggleAttacker(card.id)}
      />
  )), [player.battlefield, phase]);
  
  const MemoizedOpponentBattlefield = useMemo(() => opponent.battlefield.map((card) => (
      <GameCard key={card.id} card={card} />
  )), [opponent.battlefield]);

  if (!isClient) {
    return null; // or a loading spinner
  }

  return (
    <div className="w-full h-full flex flex-col p-4 gap-4 max-w-7xl mx-auto">
      <GameOverDialog winner={winner} onRestart={() => dispatch({ type: 'RESTART_GAME' })} />

      {/* Opponent Area */}
      <div className="flex justify-between items-start">
        <PlayerStats hp={opponent.hp} mana={opponent.mana} maxMana={opponent.maxMana} isOpponent />
        <div className="flex gap-2">
            <UICard className="w-24 h-32 flex flex-col items-center justify-center bg-secondary">
                <p className="font-bold">Pioche</p>
                <p>{opponent.deck.length}</p>
            </UICard>
            <div className="flex flex-wrap-reverse gap-1 justify-end w-96 h-32">
                {Array(opponent.hand.length).fill(0).map((_, i) => <div key={i} className="w-20 h-28 bg-primary rounded-lg"/>)}
            </div>
        </div>
      </div>
      <div className="min-h-[18rem] bg-black/10 rounded-lg p-2 flex items-center justify-center gap-2">
         {MemoizedOpponentBattlefield}
      </div>


      {/* Mid-section */}
      <div className="flex justify-between items-center my-2 gap-4">
          <Button onClick={() => dispatch({ type: 'RESTART_GAME' })} variant="outline" size="icon"><RotateCcw/></Button>
          <div className="flex flex-col items-center gap-2">
              <p className="font-headline text-xl">{activePlayer === 'player' ? 'Votre tour' : 'Tour de l\'adversaire'}</p>
              <Button onClick={handlePhaseAction} disabled={activePlayer !== 'player' || winner !== undefined} className={cn("w-48", phase === 'combat' && 'bg-red-600 hover:bg-red-700')}>
                {phase === 'main' ? 'Fin du tour' : 'Déclarer l\'attaque'}
                <Swords className="ml-2"/>
              </Button>
          </div>
          <UICard className="w-64 h-32">
            <CardContent className="p-2 h-full">
              <div className="flex items-center gap-2 mb-1">
                <ScrollText size={16}/>
                <h3 className="font-headline text-sm">Log de jeu</h3>
              </div>
              <ScrollArea className="h-24">
                  {log.slice().reverse().map((l, i) => <p key={i} className="text-xs text-muted-foreground">{l.message}</p>)}
              </ScrollArea>
            </CardContent>
          </UICard>
      </div>

      {/* Player Area */}
      <div className="min-h-[18rem] bg-black/10 rounded-lg p-2 flex items-center justify-center gap-2">
         {MemoizedPlayerBattlefield}
      </div>
      <div className="flex justify-between items-end">
        <PlayerStats hp={player.hp} mana={player.mana} maxMana={player.maxMana} />
        <div className="flex gap-2 items-end">
            <div className="flex justify-center gap-[-4rem]">{MemoizedPlayerHand}</div>
            <UICard className="w-24 h-32 flex flex-col items-center justify-center bg-secondary">
                <p className="font-bold">Pioche</p>
                <p>{player.deck.length}</p>
            </UICard>
            <UICard className="w-24 h-32 flex flex-col items-center justify-center bg-black/30 text-white">
                <p className="font-bold">Cimetière</p>
                <p>{player.graveyard.length}</p>
            </UICard>
        </div>
      </div>
    </div>
  );
}
