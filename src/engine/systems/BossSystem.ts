// src/engine/systems/BossSystem.ts
import { Player }    from "../Player";
import { Camera }    from "../Camera";
import { Boss }      from "../enemy";
import { RoomState } from "../RoomManager";
import { GameState } from "../GameState";
import { BOSS_WORLD_W, BOSS_WORLD_H } from "../Camera";
import { GoldSystem } from "./GoldSystem";

// ============================================================
// [🧱 BLOCK: BossSystem Class]
// ============================================================
export class BossSystem {
  private goldSystem = new GoldSystem();

  // ============================================================
  // [🧱 BLOCK: Setup]
  // ============================================================
  setup(state: GameState, rs: RoomState) {
    state.player.x  = BOSS_WORLD_W / 2;
    state.player.y  = BOSS_WORLD_H - 100;
    state.player.vx = 0;
    state.player.vy = 0;

    state.enemies     = [];
    state.projectiles = [];
    state.goldDrops   = [];
    state.kills       = 0;
    state.door        = null;

    state.boss = new Boss(BOSS_WORLD_W / 2 - 40, 80, rs.floor);
    state.camera.update(state.player, BOSS_WORLD_W, BOSS_WORLD_H);

    // Re-apply stats
    state.playerStats.applyToPlayer(state.player);
  }

  // ============================================================
  // [🧱 BLOCK: Reset]
  // ============================================================
  reset(state: GameState) {
    state.boss      = null;
    state.goldDrops = [];
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // Returns 'victory' when boss is defeated + gold collected.
  // ============================================================
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
    if (boss.isCollidingWithPlayer(player)) {
      const rawDmg   = boss.contactDamage;
      const finalDmg = Math.round(rawDmg * (1 - ps.damageReduction));
      player.hp           = Math.max(0, player.hp - finalDmg);
      boss.damageCooldown = 800;
    }

    // ── Boss slam AoE damage ────────────────────────────────
    if (boss.isSlamHittingPlayer(player)) {
      const rawDmg   = boss.slamDamage;
      const finalDmg = Math.round(rawDmg * (1 - ps.damageReduction));
      player.hp = Math.max(0, player.hp - finalDmg);
    }

    // ── Player attack vs boss ───────────────────────────────
    if (player.isAttacking) {
      const range   = player.attackType === "light" ? 35 : 55;
      const radius  = player.attackType === "light" ? 15 : 25;
      const baseDmg = player.attackType === "light" ? 10 : 25;
      const damage  = baseDmg + ps.atkBonus;

      const lastStand = ps.hasCharm('last_stand') && player.hp / player.maxHp < 0.25;
      const finalDmg  = damage + (lastStand ? 15 : 0);

      const cx = (player.x + player.width  / 2) + player.facing.x * range;
      const cy = (player.y + player.height / 2) + player.facing.y * range;
      const nx = Math.max(boss.x, Math.min(cx, boss.x + boss.width));
      const ny = Math.max(boss.y, Math.min(cy, boss.y + boss.height));

      if ((cx - nx) ** 2 + (cy - ny) ** 2 < radius * radius) {
        boss.takeDamage(finalDmg);
      }
    }

    // ── Stamina regen ───────────────────────────────────────
    if (player.stamina < player.maxStamina) {
      player.stamina = Math.min(
        player.maxStamina,
        player.stamina + ps.staminaRegenRate
      );
    }

    // ── Gold collection ─────────────────────────────────────
    const goldCollected = this.goldSystem.update(state, player);

    // ── Boss death ──────────────────────────────────────────
    if (boss.isDead) {
      this.goldSystem.spawnFromEnemy(
        state,
        boss.x + boss.width  / 2,
        boss.y + boss.height / 2,
        'boss'
      );
      return { event: 'victory', goldCollected };
    }

    return { event: null, goldCollected };
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // ============================================================
  draw(state: GameState, ctx: CanvasRenderingContext2D, camera: Camera) {
    state.boss?.draw(ctx, camera);
    this.goldSystem.draw(state, ctx, camera);
  }
}