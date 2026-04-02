// src/engine/systems/BossSystem.ts
import { Player }                     from "../Player";
import { Camera }                     from "../Camera";
import { Boss }                       from "../enemy/Boss";
import { RoomState }                  from "../RoomManager";
import { GameState }                  from "../GameState";
import { BOSS_WORLD_W, BOSS_WORLD_H } from "../Camera";
import { GoldDrop }                   from "../GoldDrop";
import { spawnBurst }                 from "../Particle";
import { WeaponSystem }               from "./WeaponSystem";

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

export class BossSystem {
  private weaponSystem = new WeaponSystem();

  // ============================================================
  // [🧱 BLOCK: Setup]
  // NOTE: player.hp is intentionally NOT reset here.
  // Whatever HP the player had leaving the shop carries into
  // the boss fight. Use the shop's paid healing to prepare.
  // ============================================================
  setup(state: GameState, rs: RoomState) {
    state.player.x  = BOSS_WORLD_W / 2;
    state.player.y  = BOSS_WORLD_H - 100;
    state.player.vx = 0;
    state.player.vy = 0;
    // ── state.player.hp = state.player.maxHp  ← REMOVED intentionally ──

    state.enemies     = [];
    state.projectiles = [];
    state.goldDrops   = [];
    state.particles   = [];
    state.kills       = 0;
    state.door        = null;

    state.boss = new Boss(BOSS_WORLD_W / 2 - 40, 80, rs.floor);
    state.camera.update(state.player, BOSS_WORLD_W, BOSS_WORLD_H);
    state.playerStats.applyToPlayer(state.player);
  }

  // ============================================================
  // [🧱 BLOCK: Reset]
  // ============================================================
  reset(state: GameState) {
    state.boss        = null;
    state.goldDrops   = [];
    state.particles   = [];
    state.projectiles = [];
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // Returns event: "victory" | "enraged" | null
  // "enraged" fires once when boss drops to ≤50% HP —
  // GameCanvas uses it to announce + trigger screen shake.
  // ============================================================
  update(
    state:  GameState,
    player: Player,
    worldW: number,
    worldH: number
  ): { event: "victory" | "enraged" | null; goldCollected: number } {
    const boss = state.boss;
    if (!boss) return { event: null, goldCollected: 0 };

    const ps = state.playerStats;
    boss.update(player, worldW, worldH);

    // ── Drain boss projectiles ────────────────────────────
    if (boss.pendingProjectiles.length > 0) {
      state.projectiles.push(...boss.pendingProjectiles);
      boss.pendingProjectiles = [];
    }

    // ── Projectile hits on player ─────────────────────────
    state.projectiles.forEach((proj) => {
      proj.update();
      if (proj.isHittingPlayer(player) && player.iFrames <= 0) {
        const finalDmg = Math.round(proj.damage * (1 - ps.damageReduction));
        player.takeHit(finalDmg);
        proj.isDone = true;
      }
    });
    state.projectiles = state.projectiles.filter((p) => !p.isDone);

    // ── Boss contact damage ───────────────────────────────
    if (boss.isCollidingWithPlayer(player) && player.iFrames <= 0) {
      const final = Math.round(boss.contactDamage * (1 - ps.damageReduction));
      player.takeHit(final);
      boss.damageCooldown = 800;
    }

    // ── Boss slam AoE (slam 1 + slam 2) ──────────────────
    if (boss.isSlamHittingPlayer(player) && player.iFrames <= 0) {
      const final = Math.round(boss.slamDamage * (1 - ps.damageReduction));
      player.takeHit(final);
    }

    // ── Weapon input + hit vs boss ────────────────────────
    this.weaponSystem.processInput(player);
    this.weaponSystem.resolveHitBoss(player, boss, ps.atkBonus);

    // ── Stamina regen ─────────────────────────────────────
    if (player.stamina < player.maxStamina) {
      player.stamina = Math.min(
        player.maxStamina,
        player.stamina + ps.staminaRegenRate
      );
    }

    // ── Gold collection ───────────────────────────────────
    let goldCollected = 0;
    state.goldDrops.forEach((drop) => {
      const was = drop.collected;
      drop.update(player);
      if (!was && drop.collected) goldCollected += drop.amount;
    });
    state.goldDrops = state.goldDrops.filter((d) => !d.collected);

    // ── Enrage event (one-frame flag) ─────────────────────
    if (boss.justEnragedThisFrame) {
      return { event: "enraged", goldCollected };
    }

    // ── Boss death ────────────────────────────────────────
    if (boss.isDead) {
      const bx = boss.x + boss.width  / 2;
      const by = boss.y + boss.height / 2;
      spawnBossGold(state, bx, by);
      state.particles.push(...spawnBurst(bx, by, "#dc2626", 12, 1.8));
      return { event: "victory", goldCollected };
    }

    return { event: null, goldCollected };
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // ============================================================
  draw(
    state:  GameState,
    ctx:    CanvasRenderingContext2D,
    camera: Camera,
    player: Player
  ) {
    state.boss?.draw(ctx, camera);
    state.projectiles.forEach((p) => p.draw(ctx, camera));
    state.goldDrops.forEach((drop) => drop.draw(ctx, camera));
    state.particles.forEach((p)   => p.update());
    state.particles = state.particles.filter((p) => !p.isDone);
    state.particles.forEach((p)   => p.draw(ctx, camera));
    this.weaponSystem.draw(ctx, player, camera);
  }
}