// src/engine/systems/BossSystem.ts
import { Player }                    from "../Player";
import { Camera }                    from "../Camera";
import { Boss }                      from "../enemy/Boss";
import { RoomState }                 from "../RoomManager";
import { GameState }                 from "../GameState";
import { BOSS_WORLD_W, BOSS_WORLD_H } from "../Camera";
import { GoldDrop }                  from "../GoldDrop";
import { spawnBurst }                from "../Particle"; 

// 🧱 Brick 11 — Additional Import
import { WeaponSystem } from "./WeaponSystem";

// ============================================================
// [🧱 BLOCK: Gold Drop Helper]
// ============================================================
const BOSS_GOLD = { min: 80, max: 120 };

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function spawnBossGold(state: GameState, x: number, y: number) {
  const amount = randInt(BOSS_GOLD.min, BOSS_GOLD.max);
  for (let i = 0; i < 5; i++) {
    const ox = (Math.random() - 0.5) * 60;
    const oy = (Math.random() - 0.5) * 60;
    state.goldDrops.push(new GoldDrop(x + ox, y + oy, Math.floor(amount / 5)));
  }
}

// ============================================================
// [🧱 BLOCK: BossSystem Class]
// ============================================================
export class BossSystem {
  // 🧱 Brick 11 — Add weaponSystem field
  private weaponSystem = new WeaponSystem();

  setup(state: GameState, rs: RoomState) {
    state.player.x  = BOSS_WORLD_W / 2;
    state.player.y  = BOSS_WORLD_H - 100;
    state.player.vx = 0;
    state.player.vy = 0;

    state.enemies     = [];
    state.projectiles = [];
    state.goldDrops   = [];
    state.particles   = []; // Ensure clean particles for boss room
    state.kills       = 0;
    state.door        = null;

    state.boss = new Boss(
      BOSS_WORLD_W / 2 - 40,
      80,
      rs.floor
    );

    state.camera.update(state.player, BOSS_WORLD_W, BOSS_WORLD_H);
    state.playerStats.applyToPlayer(state.player);
  }

  reset(state: GameState) {
    state.boss      = null;
    state.goldDrops = [];
    state.particles = [];
  }

  update(
    state:  GameState,
    player: Player,
    worldW: number,
    worldH: number
  ): { event: 'victory' | null; goldCollected: number } {
    const boss = state.boss;
    if (!boss) return { event: null, goldCollected: 0 };

    const ps = state.playerStats;

    boss.update(player, worldW, worldH);

    // ── Boss contact damage ─────────────────────────────────
    if (boss.isCollidingWithPlayer(player) && player.iFrames <= 0) {
      const final = Math.round(boss.contactDamage * (1 - ps.damageReduction));
      player.takeHit(final);
      boss.damageCooldown = 800; 
    }

    // ── Boss slam AoE damage ────────────────────────────────
    if (boss.isSlamHittingPlayer(player) && player.iFrames <= 0) {
      const final = Math.round(boss.slamDamage * (1 - ps.damageReduction));
      player.takeHit(final);
    }

    // 🧱 Brick 11 — Replace old player attack block
    // ── Process weapon input ─────────────────────────────────
    this.weaponSystem.processInput(player);

    // ── Resolve weapon hits vs boss ──────────────────────────
    this.weaponSystem.resolveHitBoss(player, boss, ps.atkBonus);

    // ── Stamina regen ───────────────────────────────────────
    if (player.stamina < player.maxStamina) {
      player.stamina = Math.min(
        player.maxStamina,
        player.stamina + ps.staminaRegenRate
      );
    }

    // ── Gold collection from drops ──────────────────────────
    let goldCollected = 0;
    state.goldDrops.forEach((drop) => {
      const was = drop.collected;
      drop.update(player);
      if (!was && drop.collected) goldCollected += drop.amount;
    });
    state.goldDrops = state.goldDrops.filter((d) => !d.collected);

    // ── Boss death ──────────────────────────────────────────
    if (boss.isDead) {
      const bx = boss.x + boss.width  / 2;
      const by = boss.y + boss.height / 2;
      spawnBossGold(state, bx, by);
      
      // Big burst for boss — 12 particles, larger size/speed
      state.particles.push(...spawnBurst(bx, by, "#dc2626", 12, 1.8));
      
      return { event: 'victory', goldCollected };
    }

    return { event: null, goldCollected };
  }

  // 🧱 Brick 11 — Update draw signature and add weapon draw call
  draw(state: GameState, ctx: CanvasRenderingContext2D, camera: Camera, player: Player) {
    state.boss?.draw(ctx, camera);
    state.goldDrops.forEach((drop) => drop.draw(ctx, camera));

    // Update + draw particles
    state.particles.forEach((p) => p.update());
    state.particles = state.particles.filter((p) => !p.isDone);
    state.particles.forEach((p) => p.draw(ctx, camera));

    // Draw weapon attack visual
    this.weaponSystem.draw(ctx, player, camera);
  }
}