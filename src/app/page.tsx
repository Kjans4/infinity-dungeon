// src/app/page.tsx
import GameCanvas from "@/components/GameCanvas";

export default function Home() {
  return (
    <main className="min-h-screen bg-black">
      <GameCanvas />
    </main>
  );
}