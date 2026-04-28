"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { InputHandler }  from "@/engine/Input";
import { GameState, saveRunRecord } from "@/engine/GameState";
import { HordeSystem }   from "@/engine/systems/HordeSystem";
import { BossSystem, getBossName } from "@/engine/systems/BossSystem";
import { RenderSystem }  from "@/engine/systems/RenderSystem";
import { WORLD_W, WORLD_H, BOSS_WORLD_W, BOSS_WORLD_H } from "@/engine/Camera";
import {
  RoomState, initialRoomState, advanceRoom, nextFloor,
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
import FloorTransition       from "@/components/overlays/FloorTransition";
import { spawnBurst }        from "@/engine/Particle";
import { ShopItem }          from "@/engine/items/ItemPool";
import { ItemDrop }          from "@/engine/ItemDrop";
import { WeaponItem, ArmorItem } from "@/engine/items/types";
import { HotbarSlot }        from "@/engine/PlayerConsumables";
import "@/styles/victory.css";
import "@/styles/dev-panel.css";

// ============================================================
// [🧱 BLOCK: Constants]
// ============================================================
const MAX_HP            = 100;
const MAX_STAMINA       = 100;
const INVENTORY_HOLD_MS = 500;
const IS_DEV            = process.env.NODE_ENV === "development";

const DEATH_FLASH_MS    = 600;
const DEATH_VIGNETTE_MS = 800;
const DEATH_HOLD_MS     = 400;
const DEATH_TOTAL_MS    = DEATH_FLASH_MS + DEATH_VIGNETTE_MS + DEATH_HOLD_MS;

const SWAP_DROP_OFFSET  = 40;

const REMAINING_MILESTONES = [
  { at: 5, color: "#f59e0b" },
  { at: 3, color: "#f97316" },
  { at: 1, color: "#ef4444" },
];

// ============================================================
// [🧱 BLOCK: Blank HUD + HUD State]
// hotbar is included in HUD state so it re-renders at 10fps.
// ============================================================
type BlankHotbar = [HotbarSlot, HotbarSlot, HotbarSlot, HotbarSlot];

const BLANK_HOTBAR: BlankHotbar = [
  { assignedId: null, cooldownMs: 0, durationMs: 0, wardHits: 0 },
  { assignedId: null, cooldownMs: 0, durationMs: 0, wardHits: 0 },
  { assignedId: null, cooldownMs: 0, durationMs: 0, wardHits: 0 },
  { assignedId: null, cooldownMs: 0, durationMs: 0, wardHits: 0 },
];

const BLANK_HUD = {
  hp: MAX_HP, stamina: MAX_STAMINA, kills: 0, room: 1, floor: 1,
  bossHp: 0, bossMaxHp: 0, bossIsEnraged: false,
  hotbar: BLANK_HOTBAR,
};

interface HUDState {
  hp:            number;
  stamina:       number;
  kills:         number;
  room:          number;
  floor:         number;
  bossHp:        number;
  bossMaxHp:     number;
  bossIsEnraged: boolean;
  hotbar:        BlankHotbar;
}

// ============================================================
// [🧱 BLOCK: Dev Panel]
// ============================================================
interface DevPanelProps {
  isOpen: boolean; onToggle: () => void;
  gameActive: boolean; isBossPhase: boolean; isElitePhase: boolean;
  onKillAll: () => void; onSkipRoom: () => void;
  onSkipToElite: () => void; onSkipToBoss: () => void; onAddGold: () => void;
}

function DevPanel({
  isOpen, onToggle, gameActive, isBossPhase, isElitePhase,
  onKillAll, onSkipRoom, onSkipToElite, onSkipToBoss, onAddGold,
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
            disabled={!gameActive || isBossPhase}>☠ Kill All Enemies</button>
          <div className="dev-panel__divider" />
          <button className="dev-btn dev-btn--blue" onClick={onSkipRoom}
            disabled={!gameActive || isBossPhase}>⏭ Skip Room</button>
          <button className="dev-btn dev-btn--blue" onClick={onSkipToElite}
            disabled={!gameActive || isBossPhase || isElitePhase}>⚡ Skip to Elite</button>
          <button className="dev-btn dev-btn--blue" onClick={onSkipToBoss}
            disabled={!gameActive || isBossPhase}>💀 Skip to Boss</button>
          <div className="dev-panel__divider" />
          <button className="dev-btn dev-btn--green" onClick={onAddGold}
            disabled={!gameActive}>💰 +200 Gold</button>
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

  const stateRef  = useRef<GameState | null>(null);
  const inputRef  = useRef<InputHandler | null>(null);
  const hordeRef  = useRef(new HordeSystem());
  const bossRef   = useRef(new BossSystem());
  const renderRef = useRef(new RenderSystem());
  const roomRef   = useRef<RoomState>(initialRoomState());

  const iHoldTimer                = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uiActiveRef               = useRef({ menu: true, shop: false, gameOver: false, inventory: false });
  const lastAnnouncedRemainingRef = useRef<number | null>(null);

  const isDyingRef       = useRef(false);
  const deathStartRef    = useRef(0);
  const vignetteAlphaRef = useRef(0);

  const floorKillsRef = useRef(0);
  const floorGoldRef  = useRef(0);

  // ============================================================
  // [🧱 BLOCK: UI State]
  // ============================================================
  const [showMenu,           setShowMenu]           = useState(true);
  const [isGameOver,         setIsGameOver]          = useState(false);
  const [isVictory,          setIsVictory]           = useState(false);
  const [victoryMinimized,   setVictoryMinimized]    = useState(false);
  const [showShop,           setShowShop]            = useState(false);
  const [isMidRoom,          setIsMidRoom]           = useState(false);
  const [isPaused,           setIsPaused]            = useState(false);
  const [showInventory,      setShowInventory]       = useState(false);
  const [gold,               setGold]                = useState(0);
  const [hud,                setHud]                 = useState<HUDState>(BLANK_HUD);
  const [victoryStats,       setVictoryStats]        = useState({ kills: 0, gold: 0 });
  const [announcement, setAnnouncement] = useState<{
    show: boolean; message: string; subtext?: string; color?: string;
  }>({ show: false, message: "" });
  const announcementRef = useRef(false);
  const [devPanelOpen,  setDevPanelOpen]  = useState(false);
  const [showTransition,  setShowTransition]  = useState(false);
  const [transitionFloor, setTransitionFloor] = useState(2);
  const pendingContinueRef = useRef<(() => void) | null>(null);

  const isVictoryPhase = isVictory || victoryMinimized;

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
  // [🧱 BLOCK: Setup Effect]
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
      // ── F1: Dev panel ──────────────────────────────────────
      if (e.code === "F1") {
        e.preventDefault();
        if (IS_DEV) setDevPanelOpen((p) => !p);
        return;
      }

      // ── ESC: close inventory or toggle pause ───────────────
      if (e.code === "Escape") {
        if (uiActiveRef.current.inventory) {
          setShowInventory(false);
        } else {
          setIsPaused((p) => !p);
        }
        return;
      }

      // ── F: door / shop interaction ─────────────────────────
      if (e.code === "KeyF" && !e.repeat) {
        const ui = uiActiveRef.current;
        if (ui.menu || ui.shop || ui.gameOver) return;
        const state = stateRef.current;
        if (!state) return;
        if (state.door?.playerIsNear) { handleDoorEnter(); return; }
        if (state.shopNpc?.playerIsNear) {
          state.playerStats.generateShopOptions();
          setIsMidRoom(true);
          setShowShop(true);
        }
        return;
      }

      // ── I: hold to open inventory ──────────────────────────
      if (e.code === "KeyI" && !e.repeat) {
        const ui = uiActiveRef.current;
        if (ui.menu || ui.shop || ui.gameOver) return;
        if (ui.inventory) { setShowInventory(false); return; }
        if (iHoldTimer.current) clearTimeout(iHoldTimer.current);
        iHoldTimer.current = setTimeout(() => {
          setShowInventory(true);
          iHoldTimer.current = null;
        }, INVENTORY_HOLD_MS);
      }

      // ── 1–4: hotbar activation ─────────────────────────────
      // Only fires when game is active (not in menu/shop/gameover/paused)
      if (!e.repeat) {
        const slotMap: Record<string, number> = {
          Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3,
        };
        if (e.code in slotMap) {
          const ui = uiActiveRef.current;
          if (ui.menu || ui.shop || ui.gameOver) return;
          const state = stateRef.current;
          if (!state) return;
          const slotIndex = slotMap[e.code];
          const activated = state.playerConsumables.activateSlot(slotIndex);
          if (activated) {
            // Phase 2: apply effect here based on activated.id
            // For now announce the activation as placeholder
            announce(`${activated.icon} ${activated.name}`, "Effect coming in Phase 2", "#a78bfa");
          }
        }
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

    // ── HUD sync at 10fps ──────────────────────────────────
    const hudSync = setInterval(() => {
      const s = stateRef.current;
      const r = roomRef.current;
      if (!s) return;
      const boss = s.boss;

      // Build hotbar snapshot with _bagCount piggy-backed so
      // HUD can show stack counts without a separate prop.
      const hotbarSnap = s.playerConsumables.slots.map((slot) => ({
        ...slot,
        _bagCount: slot.assignedId
          ? s.playerConsumables.bagCount(slot.assignedId)
          : 0,
      })) as unknown as BlankHotbar;

      setHud({
        hp:            Math.max(0, s.player.hp),
        stamina:       Math.round(s.player.stamina),
        kills:         s.kills,
        room:          r.roomDisplay,
        floor:         r.floor,
        bossHp:        boss && !boss.isDead ? boss.hp    : 0,
        bossMaxHp:     boss                 ? boss.maxHp : 0,
        bossIsEnraged: boss                 ? boss.isEnraged : false,
        hotbar:        hotbarSnap,
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

  const resetFloorTracking = useCallback(() => {
    floorKillsRef.current = 0;
    floorGoldRef.current  = 0;
  }, []);

  // ============================================================
  // [🧱 BLOCK: Save Current Run]
  // ============================================================
  const saveCurrentRun = useCallback(() => {
    const state = stateRef.current;
    const rs    = roomRef.current;
    if (!state) return;
    if (state.totalKills === 0 && rs.floor === 1 && rs.roomDisplay === 1) return;
    saveRunRecord({
      floor:      rs.floor,
      room:       rs.roomDisplay,
      kills:      state.totalKills,
      goldEarned: state.totalGoldEarned,
      elapsedMs:  Date.now() - state.runStartTime,
      timestamp:  Date.now(),
    });
  }, []);

  // ============================================================
  // [🧱 BLOCK: Game Start / Reset Helpers]
  // ============================================================
  const handleStart = useCallback(() => {
    const rs = initialRoomState();
    roomRef.current = rs;
    stateRef.current!.reset();
    hordeRef.current.setup(stateRef.current!, rs, WORLD_W, WORLD_H);
    setHud({ ...BLANK_HUD, hotbar: BLANK_HOTBAR });
    setGold(0);
    setIsGameOver(false);    setIsVictory(false);
    setVictoryMinimized(false);
    setShowShop(false);      setIsPaused(false);
    setIsMidRoom(false);
    setShowInventory(false);
    setShowMenu(false);
    setShowTransition(false);
    lastAnnouncedRemainingRef.current = null;
    isDyingRef.current = false;
    vignetteAlphaRef.current = 0;
    resetFloorTracking();
    setTimeout(() => announce("PREPARE!", "Room 1 — enemies incoming", "#38bdf8"), 300);
  }, [resetFloorTracking, announce]);

  const handleRaidAgain = useCallback(() => {
    saveCurrentRun();
    const rs = initialRoomState();
    roomRef.current = rs;
    stateRef.current!.reset();
    hordeRef.current.reset(stateRef.current!);
    bossRef.current.reset(stateRef.current!);
    hordeRef.current.setup(stateRef.current!, rs, WORLD_W, WORLD_H);
    setHud({ ...BLANK_HUD, hotbar: BLANK_HOTBAR });
    setGold(0);
    setIsGameOver(false);    setIsVictory(false);
    setVictoryMinimized(false);
    setShowShop(false);      setIsPaused(false);
    setIsMidRoom(false);
    setShowInventory(false);
    setShowMenu(false);
    setShowTransition(false);
    lastAnnouncedRemainingRef.current = null;
    isDyingRef.current = false;
    vignetteAlphaRef.current = 0;
    resetFloorTracking();
    setTimeout(() => announce("PREPARE!", "Room 1 — enemies incoming", "#38bdf8"), 300);
  }, [saveCurrentRun, resetFloorTracking, announce]);

  const handleQuitToMenu = useCallback(() => {
    saveCurrentRun();
    stateRef.current!.reset();
    hordeRef.current.reset(stateRef.current!);
    bossRef.current.reset(stateRef.current!);
    roomRef.current = initialRoomState();
    setHud({ ...BLANK_HUD, hotbar: BLANK_HOTBAR });
    setGold(0);
    setIsGameOver(false);    setIsVictory(false);
    setVictoryMinimized(false);
    setShowShop(false);      setIsPaused(false);
    setIsMidRoom(false);
    setShowInventory(false);
    setShowMenu(true);
    setShowTransition(false);
    lastAnnouncedRemainingRef.current = null;
    isDyingRef.current = false;
    vignetteAlphaRef.current = 0;
    resetFloorTracking();
  }, [saveCurrentRun, resetFloorTracking]);

  // ============================================================
  // [🧱 BLOCK: Door Enter]
  // ============================================================
  const handleDoorEnter = useCallback(() => {
    const rs = roomRef.current;

    if (rs.phase === 'victory') {
      const nextFloorNum = rs.floor + 1;
      pendingContinueRef.current = () => {
        const newRs = nextFloor(rs);
        roomRef.current = newRs;
        stateRef.current!.resetRoom();
        hordeRef.current.setup(stateRef.current!, newRs, WORLD_W, WORLD_H);
        setIsVictory(false);
        setVictoryMinimized(false);
        setShowShop(false);
        setIsMidRoom(false);
        lastAnnouncedRemainingRef.current = null;
        resetFloorTracking();
        setTimeout(() => announce(`FLOOR ${newRs.floor}`, "Enemies incoming", "#f59e0b"), 300);
      };
      setIsVictory(false);
      setVictoryMinimized(false);
      setTransitionFloor(nextFloorNum);
      setShowTransition(true);
      return;
    }

    const newRs = advanceRoom(rs);
    roomRef.current = newRs;
    lastAnnouncedRemainingRef.current = null;

    if (newRs.phase === 'boss') {
      bossRef.current.setup(stateRef.current!, newRs);
      const bossName = stateRef.current?.boss ? getBossName(stateRef.current.boss) : 'BOSS';
      announce(`${bossName} INCOMING`, "Prepare yourself!", "#ef4444");
    } else if (newRs.phase === 'elite') {
      hordeRef.current.setup(stateRef.current!, newRs, WORLD_W, WORLD_H);
      announce("⚡ ELITE ROOM", "No Grunts — only the strong survive", "#f97316");
    } else {
      hordeRef.current.setup(stateRef.current!, newRs, WORLD_W, WORLD_H);
      announce("PREPARE!", `Room ${newRs.roomDisplay} — enemies incoming`, "#38bdf8");
    }
  }, [announce, resetFloorTracking]);

  const handleNpcClose = useCallback(() => {
    setShowShop(false);
    setIsMidRoom(false);
  }, []);

  // ============================================================
  // [🧱 BLOCK: Equip Drop]
  // ============================================================
  const handleEquipDrop = useCallback((drop: ItemDrop) => {
    const state = stateRef.current;
    if (!state) return;
    const item   = drop.item;
    const player = state.player;
    const dropX  = player.x + player.width  + SWAP_DROP_OFFSET;
    const dropY  = player.y + player.height + SWAP_DROP_OFFSET;

    if (item.kind === 'weapon') {
      const existing = state.playerStats.equippedWeaponItem;
      if (existing) state.itemDrops.push(new ItemDrop(dropX, dropY, { ...existing, kind: 'weapon' }));
      state.playerStats.equipWeapon(item as WeaponItem, state.gold, player);
    } else if (item.kind === 'armor') {
      const armorItem = item as ArmorItem;
      const existing  = state.playerStats.armorSlots[armorItem.slot];
      if (existing) state.itemDrops.push(new ItemDrop(dropX, dropY, { ...existing, kind: 'armor' }));
      state.playerStats.equipArmor(armorItem, state.gold, player);
    } else if (item.kind === 'charm') {
      state.playerStats.buyCharm(item as any, state.gold, player);
    }

    drop.collected = true;
    const idx = state.itemDrops.findIndex((d) => d === drop);
    if (idx !== -1) state.itemDrops.splice(idx, 1);
  }, []);

  const handleTransitionComplete = useCallback(() => {
    setShowTransition(false);
    pendingContinueRef.current?.();
    pendingContinueRef.current = null;
  }, []);

  const handleVictoryClose   = useCallback(() => { setIsVictory(false); setVictoryMinimized(true); }, []);
  const handleVictoryRestore = useCallback(() => { setVictoryMinimized(false); setIsVictory(true); }, []);

  const handleGoldChange = useCallback((newGold: number) => {
    if (stateRef.current) stateRef.current.gold = newGold;
    setGold(newGold);
  }, []);

  const handleInventoryClose = useCallback(() => { setShowInventory(false); }, []);

  // ============================================================
  // [🧱 BLOCK: Dev Handlers]
  // ============================================================
  const handleDevKillAll = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    const isElite   = roomRef.current.phase === 'elite';
    const threshold = hordeRef.current.getThreshold(roomRef.current.floor, isElite);
    state.enemies = [];
    state.kills   = threshold;
    state.alive   = 0;
    if (state.door) state.door.activate();
    lastAnnouncedRemainingRef.current = null;
    announce("DEV: ALL ENEMIES KILLED", "Gate is open", "#f87171");
  }, [announce]);

  const handleDevSkipRoom = useCallback(() => {
    handleDoorEnter();
    announce("DEV: ROOM SKIPPED", undefined, "#38bdf8");
  }, [handleDoorEnter, announce]);

  const handleDevSkipToElite = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    const rs: RoomState = { floor: roomRef.current.floor, roomInCycle: 3, roomDisplay: 3, phase: 'elite' };
    roomRef.current = rs;
    hordeRef.current.setup(state, rs, WORLD_W, WORLD_H);
    announce("DEV: SKIPPED TO ELITE", undefined, "#f97316");
  }, [announce]);

  const handleDevSkipToBoss = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    setShowShop(false);
    const rs: RoomState = { floor: roomRef.current.floor, roomInCycle: 3, roomDisplay: 4, phase: 'boss' };
    roomRef.current = rs;
    bossRef.current.setup(state, rs);
    const bossName = state.boss ? getBossName(state.boss) : 'BOSS';
    announce(`DEV: ${bossName} SPAWNED`, undefined, "#f87171");
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
  // playerConsumables.update() is called every frame so
  // cooldown and duration timers tick accurately.
  // ============================================================
  useGameLoop((_dt: number) => {
    const canvas = canvasRef.current;
    const state  = stateRef.current;
    const input  = inputRef.current;
    if (!canvas || !state || !input) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (showMenu || showShop || isGameOver || isPaused || showTransition) return;

    const rs      = roomRef.current;
    const isBoss  = rs.phase === 'boss' || rs.phase === 'victory';
    const isHorde = rs.phase === 'horde' || rs.phase === 'elite';
    const worldW  = isBoss ? BOSS_WORLD_W : WORLD_W;
    const worldH  = isBoss ? BOSS_WORLD_H : WORLD_H;
    const player  = state.player;
    const render  = renderRef.current;

    // ── Tick consumable timers every frame (~16ms) ─────────
    state.playerConsumables.update(16);

    // ── Death sequence ────────────────────────────────────
    if (isDyingRef.current) {
      const elapsed = Date.now() - deathStartRef.current;
      render.clear(ctx, state.screenW, state.screenH);
      state.camera.update(player, worldW, worldH);
      render.drawWorld(ctx, state.camera, state.screenW, state.screenH, isBoss);
      if (isBoss) bossRef.current.draw(state, ctx, state.camera, player);
      else         hordeRef.current.draw(state, ctx, state.camera, player, worldW);

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
        saveCurrentRun();
        setIsGameOver(true);
      }
      return;
    }

    if (player.hp <= 0 && !isDyingRef.current) {
      isDyingRef.current    = true;
      deathStartRef.current = Date.now();
      render.shake("heavy");
      const px = player.x + player.width  / 2;
      const py = player.y + player.height / 2;
      state.particles.push(...spawnBurst(px, py, "#ef4444", 20, 2.5));
      state.particles.push(...spawnBurst(px, py, "#ffffff", 10, 1.5));
      return;
    }

    render.clear(ctx, state.screenW, state.screenH);
    state.camera.update(player, worldW, worldH);
    render.drawWorld(ctx, state.camera, state.screenW, state.screenH, isBoss);

    player.update(input);
    player.x = Math.max(0, Math.min(worldW - player.width,  player.x));
    player.y = Math.max(0, Math.min(worldH - player.height, player.y));

    if (isHorde) {
      const prevKills = state.totalKills;
      const prevHp    = player.hp;
      const { goldCollected } = hordeRef.current.update(state, player, rs, worldW, worldH, render);

      if (player.hp < prevHp) render.shake("light");
      if (goldCollected > 0) {
        state.gold           += goldCollected;
        floorGoldRef.current += goldCollected;
      }
      const newKills = state.totalKills - prevKills;
      if (newKills > 0) floorKillsRef.current += newKills;

      const isElite   = rs.phase === 'elite';
      const threshold = hordeRef.current.getThreshold(rs.floor, isElite);
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
        const clearMsg = isElite ? "ELITE CLEARED" : "ROOM CLEAR";
        const clearSub = isElite
          ? "Press F at the gate — boss awaits"
          : "Press F at the gate to advance";
        announce(clearMsg, clearSub, isElite ? "#f97316" : "#4ade80");
      }

      hordeRef.current.draw(state, ctx, state.camera, player, worldW);
    }

    if (isBoss) {
      const prevKills = state.totalKills;
      const prevHp    = player.hp;
      const { event, goldCollected } = bossRef.current.update(state, player, worldW, worldH, render);

      if (player.hp < prevHp) render.shake((prevHp - player.hp) >= 25 ? "heavy" : "medium");
      if (goldCollected > 0) {
        state.gold           += goldCollected;
        floorGoldRef.current += goldCollected;
      }
      const newKills = state.totalKills - prevKills;
      if (newKills > 0) floorKillsRef.current += newKills;

      if (event === "enraged") {
        const bossName  = state.boss ? getBossName(state.boss) : 'BOSS';
        const enrageMsg =
          bossName === 'PHANTOM'  ? "⚡ UNBOUND"      :
          bossName === 'COLOSSUS' ? "⚡ UNSHACKLED"   :
          bossName === 'MAGE'     ? "⚡ ARCANE"        :
          bossName === 'SHADE'    ? "⚡ PHANTOM STEP"  :
                                    "⚡ ENRAGED";
        announce(enrageMsg, "Boss enters rage mode!", "#ef4444");
        render.shake("heavy");
      }

      if (event === "victory") {
        setVictoryStats({ kills: floorKillsRef.current, gold: floorGoldRef.current });
        roomRef.current = { ...rs, phase: 'victory' };
        announce("BOSS SLAIN", "Approach the gate to descend", "#4ade80");
        setTimeout(() => setIsVictory(true), 1200);
      }

      bossRef.current.draw(state, ctx, state.camera, player);
    }

    player.draw(ctx, state.camera);
    render.drawDamageNumbers(ctx, state.camera, state.damageNumbers);
  });

  const gameActive   = !showMenu && !isGameOver;
  const isBossPhase  = roomRef.current.phase === 'boss';
  const isElitePhase = roomRef.current.phase === 'elite';
  const state        = stateRef.current;
  const isElite      = roomRef.current.phase === 'elite';
  const threshold    = hordeRef.current.getThreshold(hud.floor, isElite);

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#0f172a" }}>
      <canvas ref={canvasRef} style={{ display: "block" }} />

      {!showMenu && (
        <HUD
          hp={hud.hp}           maxHp={MAX_HP}
          stamina={hud.stamina} maxStamina={MAX_STAMINA}
          kills={hud.kills}     killThreshold={threshold}
          room={hud.room}       floor={hud.floor}
          gold={gold}
          bossHp={hud.bossHp}
          bossMaxHp={hud.bossMaxHp}
          bossIsEnraged={hud.bossIsEnraged}
          roomPhase={roomRef.current.phase}
          hotbar={hud.hotbar}
        />
      )}

      {!showMenu && !isGameOver && (
        <Minimap state={stateRef.current} isBoss={roomRef.current.phase === 'boss' || roomRef.current.phase === 'victory'} />
      )}

      {showShop && state && (
        <Shop
          floor={roomRef.current.floor} room={roomRef.current.roomDisplay}
          gold={gold} playerStats={state.playerStats} player={state.player}
          isMidRoom={isMidRoom}
          onGoldChange={handleGoldChange}
          onContinue={handleNpcClose}
          onClose={handleNpcClose}
        />
      )}

      {showInventory && state && (
        <Inventory
          playerStats={state.playerStats} player={state.player}
          gold={gold} nearbyDrops={state.itemDrops}
          playerConsumables={state.playerConsumables}
          onGoldChange={handleGoldChange}
          onEquipDrop={handleEquipDrop}
          onClose={handleInventoryClose}
        />
      )}

      {isVictory && state && (
        <VictoryOverlay
          floor={hud.floor}
          kills={victoryStats.kills}
          goldEarned={victoryStats.gold}
          totalKills={state.totalKills}
          totalGoldEarned={state.totalGoldEarned}
          runStartTime={state.runStartTime}
          playerStats={state.playerStats}
          onClose={handleVictoryClose}
          onQuit={handleQuitToMenu}
        />
      )}

      {victoryMinimized && (
        <button className="victory-badge" onClick={handleVictoryRestore}>
          <span className="victory-badge__gem" />
          <span className="victory-badge__label">Floor Clear</span>
        </button>
      )}

      {showTransition && (
        <FloorTransition targetFloor={transitionFloor} onComplete={handleTransitionComplete} />
      )}

      {isGameOver && !showMenu && state && (
        <GameOverOverlay
          floor={hud.floor}           room={hud.room}
          totalKills={state.totalKills}
          totalGoldEarned={state.totalGoldEarned}
          runStartTime={state.runStartTime}
          playerStats={state.playerStats}
          onRetry={handleRaidAgain}
          onQuit={handleQuitToMenu}
        />
      )}

      {isPaused && !showMenu && !isGameOver && state && (
        <PauseOverlay
          floor={hud.floor} room={hud.room}
          hp={hud.hp} maxHp={MAX_HP} gold={gold}
          playerStats={state.playerStats}
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
          gameActive={gameActive} isBossPhase={isBossPhase} isElitePhase={isElitePhase}
          onKillAll={handleDevKillAll} onSkipRoom={handleDevSkipRoom}
          onSkipToElite={handleDevSkipToElite} onSkipToBoss={handleDevSkipToBoss}
          onAddGold={handleDevAddGold}
        />
      )}
    </div>
  );
}