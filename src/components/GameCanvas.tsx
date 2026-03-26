"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { InputHandler }  from "@/engine/Input";
import { GameState }      from "@/engine/GameState";
import { HordeSystem }    from "@/engine/systems/HordeSystem";
import { BossSystem }     from "@/engine/systems/BossSystem";
import { RenderSystem }   from "@/engine/systems/RenderSystem";
import { WORLD_W, WORLD_H, BOSS_WORLD_W, BOSS_WORLD_H } from "@/engine/Camera";
import {
  RoomState, initialRoomState, advanceRoom,
  nextFloor, enterBossPhase,
} from "@/engine/RoomManager";
import { useGameLoop }        from "@/hooks/useGameLoop";
import HUD                    from "@/components/HUD";
import Menu                   from "@/components/Menu";
import Shop                   from "@/components/Shop";
import Minimap                from "@/components/Minimap";
import GameOverOverlay        from "@/components/overlays/GameOverOverlay";
import VictoryOverlay         from "@/components/overlays/VictoryOverlay";
import PauseOverlay           from "@/components/overlays/PauseOverlay";
import WaveClearAnnouncement from "@/components/overlays/WaveClearAnnouncement";

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

  // ── Systems ────────────────────────────────────────────────
  const stateRef  = useRef<GameState | null>(null);
  const inputRef  = useRef<InputHandler | null>(null);
  const hordeRef  = useRef(new HordeSystem());
  const bossRef   = useRef(new BossSystem());
  const renderRef = useRef(new RenderSystem());
  const roomRef   = useRef<RoomState>(initialRoomState());

  // ── React State ────────────────────────────────────────────
  const [showMenu,    setShowMenu]    = useState(true);
  const [isGameOver,  setIsGameOver]  = useState(false);
  const [isVictory,   setIsVictory]   = useState(false);
  const [showShop,    setShowShop]    = useState(false);
  const [isPaused,    setIsPaused]    = useState(false); 

  const [announcement, setAnnouncement] = useState<{
    show:     boolean;
    message:  string;
    subtext?: string;
    color?:   string;
  }>({ show: false, message: "" });

  const announce = useCallback((message: string, subtext?: string, color?: string) => {
    setAnnouncement({ show: true, message, subtext, color });
    setTimeout(() => setAnnouncement({ show: false, message: "" }), 2500);
  }, []);

  const [gold,        setGold]        = useState(0);
  const [hud, setHud] = useState<HUDState>({
    hp: MAX_HP, stamina: MAX_STAMINA,
    kills: 0, room: 1, floor: 1,
  });

  // ============================================================
  // [🧱 BLOCK: Init]
  // ============================================================
  useEffect(() => {
    const canvas  = canvasRef.current!;
    const w       = window.innerWidth;
    const h       = window.innerHeight;
    canvas.width  = w;
    canvas.height = h;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        setIsPaused((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    const ctx = canvas.getContext("2d");
    if (ctx) ctx.save();

    stateRef.current = new GameState(w, h);
    inputRef.current = new InputHandler();

    const onResize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      stateRef.current?.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

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
      setGold(s.gold);
    }, 100);

    return () => {
      clearInterval(hudSync);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  // ============================================================
  // [🧱 BLOCK: Handlers]
  // ============================================================
  const handleStart = useCallback(() => {
    const rs = initialRoomState();
    roomRef.current = rs;
    stateRef.current!.reset();
    hordeRef.current.setup(stateRef.current!, rs, WORLD_W, WORLD_H);
    setHud({ hp: MAX_HP, stamina: MAX_STAMINA, kills: 0, room: 1, floor: 1 });
    setGold(0);
    setIsGameOver(false);
    setIsVictory(false);
    setShowShop(false);
    setIsPaused(false);
    setShowMenu(false);
  }, []);

  const handleRestart = useCallback(() => {
    stateRef.current!.reset();
    hordeRef.current.reset(stateRef.current!);
    bossRef.current.reset(stateRef.current!);
    roomRef.current = initialRoomState();
    setHud({ hp: MAX_HP, stamina: MAX_STAMINA, kills: 0, room: 1, floor: 1 });
    setGold(0);
    setIsGameOver(false);
    setIsVictory(false);
    setShowShop(false);
    setIsPaused(false);
    setShowMenu(true);
  }, []);

  const handleDoorEnter = useCallback(() => {
    const rs = advanceRoom(roomRef.current);
    roomRef.current = rs;
    if (rs.phase === 'shop') {
      stateRef.current!.playerStats.generateShopOptions();
      announce("WAVE COMPLETE", "Entering the shop...", "#facc15");
      setTimeout(() => setShowShop(true), 1200);
    } else {
      hordeRef.current.setup(stateRef.current!, rs, WORLD_W, WORLD_H);
      announce("NEXT ROOM", `Room ${rs.roomDisplay}`, "#38bdf8");
    }
  }, [announce]);

  const handleShopContinue = useCallback(() => {
    roomRef.current = enterBossPhase(roomRef.current);
    setShowShop(false);
    bossRef.current.setup(stateRef.current!, roomRef.current);
  }, []);

  const handleVictoryContinue = useCallback(() => {
    const rs = nextFloor(roomRef.current);
    roomRef.current = rs;
    stateRef.current!.resetRoom();
    hordeRef.current.setup(stateRef.current!, rs, WORLD_W, WORLD_H);
    setIsVictory(false);
  }, []);

  const handleGoldChange = useCallback((newGold: number) => {
    if (stateRef.current) stateRef.current.gold = newGold;
    setGold(newGold);
  }, []);

  // ============================================================
  // [🧱 BLOCK: Game Loop]
  // ============================================================
  useGameLoop((_dt: number) => {
    const canvas = canvasRef.current;
    const state  = stateRef.current;
    const input  = inputRef.current;
    if (!canvas || !state || !input) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (showMenu || showShop || isVictory || isGameOver || isPaused) return;

    const rs     = roomRef.current;
    const isBoss = rs.phase === 'boss';
    const worldW = isBoss ? BOSS_WORLD_W : WORLD_W;
    const worldH = isBoss ? BOSS_WORLD_H : WORLD_H;
    const player = state.player;

    if (player.hp <= 0) { setIsGameOver(true); return; }

    renderRef.current.clear(ctx, state.screenW, state.screenH);
    state.camera.update(player, worldW, worldH);
    renderRef.current.drawWorld(ctx, state.camera, state.screenW, state.screenH, isBoss);

    player.update(input);
    player.x = Math.max(0, Math.min(worldW - player.width,  player.x));
    player.y = Math.max(0, Math.min(worldH - player.height, player.y));

    if (!isBoss) {
      const prevHp = player.hp;
      const { event, goldCollected } = hordeRef.current.update(state, player, rs, worldW, worldH);
      if (player.hp < prevHp) renderRef.current.shake('light');
      if (goldCollected > 0) state.gold += goldCollected;
      
      if (event === 'door') { handleDoorEnter(); return; }

      // Announce when door first opens
      if (
        state.door?.isActive &&
        state.kills >= hordeRef.current.killThreshold &&
        !announcement.show
      ) {
        announce("ROOM CLEAR", "Gate is open — head north");
      }
      hordeRef.current.draw(state, ctx, state.camera);
    }

    if (isBoss) {
      const prevHpBoss = player.hp;
      const { event, goldCollected } = bossRef.current.update(state, player, worldW, worldH);
      if (player.hp < prevHpBoss) {
        const dmgTaken = prevHpBoss - player.hp;
        renderRef.current.shake(dmgTaken >= 25 ? 'heavy' : 'medium');
      }
      if (goldCollected > 0) state.gold += goldCollected;
      
      if (event === 'victory') {
        announce("BOSS SLAIN", "Victory — floor cleared!", "#4ade80");
        roomRef.current = { ...rs, phase: 'victory' };
        setTimeout(() => setIsVictory(true), 2000);
        return;
      }
      bossRef.current.draw(state, ctx, state.camera);
    }

    player.draw(ctx, state.camera);
  });

  // ============================================================
  // [🧱 BLOCK: JSX]
  // ============================================================
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#0f172a" }}>
      <canvas ref={canvasRef} style={{ display: "block" }} />

      {!showMenu && (
        <HUD
          hp={hud.hp}           maxHp={MAX_HP}
          stamina={hud.stamina} maxStamina={MAX_STAMINA}
          kills={hud.kills}     killThreshold={hordeRef.current.killThreshold}
          room={hud.room}       floor={hud.floor}
          gold={gold}
        />
      )}

      {!showMenu && !isGameOver && (
        <Minimap
          state={stateRef.current}
          isBoss={roomRef.current.phase === 'boss'}
        />
      )}

      {showShop && stateRef.current && (
        <Shop
          floor={roomRef.current.floor}
          room={roomRef.current.roomDisplay}
          gold={gold}
          playerStats={stateRef.current.playerStats}
          player={stateRef.current.player}
          onGoldChange={handleGoldChange}
          onContinue={handleShopContinue}
        />
      )}

      {isVictory  && <VictoryOverlay floor={hud.floor} onContinue={handleVictoryContinue} />}
      {isGameOver && !showMenu && <GameOverOverlay floor={hud.floor} room={hud.room} onRetry={handleRestart} />}
      
      {isPaused && !showMenu && !isGameOver && (
        <PauseOverlay
          floor={hud.floor}
          room={hud.room}
          onResume={() => setIsPaused(false)}
          onQuit={() => {
            setIsPaused(false);
            handleRestart();
          }}
        />
      )}

      {showMenu && <Menu onStart={handleStart} />}

      <WaveClearAnnouncement
        show={announcement.show}
        message={announcement.message}
        subtext={announcement.subtext}
        color={announcement.color}
      />
    </div>
  );
}