import GameBoard from '@/components/game/GameBoard';
import GameHeader from '@/components/game/GameHeader';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-body">
      <GameHeader />
      <main className="flex-grow flex items-center justify-center">
        <GameBoard />
      </main>
    </div>
  );
}
