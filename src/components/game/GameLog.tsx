'use client';
import type { LogEntry } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Swords, Heart, Shield, Sparkles, Zap, ShieldQuestion, Skull, Leaf, Droplets, Mountain, Wind, Sun, Moon, Info, Play, Dices } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GameLogProps {
    log: LogEntry[];
}

const logIcons = {
    game_start: Dices,
    game_over: Skull,
    phase: Info,
    play: Play,
    draw: Droplets,
    combat: Swords,
    damage: Heart,
    heal: Heart,
    buff: Shield,
    debuff: Shield,
    destroy: Skull,
    skill: Sparkles,
    spell: Sparkles,
    mana: Zap,
    biome: Leaf,
    info: Info,
};

const logColors = {
    game_start: 'text-yellow-400',
    game_over: 'text-red-600 font-bold',
    phase: 'text-gray-400 italic',
    play: 'text-white font-semibold',
    draw: 'text-blue-300',
    combat: 'text-orange-400',
    damage: 'text-red-400',
    heal: 'text-green-400',
    buff: 'text-cyan-300',
    debuff: 'text-purple-400',
    destroy: 'text-red-500 font-bold',
    skill: 'text-yellow-300',
    spell: 'text-purple-300',
    mana: 'text-blue-400',
    biome: 'text-green-300',
    info: 'text-gray-400',
};


export default function GameLog({ log }: GameLogProps) {
    return (
        <Card className="h-full bg-black/30 backdrop-blur-sm border-white/10 flex flex-col">
            <CardHeader>
                <CardTitle className="text-center font-headline text-lg">Journal de jeu</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow overflow-hidden">
                <ScrollArea className="h-full pr-4">
                    <div className="flex flex-col gap-2">
                        {log.slice().reverse().map((entry, i) => {
                            const Icon = logIcons[entry.type] || Info;
                            const colorClass = logColors[entry.type] || 'text-gray-400';
                            return (
                                <div key={i} className={cn("flex items-start gap-2 text-sm p-2 rounded-md bg-black/20", colorClass)}>
                                    <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                                    <p className="flex-grow">
                                        <span className='font-mono text-xs mr-2 opacity-60'>[T{entry.turn}]</span>
                                        {entry.message}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
