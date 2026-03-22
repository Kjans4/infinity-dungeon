// src/components/GameCanvas.tsx
"use client";

import React, { useRef, useEffect, useState } from "react";
import { Player } from "@/engine/Player";
import { InputHandler } from "@/engine/Input";
import { Enemy, spawnWave } from "@/engine/Enemy";
import { useGameLoop } from "@/hooks/useGameLoop";
import HUD from "@/components/HUD";

// ============================================================
// [🧱 BLOCK: Constants]
// Tune game balance here in one place.
// ============================================================
const CANVAS_W       = 800;
const CANVAS_H       = 600;
const KILL_THRESHOLD = 8;   // Kills needed to open the gate
const MAX_HP         = 100;
const MAX_STAMINA    = 100;

// ============================================================
// [🧱 BLOCK: HUD Sync State Shape]
// React state is ONLY used for the HUD overlay.
// All physics / AI run in refs at 60fps — no re-renders.
// ============================================================
interface HUDState {
  hp: number;
  stamina: number;
  kills: number;
  room: number;
  floor: number;
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Engine Refs ────────────────────────────────────────────
  const playerRef  = useRef<Player>(new Player(CANVAS_W / 2, CANVAS_H / 2));
  const inputRef   = useRef<InputHandler | null>(null);
  const enemiesRef = useRef<Enemy[]>([]);
  const killsRef   = useRef<number>(0);

  // ── HUD State (synced at 10fps via interval) ───────────────
  const [hud, setHud] = useState<HUDState>({
    hp: MAX_HP,
    stamina: MAX_STAMINA,
    kills: 0,
    room: 1,
    floor: 1,
  });

  // ============================================================
  // [🧱 BLOCK: Init — runs once on mount]
  // ============================================================
  useEffect(() => {
    if (typeof window !== "undefined") {
      inputRef.current = new InputHandler();
    }

    // Spawn first wave
    enemiesRef.current = spawnWave(KILL_THRESHOLD, CANVAS_W, CANVAS_H);

    // Sync HUD values at 10fps so React doesn't fight the 60fps loop
    const hudSync = setInterval(() => {
      setHud((prev) => ({
        ...prev,
        hp:      Math.max(0, playerRef.current.hp),
        stamina: Math.round(playerRef.current.stamina),
        kills:   killsRef.current,
      }));
    }, 100);

    return () => clearInterval(hudSync);
  }, []);

  // ============================================================
  // [🧱 BLOCK: Game Loop — ~60fps]
  // ============================================================
  useGameLoop((_deltaTime: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !inputRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Stop all updates on death (HUD death overlay takes over)
    if (playerRef.current.hp <= 0) return;

    // --- 1. Clear ---
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // --- 2. Update Player ---
    playerRef.current.update(inputRef.current);

    // Clamp player inside arena walls
    playerRef.current.x = Math.max(
      0,
      Math.min(CANVAS_W - playerRef.current.width, playerRef.current.x)
    );
    playerRef.current.y = Math.max(
      0,
      Math.min(CANVAS_H - playerRef.current.height, playerRef.current.y)
    );

    // --- 3. Update Enemies + Contact Damage ---
    enemiesRef.current.forEach((enemy) => {
      enemy.update(playerRef.current, CANVAS_W, CANVAS_H);

      // Enemy body touches player → deal contact damage
      if (enemy.isCollidingWithPlayer(playerRef.current)) {
        playerRef.current.hp = Math.max(
          0,
          playerRef.current.hp - enemy.damage
        );
        // Nudge enemy back so it doesn't stick
        enemy.x -= enemy.vx * 3;
        enemy.y -= enemy.vy * 3;
        enemy.damageCooldown = 800;
      }
    });

    // ============================================================
    // [🧱 BLOCK: Attack Collision — Circle vs AABB]
    // Mirrors the attack circle drawn in Player.ts draw()
    // ============================================================
    if (playerRef.current.isAttacking) {
      const p      = playerRef.current;
      const range  = p.attackType === "light" ? 35 : 55;
      const radius = p.attackType === "light" ? 15 : 25;
      const damage = p.attackType === "light" ? 10 : 25;

      const circleX = (p.x + p.width  / 2) + p.facing.x * range;
      const circleY = (p.y + p.height / 2) + p.facing.y * range;

      enemiesRef.current.forEach((enemy) => {
        if (enemy.isDead) return;
        const nearestX = Math.max(enemy.x, Math.min(circleX, enemy.x + enemy.width));
        const nearestY = Math.max(enemy.y, Math.min(circleY, enemy.y + enemy.height));
        const distSq   = (circleX - nearestX) ** 2 + (circleY - nearestY) ** 2;
        if (distSq < radius * radius) {
          enemy.takeDamage(damage);
        }
      });
    }

    // ============================================================
    // [🧱 BLOCK: Kill Tracking]
    // Count how many died this frame, add to the kill ref.
    // ============================================================
    const before = enemiesRef.current.length;
    enemiesRef.current = enemiesRef.current.filter((e) => !e.isDead);
    killsRef.current += before - enemiesRef.current.length;

    // --- 4. Draw — enemies first, player renders on top ---
    enemiesRef.current.forEach((e) => e.draw(ctx));
    playerRef.current.draw(ctx);
  });

  // ============================================================
  // [🧱 BLOCK: JSX]
  // Canvas + HUD overlay stacked in a relative container.
  // ============================================================
  return (
    <div className="flex flex-col items-center justify-center w-full h-screen bg-slate-900 gap-0">

      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ display: "block" }}
        className="bg-slate-800 border-4 border-slate-700 rounded-t-lg shadow-2xl"
      />

      {/* HUD Footer — sits directly below the canvas */}
      <HUD
        hp={hud.hp}
        maxHp={MAX_HP}
        stamina={hud.stamina}
        maxStamina={MAX_STAMINA}
        kills={hud.kills}
        killThreshold={KILL_THRESHOLD}
        room={hud.room}
        floor={hud.floor}
      />

    </div>
  );
}