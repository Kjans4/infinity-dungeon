// src/engine/systems/HordeSystem.ts
import { Player }                          from "../Player";
import { Camera }                          from "../Camera";
import { Door }                            from "../Door";
import { Grunt, Shooter, Tank, spawnWave } from "../enemy";
import { RoomState }                       from "../RoomManager";
import { GameState }                       from "../GameState";
import { GoldSystem }                      from "./GoldSystem";
import { WeaponSystem }                    from "./WeaponSystem";
import { spawnBurst }                      from "../Particle";

const INITIAL_WAVE          = 8;
const WAVE_SIZE             = 6;
const BASE_THRESHOLD        = 20;   // Floor 1 kill threshold
const THRESHOLD_PER_FLOOR   = 5;    // +5 kills required per floor
const FARMING_SPAWN_INTERVAL= 3000; // ms between single enemy spawns after threshold

// ============================================================
// [🧱 BLOCK: Gold Multiplier After Threshold]
// Progressive diminishing returns on bonus kills.
// Every 10 extra kills reduces gold by 20%, floored at 20%.
// ============================================================
function goldMultiplierForKills(kills: number, threshold: number): number {
  if (kills < threshold) return 1.0;
  const extraKills = kills - threshold;
  const tier       = Math.floor(extraKills / 10);
  return Math.max(0.20, 1.0 - tier * 0.20);
}

export class HordeSystem {
  private goldSystem   = new GoldSystem();
  private weaponSystem = new WeaponSystem();

  // ============================================================
  // [🧱 BLOCK: Threshold Helper]
  // Dynamic per floor. Used by GameCanvas for HUD and dev tools.
  // ============================================================
  getThreshold(floor: number): number {
    return BASE_THRESHOLD + (floor - 1) * THRESHOLD_PER_FLOOR;
  }

  // Backwards-compat getter — returns Floor 1 threshold.
  // GameCanvas should prefer getThreshold(floor) where possible.
  get killThreshold(): number {
    return BASE_THRESHOLD;
  }

  // ============================================================
  // [🧱 BLOCK: Setup]
  // HP not reset — carries over from previous room.
  // ============================================================
  setup(state: GameState, rs: RoomState, worldW: number, worldH: number) {
    state.player.x  = worldW / 2;
    state.player.y  = worldH - 100;
    state.player.vx = 0;
    state.player.vy = 0;

    state.kills       = 0;
    state.alive       = INITIAL_WAVE;
    state.lastSpawn   = 0;
    state.projectiles = [];
    state.goldDrops   = [];
    state.particles   = [];
    state.boss        = null;

    state.enemies = spawnWave(
      INITIAL_WAVE, worldW, worldH,
      rs.roomInCycle, rs.floor
    );

    state.door          = new Door(worldW);
    state.door.isActive = false;

    state.camera.update(state.player, worldW, worldH);
    state.playerStats.applyToPlayer(state.player);
  }

  // ============================================================
  // [🧱 BLOCK: Reset]
  // ============================================================
  reset(state: GameState) {
    state.enemies     = [];
    state.projectiles = [];
    state.goldDrops   = [];
    state.particles   = [];
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
  ): { event: "door" | null; goldCollected: number } {
    const ps        = state.playerStats;
    const threshold = this.getThreshold(rs.floor);
    const thresholdMet = state.kills >= threshold;

    // ── Door ───────────────────────────────────────────────
    if (state.door) {
      state.door.update();
      if (thresholdMet && !state.door.isActive) {
        state.door.activate();
      }
      if (state.door.isCollidingWithPlayer(player)) {
        return { event: "door", goldCollected: 0 };
      }
    }

    // ── Enemy update + projectile collection + melee hits ──
    state.enemies.forEach((enemy) => {
      enemy.update(player, worldW, worldH);

      if (enemy instanceof Shooter && enemy.pendingProjectiles.length > 0) {
        state.projectiles.push(...enemy.pendingProjectiles);
        enemy.pendingProjectiles = [];
      }

      if (enemy.isMeleeHittingPlayer(player) && player.iFrames <= 0) {
        if (enemy instanceof Tank) {
          const finalDmg = Math.round(enemy.meleeDamage * (1 - ps.damageReduction));
          player.takeHit(finalDmg);
          enemy.applyKnockback(player);
        } else if (enemy instanceof Shooter) {
          const finalDmg = Math.round(8 * (1 - ps.damageReduction));
          player.takeHit(finalDmg);
        } else {
          const finalDmg = Math.round(15 * (1 - ps.damageReduction));
          player.takeHit(finalDmg);
        }
      }
    });

    // ── Weapon input + hit resolution ─────────────────────
    this.weaponSystem.processInput(player);

    const playerCX = player.x + player.width  / 2;
    const playerCY = player.y + player.height / 2;
    const isHeavy  = player.attackType === "heavy";

    const hitEnemies = this.weaponSystem.resolveHitsCustom(
      player,
      state.enemies,
      ps.atkBonus,
      (enemy, amount) => {
        if (enemy instanceof Tank) {
          enemy.takeDamageFrom(amount, playerCX, playerCY, isHeavy);
        } else {
          enemy.takeDamage(amount);
        }
      }
    );

    // Executioner charm shockwave
    if (isHeavy && ps.hasCharm("executioner")) {
      hitEnemies.forEach((enemy) => {
        if (enemy.isDead) {
          this.triggerShockwave(
            state,
            enemy.x + enemy.width  / 2,
            enemy.y + enemy.height / 2,
            25
          );
        }
      });
    }

    // ── Kill tracking ─────────────────────────────────────
    const before      = state.enemies.length;
    const deadEnemies = state.enemies.filter((e) => e.isDead);
    state.enemies     = state.enemies.filter((e) => !e.isDead);
    const justKilled  = before - state.enemies.length;

    if (justKilled > 0) {
      state.kills += justKilled;
      state.alive -= justKilled;

      deadEnemies.forEach((enemy) => {
        const type =
          enemy instanceof Tank    ? "tank"    :
          enemy instanceof Shooter ? "shooter" :
                                     "grunt";

        // Apply diminishing gold multiplier for kills beyond threshold
        const multiplier = goldMultiplierForKills(state.kills, threshold);

        this.goldSystem.spawnFromEnemy(
          state,
          enemy.x + enemy.width  / 2,
          enemy.y + enemy.height / 2,
          type,
          multiplier
        );

        state.particles.push(...spawnBurst(
          enemy.x + enemy.width  / 2,
          enemy.y + enemy.height / 2,
          enemy.color, 6
        ));

        ps.charms.forEach((charm) => charm.onKill?.(player, ps.modifiers));
        if (ps.healOnKill > 0) {
          player.hp = Math.min(player.maxHp, player.hp + ps.healOnKill);
        }
      });
    }

    // ── Wave spawning ─────────────────────────────────────
    const now = Date.now();

    if (!thresholdMet) {
      // Before threshold: batch spawning — fill up when alive === 0
      const killsLeft = threshold - state.kills;
      if (killsLeft > 0 && state.alive === 0 && now - state.lastSpawn > 1000) {
        const spawnCount = Math.min(WAVE_SIZE, killsLeft);
        const newWave    = spawnWave(spawnCount, worldW, worldH, rs.roomInCycle, rs.floor);
        state.enemies.push(...newWave);
        state.alive     = spawnCount;
        state.lastSpawn = now;
      }
    } else {
      // After threshold: trickle spawn — 1 enemy every 3000ms indefinitely
      // Gives the player a safer farming window while keeping pressure alive
      if (now - state.lastSpawn > FARMING_SPAWN_INTERVAL) {
        const [newEnemy] = spawnWave(1, worldW, worldH, rs.roomInCycle, rs.floor);
        state.enemies.push(newEnemy);
        state.alive    += 1;
        state.lastSpawn = now;
      }
    }

    // ── Projectiles ───────────────────────────────────────
    state.projectiles.forEach((proj) => {
      proj.update();
      if (proj.isHittingPlayer(player) && player.iFrames <= 0) {
        const finalDmg = Math.round(proj.damage * (1 - ps.damageReduction));
        player.takeHit(finalDmg);
        proj.isDone = true;
      }
    });
    state.projectiles = state.projectiles.filter((p) => !p.isDone);

    // ── Stamina regen ─────────────────────────────────────
    if (player.stamina < player.maxStamina) {
      player.stamina = Math.min(
        player.maxStamina,
        player.stamina + ps.staminaRegenRate
      );
    }

    const goldCollected = this.goldSystem.update(state, player);
    return { event: null, goldCollected };
  }

  // ============================================================
  // [🧱 BLOCK: Shockwave]
  // ============================================================
  private triggerShockwave(
    state:  GameState,
    cx:     number,
    cy:     number,
    damage: number
  ) {
    state.enemies.forEach((enemy) => {
      if (enemy.isDead) return;
      const ex   = enemy.x + enemy.width  / 2;
      const ey   = enemy.y + enemy.height / 2;
      const dist = Math.sqrt((cx - ex) ** 2 + (cy - ey) ** 2);
      if (dist < 100) enemy.takeDamage(damage);
    });
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
    state.door?.draw(ctx, camera);
    state.enemies.forEach((e)     => e.draw(ctx, camera));
    state.projectiles.forEach((p) => p.draw(ctx, camera));
    this.goldSystem.draw(state, ctx, camera);
    state.particles.forEach((p)   => p.update());
    state.particles = state.particles.filter((p) => !p.isDone);
    state.particles.forEach((p)   => p.draw(ctx, camera));
    this.weaponSystem.draw(ctx, player, camera);
  }
}