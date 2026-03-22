// src/components/GameCanvas.tsx
"use client";

import React, { useRef, useEffect, useState } from "react";
import { Player } from "@/engine/Player";
import { InputHandler } from "@/engine/Input";
import { useGameLoop } from "@/hooks/useGameLoop";

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Use Refs for engine objects to avoid React re-render lag
  const playerRef = useRef<Player>(new Player(400, 300));
  const inputRef = useRef<InputHandler | null>(null);

  useEffect(() => {
    // Initialize input once on the client side
    if (typeof window !== "undefined") {
      inputRef.current = new InputHandler();
    }
  }, []);

  useGameLoop((deltaTime) => {
    const canvas = canvasRef.current;
    if (!canvas || !inputRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 1. Clear the screen
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. Update Physics
    playerRef.current.update(inputRef.current);

    // 3. Draw Everything
    playerRef.current.draw(ctx);
  });

  return (
    <div className="flex items-center justify-center w-full h-screen bg-slate-900">
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="bg-slate-800 border-4 border-slate-700 rounded-lg shadow-2xl"
      />
      <div className="absolute bottom-10 text-slate-400 font-mono text-sm">
        WASD: Move | C: Dash (30 Stam) | J/K: Attack (Stam cost)
      </div>
    </div>
  );
}