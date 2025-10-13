import GameBoard from '@/components/game/GameBoard';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-body">
      <header className="p-2 bg-primary text-primary-foreground shadow-md sticky top-0 z-20 flex items-center justify-between">
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
