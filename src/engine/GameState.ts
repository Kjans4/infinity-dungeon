// src/engine/GameState.ts
import { Player }      from "./Player";
import { Camera, WORLD_W, WORLD_H } from "./Camera";
import { Door }        from "./Door";
import { GoldDrop }    from "./GoldDrop";
import { ItemDrop }    from "./ItemDrop";
import { ShopNPC }     from "./ShopNPC";
import { Particle }    from "./Particle";
import { PlayerStats } from "./PlayerStats";
import { ShopItem }    from "./items/ItemPool";
import { Grunt, Shooter, Tank, Boss, Projectile } from "./enemy";

// ============================================================
// [🧱 BLOCK: Pending Loot Cap]
// Max items the player can hold between killing enemies and
// visiting the NPC/shop to claim them.
// ============================================================
export const PENDING_LOOT_CAP = 3;

export class GameState {
  // Entities
  player:      Player;
  camera:      Camera;
  enemies:     (Grunt | Shooter | Tank)[];
  boss:        Boss | null;
  door:        Door | null;
  shopNpc:     ShopNPC | null;
  projectiles: Projectile[];
  goldDrops:   GoldDrop[];
  itemDrops:   ItemDrop[];
  particles:   Particle[];

  // Economy
  gold:            number;
  playerStats:     PlayerStats;

  // ── Pending loot — items dropped in world, not yet claimed ──
  // Capped at PENDING_LOOT_CAP. Claimed for free in the shop.
  pendingLoot: ShopItem[];

  // Horde tracking (resets per room)
  kills:         number;
  alive:         number;
  lastSpawn:     number;
  roomEntryTime: number; // Date.now() when the room was entered — used for grace period

  // ── Run-wide stats (never reset mid-run) ──────────────────
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

    this.gold            = 0;
    this.playerStats     = new PlayerStats();
    this.pendingLoot     = [];

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
  // Also resets run-wide stats and loot.
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
    this.pendingLoot = [];

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
  // Keeps run-wide stats, pending loot, and playerStats intact.
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