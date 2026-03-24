// src/engine/systems/HordeSystem.ts
import { Player } from "../Player";
import { Camera } from "../Camera";
import { Door } from "../Door";
import { Grunt, Shooter, spawnWave, Projectile } from "../enemy";
import { RoomState } from "../RoomManager";
import { GameState } from "../GameState";

// ============================================================
// [🧱 BLOCK: HordeSystem Config]
// ============================================================
const KILL_THRESHOLD = 20;
const INITIAL_WAVE   = 8;
const WAVE_SIZE      = 6;

// ============================================================
// [🧱 BLOCK: HordeSystem Class]
// Owns all horde-phase logic:
//   - Enemy update + attack collision
//   - Player attack vs enemies
//   - Kill tracking + wave respawn
//   - Projectile update + collision
//   - Door activation
// ============================================================
export class HordeSystem {
  readonly killThreshold = KILL_THRESHOLD;

  // ============================================================
  // [🧱 BLOCK: Setup]
  // Called at the start of every horde room.
  // ============================================================
  setup(state: GameState, rs: RoomState, worldW: number, worldH: number) {
    const sp = { x: worldW / 2, y: worldH - 100 };

    state.player.x  = sp.x;
    state.player.y  = sp.y;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.hp = 100;

    state.kills       = 0;
    state.alive       = INITIAL_WAVE;
    state.lastSpawn   = 0;
    state.projectiles = [];
    state.boss        = null;

    state.enemies = spawnWave(
      INITIAL_WAVE, worldW, worldH,
      rs.roomInCycle, rs.floor
    );

    state.door            = new Door(worldW);
    state.door.isActive   = false;

    state.camera.update(state.player, worldW, worldH);
  }

  // ============================================================
  // [🧱 BLOCK: Reset]
  // Called on full game restart.
  // ============================================================
  reset(state: GameState) {
    state.enemies     = [];
    state.projectiles = [];
    state.door        = null;
    state.kills       = 0;
    state.alive       = 0;
    state.lastSpawn   = 0;
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // Main entry point — called every frame during horde phase.
  // Returns 'door' if player entered the door this frame.
  // ============================================================
  update(
    state:  GameState,
    player: Player,
    rs:     RoomState,
    worldW: number,
    worldH: number
  ): 'door' | null {

    // ── Door ────────────────────────────────────────────────
    if (state.door) {
      state.door.update();

      if (state.kills >= KILL_THRESHOLD && !state.door.isActive) {
        state.door.activate();
      }

      if (state.door.isCollidingWithPlayer(player)) {
        return 'door';
      }
    }

    // ── Enemy Update + Melee Hits ───────────────────────────
    state.enemies.forEach((enemy) => {
      enemy.update(player, worldW, worldH);

      // Collect projectiles fired this frame
      if (enemy.pendingProjectile) {
        state.projectiles.push(enemy.pendingProjectile);
        enemy.pendingProjectile = null;
      }

      // Melee hit check
      if (enemy.isMeleeHittingPlayer(player)) {
        const dmg  = enemy instanceof Shooter ? 8 : 15;
        player.hp  = Math.max(0, player.hp - dmg);
      }
    });

    // ── Player Attack vs Enemies ────────────────────────────
    if (player.isAttacking) {
      const range  = player.attackType === "light" ? 35 : 55;
      const radius = player.attackType === "light" ? 15 : 25;
      const damage = player.attackType === "light" ? 10 : 25;
      const cx     = (player.x + player.width  / 2) + player.facing.x * range;
      const cy     = (player.y + player.height / 2) + player.facing.y * range;

      state.enemies.forEach((enemy) => {
        if (enemy.isDead) return;
        const nx = Math.max(enemy.x, Math.min(cx, enemy.x + enemy.width));
        const ny = Math.max(enemy.y, Math.min(cy, enemy.y + enemy.height));
        if ((cx - nx) ** 2 + (cy - ny) ** 2 < radius * radius) {
          enemy.takeDamage(damage);
        }
      });
    }

    // ── Kill Tracking ───────────────────────────────────────
    const before       = state.enemies.length;
    state.enemies      = state.enemies.filter((e) => !e.isDead);
    const justKilled   = before - state.enemies.length;

    if (justKilled > 0) {
      state.kills += justKilled;
      state.alive -= justKilled;
    }

    // ── Wave Respawn ────────────────────────────────────────
    const killsLeft = KILL_THRESHOLD - state.kills;
    if (
      killsLeft > 0 &&
      state.alive === 0 &&
      Date.now() - state.lastSpawn > 1000
    ) {
      const spawnCount  = Math.min(WAVE_SIZE, killsLeft);
      const newWave     = spawnWave(spawnCount, worldW, worldH, rs.roomInCycle, rs.floor);
      state.enemies.push(...newWave);
      state.alive       = spawnCount;
      state.lastSpawn   = Date.now();
    }

    // ── Projectile Update + Collision ───────────────────────
    state.projectiles.forEach((proj) => {
      proj.update();
      if (proj.isHittingPlayer(player)) {
        player.hp   = Math.max(0, player.hp - proj.damage);
        proj.isDone = true;
      }
    });
    state.projectiles = state.projectiles.filter((p) => !p.isDone);

    return null;
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // Draws all horde entities — door, enemies, projectiles.
  // ============================================================
  draw(state: GameState, ctx: CanvasRenderingContext2D, camera: Camera) {
    state.door?.draw(ctx, camera);
    state.enemies.forEach((e)     => e.draw(ctx, camera));
    state.projectiles.forEach((p) => p.draw(ctx, camera));
  }
}