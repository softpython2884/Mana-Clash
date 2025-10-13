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
    if (state.gameId === 0) {
        dispatch({ type: 'INITIALIZE_GAME' });
    }
  }, [state.gameId]);

  const { gameId, turn, activePlayer, phase, player, opponent, winner, log, isThinking, activeBiome, selectedAttackerId, selectedDefenderId, selectedCardId, spellBeingCast } = state;
  
  // Opponent AI logic
  useEffect(() => {
    if (activePlayer === 'opponent' && phase !== 'game-over' && isThinking) {
      const opponentTurn = async () => {
        await new Promise(res => setTimeout(res, 500));
        
        // The reducer now handles the complex state transitions.
        // We'll dispatch a single action that encapsulates the AI's entire turn.
        dispatch({ type: 'EXECUTE_OPPONENT_TURN' });

        // The reducer will set isThinking to false and pass the turn.
      };

      opponentTurn();
    }
  }, [activePlayer, phase, gameId, isThinking, dispatch]);
  
  const handlePlayCard = (cardId: string) => {
    dispatch({ type: 'PLAY_CARD', cardId });
  };
  
  const handleSelectCardOnBattlefield = (cardId: string) => {
    const card = player.battlefield.find(c => c.id === cardId);
    if (!card) return;

    if (phase === 'combat' && card.canAttack && !card.tapped) {
      dispatch({ type: 'SELECT_ATTACKER', cardId });
    } else if (phase === 'main') {
      dispatch({ type: 'SELECT_CARD', cardId });
    }
  }

  const handleActivateSkill = (cardId: string) => {
    dispatch({ type: 'ACTIVATE_SKILL', cardId });
  }

  const handleSelectDefender = (cardId: string | 'opponent') => {
    if (phase === 'targeting') {
      dispatch({ type: 'SELECT_DEFENDER', cardId });
    }
  }
  
  const handleSelectSpellTarget = (cardId: string) => {
    if (phase === 'spell_targeting') {
        dispatch({ type: 'CAST_SPELL_ON_TARGET', targetId: cardId });
    }
  }

  const handlePhaseAction = () => {
    if (activePlayer !== 'player') return;
    if (phase === 'main') {
        dispatch({ type: 'CHANGE_PHASE', phase: 'combat' });
    }
  };

  const handleDeclareAttack = () => {
    if (activePlayer !== 'player' || phase !== 'targeting' || !selectedAttackerId || !selectedDefenderId) return;
    dispatch({ type: 'DECLARE_ATTACK' });
  };

  const handlePassTurn = () => {
    if (activePlayer !== 'player') return;
    // Allow passing turn from any phase except targeting to prevent accidental skips
    if (phase === 'targeting' || phase === 'spell_targeting') return; 
    dispatch({ type: 'PASS_TURN' });
  }

  const MemoizedPlayerHand = useMemo(() => player.hand.map((card) => {
      const isBiomeChangeable = card.type === 'Biome' && player.biomeChanges > 0;
      const hasPlayedLand = player.battlefield.some(c => c.type === 'Land' && c.summoningSickness);
      const isCardPlayable = card.manaCost <= player.mana && (card.type !== 'Land' || !hasPlayedLand);
      
      return (
          <GameCard
              key={card.id}
              card={card}
              isPlayable={activePlayer === 'player' && phase === 'main' && (isBiomeChangeable || isCardPlayable)}
              onClick={() => handlePlayCard(card.id)}
              inHand
          />
      );
  }), [player.hand, activePlayer, phase, player.mana, player.battlefield, player.biomeChanges]);

  const MemoizedPlayerBattlefield = useMemo(() => player.battlefield.map((card) => (
      <GameCard
          key={card.id}
          card={card}
          isAttacking={card.id === selectedAttackerId}
          onClick={() => handleSelectCardOnBattlefield(card.id)}
          onSkillClick={() => handleActivateSkill(card.id)}
          showSkill={card.id === selectedCardId && !!card.skill && !card.skill.used && !card.summoningSickness && !card.tapped}
      />
  )), [player.battlefield, phase, selectedAttackerId, selectedCardId]);

  const opponentHasTaunt = opponent.battlefield.some(c => c.taunt && !c.tapped);
  const opponentHasCreatures = opponent.battlefield.filter(c => c.type === 'Creature').length > 0;
  const canTargetOpponentDirectly = phase === 'targeting' && selectedAttackerId && !opponentHasTaunt && !opponentHasCreatures;


  const MemoizedOpponentBattlefield = useMemo(() => opponent.battlefield.map((card) => {
    const isTargetableForAttack = phase === 'targeting' && selectedAttackerId && card.type === 'Creature' && (!opponentHasTaunt || card.taunt);
    const isTargetableForSpell = phase === 'spell_targeting' && card.type === 'Creature';

    return (
        <GameCard 
          key={card.id} 
          card={card} 
          isTargeted={card.id === selectedDefenderId}
          isTargetable={isTargetableForAttack || isTargetableForSpell}
          onClick={() => {
            if (isTargetableForAttack) handleSelectDefender(card.id);
            if (isTargetableForSpell) handleSelectSpellTarget(card.id);
          }}
        />
    )
  }), [opponent.battlefield, phase, selectedAttackerId, selectedDefenderId, opponentHasTaunt, spellBeingCast]);

  if (!isClient) {
    // Basic loading skeleton
    return (
      <div className="w-full h-full flex flex-col p-4 gap-4 max-w-7xl mx-auto animate-pulse">
        <div className="h-32 bg-gray-800 rounded-xl"></div>
        <div className="min-h-[18rem] bg-gray-800 rounded-xl"></div>
        <div className="h-16 bg-gray-800 rounded-xl"></div>
        <div className="min-h-[18rem] bg-gray-800 rounded-xl"></div>
        <div className="h-32 bg-gray-800 rounded-xl"></div>
      </div>
    );
  }

  const canAttack = player.battlefield.some(c => c.canAttack && !c.tapped);

  const getPhaseDescription = () => {
    switch(phase) {
        case 'main':
            return activePlayer === 'player' ? 'Votre tour' : 'Tour de l\'adversaire';
        case 'combat':
            return 'Choisissez un attaquant';
        case 'targeting':
            return 'Choisissez une cible';
        case 'spell_targeting':
            return `Ciblez une créature ennemie pour ${spellBeingCast?.name}`;
        default:
            return '';
    }
  }
  return (
    <div className="w-full h-full flex flex-col p-4 gap-4 max-w-7xl mx-auto">
      <GameOverDialog winner={winner} onRestart={() => dispatch({ type: 'RESTART_GAME' })} />

      {/* Opponent Area */}
      <div className="flex justify-between items-start">
        <PlayerStats 
            hp={opponent.hp} 
            mana={opponent.mana} 
            maxMana={opponent.maxMana} 
            isOpponent 
            isTargetable={canTargetOpponentDirectly}
            isTargeted={selectedDefenderId === 'opponent'}
            onClick={() => handleSelectDefender('opponent')}
        />
        <div className="flex gap-2">
            <UICard className="w-24 h-32 flex flex-col items-center justify-center bg-secondary/20 rounded-xl backdrop-blur-sm">
                <p className="font-bold">Pioche</p>
                <p>{opponent.deck.length}</p>
            </UICard>
            <div className="flex flex-wrap-reverse gap-1 justify-end w-96 h-32">
                {Array(opponent.hand.length).fill(0).map((_, i) => <div key={i} className="w-20 h-28 bg-primary rounded-xl shadow-md"/>)}
            </div>
        </div>
      </div>
      <div className="min-h-[268px] bg-black/20 rounded-xl p-2 flex items-center justify-center gap-2 backdrop-blur-sm shadow-inner">
         {MemoizedOpponentBattlefield}
      </div>


      {/* Mid-section */}
      <div className="flex justify-between items-center my-2 gap-4">
          <Button onClick={() => dispatch({ type: 'RESTART_GAME' })} variant="outline" size="icon"><RotateCcw/></Button>
          <div className="flex items-center gap-4">
            {activeBiome && <GameCard card={activeBiome} isActiveBiome />}
            <div className="flex flex-col items-center gap-2">
                <p className="font-headline text-xl">{getPhaseDescription()}</p>
                {phase === 'main' && activePlayer === 'player' && (
                  <div className="flex gap-2">
                      <Button onClick={handlePhaseAction} disabled={winner !== undefined || !canAttack} className="w-48">
                          Combat
                          <Swords className="ml-2"/>
                      </Button>
                      <Button onClick={handlePassTurn} disabled={winner !== undefined} className="w-48">
                          Fin du tour
                      </Button>
                  </div>
                )}
                {(phase === 'combat' || phase === 'targeting') && activePlayer === 'player' && (
                  <div className="flex gap-2">
                      <Button onClick={handleDeclareAttack} disabled={!selectedAttackerId || !selectedDefenderId} className="w-48 bg-red-600 hover:bg-red-700">
                         Attaquer la cible
                         <Swords className="ml-2"/>
                      </Button>
                       <Button onClick={() => dispatch({ type: 'CHANGE_PHASE', phase: 'main' })} variant="outline" disabled={winner !== undefined} className="w-48">
                          Annuler
                      </Button>
                  </div>
                )}
                 {phase === 'spell_targeting' && activePlayer === 'player' && (
                  <div className="flex gap-2">
                       <Button onClick={() => dispatch({ type: 'CHANGE_PHASE', phase: 'main' })} variant="outline" disabled={winner !== undefined} className="w-48">
                          Annuler
                      </Button>
                  </div>
                )}
                 {activePlayer === 'opponent' && (
                    <p className="text-sm text-muted-foreground animate-pulse">L'adversaire réfléchit...</p>
                )}
            </div>
          </div>
          <UICard className="w-64 h-32 rounded-xl backdrop-blur-sm bg-card/50">
            <CardContent className="p-2 h-full">
              <div className="flex items-center gap-2 mb-1">
                <ScrollText size={16}/>
                <h3 className="font-headline text-sm">Log de jeu</h3>
              </div>
              <ScrollArea className="h-24">
                  {log.slice().reverse().map((l, i) => <p key={i} className="text-xs text-muted-foreground">{`[T${l.turn}] ${l.message}`}</p>)}
              </ScrollArea>
            </CardContent>
          </UICard>
      </div>

      {/* Player Area */}
      <div className="min-h-[268px] bg-black/20 rounded-xl p-2 flex items-center justify-center gap-2 backdrop-blur-sm shadow-inner">
         {MemoizedPlayerBattlefield}
      </div>
      <div className="flex justify-between items-end">
        <PlayerStats hp={player.hp} mana={player.mana} maxMana={player.maxMana} />
        <div className="flex gap-2 items-end">
            <div className="flex justify-center gap-[-5rem]">{MemoizedPlayerHand}</div>
            <div className="flex gap-2">
              <UICard className="w-24 h-32 flex flex-col items-center justify-center bg-secondary/20 rounded-xl backdrop-blur-sm">
                  <p className="font-bold">Pioche</p>
                  <p>{player.deck.length}</p>
              </UICard>
              <UICard className="w-24 h-32 flex flex-col items-center justify-center bg-black/40 text-white rounded-xl backdrop-blur-sm">
                  <p className="font-bold">Cimetière</p>
                  <p>{player.graveyard.length}</p>
              </UICard>
            </div>
        </div>
      </div>
    </div>
  );
}
