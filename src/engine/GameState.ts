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
  gold:        number;
  playerStats: PlayerStats;

  // Horde tracking
  kills:     number;
  alive:     number;
  lastSpawn: number;

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

    this.gold        = 0;
    this.playerStats = new PlayerStats();

    this.kills     = 0;
    this.alive     = 0;
    this.lastSpawn = 0;

    this.playerStats.applyToPlayer(this.player);
  }

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

    this.player      = new Player(WORLD_W / 2, WORLD_H / 2);
    this.camera      = new Camera(this.screenW, this.screenH);
    this.playerStats = new PlayerStats();
    this.playerStats.applyToPlayer(this.player);
  }

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