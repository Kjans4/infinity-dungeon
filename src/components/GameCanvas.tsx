// src/components/GameCanvas.tsx
"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Player } from "@/engine/Player";
import { InputHandler } from "@/engine/Input";
import { Enemy, spawnWave } from "@/engine/Enemy";
import { useGameLoop } from "@/hooks/useGameLoop";
import HUD from "@/components/HUD";

// ============================================================
// [🧱 BLOCK: Constants]
// ============================================================
const CANVAS_W       = 800;
const CANVAS_H       = 600;
const KILL_THRESHOLD = 8;
const MAX_HP         = 100;
const MAX_STAMINA    = 100;

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

  // ── React State ────────────────────────────────────────────
  const [isGameOver, setIsGameOver] = useState(false);
  const [hud, setHud] = useState<HUDState>({
    hp: MAX_HP,
    stamina: MAX_STAMINA,
    kills: 0,
    room: 1,
    floor: 1,
  });

  // ============================================================
  // [🧱 BLOCK: Init]
  // ============================================================
  useEffect(() => {
    if (typeof window !== "undefined") {
      inputRef.current = new InputHandler();
    }
    enemiesRef.current = spawnWave(KILL_THRESHOLD, CANVAS_W, CANVAS_H);

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
  // [🧱 BLOCK: Restart]
  // ============================================================
  const handleRestart = useCallback(() => {
    playerRef.current  = new Player(CANVAS_W / 2, CANVAS_H / 2);
    enemiesRef.current = spawnWave(KILL_THRESHOLD, CANVAS_W, CANVAS_H);
    killsRef.current   = 0;
    setHud({ hp: MAX_HP, stamina: MAX_STAMINA, kills: 0, room: 1, floor: 1 });
    setIsGameOver(false);
  }, []);

  // ============================================================
  // [🧱 BLOCK: Game Loop — ~60fps]
  // We never read isGameOver inside here — we check hp directly
  // so the loop callback never goes stale.
  // setIsGameOver is a stable React setter, safe to call here.
  // ============================================================
  useGameLoop((_deltaTime: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !inputRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ── Death check ──────────────────────────────────────────
    if (playerRef.current.hp <= 0) {
      setIsGameOver(true); // was missing in the previous version
      return;
    }

    // --- 1. Clear ---
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // --- 2. Update Player ---
    playerRef.current.update(inputRef.current);

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

      if (enemy.isCollidingWithPlayer(playerRef.current)) {
        playerRef.current.hp = Math.max(
          0,
          playerRef.current.hp - enemy.damage
        );
        enemy.x -= enemy.vx * 3;
        enemy.y -= enemy.vy * 3;
        enemy.damageCooldown = 800;
      }
    });

    // ============================================================
    // [🧱 BLOCK: Attack Collision — Circle vs AABB]
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
    // ============================================================
    const before = enemiesRef.current.length;
    enemiesRef.current = enemiesRef.current.filter((e) => !e.isDead);
    killsRef.current += before - enemiesRef.current.length;

    // --- 4. Draw ---
    enemiesRef.current.forEach((e) => e.draw(ctx));
    playerRef.current.draw(ctx);
  });

  // ============================================================
  // [🧱 BLOCK: JSX]
  // ============================================================
  return (
    <div className="flex flex-col items-center justify-center w-full h-screen bg-slate-900">

      {/* ── Game Over Overlay ── */}
      {isGameOver && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80"
          style={{ pointerEvents: "auto" }}
        >
          <p
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 52,
              fontWeight: 900,
              color: "#ef4444",
              letterSpacing: "0.1em",
              textShadow: "0 0 40px #ef4444",
              marginBottom: 8,
            }}
          >
            GAME OVER
          </p>
          <p
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 13,
              color: "#475569",
              marginBottom: 32,
            }}
          >
            You were slain on Floor {hud.floor} — Room {hud.room}
          </p>
          <button
            onClick={handleRestart}
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.2em",
              color: "#0f172a",
              backgroundColor: "#ef4444",
              border: "none",
              padding: "12px 36px",
              borderRadius: 4,
              cursor: "pointer",
              textTransform: "uppercase",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f87171")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ef4444")}
          >
            ▶ Raid Again
          </button>
        </div>
      )}

      {/* ── Game Canvas ── */}
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ display: "block" }}
        className="bg-slate-800 border-4 border-slate-700 rounded-t-lg shadow-2xl"
      />

      {/* ── HUD Footer ── */}
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