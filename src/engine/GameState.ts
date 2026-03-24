// src/engine/GameState.ts
import { Player } from "./Player";
import { Camera, WORLD_W, WORLD_H } from "./Camera";
import { Door } from "./Door";
import { Grunt, Shooter, Boss, Projectile } from "./enemy";

// ============================================================
// [🧱 BLOCK: GameState Class]
// Single source of truth for all engine state.
// GameCanvas holds one ref to this — no more 15 scattered refs.
// ============================================================
export class GameState {
  // ── Entities ───────────────────────────────────────────────
  player:      Player;
  camera:      Camera;
  enemies:     (Grunt | Shooter)[] = [];
  boss:        Boss | null         = null;
  door:        Door | null         = null;
  projectiles: Projectile[]        = [];

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
  // [🧱 BLOCK: Reset]
  // Called on restart — wipes all entities and counters.
  // ============================================================
  reset() {
    this.enemies     = [];
    this.boss        = null;
    this.door        = null;
    this.projectiles = [];
    this.kills       = 0;
    this.alive       = 0;
    this.lastSpawn   = 0;
    this.player      = new Player(WORLD_W / 2, WORLD_H / 2);
    this.camera      = new Camera(this.screenW, this.screenH);
  }

  // ============================================================
  // [🧱 BLOCK: Resize]
  // Called by window resize handler.
  // ============================================================
  resize(w: number, h: number) {
    this.screenW          = w;
    this.screenH          = h;
    this.camera.screenW   = w;
    this.camera.screenH   = h;
  }
}