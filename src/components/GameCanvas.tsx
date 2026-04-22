"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { InputHandler }  from "@/engine/Input";
import { GameState, saveRunRecord } from "@/engine/GameState";
import { HordeSystem }   from "@/engine/systems/HordeSystem";
import { BossSystem, getBossName } from "@/engine/systems/BossSystem";
import { RenderSystem }  from "@/engine/systems/RenderSystem";
import { WORLD_W, WORLD_H, BOSS_WORLD_W, BOSS_WORLD_H } from "@/engine/Camera";
import {
  RoomState, initialRoomState, advanceRoom,
  nextFloor,
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
import { ItemDrop }          from "@/engine/ItemDrop";
import { WeaponItem, ArmorItem } from "@/engine/items/types";
import { Charm }             from "@/engine/CharmRegistry";
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

const REMAINING_MILESTONES = [
  { at: 5, color: "#f59e0b" },
  { at: 3, color: "#f97316" },
  { at: 1, color: "#ef4444" },
];

const BLANK_HUD = {
  hp: MAX_HP, stamina: MAX_STAMINA, kills: 0, room: 1, floor: 1,
  bossHp: 0, bossMaxHp: 0, bossIsEnraged: false,
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
}

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
            disabled={!gameActive || isBossPhase} title="Instantly kills all enemies">
            ☠ Kill All Enemies
          </button>
          <div className="dev-panel__divider" />
          <button className="dev-btn dev-btn--blue" onClick={onSkipRoom}
            disabled={!gameActive || isBossPhase} title="Skip to next room">
            ⏭ Skip Room
          </button>
          <button className="dev-btn dev-btn--blue" onClick={onSkipToElite}
            disabled={!gameActive || isBossPhase || isElitePhase} title="Jump to elite room">
            ⚡ Skip to Elite
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
  // [🧱 BLOCK: Victory UI State]
  // isVictory      — overlay is visible (not minimized)
  // victoryMinimized — overlay closed, badge shown instead
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
  const [devPanelOpen, setDevPanelOpen] = useState(false);

  // ============================================================
  // [🧱 BLOCK: Floor Transition State]
  // ============================================================
  const [showTransition,  setShowTransition]  = useState(false);
  const [transitionFloor, setTransitionFloor] = useState(2);
  const pendingContinueRef = useRef<(() => void) | null>(null);

  // Victory phase is active (overlay visible or minimized to badge)
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

      if (e.code === "KeyF" && !e.repeat) {
        const ui = uiActiveRef.current;
        if (ui.menu || ui.shop || ui.gameOver) return;
        const state = stateRef.current;
        if (!state) return;

        // Door interaction — works in all phases including victory
        if (state.door?.playerIsNear) {
          handleDoorEnter();
          return;
        }

        // Shop NPC interaction — works in all phases including victory
        if (state.shopNpc?.playerIsNear) {
          state.playerStats.generateShopOptions(roomRef.current.floor);
          setIsMidRoom(true);
          setShowShop(true);
        }
        return;
      }

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

  const resetFloorTracking = useCallback(() => {
    floorKillsRef.current = 0;
    floorGoldRef.current  = 0;
  }, []);

  // ============================================================
  // [🧱 BLOCK: Save Current Run]
  // Persists a RunRecord to localStorage. Called at every
  // run-ending point before state is reset.
  // Guard: skip if the run never started (totalKills=0, floor=1,
  // roomDisplay=1) to avoid polluting history with blank entries
  // from quitting the menu before ever playing.
  // ============================================================
  const saveCurrentRun = useCallback(() => {
    const state = stateRef.current;
    const rs    = roomRef.current;
    if (!state) return;

    // Don't save a blank run
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

  const handleStart = useCallback(() => {
    const rs = initialRoomState();
    roomRef.current = rs;
    stateRef.current!.reset();
    hordeRef.current.setup(stateRef.current!, rs, WORLD_W, WORLD_H);
    setHud(BLANK_HUD);
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
    // Save before reset wipes totalKills / totalGoldEarned
    saveCurrentRun();

    const rs = initialRoomState();
    roomRef.current = rs;
    stateRef.current!.reset();
    hordeRef.current.reset(stateRef.current!);
    bossRef.current.reset(stateRef.current!);
    hordeRef.current.setup(stateRef.current!, rs, WORLD_W, WORLD_H);
    setHud(BLANK_HUD);
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
    // Save before reset — guard inside saveCurrentRun skips blank runs
    saveCurrentRun();

    stateRef.current!.reset();
    hordeRef.current.reset(stateRef.current!);
    bossRef.current.reset(stateRef.current!);
    roomRef.current = initialRoomState();
    setHud(BLANK_HUD);
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
  // Handles F-press at any door. In victory phase it triggers
  // the floor transition instead of advanceRoom.
  // ============================================================
  const handleDoorEnter = useCallback(() => {
    const rs = roomRef.current;

    // Victory phase door → next floor
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

    // Normal room advance
    const newRs = advanceRoom(rs);
    roomRef.current = newRs;
    lastAnnouncedRemainingRef.current = null;

    if (newRs.phase === 'boss') {
      bossRef.current.setup(stateRef.current!, newRs);
      const bossName = stateRef.current?.boss
        ? getBossName(stateRef.current.boss)
        : 'BOSS';
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
  // [🧱 BLOCK: Handle Equip Drop]
  // Called by Inventory when the player equips a ground drop.
  // If the slot was occupied, the displaced item spawns as a new
  // ItemDrop near the player so it stays in the world for later.
  // ============================================================
  const handleEquipDrop = useCallback((drop: ItemDrop) => {
    const state = stateRef.current;
    if (!state) return;

    const ps     = state.playerStats;
    const player = state.player;
    const item   = drop.item;

    const spawnSwapped = (swapped: typeof item) => {
      const ox = (Math.random() - 0.5) * 48;
      const oy = (Math.random() - 0.5) * 48;
      state.itemDrops.push(new ItemDrop(
        player.x + player.width  / 2 + ox,
        player.y + player.height / 2 + oy,
        swapped
      ));
    };

    if (item.kind === "weapon") {
      if (ps.equippedWeaponItem) spawnSwapped({ ...ps.equippedWeaponItem });
      ps.claimWeapon(item as WeaponItem, player);
    } else if (item.kind === "armor") {
      const armorItem = item as ArmorItem;
      const existing  = ps.armorSlots[armorItem.slot];
      if (existing) spawnSwapped({ ...existing });
      ps.claimArmor(armorItem, player);
    } else if (item.kind === "charm") {
      ps.claimCharm(item as Charm, player);
    }

    // Mark collected so it's filtered out next game loop tick
    drop.collected  = true;
    state.itemDrops = state.itemDrops.filter((d) => !d.collected);
  }, []);

  const handleTransitionComplete = useCallback(() => {
    setShowTransition(false);
    pendingContinueRef.current?.();
    pendingContinueRef.current = null;
  }, []);

  // ============================================================
  // [🧱 BLOCK: Victory Minimize / Restore]
  // ============================================================
  const handleVictoryClose = useCallback(() => {
    setIsVictory(false);
    setVictoryMinimized(true);
  }, []);

  const handleVictoryRestore = useCallback(() => {
    setVictoryMinimized(false);
    setIsVictory(true);
  }, []);

  const handleGoldChange = useCallback((newGold: number) => {
    if (stateRef.current) stateRef.current.gold = newGold;
    setGold(newGold);
  }, []);

  const handleInventoryClose = useCallback(() => {
    setShowInventory(false);
    setIsPaused(false);
  }, []);

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

  // ============================================================
  // [🧱 BLOCK: Dev Skip Handlers]
  // roomDisplay uses per-floor values (3 = elite, 4 = boss)
  // matching the fixed RoomManager convention.
  // ============================================================
  const handleDevSkipToElite = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    const rs: RoomState = {
      floor: roomRef.current.floor, roomInCycle: 3,
      roomDisplay: 3, phase: 'elite',
    };
    roomRef.current = rs;
    hordeRef.current.setup(state, rs, WORLD_W, WORLD_H);
    announce("DEV: SKIPPED TO ELITE", undefined, "#f97316");
  }, [announce]);

  const handleDevSkipToBoss = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    setShowShop(false);
    const rs: RoomState = {
      floor: roomRef.current.floor, roomInCycle: 3,
      roomDisplay: 4, phase: 'boss',
    };
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

  useGameLoop((_dt: number) => {
    const canvas = canvasRef.current;
    const state  = stateRef.current;
    const input  = inputRef.current;
    if (!canvas || !state || !input) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ── Overlays that fully pause the game loop ───────────────
    // Victory is intentionally NOT in this list — player can roam.
    if (showMenu || showShop || isGameOver || isPaused || showInventory || showTransition) return;

    const rs      = roomRef.current;
    const isBoss  = rs.phase === 'boss' || rs.phase === 'victory';
    const isHorde = rs.phase === 'horde' || rs.phase === 'elite';
    const worldW  = isBoss ? BOSS_WORLD_W : WORLD_W;
    const worldH  = isBoss ? BOSS_WORLD_H : WORLD_H;
    const player  = state.player;

    // ── Death sequence ────────────────────────────────────────
    if (isDyingRef.current) {
      const elapsed = Date.now() - deathStartRef.current;

      renderRef.current.clear(ctx, state.screenW, state.screenH);
      state.camera.update(player, worldW, worldH);
      renderRef.current.drawWorld(ctx, state.camera, state.screenW, state.screenH, isBoss);
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
        // Save run record before showing game over screen
        saveCurrentRun();
        setIsGameOver(true);
      }

      return;
    }

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

    if (isHorde) {
      const prevKills = state.totalKills;
      const prevHp    = player.hp;
      const { goldCollected } = hordeRef.current.update(state, player, rs, worldW, worldH);

      if (player.hp < prevHp) renderRef.current.shake("light");
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
      const { event, goldCollected } = bossRef.current.update(state, player, worldW, worldH);

      if (player.hp < prevHp) renderRef.current.shake((prevHp - player.hp) >= 25 ? "heavy" : "medium");
      if (goldCollected > 0) {
        state.gold           += goldCollected;
        floorGoldRef.current += goldCollected;
      }
      const newKills = state.totalKills - prevKills;
      if (newKills > 0) floorKillsRef.current += newKills;

      if (event === "enraged") {
        const bossName = state.boss ? getBossName(state.boss) : 'BOSS';
        const enrageMsg =
          bossName === 'PHANTOM'  ? "⚡ UNBOUND"      :
          bossName === 'COLOSSUS' ? "⚡ UNSHACKLED"   :
          bossName === 'MAGE'     ? "⚡ ARCANE"        :
          bossName === 'SHADE'    ? "⚡ PHANTOM STEP"  :
                                    "⚡ ENRAGED";
        announce(enrageMsg, "Boss enters rage mode!", "#ef4444");
        renderRef.current.shake("heavy");
      }

      if (event === "victory") {
        setVictoryStats({
          kills: floorKillsRef.current,
          gold:  floorGoldRef.current,
        });

        // Mark room as victory phase so door F-press triggers nextFloor
        roomRef.current = { ...rs, phase: 'victory' };

        announce("BOSS SLAIN", "Approach the gate to descend", "#4ade80");

        // Show overlay after brief delay — game loop keeps running
        setTimeout(() => setIsVictory(true), 1200);
      }

      bossRef.current.draw(state, ctx, state.camera, player);
    }

    player.draw(ctx, state.camera);
  });

  const gameActive   = !showMenu && !isGameOver;
  const isBossPhase  = roomRef.current.phase === 'boss';
  const isElitePhase = roomRef.current.phase === 'elite';
  const state          = stateRef.current;
  const isElite      = roomRef.current.phase === 'elite';
  const threshold    = hordeRef.current.getThreshold(hud.floor, isElite);

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#0f172a" }}>
      <canvas ref={canvasRef} style={{ display: "block" }} />

      {!showMenu && (
        <HUD
          hp={hud.hp}                   maxHp={MAX_HP}
          stamina={hud.stamina} maxStamina={MAX_STAMINA}
          kills={hud.kills}     killThreshold={threshold}
          room={hud.room}       floor={hud.floor}
          gold={gold}
          bossHp={hud.bossHp}
          bossMaxHp={hud.bossMaxHp}
          bossIsEnraged={hud.bossIsEnraged}
          roomPhase={roomRef.current.phase}
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
          gold={gold}
          nearbyDrops={state.itemDrops.filter((d) => !d.collected && d.playerIsNear)}
          onGoldChange={handleGoldChange}
          onEquipDrop={handleEquipDrop}
          onClose={handleInventoryClose}
        />
      )}

      {/* ── Victory overlay — only shown when not minimized ── */}
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

      {/* ── Victory badge — shown when overlay is minimized ── */}
      {victoryMinimized && (
        <button className="victory-badge" onClick={handleVictoryRestore}>
          <span className="victory-badge__gem" />
          <span className="victory-badge__label">Floor Clear</span>
        </button>
      )}

      {/* ── Floor Transition Overlay ── */}
      {showTransition && (
        <FloorTransition
          targetFloor={transitionFloor}
          onComplete={handleTransitionComplete}
        />
      )}

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