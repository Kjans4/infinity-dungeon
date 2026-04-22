// src/engine/GameState.ts
import { Player }      from "./Player";
import { Camera, WORLD_W, WORLD_H } from "./Camera";
import { Door }        from "./Door";
import { GoldDrop }    from "./GoldDrop";
import { ItemDrop }    from "./ItemDrop";
import { ShopNPC }     from "./ShopNPC";
import { Particle }    from "./Particle";
import { PlayerStats } from "./PlayerStats";
import { Grunt, Shooter, Tank, Projectile, Dasher, Bomber } from "./enemy";
import { AnyBoss }     from "./enemy/boss/index";

// ============================================================
// [🧱 BLOCK: Run Record — localStorage persistence]
// Stores the stats of a single completed run.
// "Best" is determined by floor reached, then kills as tiebreak.
// ============================================================
export interface RunRecord {
  floor:      number;
  room:       number;
  kills:      number;
  goldEarned: number;
  elapsedMs:  number;
  timestamp:  number;   // Date.now() at run end
}

const LS_KEY_BEST    = "id_best_run";
const LS_KEY_HISTORY = "id_run_history";
const HISTORY_CAP    = 10;

export function saveRunRecord(record: RunRecord): void {
  try {
    // ── Update best ───────────────────────────────────────────
    const raw  = localStorage.getItem(LS_KEY_BEST);
    const best: RunRecord | null = raw ? JSON.parse(raw) : null;
    const isBetter =
      !best ||
      record.floor > best.floor ||
      (record.floor === best.floor && record.kills > best.kills);
    if (isBetter) localStorage.setItem(LS_KEY_BEST, JSON.stringify(record));

    // ── Append to history (newest first, capped) ──────────────
    const histRaw = localStorage.getItem(LS_KEY_HISTORY);
    const history: RunRecord[] = histRaw ? JSON.parse(histRaw) : [];
    history.unshift(record);
    if (history.length > HISTORY_CAP) history.length = HISTORY_CAP;
    localStorage.setItem(LS_KEY_HISTORY, JSON.stringify(history));
  } catch {
    // localStorage unavailable (SSR / private browsing) — silently skip
  }
}

export function loadBestRun(): RunRecord | null {
  try {
    const raw = localStorage.getItem(LS_KEY_BEST);
    return raw ? (JSON.parse(raw) as RunRecord) : null;
  } catch {
    return null;
  }
}

export function loadRunHistory(): RunRecord[] {
  try {
    const raw = localStorage.getItem(LS_KEY_HISTORY);
    return raw ? (JSON.parse(raw) as RunRecord[]) : [];
  } catch {
    return [];
  }
}

export class GameState {
  // Entities
  player:      Player;
  camera:      Camera;
  enemies:     (Grunt | Shooter | Tank | Dasher | Bomber)[];
  boss:        AnyBoss | null;
  door:        Door | null;
  shopNpc:     ShopNPC | null;
  projectiles: Projectile[];
  goldDrops:   GoldDrop[];
  itemDrops:   ItemDrop[];
  particles:   Particle[];

  // Economy
  gold:        number;
  playerStats: PlayerStats;

  // Horde tracking (resets per room)
  kills:         number;
  alive:         number;
  lastSpawn:     number;
  roomEntryTime: number;

  // ── Run-wide stats ────────────────────────────────────────
  totalKills:      number;
  totalGoldEarned: number;
  runStartTime:    number;

  // Screen
  screenW: number;
  screenH: number;

  constructor(screenW: number, screenH: number) {
    this.screenW = screenW;
    this.screenH = screenH;

    this.player      = new Player(WORLD_W / 2, WORLD_H / 2);
    this.camera      = new Camera(screenW, screenH);
    this.enemies     = [];
    this.boss        = null;
    this.door        = null;
    this.shopNpc     = null;
    this.projectiles = [];
    this.goldDrops   = [];
    this.itemDrops   = [];
    this.particles   = [];

    this.gold        = 0;
    this.playerStats = new PlayerStats();

    this.kills         = 0;
    this.alive         = 0;
    this.lastSpawn     = 0;
    this.roomEntryTime = 0;

    this.totalKills      = 0;
    this.totalGoldEarned = 0;
    this.runStartTime    = Date.now();

    this.playerStats.applyToPlayer(this.player);
  }

  // ============================================================
  // [🧱 BLOCK: Full Reset]
  // ============================================================
  reset() {
    this.enemies     = [];
    this.boss        = null;
    this.door        = null;
    this.shopNpc     = null;
    this.projectiles = [];
    this.goldDrops   = [];
    this.itemDrops   = [];
    this.particles   = [];
    this.gold        = 0;
    this.kills         = 0;
    this.alive         = 0;
    this.lastSpawn     = 0;
    this.roomEntryTime = 0;

    this.totalKills      = 0;
    this.totalGoldEarned = 0;
    this.runStartTime    = Date.now();

    this.player      = new Player(WORLD_W / 2, WORLD_H / 2);
    this.camera      = new Camera(this.screenW, this.screenH);
    this.playerStats = new PlayerStats();
    this.playerStats.applyToPlayer(this.player);
  }

  // ============================================================
  // [🧱 BLOCK: Room Reset]
  // ============================================================
  resetRoom() {
    this.enemies     = [];
    this.projectiles = [];
    this.goldDrops   = [];
    this.itemDrops   = [];
    this.particles   = [];
    this.kills         = 0;
    this.alive         = 0;
    this.lastSpawn     = 0;
    this.roomEntryTime = 0;
    this.door        = null;
    this.shopNpc     = null;
    this.boss        = null;
  }

  resize(w: number, h: number) {
    this.screenW        = w;
    this.screenH        = h;
    this.camera.screenW = w;
    this.camera.screenH = h;
  }
}