// src/engine/GameState.ts
import { Player }      from "./Player";
import { Camera, WORLD_W, WORLD_H } from "./Camera";
import { Door }        from "./Door";
import { GoldDrop }    from "./GoldDrop";
import { Particle }    from "./Particle";
import { PlayerStats } from "./PlayerStats";
import { Grunt, Shooter, Tank, Boss, Projectile } from "./enemy";

export class GameState {
  // Entities
  player:      Player;
  camera:      Camera;
  enemies:     (Grunt | Shooter | Tank)[];
  boss:        Boss | null;
  door:        Door | null;
  projectiles: Projectile[];
  goldDrops:   GoldDrop[];
  particles:   Particle[];

  // Economy
  gold:            number;
  playerStats:     PlayerStats;

  // Horde tracking (resets per room)
  kills:     number;
  alive:     number;
  lastSpawn: number;

  // ── Run-wide stats (never reset mid-run) ──────────────────
  // Used for the death screen summary.
  totalKills:      number;  // cumulative kills across all rooms
  totalGoldEarned: number;  // lifetime gold collected (not current balance)
  runStartTime:    number;  // Date.now() when the run started

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
    this.projectiles = [];
    this.goldDrops   = [];
    this.particles   = [];

    this.gold            = 0;
    this.playerStats     = new PlayerStats();

    this.kills     = 0;
    this.alive     = 0;
    this.lastSpawn = 0;

    this.totalKills      = 0;
    this.totalGoldEarned = 0;
    this.runStartTime    = Date.now();

    this.playerStats.applyToPlayer(this.player);
  }

  // Full reset — also resets run-wide stats
  reset() {
    this.enemies     = [];
    this.boss        = null;
    this.door        = null;
    this.projectiles = [];
    this.goldDrops   = [];
    this.particles   = [];
    this.gold        = 0;
    this.kills       = 0;
    this.alive       = 0;
    this.lastSpawn   = 0;

    this.totalKills      = 0;
    this.totalGoldEarned = 0;
    this.runStartTime    = Date.now();

    this.player      = new Player(WORLD_W / 2, WORLD_H / 2);
    this.camera      = new Camera(this.screenW, this.screenH);
    this.playerStats = new PlayerStats();
    this.playerStats.applyToPlayer(this.player);
  }

  // Room reset — keeps run-wide stats intact
  resetRoom() {
    this.enemies     = [];
    this.projectiles = [];
    this.goldDrops   = [];
    this.particles   = [];
    this.kills       = 0;
    this.alive       = 0;
    this.lastSpawn   = 0;
    this.door        = null;
    this.boss        = null;
  }

  resize(w: number, h: number) {
    this.screenW        = w;
    this.screenH        = h;
    this.camera.screenW = w;
    this.camera.screenH = h;
  }
}