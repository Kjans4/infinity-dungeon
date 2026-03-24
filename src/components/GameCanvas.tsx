// src/components/GameCanvas.tsx
"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { InputHandler }  from "@/engine/Input";
import { GameState }     from "@/engine/GameState";
import { HordeSystem }   from "@/engine/systems/HordeSystem";
import { BossSystem }    from "@/engine/systems/BossSystem";
import { RenderSystem }  from "@/engine/systems/RenderSystem";
import { WORLD_W, WORLD_H, BOSS_WORLD_W, BOSS_WORLD_H } from "@/engine/Camera";
import {
  RoomState, initialRoomState, advanceRoom,
  nextFloor, enterBossPhase,
} from "@/engine/RoomManager";
import { useGameLoop }       from "@/hooks/useGameLoop";
import HUD                   from "@/components/HUD";
import Menu                  from "@/components/Menu";
import Shop                  from "@/components/Shop";
import GameOverOverlay        from "@/components/overlays/GameOverOverlay";
import VictoryOverlay         from "@/components/overlays/VictoryOverlay";

// ============================================================
// [🧱 BLOCK: Constants]
// ============================================================
const MAX_HP      = 100;
const MAX_STAMINA = 100;

interface HUDState {
  hp: number; stamina: number;
  kills: number; room: number; floor: number;
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Systems (created once, live for app lifetime) ──────────
  const stateRef  = useRef<GameState | null>(null);
  const inputRef  = useRef<InputHandler | null>(null);
  const hordeRef  = useRef(new HordeSystem());
  const bossRef   = useRef(new BossSystem());
  const renderRef = useRef(new RenderSystem());
  const roomRef   = useRef<RoomState>(initialRoomState());

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
  // [🧱 BLOCK: Init — canvas + input only]
  // Game state not initialized until RAID is clicked.
  // ============================================================
  useEffect(() => {
    const canvas  = canvasRef.current!;
    const w       = window.innerWidth;
    const h       = window.innerHeight;
    canvas.width  = w;
    canvas.height = h;

    stateRef.current = new GameState(w, h);
    inputRef.current = new InputHandler();

    const onResize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      stateRef.current?.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    // Sync HUD at 10fps
    const hudSync = setInterval(() => {
      const s = stateRef.current;
      const r = roomRef.current;
      if (!s) return;
      setHud({
        hp:      Math.max(0, s.player.hp),
        stamina: Math.round(s.player.stamina),
        kills:   s.kills,
        room:    r.roomDisplay,
        floor:   r.floor,
      });
    }, 100);

    return () => {
      clearInterval(hudSync);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // ============================================================
  // [🧱 BLOCK: Handle Start — RAID button]
  // ============================================================
  const handleStart = useCallback(() => {
    const rs = initialRoomState();
    roomRef.current = rs;

    stateRef.current!.reset();
    hordeRef.current.setup(
      stateRef.current!, rs, WORLD_W, WORLD_H
    );

    setHud({ hp: MAX_HP, stamina: MAX_STAMINA, kills: 0, room: 1, floor: 1 });
    setIsGameOver(false);
    setIsVictory(false);
    setShowShop(false);
    setShowMenu(false);
  }, []);

  // ============================================================
  // [🧱 BLOCK: Handle Restart — back to menu]
  // ============================================================
  const handleRestart = useCallback(() => {
    stateRef.current!.reset();
    hordeRef.current.reset(stateRef.current!);
    bossRef.current.reset(stateRef.current!);
    roomRef.current = initialRoomState();

    setHud({ hp: MAX_HP, stamina: MAX_STAMINA, kills: 0, room: 1, floor: 1 });
    setIsGameOver(false);
    setIsVictory(false);
    setShowShop(false);
    setShowMenu(true);
  }, []);

  // ============================================================
  // [🧱 BLOCK: Handle Door Enter]
  // ============================================================
  const handleDoorEnter = useCallback(() => {
    const rs = advanceRoom(roomRef.current);
    roomRef.current = rs;

    if (rs.phase === 'shop') {
      setShowShop(true);
    } else {
      hordeRef.current.setup(stateRef.current!, rs, WORLD_W, WORLD_H);
    }
  }, []);

  // ============================================================
  // [🧱 BLOCK: Handle Shop Continue → Boss]
  // ============================================================
  const handleShopContinue = useCallback(() => {
    roomRef.current = enterBossPhase(roomRef.current);
    setShowShop(false);
    bossRef.current.setup(stateRef.current!, roomRef.current);
  }, []);

  // ============================================================
  // [🧱 BLOCK: Handle Victory → Next Floor]
  // ============================================================
  const handleVictoryContinue = useCallback(() => {
    const rs = nextFloor(roomRef.current);
    roomRef.current = rs;

    stateRef.current!.reset();
    hordeRef.current.setup(stateRef.current!, rs, WORLD_W, WORLD_H);
    setIsVictory(false);
    setShowShop(false);
  }, []);

  // ============================================================
  // [🧱 BLOCK: Game Loop — ~60fps]
  // Thin orchestration — each system does its own work.
  // ============================================================
  useGameLoop((_dt: number) => {
    const canvas = canvasRef.current;
    const state  = stateRef.current;
    const input  = inputRef.current;
    if (!canvas || !state || !input) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Pause during any overlay
    if (showMenu || showShop || isVictory || isGameOver) return;

    const rs     = roomRef.current;
    const isBoss = rs.phase === 'boss';
    const worldW = isBoss ? BOSS_WORLD_W : WORLD_W;
    const worldH = isBoss ? BOSS_WORLD_H : WORLD_H;
    const player = state.player;

    // ── Death check ──────────────────────────────────────────
    if (player.hp <= 0) { setIsGameOver(true); return; }

    // ── 1. Clear ─────────────────────────────────────────────
    renderRef.current.clear(ctx, state.screenW, state.screenH);

    // ── 2. Camera ────────────────────────────────────────────
    state.camera.update(player, worldW, worldH);

    // ── 3. World ─────────────────────────────────────────────
    renderRef.current.drawWorld(
      ctx, state.camera,
      state.screenW, state.screenH,
      isBoss
    );

    // ── 4. Player update + clamp ─────────────────────────────
    player.update(input);
    player.x = Math.max(0, Math.min(worldW - player.width,  player.x));
    player.y = Math.max(0, Math.min(worldH - player.height, player.y));

    // ── 5. Systems ───────────────────────────────────────────
    if (!isBoss) {
      const result = hordeRef.current.update(state, player, rs, worldW, worldH);
      if (result === 'door') { handleDoorEnter(); return; }
      hordeRef.current.draw(state, ctx, state.camera);
    }

    if (isBoss) {
      const result = bossRef.current.update(state, player, worldW, worldH);
      if (result === 'victory') {
        roomRef.current = { ...rs, phase: 'victory' };
        setIsVictory(true);
        return;
      }
      bossRef.current.draw(state, ctx, state.camera);
    }

    // ── 6. Player draw (always on top) ───────────────────────
    player.draw(ctx, state.camera);
  });

  // ============================================================
  // [🧱 BLOCK: JSX]
  // ============================================================
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#0f172a" }}>

      <canvas ref={canvasRef} style={{ display: "block" }} />

      {/* HUD */}
      {!showMenu && (
        <HUD
          hp={hud.hp}           maxHp={MAX_HP}
          stamina={hud.stamina} maxStamina={MAX_STAMINA}
          kills={hud.kills}     killThreshold={hordeRef.current.killThreshold}
          room={hud.room}       floor={hud.floor}
        />
      )}

      {/* Overlays — order matters for z-index */}
      {showShop    && <Shop floor={roomRef.current.floor} room={roomRef.current.roomDisplay} onContinue={handleShopContinue} />}
      {isVictory   && <VictoryOverlay  floor={hud.floor} onContinue={handleVictoryContinue} />}
      {isGameOver && !showMenu && <GameOverOverlay floor={hud.floor} room={hud.room} onRetry={handleRestart} />}
      {showMenu    && <Menu onStart={handleStart} />}

    </div>
  );
}