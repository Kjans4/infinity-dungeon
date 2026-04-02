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
import Minimap               from "@/components/Minimap";
import Inventory             from "@/components/Inventory";
import GameOverOverlay        from "@/components/overlays/GameOverOverlay";
import VictoryOverlay        from "@/components/overlays/VictoryOverlay";
import PauseOverlay          from "@/components/overlays/PauseOverlay";
import WaveClearAnnouncement from "@/components/overlays/WaveClearAnnouncement";

// ── Dev panel styles (panel itself only renders in development) ──
import "@/styles/dev-panel.css";

// ============================================================
// [🧱 BLOCK: Constants]
// ============================================================
const MAX_HP            = 100;
const MAX_STAMINA       = 100;
const INVENTORY_HOLD_MS = 500;
const IS_DEV            = process.env.NODE_ENV === "development";

const REMAINING_MILESTONES = [
  { at: 5, color: "#f59e0b" },
  { at: 3, color: "#f97316" },
  { at: 1, color: "#ef4444" },
];

interface HUDState {
  hp: number; stamina: number;
  kills: number; room: number; floor: number;
}

// ============================================================
// [🧱 BLOCK: Dev Panel]
// Only rendered in development. Closed over GameCanvas refs
// and handlers so no prop drilling is needed.
// To remove for production: delete this component + the
// <DevPanel /> JSX below. The IS_DEV guard also prevents
// it rendering in prod builds automatically.
// ============================================================
interface DevPanelProps {
  isOpen:          boolean;
  onToggle:        () => void;
  gameActive:      boolean;
  isBossPhase:     boolean;
  isShopPhase:     boolean;
  onKillAll:       () => void;
  onSkipRoom:      () => void;
  onSkipToShop:    () => void;
  onSkipToBoss:    () => void;
  onAddGold:       () => void;
}

function DevPanel({
  isOpen, onToggle, gameActive, isBossPhase, isShopPhase,
  onKillAll, onSkipRoom, onSkipToShop, onSkipToBoss, onAddGold,
}: DevPanelProps) {
  return (
    <>
      <button
        className={`dev-toggle ${isOpen ? "dev-toggle--active" : ""}`}
        onClick={onToggle}
      >
        F1 DEV
      </button>

      {isOpen && (
        <div className="dev-panel">
          <div className="dev-panel__header">⚙ Dev Tools</div>

          <button
            className="dev-btn dev-btn--red"
            onClick={onKillAll}
            disabled={!gameActive || isBossPhase}
            title="Instantly kills all enemies and opens the door"
          >
            ☠ Kill All Enemies
          </button>

          <div className="dev-panel__divider" />

          <button
            className="dev-btn dev-btn--blue"
            onClick={onSkipRoom}
            disabled={!gameActive || isBossPhase || isShopPhase}
            title="Skip directly to the next room (bypasses door walk)"
          >
            ⏭ Skip Room
          </button>

          <button
            className="dev-btn dev-btn--blue"
            onClick={onSkipToShop}
            disabled={!gameActive || isBossPhase || isShopPhase}
            title="Jump straight to the shop"
          >
            🛒 Skip to Shop
          </button>

          <button
            className="dev-btn dev-btn--blue"
            onClick={onSkipToBoss}
            disabled={!gameActive || isBossPhase}
            title="Skip shop and go directly to boss"
          >
            💀 Skip to Boss
          </button>

          <div className="dev-panel__divider" />

          <button
            className="dev-btn dev-btn--green"
            onClick={onAddGold}
            disabled={!gameActive}
            title="Add 200 gold"
          >
            💰 +200 Gold
          </button>
        </div>
      )}
    </>
  );
}

// ============================================================
// [🧱 BLOCK: GameCanvas]
// ============================================================
export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Systems ───────────────────────────────────────────────
  const stateRef  = useRef<GameState | null>(null);
  const inputRef  = useRef<InputHandler | null>(null);
  const hordeRef  = useRef(new HordeSystem());
  const bossRef   = useRef(new BossSystem());
  const renderRef = useRef(new RenderSystem());
  const roomRef   = useRef<RoomState>(initialRoomState());

  // ── Tracking Refs ─────────────────────────────────────────
  const iHoldTimer                = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uiActiveRef               = useRef({ menu: true, shop: false, gameOver: false, inventory: false });
  const lastAnnouncedRemainingRef = useRef<number | null>(null);

  // ── React State ───────────────────────────────────────────
  const [showMenu,      setShowMenu]      = useState(true);
  const [isGameOver,    setIsGameOver]    = useState(false);
  const [isVictory,     setIsVictory]     = useState(false);
  const [showShop,      setShowShop]      = useState(false);
  const [isPaused,      setIsPaused]      = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [gold,          setGold]          = useState(0);
  const [hud, setHud] = useState<HUDState>({
    hp: MAX_HP, stamina: MAX_STAMINA, kills: 0, room: 1, floor: 1,
  });
  const [announcement, setAnnouncement] = useState<{
    show: boolean; message: string; subtext?: string; color?: string;
  }>({ show: false, message: "" });
  const announcementRef = useRef(false);

  // ── Dev State ─────────────────────────────────────────────
  const [devPanelOpen, setDevPanelOpen] = useState(false);

  useEffect(() => {
    uiActiveRef.current = {
      menu:      showMenu,
      shop:      showShop,
      gameOver:  isGameOver,
      inventory: showInventory,
    };
    announcementRef.current = announcement.show;
  }, [showMenu, showShop, isGameOver, showInventory, announcement.show]);

  const announce = useCallback((message: string, subtext?: string, color?: string) => {
    setAnnouncement({ show: true, message, subtext, color });
    setTimeout(() => setAnnouncement({ show: false, message: "" }), 2500);
  }, []);

  // ============================================================
  // [🧱 BLOCK: Init & Input]
  // ============================================================
  useEffect(() => {
    const canvas = canvasRef.current!;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const ctx = canvas.getContext("2d");
    if (ctx) ctx.save();

    stateRef.current = new GameState(window.innerWidth, window.innerHeight);
    inputRef.current = new InputHandler();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "F1") {
        e.preventDefault();
        if (IS_DEV) setDevPanelOpen((prev) => !prev);
        return;
      }
      if (e.code === "Escape") {
        setShowInventory(false);
        setIsPaused((prev) => !prev);
        return;
      }
      if (e.code === "KeyI" && !e.repeat) {
        const ui = uiActiveRef.current;
        if (ui.menu || ui.shop || ui.gameOver) return;
        if (iHoldTimer.current) clearTimeout(iHoldTimer.current);
        iHoldTimer.current = setTimeout(() => {
          setShowInventory((prev) => {
            const next = !prev;
            setIsPaused(next);
            return next;
          });
          iHoldTimer.current = null;
        }, INVENTORY_HOLD_MS);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "KeyI") {
        if (iHoldTimer.current) {
          clearTimeout(iHoldTimer.current);
          iHoldTimer.current = null;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup",   onKeyUp);

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
      window.removeEventListener("resize",  onResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup",   onKeyUp);
      if (iHoldTimer.current) clearTimeout(iHoldTimer.current);
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
    setIsGameOver(false); setIsVictory(false);
    setShowShop(false);   setIsPaused(false);
    setShowInventory(false);
    setShowMenu(false);
    lastAnnouncedRemainingRef.current = null;
  }, []);

  const handleRestart = useCallback(() => {
    stateRef.current!.reset();
    hordeRef.current.reset(stateRef.current!);
    bossRef.current.reset(stateRef.current!);
    roomRef.current = initialRoomState();
    setHud({ hp: MAX_HP, stamina: MAX_STAMINA, kills: 0, room: 1, floor: 1 });
    setGold(0);
    setIsGameOver(false); setIsVictory(false);
    setShowShop(false);   setIsPaused(false);
    setShowInventory(false);
    setShowMenu(true);
    lastAnnouncedRemainingRef.current = null;
  }, []);

  const handleDoorEnter = useCallback(() => {
    const rs = advanceRoom(roomRef.current);
    roomRef.current = rs;
    lastAnnouncedRemainingRef.current = null;
    if (rs.phase === "shop") {
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
    setShowShop(false);
    lastAnnouncedRemainingRef.current = null;
  }, []);

  const handleGoldChange = useCallback((newGold: number) => {
    if (stateRef.current) stateRef.current.gold = newGold;
    setGold(newGold);
  }, []);

  const handleInventoryClose = useCallback(() => {
    setShowInventory(false);
    setIsPaused(false);
  }, []);

  // ============================================================
  // [🧱 BLOCK: Dev Handlers]
  // ============================================================
  const handleDevKillAll = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    state.enemies = [];
    state.kills   = hordeRef.current.getThreshold(roomRef.current.floor);
    state.alive   = 0;
    if (state.door) state.door.activate();
    lastAnnouncedRemainingRef.current = null;
    announce("DEV: ALL ENEMIES KILLED", "Gate is open", "#f87171");
  }, [announce]);

  const handleDevSkipRoom = useCallback(() => {
    handleDoorEnter();
    announce("DEV: ROOM SKIPPED", undefined, "#38bdf8");
  }, [handleDoorEnter, announce]);

  const handleDevSkipToShop = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    const rs: RoomState = {
      floor:       roomRef.current.floor,
      roomInCycle: 3,
      roomDisplay: (roomRef.current.floor - 1) * 3 + 3,
      phase:       "shop",
    };
    roomRef.current = rs;
    state.playerStats.generateShopOptions();
    setShowShop(true);
    announce("DEV: SKIPPED TO SHOP", undefined, "#facc15");
  }, [announce]);

  const handleDevSkipToBoss = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    setShowShop(false);
    const rs: RoomState = {
      floor:       roomRef.current.floor,
      roomInCycle: 3,
      roomDisplay: (roomRef.current.floor - 1) * 3 + 3,
      phase:       "boss",
    };
    roomRef.current = rs;
    bossRef.current.setup(state, rs);
    announce("DEV: SKIPPED TO BOSS", undefined, "#f87171");
  }, [announce]);

  const handleDevAddGold = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    state.gold += 200;
    setGold(state.gold);
    announce("DEV: +200 GOLD", undefined, "#4ade80");
  }, [announce]);

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

    if (showMenu || showShop || isVictory || isGameOver || isPaused || showInventory) return;

    const rs     = roomRef.current;
    const isBoss = rs.phase === "boss";
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
      const { event, goldCollected } = hordeRef.current.update(
        state, player, rs, worldW, worldH
      );
      if (player.hp < prevHp) renderRef.current.shake("light");
      if (goldCollected > 0)  state.gold += goldCollected;
      if (event === "door") { handleDoorEnter(); return; }

      const threshold = hordeRef.current.getThreshold(rs.floor);
      const remaining = threshold - state.kills;

      // ── Kill count milestone announcements ────────────────
      if (remaining > 0 && !announcementRef.current) {
        for (const milestone of REMAINING_MILESTONES) {
          if (
            remaining === milestone.at &&
            lastAnnouncedRemainingRef.current !== milestone.at
          ) {
            lastAnnouncedRemainingRef.current = milestone.at;
            announce(
              `${milestone.at} REMAINING`,
              milestone.at === 1 ? "Last one!" : undefined,
              milestone.color
            );
            break;
          }
        }
      }

      // ── Room clear ────────────────────────────────────────
      if (
        state.door?.isActive &&
        state.kills >= threshold &&
        !announcementRef.current
      ) {
        announce("ROOM CLEAR", "Gate is open — head north");
      }

      hordeRef.current.draw(state, ctx, state.camera, player);
    }

    if (isBoss) {
      const prevHp = player.hp;
      const { event, goldCollected } = bossRef.current.update(state, player, worldW, worldH);

      if (player.hp < prevHp) {
        renderRef.current.shake((prevHp - player.hp) >= 25 ? "heavy" : "medium");
      }
      if (goldCollected > 0) state.gold += goldCollected;

      // ── Boss enrage ───────────────────────────────────────
      if (event === "enraged") {
        announce("⚡ ENRAGED", "Boss enters rage mode!", "#ef4444");
        renderRef.current.shake("heavy");
      }

      if (event === "victory") {
        announce("BOSS SLAIN", "Victory — floor cleared!", "#4ade80");
        roomRef.current = { ...rs, phase: "victory" };
        setTimeout(() => setIsVictory(true), 2000);
        return;
      }

      bossRef.current.draw(state, ctx, state.camera, player);
    }

    player.draw(ctx, state.camera);
  });

  // ============================================================
  // [🧱 BLOCK: Derived State for DevPanel]
  // ============================================================
  const gameActive  = !showMenu && !isGameOver && !isVictory;
  const isBossPhase = roomRef.current.phase === "boss";
  const isShopPhase = roomRef.current.phase === "shop";
  const state       = stateRef.current;

  const currentThreshold = hordeRef.current.getThreshold(hud.floor);

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#0f172a" }}>
      <canvas ref={canvasRef} style={{ display: "block" }} />

      {!showMenu && (
        <HUD
          hp={hud.hp}           maxHp={MAX_HP}
          stamina={hud.stamina} maxStamina={MAX_STAMINA}
          kills={hud.kills}     killThreshold={currentThreshold}
          room={hud.room}       floor={hud.floor}
          gold={gold}
        />
      )}

      {!showMenu && !isGameOver && (
        <Minimap state={stateRef.current} isBoss={roomRef.current.phase === "boss"} />
      )}

      {showShop && state && (
        <Shop
          floor={roomRef.current.floor} room={roomRef.current.roomDisplay}
          gold={gold} playerStats={state.playerStats} player={state.player}
          onGoldChange={handleGoldChange} onContinue={handleShopContinue}
        />
      )}

      {showInventory && state && (
        <Inventory
          playerStats={state.playerStats} player={state.player}
          gold={gold} onGoldChange={handleGoldChange} onClose={handleInventoryClose}
        />
      )}

      {isVictory && (
        <VictoryOverlay floor={hud.floor} onContinue={handleVictoryContinue} />
      )}
      {isGameOver && !showMenu && (
        <GameOverOverlay floor={hud.floor} room={hud.room} onRetry={handleRestart} />
      )}

      {isPaused && !showMenu && !isGameOver && !showInventory && state && (
        <PauseOverlay
          floor={hud.floor}         room={hud.room}
          hp={hud.hp}               maxHp={MAX_HP}
          gold={gold}
          playerStats={state.playerStats}
          player={state.player}
          onResume={() => setIsPaused(false)}
          onQuit={() => { setIsPaused(false); handleRestart(); }}
        />
      )}

      {showMenu && <Menu onStart={handleStart} />}

      <WaveClearAnnouncement
        show={announcement.show} message={announcement.message}
        subtext={announcement.subtext} color={announcement.color}
      />

      {/* ── Dev Panel — only in development ── */}
      {IS_DEV && (
        <DevPanel
          isOpen={devPanelOpen}
          onToggle={() => setDevPanelOpen((p) => !p)}
          gameActive={gameActive}
          isBossPhase={isBossPhase}
          isShopPhase={isShopPhase}
          onKillAll={handleDevKillAll}
          onSkipRoom={handleDevSkipRoom}
          onSkipToShop={handleDevSkipToShop}
          onSkipToBoss={handleDevSkipToBoss}
          onAddGold={handleDevAddGold}
        />
      )}
    </div>
  );
}