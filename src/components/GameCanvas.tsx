// src/components/GameCanvas.tsx
"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Player } from "@/engine/Player";
import { InputHandler } from "@/engine/Input";
import { Enemy, spawnWave } from "@/engine/Enemy";
import { Camera, WORLD_W, WORLD_H } from "@/engine/Camera";
import { useGameLoop } from "@/hooks/useGameLoop";
import HUD from "@/components/HUD";

// ============================================================
// [🧱 BLOCK: Constants]
// CANVAS = the browser window viewport size.
// WORLD  = the actual scrollable arena size (defined in Camera.ts).
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
  const playerRef  = useRef<Player>(new Player(WORLD_W / 2, WORLD_H / 2));
  const inputRef   = useRef<InputHandler | null>(null);
  const enemiesRef = useRef<Enemy[]>([]);
  const killsRef   = useRef<number>(0);
  const cameraRef  = useRef<Camera>(new Camera(CANVAS_W, CANVAS_H));

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

    // Spawn wave across the full world
    enemiesRef.current = spawnWave(KILL_THRESHOLD, WORLD_W, WORLD_H);

    // Snap camera to player spawn position immediately
    cameraRef.current.update(playerRef.current);

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
    playerRef.current  = new Player(WORLD_W / 2, WORLD_H / 2);
    enemiesRef.current = spawnWave(KILL_THRESHOLD, WORLD_W, WORLD_H);
    killsRef.current   = 0;
    cameraRef.current  = new Camera(CANVAS_W, CANVAS_H);
    cameraRef.current.update(playerRef.current);
    setHud({ hp: MAX_HP, stamina: MAX_STAMINA, kills: 0, room: 1, floor: 1 });
    setIsGameOver(false);
  }, []);

  // ============================================================
  // [🧱 BLOCK: Game Loop — ~60fps]
  // ============================================================
  useGameLoop((_deltaTime: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !inputRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ── Death check ──────────────────────────────────────────
    if (playerRef.current.hp <= 0) {
      setIsGameOver(true);
      return;
    }

    // --- 1. Clear ---
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // --- 2. Update Camera ---
    cameraRef.current.update(playerRef.current);

    // --- 3. Draw World Background ---
    // Dark grid pattern to show the world is scrolling
    drawWorldGrid(ctx, cameraRef.current);

    // --- 4. Draw World Boundary Walls ---
    drawWorldBounds(ctx, cameraRef.current);

    // --- 5. Update Player ---
    playerRef.current.update(inputRef.current);

    // Clamp player inside WORLD boundaries (not canvas)
    playerRef.current.x = Math.max(
      0,
      Math.min(WORLD_W - playerRef.current.width, playerRef.current.x)
    );
    playerRef.current.y = Math.max(
      0,
      Math.min(WORLD_H - playerRef.current.height, playerRef.current.y)
    );

    // --- 6. Update Enemies + Contact Damage ---
    enemiesRef.current.forEach((enemy) => {
      enemy.update(playerRef.current, WORLD_W, WORLD_H);

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
    // Attack circle uses world coords for collision,
    // screen coords only matter for drawing (handled in Player.ts)
    // ============================================================
    if (playerRef.current.isAttacking) {
      const p      = playerRef.current;
      const range  = p.attackType === "light" ? 35 : 55;
      const radius = p.attackType === "light" ? 15 : 25;
      const damage = p.attackType === "light" ? 10 : 25;

      // Use WORLD coords for collision math
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
    killsRef.current  += before - enemiesRef.current.length;

    // --- 7. Draw Entities (pass camera to offset positions) ---
    enemiesRef.current.forEach((e) => e.draw(ctx, cameraRef.current));
    playerRef.current.draw(ctx, cameraRef.current);
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
          <p style={{
            fontFamily: "'Courier New', monospace",
            fontSize: 52, fontWeight: 900,
            color: "#ef4444", letterSpacing: "0.1em",
            textShadow: "0 0 40px #ef4444", marginBottom: 8,
          }}>
            GAME OVER
          </p>
          <p style={{
            fontFamily: "'Courier New', monospace",
            fontSize: 13, color: "#475569", marginBottom: 32,
          }}>
            You were slain on Floor {hud.floor} — Room {hud.room}
          </p>
          <button
            onClick={handleRestart}
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 14, fontWeight: 700, letterSpacing: "0.2em",
              color: "#0f172a", backgroundColor: "#ef4444",
              border: "none", padding: "12px 36px",
              borderRadius: 4, cursor: "pointer", textTransform: "uppercase",
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

// ============================================================
// [🧱 BLOCK: World Grid Painter]
// Draws a subtle scrolling dot grid so the player can feel
// they're moving through a space, not standing still.
// ============================================================
function drawWorldGrid(ctx: CanvasRenderingContext2D, camera: Camera) {
  const gridSize = 80;
  const dotSize  = 1.5;

  ctx.fillStyle = "rgba(148, 163, 184, 0.12)"; // slate-400 at low opacity

  // Offset grid lines by camera position so they scroll
  const startX = -(camera.x % gridSize);
  const startY = -(camera.y % gridSize);

  for (let x = startX; x < CANVAS_W; x += gridSize) {
    for (let y = startY; y < CANVAS_H; y += gridSize) {
      ctx.beginPath();
      ctx.arc(x, y, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ============================================================
// [🧱 BLOCK: World Boundary Painter]
// Draws a visible red border at the world's edges so the
// player knows where the arena ends.
// ============================================================
function drawWorldBounds(ctx: CanvasRenderingContext2D, camera: Camera) {
  const sx = camera.toScreenX(0);
  const sy = camera.toScreenY(0);
  const sw = WORLD_W;
  const sh = WORLD_H;

  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth   = 6;
  ctx.strokeRect(sx, sy, sw, sh);
}