// src/components/GameCanvas.tsx
"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Player } from "@/engine/Player";
import { InputHandler } from "@/engine/Input";
// 🧱 Brick 2 — Add Projectile to the Enemy import at the top:
import { Enemy, spawnWave, Projectile } from "@/engine/Enemy";
import { Boss } from "@/engine/Boss";
import { Door } from "@/engine/Door";
import { Camera, WORLD_W, WORLD_H, BOSS_WORLD_W, BOSS_WORLD_H } from "@/engine/Camera";
import {
  RoomState, initialRoomState, advanceRoom, nextFloor, enterBossPhase,
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
  // 🧱 Brick 1 — Add projectilesRef after lastSpawnRef:
  const projectilesRef = useRef<Projectile[]>([]);
  const roomStateRef = useRef<RoomState>(initialRoomState());

  const screenW = useRef<number>(800);
  const screenH = useRef<number>(600);

  // ── React State (UI only) ──────────────────────────────────
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
    // 🧱 Brick 3 — Clear projectiles on room setup.
    projectilesRef.current = [];
    aliveRef.current     = INITIAL_WAVE;
    lastSpawnRef.current = 0;

    // 🧱 Brick 6 — Update spawnWave calls to pass roomInCycle:
    enemiesRef.current = spawnWave(INITIAL_WAVE, WORLD_W, WORLD_H, rs.roomInCycle, rs.floor);
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
    // 🧱 Brick 3 — Clear projectiles on room setup.
    projectilesRef.current = [];
    bossRef.current    = new Boss(BOSS_WORLD_W / 2 - 40, 80, rs.floor);
    doorRef.current    = null;

    cameraRef.current.update(playerRef.current, BOSS_WORLD_W, BOSS_WORLD_H);
  }, []);

  // ============================================================
  // [🧱 BLOCK: Init — canvas + input only, NO game setup]
  // ============================================================
  useEffect(() => {
    screenW.current = window.innerWidth;
    screenH.current = window.innerHeight;

    const canvas = canvasRef.current!;
    canvas.width  = screenW.current;
    canvas.height = screenH.current;

    cameraRef.current = new Camera(screenW.current, screenH.current);
    inputRef.current  = new InputHandler();
    playerRef.current = new Player(WORLD_W / 2, WORLD_H / 2);

    enemiesRef.current = [];
    doorRef.current    = null;
    roomStateRef.current = { ...roomStateRef.current, phase: 'boss' };
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
    setShowMenu(false); 
  }, [setupHordeRoom]);

  // ============================================================
  // [🧱 BLOCK: Handle Restart — goes back to main menu]
  // ============================================================
  const handleRestart = useCallback(() => {
    enemiesRef.current = [];
    // 🧱 Brick 3 — Clear projectiles on restart.
    projectilesRef.current = [];
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
    setShowMenu(true); 
  }, []);

  // ============================================================
  // [🧱 BLOCK: Shop Continue → Boss Room]
  // ============================================================
  const handleShopContinue = useCallback(() => {
  // ✅ Set phase to 'boss' BEFORE setupBossRoom so isBoss is true in the loop
  roomStateRef.current = enterBossPhase(roomStateRef.current);
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

    if (showMenu || showShop || isVictory || isGameOver) return;

    const W      = screenW.current;
    const H      = screenH.current;
    const rs     = roomStateRef.current;
    const isBoss = rs.phase === 'boss';
    const worldW = isBoss ? BOSS_WORLD_W : WORLD_W;
    const worldH = isBoss ? BOSS_WORLD_H : WORLD_H;

    if (player.hp <= 0) { setIsGameOver(true); return; }

    ctx.clearRect(0, 0, W, H);
    camera.update(player, worldW, worldH);
    drawWorldGrid(ctx, camera, W, H);
    drawWorldBounds(ctx, camera, worldW, worldH, isBoss);

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

    player.update(inputRef.current);
    player.x = Math.max(0, Math.min(worldW - player.width,  player.x));
    player.y = Math.max(0, Math.min(worldH - player.height, player.y));

    // ============================================================
    // [🧱 BLOCK: Horde Logic]
    // ============================================================
    if (!isBoss) {
      // 🧱 Brick 4 — Replace the entire Horde Logic block's enemy contact damage and collision section:
      enemiesRef.current.forEach((enemy) => {
        enemy.update(player, worldW, worldH);
        // Collect any fired projectile this frame
        if (enemy.pendingProjectile) {
          projectilesRef.current.push(enemy.pendingProjectile);
          enemy.pendingProjectile = null;
        }
        // Melee strike hit check
        if (enemy.isMeleeHittingPlayer(player)) {
          const dmg = enemy.type === 'shooter' ? 8 : 15;
          player.hp = Math.max(0, player.hp - dmg);
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
        // 🧱 Brick 6 — Update spawnWave call for wave respawn:
        const newWave    = spawnWave(spawnCount, worldW, worldH, rs.roomInCycle, rs.floor);
        enemiesRef.current.push(...newWave);
        aliveRef.current     = spawnCount;
        lastSpawnRef.current = Date.now();
      }

      // 🧱 Brick 5 — Add projectile update/draw/collision:
      // ============================================================
      // [🧱 BLOCK: Projectile Update + Collision]
      // ============================================================
      projectilesRef.current.forEach((proj) => {
        proj.update();
        if (proj.isHittingPlayer(player)) {
          player.hp = Math.max(0, player.hp - proj.damage);
          proj.isDone = true;
        }
      });
      projectilesRef.current = projectilesRef.current.filter((p) => !p.isDone);
      projectilesRef.current.forEach((p) => p.draw(ctx, camera));

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

    player.draw(ctx, camera);
  });

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#0f172a" }}>
      <canvas ref={canvasRef} style={{ display: "block" }} />

      {!showMenu && (
        <HUD
          hp={hud.hp}           maxHp={MAX_HP}
          stamina={hud.stamina} maxStamina={MAX_STAMINA}
          kills={hud.kills}     killThreshold={KILL_THRESHOLD}
          room={hud.room}       floor={hud.floor}
        />
      )}

      {showShop && (
        <Shop
          floor={roomStateRef.current.floor}
          room={roomStateRef.current.roomDisplay}
          onContinue={handleShopContinue}
        />
      )}

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

      {showMenu && (
        <Menu onStart={handleStart} />
      )}
    </div>
  );
}

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