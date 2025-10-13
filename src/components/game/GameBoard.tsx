'use client';
import { useReducer, useEffect, useMemo, useState } from 'react';
import { gameReducer, getInitialState } from '@/lib/game-reducer';
import type { Card } from '@/lib/types';
import GameCard from './Card';
import PlayerStats from './PlayerStats';
import GameOverDialog from './GameOverDialog';
import { Button } from '@/components/ui/button';
import { Swords, RotateCcw, ScrollText, Brain, Replace } from 'lucide-react';
import { Card as UICard, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import GameLog from './GameLog';

export default function GameBoard() {
  const [state, dispatch] = useReducer(gameReducer, getInitialState());
  const [isClient, setIsClient] = useState(false);
  const [leavingCards, setLeavingCards] = useState<string[]>([]);

  useEffect(() => {
    setIsClient(true);
    if (state.gameId === 0) {
        dispatch({ type: 'INITIALIZE_GAME' });
    }
  }, [state.gameId]);

  useEffect(() => {
    // When cards are removed from the battlefield, add them to the leaving list
    const currentIds = new Set([...state.player.battlefield.map(c => c.id), ...state.opponent.battlefield.map(c => c.id)]);
    const previousIds = new Set(leavingCards);
    
    // Find cards that are in leavingCards but not on the battlefield anymore
    leavingCards.forEach(id => {
      if (!currentIds.has(id)) {
        // Card is truly gone, remove it from leaving list after animation
        setTimeout(() => {
          setLeavingCards(prev => prev.filter(cardId => cardId !== id));
        }, 500); // Corresponds to animation duration
      }
    });

  }, [state.player.battlefield, state.opponent.battlefield]);


  const { gameId, turn, activePlayer, phase, player, opponent, winner, log, isThinking, activeBiome, selectedAttackerId, selectedDefenderId, selectedCardId, spellBeingCast } = state;
  
  // Opponent AI logic
  useEffect(() => {
    if (activePlayer === 'opponent' && phase !== 'game-over' && isThinking) {
      const opponentTurn = async () => {
        await new Promise(res => setTimeout(res, 500));
        dispatch({ type: 'EXECUTE_OPPONENT_TURN' });
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
    } else if (phase === 'main' || (phase === 'spell_targeting' && (spellBeingCast?.skill?.target === 'friendly_creature' || spellBeingCast?.skill?.target === 'any_creature'))) {
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
    const attacker = player.battlefield.find(c => c.id === selectedAttackerId);
    if(attacker) {
      setLeavingCards(prev => [...prev, attacker.id]);
    }
    dispatch({ type: 'DECLARE_ATTACK' });
  };
  
  const handleMeditate = () => {
    if (activePlayer !== 'player' || phase !== 'main') return;
    dispatch({ type: 'MEDITATE' });
  }
  
  const handleRedraw = () => {
    if (activePlayer !== 'player' || phase !== 'main' || turn !== 1 || player.hasRedrawn) return;
    dispatch({ type: 'REDRAW_HAND' });
  }

  const handlePassTurn = () => {
    if (activePlayer !== 'player') return;
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
              isPlayable={activePlayer === 'player' && (phase === 'main' || phase === 'post_mulligan') && (isBiomeChangeable || isCardPlayable)}
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
          showSkill={card.id === selectedCardId && !!card.skill && !card.skill.onCooldown && !card.summoningSickness && !card.tapped}
          isTargetable={phase === 'spell_targeting' && (spellBeingCast?.skill?.target === 'friendly_creature' || spellBeingCast?.skill?.target === 'any_creature')}
          isEntering={card.isEntering}
          isLeaving={leavingCards.includes(card.id) && card.health <= 0}
      />
  )), [player.battlefield, phase, selectedAttackerId, selectedCardId, spellBeingCast, leavingCards]);

  const opponentHasTaunt = opponent.battlefield.some(c => c.taunt && !c.tapped);
  const opponentHasCreatures = opponent.battlefield.filter(c => c.type === 'Creature').length > 0;
  const canTargetOpponentDirectly = phase === 'targeting' && selectedAttackerId && !opponentHasTaunt && !opponentHasCreatures;

  const attackerCard = useMemo(() => {
    if (!selectedAttackerId) return null;
    return player.battlefield.find(c => c.id === selectedAttackerId) || null;
  }, [selectedAttackerId, player.battlefield]);


  const MemoizedOpponentBattlefield = useMemo(() => opponent.battlefield.map((card) => {
    const isTargetableForAttack = phase === 'targeting' && selectedAttackerId && card.type === 'Creature' && (!opponentHasTaunt || card.taunt);
    const isTargetableForSpell = phase === 'spell_targeting' && card.type === 'Creature' && (spellBeingCast?.skill?.target === 'opponent_creature' || spellBeingCast?.skill?.target === 'any_creature');
    
    let isLethal = false;
    if (isTargetableForAttack && attackerCard) {
        const totalAttack = (attackerCard.attack || 0) + (attackerCard.buffs?.filter(b => b.type === 'attack').reduce((acc, b) => acc + b.value, 0) || 0);
        const totalArmor = (card.armor || 0) + (card.buffs?.filter(b => b.type === 'armor').reduce((acc, b) => acc + b.value, 0) || 0);
        const damageAfterArmor = Math.max(0, totalAttack - totalArmor);
        isLethal = damageAfterArmor >= (card.health || 0);
    }

    return (
        <GameCard 
          key={card.id} 
          card={card} 
          isTargeted={card.id === selectedDefenderId}
          isTargetable={isTargetableForAttack || isTargetableForSpell}
          isLethal={isLethal}
          onClick={() => {
            if (isTargetableForAttack) handleSelectDefender(card.id);
            if (isTargetableForSpell) handleSelectSpellTarget(card.id);
          }}
          isEntering={card.isEntering}
          isLeaving={leavingCards.includes(card.id) && card.health <= 0}
        />
    )
  }), [opponent.battlefield, phase, selectedAttackerId, selectedDefenderId, opponentHasTaunt, spellBeingCast, attackerCard, leavingCards]);

  if (!isClient) {
    // Basic loading skeleton
    return (
      <div className="w-full h-full flex p-4 gap-4 max-w-7xl mx-auto animate-pulse">
        <div className="flex-grow">
          <div className="h-24 md:h-32 bg-gray-800 rounded-xl"></div>
          <div className="min-h-[18rem] bg-gray-800 rounded-xl mt-4"></div>
          <div className="h-16 bg-gray-800 rounded-xl mt-4"></div>
          <div className="min-h-[18rem] bg-gray-800 rounded-xl mt-4"></div>
          <div className="h-24 md:h-32 bg-gray-800 rounded-xl mt-4"></div>
        </div>
        <div className="w-80 h-full bg-gray-800 rounded-xl"></div>
      </div>
    );
  }

  const canAttack = player.battlefield.some(c => c.canAttack && !c.tapped);
  const canMeditate = player.graveyard.length > 0;
  const canRedraw = turn === 1 && !player.hasRedrawn;

  const getPhaseDescription = () => {
    switch(phase) {
        case 'main':
            return activePlayer === 'player' ? 'Votre tour' : 'Tour de l\'adversaire';
        case 'combat':
            return 'Choisissez un attaquant';
        case 'targeting':
            return 'Choisissez une cible';
        case 'spell_targeting':
            return `Ciblez une créature pour ${spellBeingCast?.name}`;
        case 'post_mulligan':
            return 'Jouez une carte pour terminer votre tour.';
        default:
            return '';
    }
  }
  return (
    <div className="w-full h-full flex p-2 sm:p-4 gap-2 sm:gap-4 max-w-[100rem] mx-auto">
      <div className="flex-grow flex flex-col gap-2 sm:gap-4">
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
          <div className="flex flex-col sm:flex-row gap-2">
              <UICard className="w-20 h-28 sm:w-24 sm:h-32 flex flex-col items-center justify-center bg-secondary/20 rounded-xl backdrop-blur-sm">
                  <p className="font-bold text-sm sm:text-base">Pioche</p>
                  <p>{opponent.deck.length}</p>
              </UICard>
              <div className="hidden sm:flex flex-wrap-reverse gap-1 justify-end w-96 h-32">
                  {Array(opponent.hand.length).fill(0).map((_, i) => <div key={i} className="w-20 h-28 bg-primary rounded-xl shadow-md"/>)}
              </div>
          </div>
        </div>
        <div className="min-h-[184px] sm:min-h-[224px] md:min-h-[268px] bg-black/20 rounded-xl p-2 flex items-center justify-center gap-2 backdrop-blur-sm shadow-inner overflow-x-auto">
          {MemoizedOpponentBattlefield}
        </div>


        {/* Mid-section */}
        <div className="flex justify-between items-center my-2 gap-4">
            <Button onClick={() => dispatch({ type: 'RESTART_GAME' })} variant="outline" size="icon" className="hidden sm:inline-flex"><RotateCcw/></Button>
            <div className="flex items-center gap-4">
              {activeBiome && <GameCard card={activeBiome} isActiveBiome />}
              <div className="flex flex-col items-center gap-2">
                  <p className="font-headline text-lg sm:text-xl">{getPhaseDescription()}</p>
                  {phase === 'main' && activePlayer === 'player' && (
                    <div className="flex gap-2">
                        {turn === 1 && (
                        <Button onClick={handleRedraw} disabled={!canRedraw} variant="secondary" className="w-28 sm:w-36">
                            Mulligan
                            <Replace className="ml-2"/>
                        </Button>
                        )}
                        <Button onClick={handlePhaseAction} disabled={winner !== undefined || !canAttack} className="w-28 sm:w-36">
                            Combat
                            <Swords className="ml-2"/>
                        </Button>
                         <Button onClick={handleMeditate} disabled={winner !== undefined || !canMeditate} variant="secondary" className="w-28 sm:w-36">
                            Méditer
                            <Brain className="ml-2"/>
                        </Button>
                        <Button onClick={handlePassTurn} disabled={winner !== undefined} className="w-28 sm:w-36">
                            Fin du tour
                        </Button>
                    </div>
                  )}
                   {phase === 'post_mulligan' && activePlayer === 'player' && (
                     <p className="text-sm text-muted-foreground">Jouez une carte pour terminer votre tour.</p>
                  )}
                  {(phase === 'combat' || phase === 'targeting') && activePlayer === 'player' && (
                    <div className="flex gap-2">
                        <Button onClick={handleDeclareAttack} disabled={!selectedAttackerId || !selectedDefenderId} className="w-32 sm:w-48 bg-red-600 hover:bg-red-700">
                          Attaquer
                          <Swords className="ml-2 hidden sm:inline-flex"/>
                        </Button>
                        <Button onClick={() => dispatch({ type: 'CHANGE_PHASE', phase: 'main' })} variant="outline" disabled={winner !== undefined} className="w-32 sm:w-48">
                            Annuler
                        </Button>
                    </div>
                  )}
                  {phase === 'spell_targeting' && activePlayer === 'player' && (
                    <div className="flex gap-2">
                        <Button onClick={() => dispatch({ type: 'CHANGE_PHASE', phase: 'main' })} variant="outline" disabled={winner !== undefined} className="w-32 sm:w-48">
                            Annuler
                        </Button>
                    </div>
                  )}
                  {activePlayer === 'opponent' && (
                      <p className="text-sm text-muted-foreground animate-pulse">L'adversaire réfléchit...</p>
                  )}
              </div>
            </div>
        </div>

        {/* Player Area */}
        <div className="min-h-[184px] sm:min-h-[224px] md:min-h-[268px] bg-black/20 rounded-xl p-2 flex items-center justify-center gap-2 backdrop-blur-sm shadow-inner overflow-x-auto">
          {MemoizedPlayerBattlefield}
        </div>
        <div className="flex justify-between items-end">
          <PlayerStats hp={player.hp} mana={player.mana} maxMana={player.maxMana} />
          <div className="flex gap-2 items-end">
              <div className="flex justify-center -space-x-12 sm:-space-x-20">{MemoizedPlayerHand}</div>
              <div className="flex flex-col sm:flex-row gap-2">
                <UICard className="w-20 h-28 sm:w-24 sm:h-32 flex flex-col items-center justify-center bg-secondary/20 rounded-xl backdrop-blur-sm">
                    <p className="font-bold text-sm sm:text-base">Pioche</p>
                    <p>{player.deck.length}</p>
                </UICard>
                <UICard className="w-20 h-28 sm:w-24 sm:h-32 flex flex-col items-center justify-center bg-black/40 text-white rounded-xl backdrop-blur-sm">
                    <p className="font-bold text-sm sm:text-base">Cimetière</p>
                    <p>{player.graveyard.length}</p>
                </UICard>
              </div>
          </div>
        </div>
      </div>
      <div className="w-80 hidden lg:block">
        <GameLog log={log} />
      </div>
       <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden fixed bottom-4 right-4 z-50">
                    <ScrollText />
                </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-1/3">
                <SheetHeader>
                    <SheetTitle>Journal de jeu</SheetTitle>
                </SheetHeader>
                <GameLog log={log} />
            </SheetContent>
        </Sheet>
    </div>
  );
}

    