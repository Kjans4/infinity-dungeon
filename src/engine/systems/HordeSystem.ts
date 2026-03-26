// src/engine/systems/HordeSystem.ts
import { Player }    from "../Player";
import { Camera }    from "../Camera";
import { Door }      from "../Door";
import { Grunt, Shooter, spawnWave } from "../enemy";
import { RoomState } from "../RoomManager";
import { GameState } from "../GameState";
import { GoldSystem, GOLD_DROPS } from "./GoldSystem";
import { GoldDrop }  from "../GoldDrop";

// ============================================================
// [🧱 BLOCK: HordeSystem Config]
// ============================================================
const KILL_THRESHOLD = 20;
const INITIAL_WAVE   = 8;
const WAVE_SIZE      = 6;

// ============================================================
// [🧱 BLOCK: HordeSystem Class]
// ============================================================
export class HordeSystem {
  readonly killThreshold = KILL_THRESHOLD;
  private goldSystem     = new GoldSystem();

  // ============================================================
  // [🧱 BLOCK: Setup]
  // ============================================================
  setup(state: GameState, rs: RoomState, worldW: number, worldH: number) {
    state.player.x  = worldW / 2;
    state.player.y  = worldH - 100;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.hp = state.player.maxHp ?? 100;

    state.kills       = 0;
    state.alive       = INITIAL_WAVE;
    state.lastSpawn   = 0;
    state.projectiles = [];
    state.goldDrops   = [];
    state.boss        = null;

    state.enemies = spawnWave(
      INITIAL_WAVE, worldW, worldH,
      rs.roomInCycle, rs.floor
    );

    state.door          = new Door(worldW);
    state.door.isActive = false;

    state.camera.update(state.player, worldW, worldH);

    // Re-apply stats in case charms changed between rooms
    state.playerStats.applyToPlayer(state.player);
  }

  // ============================================================
  // [🧱 BLOCK: Reset]
  // ============================================================
  reset(state: GameState) {
    state.enemies     = [];
    state.projectiles = [];
    state.goldDrops   = [];
    state.door        = null;
    state.kills       = 0;
    state.alive       = 0;
    state.lastSpawn   = 0;
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // ============================================================
  update(
    state:  GameState,
    player: Player,
    rs:     RoomState,
    worldW: number,
    worldH: number
  ): { event: 'door' | null; goldCollected: number } {

    const ps = state.playerStats;

    // ── Door ────────────────────────────────────────────────
    if (state.door) {
      state.door.update();
      if (state.kills >= KILL_THRESHOLD && !state.door.isActive) {
        state.door.activate();
      }
      if (state.door.isCollidingWithPlayer(player)) {
        return { event: 'door', goldCollected: 0 };
      }
    }

    // ── Enemy Update + Melee Hits ───────────────────────────
    state.enemies.forEach((enemy) => {
      enemy.update(player, worldW, worldH);

      if (enemy.pendingProjectile) {
        state.projectiles.push(enemy.pendingProjectile);
        enemy.pendingProjectile = null;
      }

      if (enemy.isMeleeHittingPlayer(player) && player.iFrames <= 0) {
        const rawDmg   = enemy instanceof Shooter ? 8 : 15;
        const finalDmg = Math.round(rawDmg * (1 - ps.damageReduction));
        player.hp      = Math.max(0, player.hp - finalDmg);
        player.iFrames = 600; // 0.6s of invincibility
      }
    });

    // ── Player Attack vs Enemies ────────────────────────────
    if (player.isAttacking) {
      const range   = player.attackType === "light" ? 35 : 55;
      const radius = player.attackType === "light" ? 15 : 25;
      const baseDmg = player.attackType === "light" ? 10 : 25;
      const damage  = baseDmg + ps.atkBonus;

      const lastStand = ps.hasCharm('last_stand') && player.hp / (player.maxHp ?? 100) < 0.25;
      const finalDmg  = damage + (lastStand ? 15 : 0);

      // Use locked facing for heavy so the hitbox matches where
      // the player was aiming when they pressed K
      const dir = (player.attackType === 'heavy' && player.lockedFacing)
        ? player.lockedFacing
        : player.facing;

      const cx = (player.x + player.width  / 2) + dir.x * range;
      const cy = (player.y + player.height / 2) + dir.y * range;

      state.enemies.forEach((enemy) => {
        if (enemy.isDead) return;
        const nx = Math.max(enemy.x, Math.min(cx, enemy.x + enemy.width));
        const ny = Math.max(enemy.y, Math.min(cy, enemy.y + enemy.height));
        if ((cx - nx) ** 2 + (cy - ny) ** 2 < radius * radius) {
          enemy.takeDamage(finalDmg);

          if (
            enemy.isDead &&
            player.attackType === 'heavy' &&
            ps.hasCharm('executioner')
          ) {
            this.triggerShockwave(state, enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 25);
          }
        }
      });
    }

    // ── Kill Tracking + Gold Drops ──────────────────────────
    const before     = state.enemies.length;
    const deadEnemies = state.enemies.filter((e) => e.isDead);
    state.enemies     = state.enemies.filter((e) => !e.isDead);
    const justKilled = before - state.enemies.length;

    if (justKilled > 0) {
      state.kills += justKilled;
      state.alive -= justKilled;

      deadEnemies.forEach((enemy) => {
        const type = enemy instanceof Shooter ? 'shooter' : 'grunt';
        this.goldSystem.spawnFromEnemy(
          state,
          enemy.x + enemy.width  / 2,
          enemy.y + enemy.height / 2,
          type
        );

        ps.charms.forEach((charm) => {
          charm.onKill?.(player, ps.modifiers);
        });

        if (ps.healOnKill > 0) {
          player.hp = Math.min(player.maxHp!, player.hp + ps.healOnKill);
        }
      });
    }

    // ── Wave Respawn ────────────────────────────────────────
    const killsLeft = KILL_THRESHOLD - state.kills;
    if (
      killsLeft > 0 &&
      state.alive === 0 &&
      Date.now() - state.lastSpawn > 1000
    ) {
      const spawnCount = Math.min(WAVE_SIZE, killsLeft);
      const newWave    = spawnWave(spawnCount, worldW, worldH, rs.roomInCycle, rs.floor);
      state.enemies.push(...newWave);
      state.alive      = spawnCount;
      state.lastSpawn = Date.now();
    }

    // ── Projectile Update ───────────────────────────────────
    state.projectiles.forEach((proj) => {
      proj.update();
      if (proj.isHittingPlayer(player) && player.iFrames <= 0) {
        const rawDmg   = proj.damage;
        const finalDmg = Math.round(rawDmg * (1 - ps.damageReduction));
        player.hp      = Math.max(0, player.hp - finalDmg);
        player.iFrames = 400; // 0.4s of invincibility
        proj.isDone    = true;
      }
    });
    state.projectiles = state.projectiles.filter((p) => !p.isDone);

    // ── Stamina Regen ──────────────────────────────────────
    if (player.stamina < player.maxStamina) {
      player.stamina = Math.min(
        player.maxStamina,
        player.stamina + ps.staminaRegenRate
      );
    }

    // ── Gold Collection ─────────────────────────────────────
    const goldCollected = this.goldSystem.update(state, player);

    return { event: null, goldCollected };
  }

  private triggerShockwave(state: GameState, cx: number, cy: number, damage: number) {
    const radius = 100;
    state.enemies.forEach((enemy) => {
      if (enemy.isDead) return;
      const ex   = enemy.x + enemy.width  / 2;
      const ey   = enemy.y + enemy.height / 2;
      const dist = Math.sqrt((cx - ex) ** 2 + (cy - ey) ** 2);
      if (dist < radius) enemy.takeDamage(damage);
    });
  }

  draw(state: GameState, ctx: CanvasRenderingContext2D, camera: Camera) {
    state.door?.draw(ctx, camera);
    state.enemies.forEach((e)     => e.draw(ctx, camera));
    state.projectiles.forEach((p) => p.draw(ctx, camera));
    this.goldSystem.draw(state, ctx, camera);
  }
}