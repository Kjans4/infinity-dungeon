// src/components/GameCanvas.tsx
"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Player } from "@/engine/Player";
import { InputHandler } from "@/engine/Input";
import { Enemy, spawnWave } from "@/engine/Enemy";
import { Boss } from "@/engine/Boss";
import { Door } from "@/engine/Door";
import { Camera, WORLD_W, WORLD_H, BOSS_WORLD_W, BOSS_WORLD_H } from "@/engine/Camera";
import {
  RoomState, initialRoomState, advanceRoom, nextFloor,
} from "@/engine/RoomManager";
import { useGameLoop } from "@/hooks/useGameLoop";
import HUD from "@/components/HUD";
import Shop from "@/components/Shop";
import Menu from "@/components/Menu";

// ============================================================
// [🧱 BLOCK: Constants]
// ============================================================
const KILL_THRESHOLD = 20;
const INITIAL_WAVE   = 8;
const WAVE_SIZE      = 6;
const MAX_HP         = 100;
const MAX_STAMINA    = 100;

const hordeSpawn = (wW: number, wH: number) => ({ x: wW / 2, y: wH - 100 });
const bossSpawn  = () => ({ x: BOSS_WORLD_W / 2, y: BOSS_WORLD_H - 100 });

interface HUDState {
  hp: number; stamina: number;
  kills: number; room: number; floor: number;
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Engine Refs ────────────────────────────────────────────
  const playerRef    = useRef<Player | null>(null);
  const inputRef     = useRef<InputHandler | null>(null);
  const enemiesRef   = useRef<Enemy[]>([]);
  const bossRef      = useRef<Boss | null>(null);
  const doorRef      = useRef<Door | null>(null);
  const cameraRef    = useRef<Camera | null>(null);
  const killsRef     = useRef<number>(0);
  const aliveRef     = useRef<number>(0);
  const lastSpawnRef = useRef<number>(0);
  const roomStateRef = useRef<RoomState>(initialRoomState());

  const screenW = useRef<number>(800);
  const screenH = useRef<number>(600);

  // ── React State (UI only) ──────────────────────────────────
  // ✅ FIX: showMenu starts true — nothing runs until RAID clicked
  const [showMenu,   setShowMenu]   = useState(true);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isVictory,  setIsVictory]  = useState(false);
  const [showShop,   setShowShop]   = useState(false);
  const [hud, setHud] = useState<HUDState>({
    hp: MAX_HP, stamina: MAX_STAMINA,
    kills: 0, room: 1, floor: 1,
  });

  // ============================================================
  // [🧱 BLOCK: Setup Horde Room]
  // ============================================================
  const setupHordeRoom = useCallback((rs: RoomState) => {
    if (!playerRef.current || !cameraRef.current) return;

    const sp = hordeSpawn(WORLD_W, WORLD_H);
    playerRef.current.x  = sp.x;
    playerRef.current.y  = sp.y;
    playerRef.current.vx = 0;
    playerRef.current.vy = 0;
    playerRef.current.hp = MAX_HP;

    killsRef.current     = 0;
    aliveRef.current     = INITIAL_WAVE;
    lastSpawnRef.current = 0;

    enemiesRef.current = spawnWave(INITIAL_WAVE, WORLD_W, WORLD_H, 'grunt', rs.floor);
    bossRef.current    = null;
    doorRef.current    = new Door(WORLD_W);
    doorRef.current.isActive = false;

    cameraRef.current.update(playerRef.current, WORLD_W, WORLD_H);
  }, []);

  // ============================================================
  // [🧱 BLOCK: Setup Boss Room]
  // ============================================================
  const setupBossRoom = useCallback((rs: RoomState) => {
    if (!playerRef.current || !cameraRef.current) return;

    const sp = bossSpawn();
    playerRef.current.x  = sp.x;
    playerRef.current.y  = sp.y;
    playerRef.current.vx = 0;
    playerRef.current.vy = 0;

    enemiesRef.current = [];
    killsRef.current   = 0;
    bossRef.current    = new Boss(BOSS_WORLD_W / 2 - 40, 80, rs.floor);
    doorRef.current    = null;

    cameraRef.current.update(playerRef.current, BOSS_WORLD_W, BOSS_WORLD_H);
  }, []);

  // ============================================================
  // [🧱 BLOCK: Init — canvas + input only, NO game setup]
  // Game setup happens in handleStart when RAID is clicked.
  // ============================================================
  useEffect(() => {
    screenW.current = window.innerWidth;
    screenH.current = window.innerHeight;

    const canvas = canvasRef.current!;
    canvas.width  = screenW.current;
    canvas.height = screenH.current;

    // Camera and input ready — but no enemies, no player stats
    cameraRef.current = new Camera(screenW.current, screenH.current);
    inputRef.current  = new InputHandler();
    playerRef.current = new Player(WORLD_W / 2, WORLD_H / 2);

    // ✅ FIX: Leave everything empty until RAID is clicked
    enemiesRef.current = [];
    doorRef.current    = null;
    bossRef.current    = null;

    const handleResize = () => {
      screenW.current   = window.innerWidth;
      screenH.current   = window.innerHeight;
      canvas.width      = screenW.current;
      canvas.height     = screenH.current;
      if (cameraRef.current) {
        cameraRef.current.screenW = screenW.current;
        cameraRef.current.screenH = screenH.current;
      }
    };
    window.addEventListener("resize", handleResize);

    const hudSync = setInterval(() => {
      if (!playerRef.current) return;
      setHud({
        hp:      Math.max(0, playerRef.current.hp),
        stamina: Math.round(playerRef.current.stamina),
        kills:   killsRef.current,
        room:    roomStateRef.current.roomDisplay,
        floor:   roomStateRef.current.floor,
      });
    }, 100);

    return () => {
      clearInterval(hudSync);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // ============================================================
  // [🧱 BLOCK: Handle Start — called by RAID button]
  // Initializes everything fresh and hides the menu.
  // ============================================================
  const handleStart = useCallback(() => {
    const rs = initialRoomState();
    roomStateRef.current = rs;

    playerRef.current  = new Player(WORLD_W / 2, WORLD_H / 2);
    cameraRef.current  = new Camera(screenW.current, screenH.current);

    setupHordeRoom(rs);

    setHud({ hp: MAX_HP, stamina: MAX_STAMINA, kills: 0, room: 1, floor: 1 });
    setIsGameOver(false);
    setIsVictory(false);
    setShowShop(false);
    setShowMenu(false); // ✅ Hide menu LAST so game is ready before it appears
  }, [setupHordeRoom]);

  // ============================================================
  // [🧱 BLOCK: Handle Restart — goes back to main menu]
  // ============================================================
  const handleRestart = useCallback(() => {
    // ✅ FIX: Reset everything and return to menu
    enemiesRef.current = [];
    bossRef.current    = null;
    doorRef.current    = null;
    killsRef.current   = 0;
    aliveRef.current   = 0;

    roomStateRef.current = initialRoomState();
    playerRef.current    = new Player(WORLD_W / 2, WORLD_H / 2);
    cameraRef.current    = new Camera(screenW.current, screenH.current);

    setHud({ hp: MAX_HP, stamina: MAX_STAMINA, kills: 0, room: 1, floor: 1 });
    setIsGameOver(false);
    setIsVictory(false);
    setShowShop(false);
    setShowMenu(true); // ✅ Back to menu
  }, []);

  // ============================================================
  // [🧱 BLOCK: Shop Continue → Boss Room]
  // ============================================================
  const handleShopContinue = useCallback(() => {
    setShowShop(false);
    setupBossRoom(roomStateRef.current);
  }, [setupBossRoom]);

  // ============================================================
  // [🧱 BLOCK: Victory Continue → Next Floor]
  // ============================================================
  const handleVictoryContinue = useCallback(() => {
    const rs = nextFloor(roomStateRef.current);
    roomStateRef.current = rs;

    playerRef.current = new Player(WORLD_W / 2, WORLD_H / 2);
    cameraRef.current = new Camera(screenW.current, screenH.current);

    setupHordeRoom(rs);
    setIsVictory(false);
    setShowShop(false);
  }, [setupHordeRoom]);

  // ============================================================
  // [🧱 BLOCK: Door Transition]
  // ============================================================
  const handleDoorEnter = useCallback(() => {
    const rs = advanceRoom(roomStateRef.current);
    roomStateRef.current = rs;

    if (rs.phase === 'shop') {
      setShowShop(true);
    } else {
      setupHordeRoom(rs);
    }
  }, [setupHordeRoom]);

  // ============================================================
  // [🧱 BLOCK: Game Loop — ~60fps]
  // ============================================================
  useGameLoop((_deltaTime: number) => {
    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    const player = playerRef.current;
    if (!canvas || !camera || !player || !inputRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ✅ FIX: Pause during ALL overlays including menu
    if (showMenu || showShop || isVictory || isGameOver) return;

    const W      = screenW.current;
    const H      = screenH.current;
    const rs     = roomStateRef.current;
    const isBoss = rs.phase === 'boss';
    const worldW = isBoss ? BOSS_WORLD_W : WORLD_W;
    const worldH = isBoss ? BOSS_WORLD_H : WORLD_H;

    // ── Death check ──────────────────────────────────────────
    if (player.hp <= 0) { setIsGameOver(true); return; }

    // --- 1. Clear ---
    ctx.clearRect(0, 0, W, H);

    // --- 2. Camera ---
    camera.update(player, worldW, worldH);

    // --- 3. Draw World ---
    drawWorldGrid(ctx, camera, W, H);
    drawWorldBounds(ctx, camera, worldW, worldH, isBoss);

    // --- 4. Door ---
    if (doorRef.current) {
      doorRef.current.update();
      doorRef.current.draw(ctx, camera);

      if (killsRef.current >= KILL_THRESHOLD && !doorRef.current.isActive) {
        doorRef.current.activate();
      }
      if (doorRef.current.isCollidingWithPlayer(player)) {
        handleDoorEnter();
        return;
      }
    }

    // --- 5. Player ---
    player.update(inputRef.current);
    player.x = Math.max(0, Math.min(worldW - player.width,  player.x));
    player.y = Math.max(0, Math.min(worldH - player.height, player.y));

    // ============================================================
    // [🧱 BLOCK: Horde Logic]
    // ============================================================
    if (!isBoss) {
      enemiesRef.current.forEach((enemy) => {
        enemy.update(player, worldW, worldH);
        if (enemy.isCollidingWithPlayer(player)) {
          player.hp = Math.max(0, player.hp - enemy.damage);
          enemy.x  -= enemy.vx * 3;
          enemy.y  -= enemy.vy * 3;
          enemy.damageCooldown = 800;
        }
      });

      if (player.isAttacking) {
        const range  = player.attackType === "light" ? 35 : 55;
        const radius = player.attackType === "light" ? 15 : 25;
        const damage = player.attackType === "light" ? 10 : 25;
        const cx = (player.x + player.width  / 2) + player.facing.x * range;
        const cy = (player.y + player.height / 2) + player.facing.y * range;

        enemiesRef.current.forEach((enemy) => {
          if (enemy.isDead) return;
          const nx = Math.max(enemy.x, Math.min(cx, enemy.x + enemy.width));
          const ny = Math.max(enemy.y, Math.min(cy, enemy.y + enemy.height));
          if ((cx - nx) ** 2 + (cy - ny) ** 2 < radius * radius) {
            enemy.takeDamage(damage);
          }
        });
      }

      const before   = enemiesRef.current.length;
      enemiesRef.current = enemiesRef.current.filter((e) => !e.isDead);
      const justKilled = before - enemiesRef.current.length;
      if (justKilled > 0) {
        killsRef.current += justKilled;
        aliveRef.current -= justKilled;
      }

      const killsLeft = KILL_THRESHOLD - killsRef.current;
      if (
        killsLeft > 0 &&
        aliveRef.current === 0 &&
        Date.now() - lastSpawnRef.current > 1000
      ) {
        const spawnCount = Math.min(WAVE_SIZE, killsLeft);
        const newWave    = spawnWave(spawnCount, worldW, worldH, 'grunt', rs.floor);
        enemiesRef.current.push(...newWave);
        aliveRef.current     = spawnCount;
        lastSpawnRef.current = Date.now();
      }

      enemiesRef.current.forEach((e) => e.draw(ctx, camera));
    }

    // ============================================================
    // [🧱 BLOCK: Boss Logic]
    // ============================================================
    if (isBoss && bossRef.current) {
      const boss = bossRef.current;
      boss.update(player, worldW, worldH);

      if (boss.isCollidingWithPlayer(player)) {
        player.hp = Math.max(0, player.hp - boss.damage);
        boss.damageCooldown = 800;
      }
      if (boss.isSlamHittingPlayer(player)) {
        player.hp = Math.max(0, player.hp - 30);
      }

      if (player.isAttacking) {
        const range  = player.attackType === "light" ? 35 : 55;
        const radius = player.attackType === "light" ? 15 : 25;
        const damage = player.attackType === "light" ? 10 : 25;
        const cx = (player.x + player.width  / 2) + player.facing.x * range;
        const cy = (player.y + player.height / 2) + player.facing.y * range;
        const nx = Math.max(boss.x, Math.min(cx, boss.x + boss.width));
        const ny = Math.max(boss.y, Math.min(cy, boss.y + boss.height));
        if ((cx - nx) ** 2 + (cy - ny) ** 2 < radius * radius) {
          boss.takeDamage(damage);
        }
      }

      if (boss.isDead) {
        roomStateRef.current = { ...roomStateRef.current, phase: 'victory' };
        setIsVictory(true);
        return;
      }

      boss.draw(ctx, camera);
    }

    // --- Draw Player on top ---
    player.draw(ctx, camera);
  });

  // ============================================================
  // [🧱 BLOCK: JSX]
  // z-index order (low → high): canvas, HUD(20), shop(40),
  // victory(45), gameOver(48), menu(50 — always on top)
  // ============================================================
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#0f172a" }}>

      {/* ── Fullscreen Canvas ── */}
      <canvas ref={canvasRef} style={{ display: "block" }} />

      {/* ── HUD — hidden while menu is showing ── */}
      {!showMenu && (
        <HUD
          hp={hud.hp}           maxHp={MAX_HP}
          stamina={hud.stamina} maxStamina={MAX_STAMINA}
          kills={hud.kills}     killThreshold={KILL_THRESHOLD}
          room={hud.room}       floor={hud.floor}
        />
      )}

      {/* ── Shop Overlay ── */}
      {showShop && (
        <Shop
          floor={roomStateRef.current.floor}
          room={roomStateRef.current.roomDisplay}
          onContinue={handleShopContinue}
        />
      )}

      {/* ── Victory Screen ── */}
      {isVictory && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 45,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.85)",
        }}>
          <p style={{
            fontFamily: "'Courier New', monospace",
            fontSize: 64, fontWeight: 900,
            color: "#4ade80", letterSpacing: "0.1em",
            textShadow: "0 0 60px #4ade80", marginBottom: 12,
          }}>
            VICTORY
          </p>
          <p style={{
            fontFamily: "'Courier New', monospace",
            fontSize: 14, color: "#475569", marginBottom: 8,
          }}>
            Floor {hud.floor} cleared.
          </p>
          <p style={{
            fontFamily: "'Courier New', monospace",
            fontSize: 12, color: "#334155", marginBottom: 40,
          }}>
            Floor {hud.floor + 1} — enemies are stronger.
          </p>
          <button
            onClick={handleVictoryContinue}
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 15, fontWeight: 700, letterSpacing: "0.2em",
              color: "#0f172a", backgroundColor: "#4ade80",
              border: "none", padding: "14px 44px",
              borderRadius: 4, cursor: "pointer", textTransform: "uppercase",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#86efac")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#4ade80")}
          >
            ▶ Enter Floor {hud.floor + 1}
          </button>
        </div>
      )}

      {/* ── Game Over — ✅ only shows if menu is NOT showing ── */}
      {isGameOver && !showMenu && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 48,
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
              borderRadius: 4, cursor: "pointer", textTransform: "uppercase",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f87171")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ef4444")}
          >
            ▶ Raid Again
          </button>
        </div>
      )}

      {/* ── Main Menu — ✅ zIndex 50, always on top ── */}
      {showMenu && (
        <Menu onStart={handleStart} />
      )}

    </div>
  );
}

// ============================================================
// [🧱 BLOCK: World Grid Painter]
// ============================================================
function drawWorldGrid(ctx: CanvasRenderingContext2D, camera: Camera, W: number, H: number) {
  const gridSize = 80;
  ctx.fillStyle  = "rgba(148, 163, 184, 0.1)";
  const startX   = -(camera.x % gridSize);
  const startY   = -(camera.y % gridSize);
  for (let x = startX; x < W; x += gridSize) {
    for (let y = startY; y < H; y += gridSize) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ============================================================
// [🧱 BLOCK: World Boundary Painter]
// ============================================================
function drawWorldBounds(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  worldW: number,
  worldH: number,
  isBoss: boolean
) {
  ctx.strokeStyle = isBoss ? "#f97316" : "#ef4444";
  ctx.lineWidth   = 6;
  ctx.strokeRect(camera.toScreenX(0), camera.toScreenY(0), worldW, worldH);
}