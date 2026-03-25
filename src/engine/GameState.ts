// src/engine/GameState.ts
import { Player }      from "./Player";
import { Camera, WORLD_W, WORLD_H } from "./Camera";
import { Door }        from "./Door";
import { GoldDrop }    from "./GoldDrop";
import { PlayerStats } from "./PlayerStats";
import { Grunt, Shooter, Boss, Projectile } from "./enemy";

// ============================================================
// [🧱 BLOCK: GameState Class]
// Single source of truth for all engine state.
// ============================================================
export class GameState {
  // ── Entities ───────────────────────────────────────────────
  player:      Player;
  camera:      Camera;
  enemies:     (Grunt | Shooter)[] = [];
  boss:        Boss | null         = null;
  door:        Door | null         = null;
  projectiles: Projectile[]        = [];
  goldDrops:   GoldDrop[]          = [];

  // ── Economy ────────────────────────────────────────────────
  gold:        number      = 0;
  playerStats: PlayerStats = new PlayerStats();

  // ── Horde Tracking ─────────────────────────────────────────
  kills:     number = 0;
  alive:     number = 0;
  lastSpawn: number = 0;

  // ── Screen Size ────────────────────────────────────────────
  screenW: number;
  screenH: number;

  constructor(screenW: number, screenH: number) {
    this.screenW = screenW;
    this.screenH = screenH;
    this.player  = new Player(WORLD_W / 2, WORLD_H / 2);
    this.camera  = new Camera(screenW, screenH);
  }

  // ============================================================
  // [🧱 BLOCK: Full Reset]
  // Wipes all entities, economy, and stats on restart.
  // ============================================================
  reset() {
  this.enemies     = [];
  this.boss        = null;
  this.door        = null;
  this.projectiles = [];
  this.goldDrops   = [];
  this.gold        = 0;
  this.kills       = 0;
  this.alive       = 0;
  this.lastSpawn   = 0;

  this.player      = new Player(WORLD_W / 2, WORLD_H / 2);
  this.camera      = new Camera(this.screenW, this.screenH);

  // ✅ Always create a fresh PlayerStats instance
  this.playerStats = new PlayerStats();

  // ✅ Apply immediately so player values are correct from the start
  this.playerStats.applyToPlayer(this.player);
}

  // ============================================================
  // [🧱 BLOCK: Room Reset]
  // Wipes room-specific state between rooms but keeps
  // gold, stats, and charms (they persist across rooms).
  // ============================================================
  resetRoom() {
    this.enemies     = [];
    this.projectiles = [];
    this.goldDrops   = [];
    this.kills       = 0;
    this.alive       = 0;
    this.lastSpawn   = 0;
    this.door        = null;
    this.boss        = null;
  }

  // ============================================================
  // [🧱 BLOCK: Resize]
  // ============================================================
  resize(w: number, h: number) {
    this.screenW        = w;
    this.screenH        = h;
    this.camera.screenW = w;
    this.camera.screenH = h;
  }
}