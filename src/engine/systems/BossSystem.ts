// src/engine/systems/BossSystem.ts
import { Player }                    from "../Player";
import { Camera }                    from "../Camera";
import { Boss }                      from "../enemy/Boss";
import { RoomState }                 from "../RoomManager";
import { GameState }                 from "../GameState";
import { BOSS_WORLD_W, BOSS_WORLD_H } from "../Camera";
import { GoldDrop }                  from "../GoldDrop";

// ============================================================
// [🧱 BLOCK: Gold Drop Helper]
// Inlined here to avoid the GoldSystem import issue.
// BossSystem only needs to spawn gold — not manage the full
// collection/update loop (that lives in HordeSystem).
// ============================================================
const BOSS_GOLD = { min: 80, max: 120 };

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function spawnBossGold(state: GameState, x: number, y: number) {
  const amount = randInt(BOSS_GOLD.min, BOSS_GOLD.max);
  // Scatter a few coins around the boss death position
  for (let i = 0; i < 5; i++) {
    const ox = (Math.random() - 0.5) * 60;
    const oy = (Math.random() - 0.5) * 60;
    state.goldDrops.push(new GoldDrop(x + ox, y + oy, Math.floor(amount / 5)));
  }
}

// ============================================================
// [🧱 BLOCK: BossSystem Class]
// Owns all boss-phase logic:
//   - Boss setup (spawn, player position)
//   - Boss update (state machine runs inside Boss.ts)
//   - Player attack vs boss
//   - Contact + slam damage to player
//   - Gold drops + collection
//   - Death detection
// ============================================================
export class BossSystem {

  // ============================================================
  // [🧱 BLOCK: Setup]
  // Called after shop is dismissed.
  // phase must already be 'boss' before this runs.
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

    state.boss = new Boss(
      BOSS_WORLD_W / 2 - 40,
      80,
      rs.floor
    );

    state.camera.update(state.player, BOSS_WORLD_W, BOSS_WORLD_H);

    // Re-apply stats so charm/stat bonuses carry into boss room
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
  // Returns 'victory' when boss is defeated, null otherwise.
  // Also returns gold collected this frame.
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
      const raw      = boss.contactDamage;
      const final    = Math.round(raw * (1 - ps.damageReduction));
      player.hp      = Math.max(0, player.hp - final);
      boss.damageCooldown = 800;
    }

    // ── Boss slam AoE damage ────────────────────────────────
    if (boss.isSlamHittingPlayer(player)) {
      const raw   = boss.slamDamage;
      const final = Math.round(raw * (1 - ps.damageReduction));
      player.hp   = Math.max(0, player.hp - final);
    }

    // ── Player attack vs boss ───────────────────────────────
    if (player.isAttacking) {
      const range   = player.attackType === "light" ? 35 : 55;
      const radius  = player.attackType === "light" ? 15 : 25;
      const baseDmg = player.attackType === "light" ? 10 : 25;
      const damage  = baseDmg + ps.atkBonus;

      const lastStand = ps.hasCharm('last_stand') && player.hp / (player.maxHp ?? 100) < 0.25;
      const finalDmg   = damage + (lastStand ? 15 : 0);

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
      spawnBossGold(
        state,
        boss.x + boss.width  / 2,
        boss.y + boss.height / 2
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

    // Draw any lingering gold drops
    state.goldDrops.forEach((drop) => drop.draw(ctx, camera));
  }
}