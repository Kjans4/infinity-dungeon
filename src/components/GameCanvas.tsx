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
  nextFloor, enterBossPhase, isFinalFloor, MAX_FLOORS,
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
import { spawnBurst }        from "@/engine/Particle";
import { ShopItem }          from "@/engine/items/ItemPool";

import "@/styles/dev-panel.css";

// ============================================================
// [🧱 BLOCK: Constants]
// ============================================================
const MAX_HP            = 100;
const MAX_STAMINA       = 100;
const INVENTORY_HOLD_MS = 500;
const IS_DEV            = process.env.NODE_ENV === "development";

// Death sequence timing (ms)
const DEATH_FLASH_MS    = 600;
const DEATH_VIGNETTE_MS = 800;
const DEATH_HOLD_MS     = 400;
const DEATH_TOTAL_MS    = DEATH_FLASH_MS + DEATH_VIGNETTE_MS + DEATH_HOLD_MS;

const REMAINING_MILESTONES = [
  { at: 5, color: "#f59e0b" },
  { at: 3, color: "#f97316" },
  { at: 1, color: "#ef4444" },
];

// ============================================================
// [🧱 BLOCK: HUD State Interface]
// bossHp/bossMaxHp/bossIsEnraged — fed from state.boss each
// hudSync tick; all zero/false when no boss is alive.
// ============================================================
interface HUDState {
  hp:            number;
  stamina:       number;
  kills:         number;
  room:          number;
  floor:         number;
  bossHp:        number;
  bossMaxHp:     number;
  bossIsEnraged: boolean;
}

// ============================================================
// [🧱 BLOCK: Dev Panel]
// ============================================================
interface DevPanelProps {
  isOpen: boolean; onToggle: () => void;
  gameActive: boolean; isBossPhase: boolean; isShopPhase: boolean;
  onKillAll: () => void; onSkipRoom: () => void;
  onSkipToShop: () => void; onSkipToBoss: () => void; onAddGold: () => void;
}

function DevPanel({
  isOpen, onToggle, gameActive, isBossPhase, isShopPhase,
  onKillAll, onSkipRoom, onSkipToShop, onSkipToBoss, onAddGold,
}: DevPanelProps) {
  return (
    <>
      <button className={`dev-toggle ${isOpen ? "dev-toggle--active" : ""}`} onClick={onToggle}>
        F1 DEV
      </button>
      {isOpen && (
        <div className="dev-panel">
          <div className="dev-panel__header">⚙ Dev Tools</div>
          <button className="dev-btn dev-btn--red" onClick={onKillAll}
            disabled={!gameActive || isBossPhase} title="Instantly kills all enemies">
            ☠ Kill All Enemies
          </button>
          <div className="dev-panel__divider" />
          <button className="dev-btn dev-btn--blue" onClick={onSkipRoom}
            disabled={!gameActive || isBossPhase || isShopPhase} title="Skip to next room">
            ⏭ Skip Room
          </button>
          <button className="dev-btn dev-btn--blue" onClick={onSkipToShop}
            disabled={!gameActive || isBossPhase || isShopPhase} title="Jump to shop">
            🛒 Skip to Shop
          </button>
          <button className="dev-btn dev-btn--blue" onClick={onSkipToBoss}
            disabled={!gameActive || isBossPhase} title="Skip to boss">
            💀 Skip to Boss
          </button>
          <div className="dev-panel__divider" />
          <button className="dev-btn dev-btn--green" onClick={onAddGold}
            disabled={!gameActive} title="Add 200 gold">
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

  // ── Death sequence refs ───────────────────────────────────
  const isDyingRef       = useRef(false);
  const deathStartRef    = useRef(0);
  const vignetteAlphaRef = useRef(0);

  // ── Per-floor stat tracking (reset on each new floor) ─────
  // Captured into victoryStats state when victory fires so
  // VictoryOverlay can display them even after state resets.
  const floorKillsRef = useRef(0);
  const floorGoldRef  = useRef(0);

  // ── React State ───────────────────────────────────────────
  const [showMenu,      setShowMenu]      = useState(true);
  const [isGameOver,    setIsGameOver]    = useState(false);
  const [isVictory,     setIsVictory]     = useState(false);
  const [showShop,      setShowShop]      = useState(false);
  const [isMidRoom,     setIsMidRoom]     = useState(false);
  const [isPaused,      setIsPaused]      = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [gold,          setGold]          = useState(0);
  const [hud, setHud] = useState<HUDState>({
    hp: MAX_HP, stamina: MAX_STAMINA,
    kills: 0, room: 1, floor: 1,
    bossHp: 0, bossMaxHp: 0, bossIsEnraged: false,
  });
  const [victoryStats, setVictoryStats] = useState({ kills: 0, gold: 0 });
  const [announcement, setAnnouncement] = useState<{
    show: boolean; message: string; subtext?: string; color?: string;
  }>({ show: false, message: "" });
  const announcementRef = useRef(false);
  const [devPanelOpen, setDevPanelOpen] = useState(false);

  useEffect(() => {
    uiActiveRef.current = {
      menu: showMenu, shop: showShop,
      gameOver: isGameOver, inventory: showInventory,
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
      if (e.code === "F1") { e.preventDefault(); if (IS_DEV) setDevPanelOpen((p) => !p); return; }
      if (e.code === "Escape") { setShowInventory(false); setIsPaused((p) => !p); return; }
      if (e.code === "KeyI" && !e.repeat) {
        const ui = uiActiveRef.current;
        if (ui.menu || ui.shop || ui.gameOver) return;
        if (iHoldTimer.current) clearTimeout(iHoldTimer.current);
        iHoldTimer.current = setTimeout(() => {
          setShowInventory((prev) => { const next = !prev; setIsPaused(next); return next; });
          iHoldTimer.current = null;
        }, INVENTORY_HOLD_MS);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "KeyI" && iHoldTimer.current) {
        clearTimeout(iHoldTimer.current);
        iHoldTimer.current = null;
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

    // ── HUD sync — polls at 10fps ─────────────────────────
    // Boss HP fields are zeroed when no boss is present so the
    // BossHPBar component unmounts cleanly between fights.
    const hudSync = setInterval(() => {
      const s = stateRef.current;
      const r = roomRef.current;
      if (!s) return;
      const boss = s.boss;
      setHud({
        hp:            Math.max(0, s.player.hp),
        stamina:       Math.round(s.player.stamina),
        kills:         s.kills,
        room:          r.roomDisplay,
        floor:         r.floor,
        bossHp:        boss && !boss.isDead ? boss.hp    : 0,
        bossMaxHp:     boss                 ? boss.maxHp : 0,
        bossIsEnraged: boss                 ? boss.isEnraged : false,
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
  const resetFloorTracking = useCallback(() => {
    floorKillsRef.current = 0;
    floorGoldRef.current  = 0;
  }, []);

  const blankHud: HUDState = {
    hp: MAX_HP, stamina: MAX_STAMINA, kills: 0, room: 1, floor: 1,
    bossHp: 0, bossMaxHp: 0, bossIsEnraged: false,
  };

  const handleStart = useCallback(() => {
    const rs = initialRoomState();
    roomRef.current = rs;
    stateRef.current!.reset();
    hordeRef.current.setup(stateRef.current!, rs, WORLD_W, WORLD_H);
    setHud(blankHud);
    setGold(0);
    setIsGameOver(false); setIsVictory(false);
    setShowShop(false);   setIsPaused(false);
    setIsMidRoom(false);
    setShowInventory(false);
    setShowMenu(false);
    lastAnnouncedRemainingRef.current = null;
    isDyingRef.current = false;
    vignetteAlphaRef.current = 0;
    resetFloorTracking();
  }, [resetFloorTracking]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Raid Again — reset and start immediately, no menu ─────
  const handleRaidAgain = useCallback(() => {
    const rs = initialRoomState();
    roomRef.current = rs;
    stateRef.current!.reset();
    hordeRef.current.reset(stateRef.current!);
    bossRef.current.reset(stateRef.current!);
    hordeRef.current.setup(stateRef.current!, rs, WORLD_W, WORLD_H);
    setHud(blankHud);
    setGold(0);
    setIsGameOver(false); setIsVictory(false);
    setShowShop(false);   setIsPaused(false);
    setIsMidRoom(false);
    setShowInventory(false);
    setShowMenu(false);
    lastAnnouncedRemainingRef.current = null;
    isDyingRef.current = false;
    vignetteAlphaRef.current = 0;
    resetFloorTracking();
  }, [resetFloorTracking]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Quit to Menu ──────────────────────────────────────────
  const handleQuitToMenu = useCallback(() => {
    stateRef.current!.reset();
    hordeRef.current.reset(stateRef.current!);
    bossRef.current.reset(stateRef.current!);
    roomRef.current = initialRoomState();
    setHud(blankHud);
    setGold(0);
    setIsGameOver(false); setIsVictory(false);
    setShowShop(false);   setIsPaused(false);
    setIsMidRoom(false);
    setShowInventory(false);
    setShowMenu(true);
    lastAnnouncedRemainingRef.current = null;
    isDyingRef.current = false;
    vignetteAlphaRef.current = 0;
    resetFloorTracking();
  }, [resetFloorTracking]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setIsMidRoom(false);
    bossRef.current.setup(stateRef.current!, roomRef.current);
  }, []);

  // ── NPC shop — open mid-room, no phase advance ────────────
  const handleNpcOpen = useCallback(() => {
    stateRef.current!.playerStats.generateShopOptions();
    setIsMidRoom(true);
    setShowShop(true);
  }, []);

  // ── NPC shop close — return to gameplay, room phase unchanged ─
  const handleNpcClose = useCallback(() => {
    setShowShop(false);
    setIsMidRoom(false);
  }, []);

  // ── Claim a pending loot item — remove from state.pendingLoot ─
  const handleClaimLoot = useCallback((item: ShopItem) => {
    const state = stateRef.current;
    if (!state) return;
    const idx = state.pendingLoot.findIndex((i) => i.id === item.id);
    if (idx !== -1) state.pendingLoot.splice(idx, 1);
  }, []);

  // ── Victory Continue — only used when NOT on final floor ──
  const handleVictoryContinue = useCallback(() => {
    const rs = nextFloor(roomRef.current);
    roomRef.current = rs;
    stateRef.current!.resetRoom();
    hordeRef.current.setup(stateRef.current!, rs, WORLD_W, WORLD_H);
    setIsVictory(false);
    setShowShop(false);
    setIsMidRoom(false);
    lastAnnouncedRemainingRef.current = null;
    resetFloorTracking();
  }, [resetFloorTracking]);

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
      floor: roomRef.current.floor, roomInCycle: 3,
      roomDisplay: (roomRef.current.floor - 1) * 3 + 3, phase: "shop",
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
      floor: roomRef.current.floor, roomInCycle: 3,
      roomDisplay: (roomRef.current.floor - 1) * 3 + 3, phase: "boss",
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

    // ============================================================
    // [🧱 BLOCK: Death Sequence]
    // ============================================================
    if (isDyingRef.current) {
      const elapsed = Date.now() - deathStartRef.current;

      renderRef.current.clear(ctx, state.screenW, state.screenH);
      state.camera.update(player, worldW, worldH);
      renderRef.current.drawWorld(ctx, state.camera, state.screenW, state.screenH, isBoss);
      if (isBoss) bossRef.current.draw(state, ctx, state.camera, player);
      else        hordeRef.current.draw(state, ctx, state.camera, player, worldW);

      if (elapsed < DEATH_FLASH_MS) {
        const flashOn = Math.floor(elapsed / 80) % 2 === 0;
        if (flashOn) {
          const sx = state.camera.toScreenX(player.x);
          const sy = state.camera.toScreenY(player.y);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(sx, sy, player.width, player.height);
        }
      }

      if (elapsed >= DEATH_FLASH_MS) {
        const vigProgress = Math.min((elapsed - DEATH_FLASH_MS) / DEATH_VIGNETTE_MS, 1);
        vignetteAlphaRef.current = vigProgress;
        const alpha = vigProgress * 0.85;
        const grad  = ctx.createRadialGradient(
          state.screenW / 2, state.screenH / 2, state.screenH * 0.2,
          state.screenW / 2, state.screenH / 2, state.screenH * 0.9
        );
        grad.addColorStop(0, `rgba(80, 0, 0, 0)`);
        grad.addColorStop(1, `rgba(80, 0, 0, ${alpha})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, state.screenW, state.screenH);
        ctx.fillStyle = `rgba(0, 0, 0, ${vigProgress * 0.6})`;
        ctx.fillRect(0, 0, state.screenW, state.screenH);
      }

      if (elapsed >= DEATH_TOTAL_MS) {
        isDyingRef.current = false;
        setIsGameOver(true);
      }

      return;
    }

    // ── Normal player death check ─────────────────────────
    if (player.hp <= 0 && !isDyingRef.current) {
      isDyingRef.current    = true;
      deathStartRef.current = Date.now();
      renderRef.current.shake("heavy");
      const px = player.x + player.width  / 2;
      const py = player.y + player.height / 2;
      state.particles.push(...spawnBurst(px, py, "#ef4444", 20, 2.5));
      state.particles.push(...spawnBurst(px, py, "#ffffff", 10, 1.5));
      return;
    }

    renderRef.current.clear(ctx, state.screenW, state.screenH);
    state.camera.update(player, worldW, worldH);
    renderRef.current.drawWorld(ctx, state.camera, state.screenW, state.screenH, isBoss);

    player.update(input);
    player.x = Math.max(0, Math.min(worldW - player.width,  player.x));
    player.y = Math.max(0, Math.min(worldH - player.height, player.y));

    if (!isBoss) {
      const prevKills = state.totalKills;
      const prevHp    = player.hp;
      const { event, goldCollected } = hordeRef.current.update(state, player, rs, worldW, worldH);

      if (player.hp < prevHp) renderRef.current.shake("light");
      if (goldCollected > 0) {
        state.gold           += goldCollected;
        floorGoldRef.current += goldCollected;
      }
      const newKills = state.totalKills - prevKills;
      if (newKills > 0) floorKillsRef.current += newKills;

      if (event === "door") { handleDoorEnter(); return; }
      if (event === "npc")  { handleNpcOpen();   return; }

      const threshold = hordeRef.current.getThreshold(rs.floor);
      const remaining = threshold - state.kills;

      if (remaining > 0 && !announcementRef.current) {
        for (const milestone of REMAINING_MILESTONES) {
          if (remaining === milestone.at && lastAnnouncedRemainingRef.current !== milestone.at) {
            lastAnnouncedRemainingRef.current = milestone.at;
            announce(`${milestone.at} REMAINING`, milestone.at === 1 ? "Last one!" : undefined, milestone.color);
            break;
          }
        }
      }

      if (state.door?.isActive && state.kills >= threshold && !announcementRef.current) {
        announce("ROOM CLEAR", "Gate is open — head north");
      }

      hordeRef.current.draw(state, ctx, state.camera, player, worldW);
    }

    if (isBoss) {
      const prevKills = state.totalKills;
      const prevHp    = player.hp;
      const { event, goldCollected } = bossRef.current.update(state, player, worldW, worldH);

      if (player.hp < prevHp) renderRef.current.shake((prevHp - player.hp) >= 25 ? "heavy" : "medium");
      if (goldCollected > 0) {
        state.gold           += goldCollected;
        floorGoldRef.current += goldCollected;
      }
      const newKills = state.totalKills - prevKills;
      if (newKills > 0) floorKillsRef.current += newKills;

      if (event === "enraged") {
        announce("⚡ ENRAGED", "Boss enters rage mode!", "#ef4444");
        renderRef.current.shake("heavy");
      }

      if (event === "victory") {
        const isLast = isFinalFloor(rs.floor);

        // Snapshot per-floor stats before any resets fire
        setVictoryStats({
          kills: floorKillsRef.current,
          gold:  floorGoldRef.current,
        });

        if (isLast) {
          announce("YOU WIN", `All ${MAX_FLOORS} floors cleared!`, "#4ade80");
        } else {
          announce("BOSS SLAIN", "Victory — floor cleared!", "#4ade80");
        }

        roomRef.current = { ...rs, phase: "victory" };
        setTimeout(() => setIsVictory(true), 2000);
        return;
      }

      bossRef.current.draw(state, ctx, state.camera, player);
    }

    player.draw(ctx, state.camera);
  });

  // ============================================================
  // [🧱 BLOCK: Derived State]
  // ============================================================
  const gameActive       = !showMenu && !isGameOver && !isVictory;
  const isBossPhase      = roomRef.current.phase === "boss";
  const isShopPhase      = roomRef.current.phase === "shop";
  const state            = stateRef.current;
  const currentThreshold = hordeRef.current.getThreshold(hud.floor);
  const floorIsLast      = isFinalFloor(hud.floor);

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
          bossHp={hud.bossHp}
          bossMaxHp={hud.bossMaxHp}
          bossIsEnraged={hud.bossIsEnraged}
        />
      )}

      {!showMenu && !isGameOver && (
        <Minimap state={stateRef.current} isBoss={roomRef.current.phase === "boss"} />
      )}

      {showShop && state && (
        <Shop
          floor={roomRef.current.floor} room={roomRef.current.roomDisplay}
          gold={gold} playerStats={state.playerStats} player={state.player}
          pendingLoot={state.pendingLoot}
          isMidRoom={isMidRoom}
          onGoldChange={handleGoldChange}
          onClaimLoot={handleClaimLoot}
          onContinue={handleShopContinue}
          onClose={handleNpcClose}
        />
      )}

      {showInventory && state && (
        <Inventory
          playerStats={state.playerStats} player={state.player}
          gold={gold} onGoldChange={handleGoldChange} onClose={handleInventoryClose}
        />
      )}

      {/* ── Victory — floor stats + final-floor flag ── */}
      {isVictory && state && (
        <VictoryOverlay
          floor={hud.floor}
          kills={victoryStats.kills}
          goldEarned={victoryStats.gold}
          runStartTime={state.runStartTime}
          isFinalFloor={floorIsLast}
          onContinue={handleVictoryContinue}
          onQuit={handleQuitToMenu}
        />
      )}

      {/* ── Game Over ── */}
      {isGameOver && !showMenu && state && (
        <GameOverOverlay
          floor={hud.floor}                   room={hud.room}
          totalKills={state.totalKills}
          totalGoldEarned={state.totalGoldEarned}
          runStartTime={state.runStartTime}
          playerStats={state.playerStats}
          onRetry={handleRaidAgain}
          onQuit={handleQuitToMenu}
        />
      )}

      {isPaused && !showMenu && !isGameOver && !showInventory && state && (
        <PauseOverlay
          floor={hud.floor} room={hud.room}
          hp={hud.hp} maxHp={MAX_HP} gold={gold}
          playerStats={state.playerStats} player={state.player}
          onResume={() => setIsPaused(false)}
          onQuit={() => { setIsPaused(false); handleQuitToMenu(); }}
        />
      )}

      {showMenu && <Menu onStart={handleStart} />}

      <WaveClearAnnouncement
        show={announcement.show} message={announcement.message}
        subtext={announcement.subtext} color={announcement.color}
      />

      {IS_DEV && (
        <DevPanel
          isOpen={devPanelOpen} onToggle={() => setDevPanelOpen((p) => !p)}
          gameActive={gameActive} isBossPhase={isBossPhase} isShopPhase={isShopPhase}
          onKillAll={handleDevKillAll} onSkipRoom={handleDevSkipRoom}
          onSkipToShop={handleDevSkipToShop} onSkipToBoss={handleDevSkipToBoss}
          onAddGold={handleDevAddGold}
        />
      )}
    </div>
  );
}