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
// Canvas size is now dynamic — set on mount from window size.
// WORLD size stays fixed in Camera.ts.
// ============================================================
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
  const cameraRef  = useRef<Camera | null>(null);

  // ── Screen size — read once on mount ──────────────────────
  const screenW = useRef<number>(800);
  const screenH = useRef<number>(600);

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
    // Read actual screen size
    screenW.current = window.innerWidth;
    screenH.current = window.innerHeight;

    // Size the canvas to fill the window
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width  = screenW.current;
      canvas.height = screenH.current;
    }

    // Init camera with real screen size
    cameraRef.current = new Camera(screenW.current, screenH.current);
    cameraRef.current.update(playerRef.current);

    // Input
    inputRef.current = new InputHandler();

    // First wave
    enemiesRef.current = spawnWave(KILL_THRESHOLD, WORLD_W, WORLD_H);

    // Resize handler — keeps canvas fullscreen if window resizes
    const handleResize = () => {
      screenW.current = window.innerWidth;
      screenH.current = window.innerHeight;
      if (canvas) {
        canvas.width  = screenW.current;
        canvas.height = screenH.current;
      }
      if (cameraRef.current) {
        cameraRef.current.screenW = screenW.current;
        cameraRef.current.screenH = screenH.current;
      }
    };
    window.addEventListener("resize", handleResize);

    // HUD sync at 10fps
    const hudSync = setInterval(() => {
      setHud((prev) => ({
        ...prev,
        hp:      Math.max(0, playerRef.current.hp),
        stamina: Math.round(playerRef.current.stamina),
        kills:   killsRef.current,
      }));
    }, 100);

    return () => {
      clearInterval(hudSync);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // ============================================================
  // [🧱 BLOCK: Restart]
  // ============================================================
  const handleRestart = useCallback(() => {
    playerRef.current  = new Player(WORLD_W / 2, WORLD_H / 2);
    enemiesRef.current = spawnWave(KILL_THRESHOLD, WORLD_W, WORLD_H);
    killsRef.current   = 0;
    cameraRef.current  = new Camera(screenW.current, screenH.current);
    cameraRef.current.update(playerRef.current);
    setHud({ hp: MAX_HP, stamina: MAX_STAMINA, kills: 0, room: 1, floor: 1 });
    setIsGameOver(false);
  }, []);

  // ============================================================
  // [🧱 BLOCK: Game Loop — ~60fps]
  // ============================================================
  useGameLoop((_deltaTime: number) => {
    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    if (!canvas || !camera || !inputRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = screenW.current;
    const H = screenH.current;

    // ── Death check ──────────────────────────────────────────
    if (playerRef.current.hp <= 0) {
      setIsGameOver(true);
      return;
    }

    // --- 1. Clear ---
    ctx.clearRect(0, 0, W, H);

    // --- 2. Update Camera ---
    camera.update(playerRef.current);

    // --- 3. Draw World Background ---
    drawWorldGrid(ctx, camera, W, H);

    // --- 4. Draw World Boundary Walls ---
    drawWorldBounds(ctx, camera);

    // --- 5. Update Player ---
    playerRef.current.update(inputRef.current);

    // Clamp player inside WORLD boundaries
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
    killsRef.current  += before - enemiesRef.current.length;

    // --- 7. Draw Entities ---
    enemiesRef.current.forEach((e) => e.draw(ctx, camera));
    playerRef.current.draw(ctx, camera);
  });

  // ============================================================
  // [🧱 BLOCK: JSX]
  // No wrapper padding, no border — canvas fills the window.
  // HUD is absolutely pinned to the bottom center.
  // ============================================================
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#0f172a" }}>

      {/* ── Fullscreen Canvas ── */}
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100vw", height: "100vh" }}
      />

      {/* ── HUD — pinned to bottom center over the canvas ── */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10,
        pointerEvents: "none",
      }}>
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

      {/* ── Game Over Overlay ── */}
      {isGameOver && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 50,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.82)",
        }}>
          <p style={{
            fontFamily: "'Courier New', monospace",
            fontSize: 64, fontWeight: 900,
            color: "#ef4444", letterSpacing: "0.1em",
            textShadow: "0 0 60px #ef4444", marginBottom: 12,
          }}>
            GAME OVER
          </p>
          <p style={{
            fontFamily: "'Courier New', monospace",
            fontSize: 14, color: "#475569", marginBottom: 40,
          }}>
            You were slain on Floor {hud.floor} — Room {hud.room}
          </p>
          <button
            onClick={handleRestart}
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 15, fontWeight: 700, letterSpacing: "0.2em",
              color: "#0f172a", backgroundColor: "#ef4444",
              border: "none", padding: "14px 44px",
              borderRadius: 4, cursor: "pointer",
              textTransform: "uppercase",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f87171")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ef4444")}
          >
            ▶ Raid Again
          </button>
        </div>
      )}

    </div>
  );
}

// ============================================================
// [🧱 BLOCK: World Grid Painter]
// Scrolling dot grid — gives a sense of movement and scale.
// ============================================================
function drawWorldGrid(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  W: number,
  H: number
) {
  const gridSize = 80;
  const dotSize  = 1.5;

  ctx.fillStyle = "rgba(148, 163, 184, 0.1)";

  const startX = -(camera.x % gridSize);
  const startY = -(camera.y % gridSize);

  for (let x = startX; x < W; x += gridSize) {
    for (let y = startY; y < H; y += gridSize) {
      ctx.beginPath();
      ctx.arc(x, y, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ============================================================
// [🧱 BLOCK: World Boundary Painter]
// Red border at the world's hard edge.
// ============================================================
function drawWorldBounds(ctx: CanvasRenderingContext2D, camera: Camera) {
  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth   = 6;
  ctx.strokeRect(
    camera.toScreenX(0),
    camera.toScreenY(0),
    WORLD_W,
    WORLD_H
  );
}