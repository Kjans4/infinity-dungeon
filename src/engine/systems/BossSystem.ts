// src/engine/systems/BossSystem.ts
import { Player } from "../Player";
import { Camera } from "../Camera";
import { Boss } from "../enemy";
import { RoomState } from "../RoomManager";
import { GameState } from "../GameState";
import { BOSS_WORLD_W, BOSS_WORLD_H } from "../Camera";

// ============================================================
// [🧱 BLOCK: BossSystem Class]
// Owns all boss-phase logic:
//   - Boss setup (spawn, player position)
//   - Boss update (state machine runs inside Boss.ts)
//   - Player attack vs boss
//   - Contact + slam damage to player
//   - Death detection
// ============================================================
export class BossSystem {

  // ============================================================
  // [🧱 BLOCK: Setup]
  // Called after shop is dismissed — phase must be 'boss'
  // before this runs (set by enterBossPhase in RoomManager).
  // ============================================================
  setup(state: GameState, rs: RoomState) {
    const sp = { x: BOSS_WORLD_W / 2, y: BOSS_WORLD_H - 100 };

    state.player.x  = sp.x;
    state.player.y  = sp.y;
    state.player.vx = 0;
    state.player.vy = 0;

    state.enemies     = [];
    state.projectiles = [];
    state.kills       = 0;
    state.door        = null;

    // Spawn boss at top-center of the arena
    state.boss = new Boss(
      BOSS_WORLD_W / 2 - 40,
      80,
      rs.floor
    );

    state.camera.update(state.player, BOSS_WORLD_W, BOSS_WORLD_H);
  }

  // ============================================================
  // [🧱 BLOCK: Reset]
  // ============================================================
  reset(state: GameState) {
    state.boss = null;
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // Returns 'victory' when boss is defeated, null otherwise.
  // ============================================================
  update(
    state:  GameState,
    player: Player,
    worldW: number,
    worldH: number
  ): 'victory' | null {
    const boss = state.boss;
    if (!boss) return null;

    boss.update(player, worldW, worldH);

    // ── Boss contact damage ─────────────────────────────────
    if (boss.isCollidingWithPlayer(player)) {
      player.hp           = Math.max(0, player.hp - boss.contactDamage);
      boss.damageCooldown = 800;
    }

    // ── Boss slam AoE damage ────────────────────────────────
    if (boss.isSlamHittingPlayer(player)) {
      player.hp = Math.max(0, player.hp - boss.slamDamage);
    }

    // ── Player attack vs boss ───────────────────────────────
    if (player.isAttacking) {
      const range  = player.attackType === "light" ? 35 : 55;
      const radius = player.attackType === "light" ? 15 : 25;
      const damage = player.attackType === "light" ? 10 : 25;

      const cx = (player.x + player.width  / 2) + player.facing.x * range;
      const cy = (player.y + player.height / 2) + player.facing.y * range;
      const nx = Math.max(boss.x, Math.min(cx, boss.x + boss.width));
      const ny = Math.max(boss.y, Math.min(cy, boss.y + boss.height));

      if ((cx - nx) ** 2 + (cy - ny) ** 2 < radius * radius) {
        boss.takeDamage(damage);
      }
    }

    // ── Death check ─────────────────────────────────────────
    if (boss.isDead) return 'victory';

    return null;
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // ============================================================
  draw(state: GameState, ctx: CanvasRenderingContext2D, camera: Camera) {
    state.boss?.draw(ctx, camera);
  }
}