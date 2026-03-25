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
// GameCanvas holds one ref to this — no more scattered refs.
// ============================================================
export class GameState {
  // ── Entities ───────────────────────────────────────────────
  player:      Player;
  camera:      Camera;
  enemies:     (Grunt | Shooter)[];
  boss:        Boss | null;
  door:        Door | null;
  projectiles: Projectile[];
  goldDrops:   GoldDrop[];

  // ── Economy ────────────────────────────────────────────────
  gold:        number;
  playerStats: PlayerStats;

  // ── Horde Tracking ─────────────────────────────────────────
  kills:     number;
  alive:     number;
  lastSpawn: number;

  // ── Screen Size ────────────────────────────────────────────
  screenW: number;
  screenH: number;

  // ============================================================
  // [🧱 BLOCK: Constructor]
  // Everything initialized here explicitly — no field
  // initializers. This avoids Turbopack module resolution
  // timing issues where `= new PlayerStats()` as a class
  // field can run before its module is fully loaded.
  // ============================================================
  constructor(screenW: number, screenH: number) {
    this.screenW = screenW;
    this.screenH = screenH;

    // Entities
    this.player      = new Player(WORLD_W / 2, WORLD_H / 2);
    this.camera      = new Camera(screenW, screenH);
    this.enemies     = [];
    this.boss        = null;
    this.door        = null;
    this.projectiles = [];
    this.goldDrops   = [];

    // Economy — created here so module is guaranteed loaded
    this.gold        = 0;
    this.playerStats = new PlayerStats();

    // Horde counters
    this.kills     = 0;
    this.alive     = 0;
    this.lastSpawn = 0;

    // Apply default stats immediately
    this.playerStats.applyToPlayer(this.player);
  }

  // ============================================================
  // [🧱 BLOCK: Full Reset]
  // Wipes everything on game restart.
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

    // Always a fresh instance — never reuse
    this.playerStats = new PlayerStats();
    this.playerStats.applyToPlayer(this.player);
  }

  // ============================================================
  // [🧱 BLOCK: Room Reset]
  // Wipes room entities but keeps gold, stats and charms.
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