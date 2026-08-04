// src/engine/GameState.ts
import { Player }             from "./Player";
import { Camera, WORLD_W, WORLD_H } from "./Camera";
import { Door }               from "./Door";
import { GoldDrop }           from "./GoldDrop";
import { ConsumableDrop }     from "./ConsumableDrop";
import { ShopNPC }            from "./ShopNPC";
import { BossChest }          from "./BossChest";
import { BoonDef }            from "./BoonRegistry";
import { Particle, HitSpark, DamageNumber } from "./Particle";
import { PlayerStats }        from "./PlayerStats";
import { PlayerConsumables }  from "./PlayerConsumables";
import { ConsumableSystem }   from "./ConsumableSystem";
import { WeaponItem }         from "./items/types";
import { Grunt, Shooter, Tank, Projectile, Dasher, Bomber } from "./enemy";
import { AnyBoss }            from "./enemy/boss/index";
import { TileMap }            from "./TileMap";

// ============================================================
// [🧱 BLOCK: Run Record — localStorage persistence]
// ============================================================
export interface RunRecord {
  floor:      number;
  room:       number;
  kills:      number;
  goldEarned: number;
  elapsedMs:  number;
  timestamp:  number;
}

const LS_KEY_BEST    = "id_best_run";
const LS_KEY_HISTORY = "id_run_history";
const HISTORY_CAP    = 10;

export function saveRunRecord(record: RunRecord): void {
  try {
    const raw  = localStorage.getItem(LS_KEY_BEST);
    const best: RunRecord | null = raw ? JSON.parse(raw) : null;
    const isBetter =
      !best ||
      record.floor > best.floor ||
      (record.floor === best.floor && record.kills > best.kills);
    if (isBetter) localStorage.setItem(LS_KEY_BEST, JSON.stringify(record));

    const histRaw = localStorage.getItem(LS_KEY_HISTORY);
    const history: RunRecord[] = histRaw ? JSON.parse(histRaw) : [];
    history.unshift(record);
    if (history.length > HISTORY_CAP) history.length = HISTORY_CAP;
    localStorage.setItem(LS_KEY_HISTORY, JSON.stringify(history));
  } catch {
    // localStorage unavailable — silently skip
  }
}

export function loadBestRun(): RunRecord | null {
  try {
    const raw = localStorage.getItem(LS_KEY_BEST);
    return raw ? (JSON.parse(raw) as RunRecord) : null;
  } catch { return null; }
}

export function loadRunHistory(): RunRecord[] {
  try {
    const raw = localStorage.getItem(LS_KEY_HISTORY);
    return raw ? (JSON.parse(raw) as RunRecord[]) : [];
  } catch { return []; }
}

export class GameState {
  // ============================================================
  // [🧱 BLOCK: Entities]
  // ============================================================
  player:           Player;
  camera:           Camera;
  enemies:          (Grunt | Shooter | Tank | Dasher | Bomber)[];
  boss:             AnyBoss | null;
  door:             Door | null;
  shopNpc:          ShopNPC | null;
  bossChest:        BossChest | null;
  projectiles:      Projectile[];
  goldDrops:        GoldDrop[];
  consumableDrops:  ConsumableDrop[];
  particles:        Particle[];
  hitSparks:        HitSpark[];
  damageNumbers:    DamageNumber[];

  // ============================================================
  // [🧱 BLOCK: Tile Map]
  // One TileMap instance — regenerated each room transition.
  // ============================================================
  tileMap: TileMap;

  // ============================================================
  // [🧱 BLOCK: Economy + Stats + Consumables]
  // ============================================================
  gold:              number;
  playerStats:       PlayerStats;
  playerConsumables: PlayerConsumables;
  consumableSystem:  ConsumableSystem;

  // ============================================================
  // [🧱 BLOCK: Pending Boon Choices — Boss Chest]
  // Set when the player opens a BossChest; consumed by the boon
  // picker UI (3 random choices, pick 1).
  // ============================================================
  pendingBoonChoices: BoonDef[];

  // ============================================================
  // [🧱 BLOCK: Pending Weapon Choices — Run-Start Picker]
  // [🧱 Phase 2] Set on every full run reset (Menu → RAID, or
  // Game Over → Raid Again); consumed by WeaponPicker (3 random
  // choices, pick 1, no reroll/cancel). Weapons are Shop-only
  // after this — this is the only free-grant exception, mirroring
  // pendingBoonChoices for the Boss Chest.
  // ============================================================
  pendingWeaponChoices: WeaponItem[];

  // ============================================================
  // [🧱 BLOCK: Horde Tracking]
  // ============================================================
  kills:         number;
  alive:         number;
  lastSpawn:     number;
  roomEntryTime: number;

  // ============================================================
  // [🧱 BLOCK: Run-wide Stats]
  // ============================================================
  totalKills:      number;
  totalGoldEarned: number;
  runStartTime:    number;

  // ============================================================
  // [🧱 BLOCK: Screen]
  // ============================================================
  screenW: number;
  screenH: number;

  constructor(screenW: number, screenH: number) {
    this.screenW = screenW;
    this.screenH = screenH;

    this.player          = new Player(WORLD_W / 2, WORLD_H / 2);
    this.camera          = new Camera(screenW, screenH);
    this.enemies         = [];
    this.boss            = null;
    this.door            = null;
    this.shopNpc         = null;
    this.bossChest       = null;
    this.projectiles     = [];
    this.goldDrops       = [];
    this.consumableDrops = [];
    this.particles       = [];
    this.hitSparks       = [];
    this.damageNumbers   = [];

    this.tileMap           = new TileMap(WORLD_W, WORLD_H);

    this.gold              = 0;
    this.playerStats       = new PlayerStats();
    this.playerConsumables = new PlayerConsumables();
    this.consumableSystem  = new ConsumableSystem();
    this.pendingBoonChoices   = [];
    this.pendingWeaponChoices = [];

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
    this.enemies         = [];
    this.boss            = null;
    this.door            = null;
    this.shopNpc         = null;
    this.bossChest       = null;
    this.projectiles     = [];
    this.goldDrops       = [];
    this.consumableDrops = [];
    this.particles       = [];
    this.hitSparks       = [];
    this.damageNumbers   = [];
    this.gold            = 0;
    this.kills           = 0;
    this.alive           = 0;
    this.lastSpawn       = 0;
    this.roomEntryTime   = 0;
    this.pendingBoonChoices   = [];
    this.pendingWeaponChoices = [];

    this.totalKills      = 0;
    this.totalGoldEarned = 0;
    this.runStartTime    = Date.now();

    this.player            = new Player(WORLD_W / 2, WORLD_H / 2);
    this.camera            = new Camera(this.screenW, this.screenH);
    this.playerStats       = new PlayerStats();
    this.playerConsumables = new PlayerConsumables();
    this.consumableSystem  = new ConsumableSystem();
    this.tileMap.regenerate(WORLD_W, WORLD_H);
    this.playerStats.applyToPlayer(this.player);
  }

  // ============================================================
  // [🧱 BLOCK: Room Reset]
  // Regenerates tile map for fresh room look.
  // ============================================================
  resetRoom() {
    this.enemies         = [];
    this.projectiles     = [];
    this.goldDrops       = [];
    this.consumableDrops = [];
    this.particles       = [];
    this.hitSparks       = [];
    this.damageNumbers   = [];
    this.kills           = 0;
    this.alive           = 0;
    this.lastSpawn       = 0;
    this.roomEntryTime   = 0;
    this.door            = null;
    this.shopNpc         = null;
    this.bossChest       = null;
    this.boss            = null;
    this.pendingBoonChoices = [];
    this.consumableSystem.reset();
    this.tileMap.regenerate(WORLD_W, WORLD_H);
    // playerConsumables intentionally NOT reset — bag/hotbar persist
  }

  resize(w: number, h: number) {
    this.screenW        = w;
    this.screenH        = h;
    this.camera.screenW = w;
    this.camera.screenH = h;
  }
}