// src/components/GameCanvas.tsx
"use client";

import React, { useRef, useEffect } from "react";
import { Player } from "@/engine/Player";
import { InputHandler } from "@/engine/Input";
import { Enemy, spawnWave } from "@/engine/Enemy";
import { useGameLoop } from "@/hooks/useGameLoop";

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ============================================================
  // [🧱 BLOCK: Engine Refs]
  // Using refs (not state) so updates never trigger a re-render.
  // ============================================================
  const playerRef  = useRef<Player>(new Player(400, 300));
  const inputRef   = useRef<InputHandler | null>(null);
  const enemiesRef = useRef<Enemy[]>([]);

  // ============================================================
  // [🧱 BLOCK: Init — runs once on mount]
  // Sets up input listener and spawns the first wave.
  // ============================================================
  useEffect(() => {
    if (typeof window !== "undefined") {
      inputRef.current = new InputHandler();
    }

    // Spawn 8 grunts for the first room
    enemiesRef.current = spawnWave(8, 800, 600);
  }, []);

  // ============================================================
  // [🧱 BLOCK: Game Loop — ~60 fps]
  // Order matters:
  //   1. Clear canvas
  //   2. Update all entities (physics, AI, timers)
  //   3. Check collisions
  //   4. Draw everything
  // ============================================================
  useGameLoop((_deltaTime: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !inputRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // --- 1. Clear ---
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- 2. Update Player ---
    playerRef.current.update(inputRef.current);

    // Clamp player inside the arena
    playerRef.current.x = Math.max(
      0,
      Math.min(canvas.width - playerRef.current.width, playerRef.current.x)
    );
    playerRef.current.y = Math.max(
      0,
      Math.min(canvas.height - playerRef.current.height, playerRef.current.y)
    );

    // --- 3. Update Enemies + Contact Damage ---
    enemiesRef.current.forEach((enemy) => {
      enemy.update(playerRef.current, canvas.width, canvas.height);

      // Enemy walks into player → deal contact damage
      if (enemy.isCollidingWithPlayer(playerRef.current)) {
        playerRef.current.hp = Math.max(
          0,
          playerRef.current.hp - enemy.damage
        );
        // Cooldown is set inside isCollidingWithPlayer check,
        // but we also push the enemy back slightly so they don't stick
        enemy.x -= enemy.vx * 3;
        enemy.y -= enemy.vy * 3;
        enemy.damageCooldown = 800; // 800ms before it can hurt again
      }
    });

    // ============================================================
    // [🧱 BLOCK: Attack Collision]
    // Checks if the player's active attack circle overlaps
    // with any living enemy's rectangle (Circle vs AABB).
    // ============================================================
    if (playerRef.current.isAttacking) {
      const p = playerRef.current;

      // Mirror the attack circle from Player.ts draw()
      const range   = p.attackType === 'light' ? 35 : 55;
      const radius  = p.attackType === 'light' ? 15 : 25;
      const damage  = p.attackType === 'light' ? 10 : 25;

      const circleX = (p.x + p.width  / 2) + (p.facing.x * range);
      const circleY = (p.y + p.height / 2) + (p.facing.y * range);

      enemiesRef.current.forEach((enemy) => {
        if (enemy.isDead) return;

        // Find the closest point on the enemy rect to the circle center
        const nearestX = Math.max(enemy.x, Math.min(circleX, enemy.x + enemy.width));
        const nearestY = Math.max(enemy.y, Math.min(circleY, enemy.y + enemy.height));

        const distX = circleX - nearestX;
        const distY = circleY - nearestY;
        const distSq = distX * distX + distY * distY;

        if (distSq < radius * radius) {
          enemy.takeDamage(damage);
        }
      });
    }

    // Remove dead enemies from the array
    enemiesRef.current = enemiesRef.current.filter((e) => !e.isDead);

    // --- 4. Draw (enemies first, player on top) ---
    enemiesRef.current.forEach((enemy) => enemy.draw(ctx));
    playerRef.current.draw(ctx);
  });

  // ============================================================
  // [🧱 BLOCK: Render]
  // ============================================================
  return (
    <div className="flex items-center justify-center w-full h-screen bg-slate-900">
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="bg-slate-800 border-4 border-slate-700 rounded-lg shadow-2xl"
      />
      <div className="absolute bottom-10 text-slate-400 font-mono text-sm">
        WASD: Move &nbsp;|&nbsp; C: Dash &nbsp;|&nbsp; J: Light Attack &nbsp;|&nbsp; K: Heavy Attack
      </div>
    </div>
  );
}