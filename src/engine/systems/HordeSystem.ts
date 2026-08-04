// src/engine/systems/HordeSystem.ts
import { Player }                               from "../Player";
import { Camera }                               from "../Camera";
import { Door }                                 from "../Door";
import { ShopNPC }                              from "../ShopNPC";
import { ConsumableDrop }                       from "../ConsumableDrop";
import { BaseEnemy }                            from "../enemy/BaseEnemy";
import { Grunt, Shooter, Tank, spawnWave }      from "../enemy";
import { Dasher }                               from "../enemy/Dasher";
import { Bomber }                               from "../enemy/Bomber";
import { spawnEliteWave }                       from "../enemy/spawn";
import { RoomState }                            from "../RoomManager";
import { GameState }                            from "../GameState";
import { GoldSystem }                           from "./GoldSystem";
import { WeaponSystem }                         from "./WeaponSystem";
import { RenderSystem, FREEZE_PRESETS }         from "./RenderSystem";
import { ConsumableSystem }                     from "../ConsumableSystem";
import { spawnBurst, spawnHitSpark, spawnDamageNumber } from "../Particle";
import { getRandomConsumableDrop }              from "../items/ItemPool";
import { circleCircle, rectCenter }             from "../Collision";
import {
  isRendMarked, clearRendMark, REND_BONUS_DAMAGE,
  isRiposteActive, tickRiposte, RIPOSTE_MULT, GLAIVE_EXTRA_COST,
} from "../WeaponPassiveRegistry";
import {
  tryIronWardenReflect,
  applyShadowWalkerFreeze,
  onBloodReaperKill,
  triggerExecutionerShockwave,
  MAX_BOON_LEVEL,
} from "../BoonRegistry";

// ============================================================
// [🧱 BLOCK: Constants]
// ============================================================
const WAVE_SIZE              = 8;
const BASE_THRESHOLD         = 20;
const THRESHOLD_PER_FLOOR    = 5;
const ELITE_THRESHOLD_MULT   = 1.5;
const ELITE_WAVE_MULT        = 1.5;
const GRACE_PERIOD_MS        = 1500;

// ============================================================
// [🧱 BLOCK: Farming Batch Constants]
// After the kill threshold is met, Tanks spawn in batches.
// Each batch must be fully cleared before the next spawns.
// HP and damage scale up each batch to reward staying.
// ============================================================
const FARMING_BATCH_SIZE       = 5;
const FARMING_BATCH_DELAY_MS   = 2000;   // delay before batch 1 spawns
const FARMING_BETWEEN_DELAY_MS = 1500;   // delay between subsequent batches
const FARMING_HP_MULT_PER_BATCH  = 1.40; // ×1.4 HP each batch
const FARMING_DMG_MULT_PER_BATCH = 1.20; // ×1.2 damage each batch

// ============================================================
// [🧱 BLOCK: Parry Constants]
// ============================================================
const PARRY_STUN_MS       = 1200;
const PARRY_VULN_MULT     = 1.5;
const PARRY_WINDUP_RADIUS = 80;

// ============================================================
// [🧱 BLOCK: Separation Constants]
// ============================================================
const SEPARATION_PASSES   = 2;
const SEPARATION_STRENGTH = 0.4;
const TANK_RADIUS_BONUS   = 10;

// ============================================================
// [🧱 BLOCK: Consumable Drop Chances]
// [🧱 Phase 2] Weapon ground drops removed entirely — weapons
// are Shop-only now (see docs/phase-2-weapon-lock.md). Consumable
// drops are untouched by this phase.
// ============================================================
const CONSUMABLE_DROP_CHANCE = {
  grunt:   0.04,
  shooter: 0.06,
  tank:    0.10,
  dasher:  0.05,
  bomber:  0.07,
};
const ELITE_CONSUMABLE_MULT = 1.5;

// ============================================================
// [🧱 BLOCK: Volatile Explosion Constants]
// ============================================================
const VOLATILE_EXPLODE_RADIUS = 55;
const VOLATILE_EXPLODE_DAMAGE = 20;

// ============================================================
// [🧱 BLOCK: Freeze Thresholds]
// ============================================================
const FREEZE_HEAVY_DAMAGE_THRESHOLD = 20;

type AnyHordeEnemy = Grunt | Shooter | Tank | Dasher | Bomber;

// ============================================================
// [🧱 BLOCK: Farming Batch State]
// Tracks which batch we're on, how many are still alive,
// and when the next batch is allowed to spawn.
// ============================================================
interface FarmingBatchState {
  batchNumber:  number;   // 1-indexed, increments each batch
  aliveInBatch: number;   // how many of this batch are still alive
  nextSpawnAt:  number;   // Date.now() timestamp — don't spawn before this
  active:       boolean;  // true once farming mode begins
}

function goldMultiplierForKills(kills: number, threshold: number): number {
  if (kills < threshold) return 1.0;
  const extraKills = kills - threshold;
  const tier       = Math.floor(extraKills / 10);
  return Math.max(0.20, 1.0 - tier * 0.20);
}

// ============================================================
// [🧱 BLOCK: Spawn Scaled Tank]
// Creates a Tank then multiplies its HP and damageMult
// to match the current batch scaling.
// batchNumber is 1-indexed; batch 1 = base stats.
// ============================================================
function spawnScaledTank(
  x: number,
  y: number,
  floor: number,
  batchNumber: number
): Tank {
  const tank    = new Tank(x, y, floor);
  const scale   = Math.pow(FARMING_HP_MULT_PER_BATCH,  batchNumber - 1);
  const dmgScale= Math.pow(FARMING_DMG_MULT_PER_BATCH, batchNumber - 1);
  tank.hp       = Math.round(tank.hp    * scale);
  tank.maxHp    = tank.hp;
  tank.damageMult = tank.damageMult * dmgScale;
  return tank;
}

// ============================================================
// [🧱 BLOCK: Random Edge Position]
// ============================================================
function randomEdgePosition(
  worldW: number,
  worldH: number,
  margin: number = 60
): { x: number; y: number } {
  const edge = Math.floor(Math.random() * 4);
  switch (edge) {
    case 0: return { x: Math.random() * worldW, y: margin                };
    case 1: return { x: Math.random() * worldW, y: worldH - margin       };
    case 2: return { x: margin,                 y: Math.random() * worldH };
    default:return { x: worldW - margin,        y: Math.random() * worldH };
  }
}

export class HordeSystem {
  private goldSystem   = new GoldSystem();
  private weaponSystem = new WeaponSystem();

  // ============================================================
  // [🧱 BLOCK: Farming State]
  // ============================================================
  private farming: FarmingBatchState = {
    batchNumber:  0,
    aliveInBatch: 0,
    nextSpawnAt:  0,
    active:       false,
  };

  // ============================================================
  // [🧱 BLOCK: Threshold Helper]
  // ============================================================
  getThreshold(floor: number, isElite = false): number {
    const base = BASE_THRESHOLD + (floor - 1) * THRESHOLD_PER_FLOOR;
    return isElite ? Math.round(base * ELITE_THRESHOLD_MULT) : base;
  }

  get killThreshold(): number { return BASE_THRESHOLD; }

  // ============================================================
  // [🧱 BLOCK: Setup]
  // ============================================================
  setup(state: GameState, rs: RoomState, worldW: number, worldH: number) {
    state.player.x  = worldW / 2;
    state.player.y  = worldH - 100;
    state.player.vx = 0;
    state.player.vy = 0;

    state.kills          = 0;
    state.alive          = 0;
    state.lastSpawn      = 0;
    state.roomEntryTime  = Date.now();
    state.projectiles    = [];
    state.goldDrops      = [];
    state.consumableDrops = [];
    state.particles      = [];
    state.hitSparks      = [];
    state.damageNumbers  = [];
    state.boss           = null;
    state.enemies        = [];

    state.door          = new Door(worldW);
    state.door.isActive = false;
    state.shopNpc       = new ShopNPC(worldW);
    state.bossChest      = null;

    // Reset farming state for new room
    this.farming = {
      batchNumber:  0,
      aliveInBatch: 0,
      nextSpawnAt:  0,
      active:       false,
    };

    state.camera.update(state.player, worldW, worldH);
    state.playerStats.applyToPlayer(state.player);
  }

  // ============================================================
  // [🧱 BLOCK: Reset]
  // ============================================================
  reset(state: GameState) {
    state.enemies         = [];
    state.projectiles     = [];
    state.goldDrops       = [];
    state.consumableDrops = [];
    state.particles       = [];
    state.hitSparks       = [];
    state.damageNumbers   = [];
    state.door            = null;
    state.shopNpc         = null;
    state.bossChest       = null;
    state.kills           = 0;
    state.alive           = 0;
    state.lastSpawn       = 0;

    this.farming = {
      batchNumber:  0,
      aliveInBatch: 0,
      nextSpawnAt:  0,
      active:       false,
    };
  }

  // ============================================================
  // [🧱 BLOCK: Separate Enemies]
  // ============================================================
  private separateEnemies(enemies: AnyHordeEnemy[], worldW: number, worldH: number): void {
    for (let pass = 0; pass < SEPARATION_PASSES; pass++) {
      for (let i = 0; i < enemies.length; i++) {
        const a = enemies[i];
        if (a.isDead) continue;
        const aRadius = a.width / 2 + (a instanceof Tank ? TANK_RADIUS_BONUS : 0);
        const acx     = a.x + a.width  / 2;
        const acy     = a.y + a.height / 2;

        for (let j = i + 1; j < enemies.length; j++) {
          const b = enemies[j];
          if (b.isDead) continue;
          const bRadius = b.width / 2 + (b instanceof Tank ? TANK_RADIUS_BONUS : 0);
          const bcx     = b.x + b.width  / 2;
          const bcy     = b.y + b.height / 2;

          const dx   = bcx - acx;
          const dy   = bcy - acy;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const minD = aRadius + bRadius;
          if (dist >= minD) continue;

          const overlap  = (minD - dist) * SEPARATION_STRENGTH;
          const nx       = dx / dist;
          const ny       = dy / dist;
          const aIsHeavy = a instanceof Tank;
          const bIsHeavy = b instanceof Tank;
          const pushA    = aIsHeavy ? overlap * 0.25 : (bIsHeavy ? overlap * 0.75 : overlap * 0.5);
          const pushB    = bIsHeavy ? overlap * 0.25 : (aIsHeavy ? overlap * 0.75 : overlap * 0.5);

          a.x -= nx * pushA; a.y -= ny * pushA;
          b.x += nx * pushB; b.y += ny * pushB;

          a.x = Math.max(0, Math.min(worldW - a.width,  a.x));
          a.y = Math.max(0, Math.min(worldH - a.height, a.y));
          b.x = Math.max(0, Math.min(worldW - b.width,  b.x));
          b.y = Math.max(0, Math.min(worldH - b.height, b.y));
        }
      }
    }
  }

  // ============================================================
  // [🧱 BLOCK: Enforce Safe Zone]
  // ============================================================
  private enforceSafeZone(enemies: AnyHordeEnemy[], npc: ShopNPC): void {
    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      const cy = enemy.y + enemy.height / 2;
      if (npc.isSafeZone(cy)) {
        enemy.y  = npc.safeLineY - enemy.height / 2;
        if (enemy.vy < 0) enemy.vy = 0;
      }
    }
  }

  // ============================================================
  // [🧱 BLOCK: Is Enemy In Parry Range]
  // ============================================================
  private isEnemyInParryRange(player: Player, enemy: AnyHordeEnemy): boolean {
    const { x: px, y: py } = rectCenter(player);
    const { x: ex, y: ey } = rectCenter(enemy);
    return circleCircle(px, py, PARRY_WINDUP_RADIUS, ex, ey, 1);
  }

  // ============================================================
  // [🧱 BLOCK: Resolve Parry]
  // ============================================================
  private resolveParry(player: Player, enemy: AnyHordeEnemy, state: GameState): boolean {
    if (!player.isParrying) return false;
    const hit = player.tryParry();
    if (!hit) return false;
    enemy.applyStun(PARRY_STUN_MS);
    state.particles.push(...spawnBurst(
      player.x + player.width  / 2,
      player.y + player.height / 2,
      "#38bdf8", 10, 1.3
    ));
    state.playerStats.weaponPassive?.onParry?.(player, state);
    return true;
  }

  // ============================================================
  // [🧱 BLOCK: Resolve Block]
  // ============================================================
  private resolveBlock(player: Player, rawDamage: number): number {
    if (player.isBlocking) return player.applyBlockedHit(rawDamage);
    return rawDamage;
  }

  // ============================================================
  // [🧱 BLOCK: Apply Incoming Damage]
  // ============================================================
  private applyIncomingDamage(
    state:    GameState,
    player:   Player,
    rawDamage:number,
    source:   BaseEnemy | null = null
  ): boolean {
    if (player.iFrames > 0) return true;

    if (ConsumableSystem.wardCanAbsorb(state)) {
      ConsumableSystem.consumeWardHit(state);
      state.particles.push(...spawnBurst(
        player.x + player.width  / 2,
        player.y + player.height / 2,
        '#a78bfa', 6, 1.0
      ));
      return true;
    }

    const ironMult = ConsumableSystem.ironDamageReductionMult(state);
    let   dmg      = Math.round(rawDamage * ironMult);

    dmg = this.resolveBlock(player, dmg);
    if (dmg > 0) player.takeHit(dmg);

    if (source !== null) {
      const iwLevel = state.playerStats.getBoonLevel('iron_warden');
      tryIronWardenReflect(iwLevel, source);
    }

    return false;
  }

  // ============================================================
  // [🧱 BLOCK: Handle Bomber Explosion]
  // ============================================================
  private handleBomberExplosion(
    state:  GameState,
    bomber: Bomber,
    player: Player,
    ps:     GameState['playerStats']
  ): void {
    const { x: bx, y: by } = rectCenter(bomber);
    state.particles.push(...spawnBurst(bx, by, "#f97316", 14, 2.0));
    state.particles.push(...spawnBurst(bx, by, "#ffffff",  6, 1.2));
    if (bomber.isExplosionHittingPlayer(player) && player.iFrames <= 0) {
      const rawDmg = Math.round(bomber.explodeDamage * (1 - ps.damageReduction));
      this.applyIncomingDamage(state, player, rawDmg, null);
    }
  }

  // ============================================================
  // [🧱 BLOCK: Handle Volatile Death Explosion]
  // ============================================================
  private handleVolatileExplosion(
    state:  GameState,
    enemy:  BaseEnemy,
    player: Player,
    ps:     GameState['playerStats'],
    render: RenderSystem
  ): void {
    const cx = enemy.x + enemy.width  / 2;
    const cy = enemy.y + enemy.height / 2;

    state.particles.push(...spawnBurst(cx, cy, "#f97316", 12, 1.8));
    state.particles.push(...spawnBurst(cx, cy, "#ffffff",  5, 1.0));
    render.shake('medium');

    const { x: px, y: py } = rectCenter(player);
    const dx   = px - cx;
    const dy   = py - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < VOLATILE_EXPLODE_RADIUS + player.width / 2 && player.iFrames <= 0) {
      const rawDmg = Math.round(VOLATILE_EXPLODE_DAMAGE * (1 - ps.damageReduction));
      this.applyIncomingDamage(state, player, rawDmg, null);
    }

    state.enemies.forEach((e) => {
      if (e.isDead || e === enemy) return;
      const ex = e.x + e.width  / 2;
      const ey = e.y + e.height / 2;
      if (Math.sqrt((cx - ex) ** 2 + (cy - ey) ** 2) < VOLATILE_EXPLODE_RADIUS) {
        e.takeDamage(VOLATILE_EXPLODE_DAMAGE);
      }
    });
  }

  // ============================================================
  // [🧱 BLOCK: Emit Hit Feedback]
  // ============================================================
  private emitHitFeedback(
    state:      GameState,
    enemy:      BaseEnemy,
    damage:     number,
    attackType: string | null,
    render:     RenderSystem,
    isFirstHit: boolean
  ): void {
    if (!isFirstHit) return;

    const cx = enemy.x + enemy.width  / 2;
    const cy = enemy.y + enemy.height / 2;

    const sparkColor =
      attackType === 'charged_heavy' ? '#ef4444' :
      attackType === 'heavy'         ? '#fb923c' :
      attackType === 'charged_light' ? '#facc15' :
                                       '#f1f5f9';

    state.hitSparks.push(...spawnHitSpark(cx, cy, sparkColor, 4));
    state.damageNumbers.push(spawnDamageNumber(cx, cy - enemy.height / 2, damage, attackType));
    render.shake('micro');

    if (attackType === 'charged_heavy' || attackType === 'heavy') {
      render.freezeFrames(FREEZE_PRESETS.heavy);
    } else if (attackType === 'charged_light') {
      render.freezeFrames(FREEZE_PRESETS.light);
    }
  }

  // ============================================================
  // [🧱 BLOCK: Tick Farming Batches]
  // Called every frame once the kill threshold is met.
  // Spawns the next batch only when all enemies from the
  // previous batch are dead AND the delay has elapsed.
  // Returns the batch number if a new batch just spawned
  // (so the caller can announce it), or null otherwise.
  // ============================================================
  private tickFarmingBatches(
    state:  GameState,
    rs:     RoomState,
    worldW: number,
    worldH: number
  ): number | null {
    const f   = this.farming;
    const now = Date.now();

    // Activate farming mode the first time we enter this path
    if (!f.active) {
      f.active      = true;
      f.batchNumber = 0;
      f.aliveInBatch= 0;
      f.nextSpawnAt = now + FARMING_BATCH_DELAY_MS;
      return null;
    }

    // Count how many farming-batch Tanks are still alive
    // We track this via aliveInBatch — decrement when enemies die
    const livingEnemies = state.enemies.filter((e) => !e.isDead).length;

    // If there are still enemies alive from this batch, wait
    if (f.aliveInBatch > 0 && livingEnemies > 0) {
      // Sync alive count (enemies could die from volatile etc.)
      // aliveInBatch shrinks as enemies are removed from state.enemies
      // We recalculate it from state each frame to stay accurate
      return null;
    }

    // Previous batch cleared (or batch 0 waiting for initial delay)
    if (now < f.nextSpawnAt) return null;

    // Spawn the next batch
    f.batchNumber  += 1;
    f.aliveInBatch  = FARMING_BATCH_SIZE;
    f.nextSpawnAt   = now + FARMING_BETWEEN_DELAY_MS; // set for *after* this batch

    for (let i = 0; i < FARMING_BATCH_SIZE; i++) {
      const { x, y } = randomEdgePosition(worldW, worldH);
      const tank      = spawnScaledTank(x, y, rs.floor, f.batchNumber);
      state.enemies.push(tank);
    }

    state.alive += FARMING_BATCH_SIZE;
    return f.batchNumber;
  }

  // ============================================================
  // [🧱 BLOCK: Update Farming Alive Count]
  // Called after the dead-enemy sweep so aliveInBatch stays
  // in sync when tanks die from any source.
  // ============================================================
  private syncFarmingAliveCount(justKilledCount: number): void {
    if (!this.farming.active || this.farming.aliveInBatch <= 0) return;
    this.farming.aliveInBatch = Math.max(
      0,
      this.farming.aliveInBatch - justKilledCount
    );
    // If batch cleared, arm the delay for the next batch
    if (this.farming.aliveInBatch === 0) {
      this.farming.nextSpawnAt = Date.now() + FARMING_BETWEEN_DELAY_MS;
    }
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // ============================================================
  update(
    state:  GameState,
    player: Player,
    rs:     RoomState,
    worldW: number,
    worldH: number,
    render: RenderSystem
  ): { event: null; goldCollected: number; farmingBatchSpawned: number | null } {
    const ps        = state.playerStats;
    const isElite   = rs.phase === 'elite';
    const threshold = this.getThreshold(rs.floor, isElite);
    const thresholdMet = state.kills >= threshold;

    const playerIsInvisible = ConsumableSystem.isPhantomActive(state);

    // ── Door ─────────────────────────────────────────────────
    if (state.door) {
      state.door.update();
      if (thresholdMet && !state.door.isActive) state.door.activate();
      state.door.checkPlayerProximity(player);
    }

    // ── Shop NPC ─────────────────────────────────────────────
    if (state.shopNpc) {
      state.shopNpc.update();
      if (thresholdMet && !state.shopNpc.isActive) state.shopNpc.activate();
      state.shopNpc.checkPlayerProximity(player);
    }

    // ── Shadow Walker (boon, level 5) ─────────────────────────
    const swLevel = ps.getBoonLevel('shadow_walker');
    if (swLevel >= MAX_BOON_LEVEL) {
      const wasDashing = (player as any)._wasDashingLastFrame ?? false;
      const isDashing  = player.dashTimer > 0;
      if (isDashing && !wasDashing) {
        applyShadowWalkerFreeze(swLevel, state.enemies);
        state.particles.push(...spawnBurst(
          player.x + player.width  / 2,
          player.y + player.height / 2,
          '#7dd3fc', 10, 1.3
        ));
      }
      (player as any)._wasDashingLastFrame = isDashing;
    }

    // ── Enemy update + combat resolution ─────────────────────
    state.enemies.forEach((enemy) => {
      if (!playerIsInvisible) {
        if (!enemy.isStunned) {
          enemy.update(player, worldW, worldH);
        } else {
          (enemy as any).stunTimer -= 16;
          if ((enemy as any).stunTimer < 0) (enemy as any).stunTimer = 0;
          enemy.vx = 0;
          enemy.vy = 0;
        }
      } else {
        if (enemy.isStunned) {
          (enemy as any).stunTimer -= 16;
          if ((enemy as any).stunTimer < 0) (enemy as any).stunTimer = 0;
        }
      }

      if (enemy instanceof Shooter && enemy.pendingProjectiles.length > 0) {
        state.projectiles.push(...enemy.pendingProjectiles);
        enemy.pendingProjectiles = [];
      }

      if (enemy instanceof Bomber && enemy.isExploding) {
        this.handleBomberExplosion(state, enemy, player, ps);
      }

      if (enemy.isDead) return;
      if (playerIsInvisible) return;

      if (!enemy.isStunned) {
        const isWindingUp =
          (enemy instanceof Grunt    && (enemy as any).attackState === 'windup') ||
          (enemy instanceof Shooter  && (enemy as any).attackState === 'windup') ||
          (enemy instanceof Tank     && (enemy as any).tankState   === 'windup') ||
          (enemy instanceof Dasher   && (enemy as any).dasherState === 'windup');

        if (isWindingUp && this.isEnemyInParryRange(player, enemy)) {
          this.resolveParry(player, enemy, state);
        }
      }

      if (enemy instanceof Dasher) {
        if (enemy.isDashHittingPlayer(player) && player.iFrames <= 0) {
          if (player.isParrying) {
            const parried = this.resolveParry(player, enemy, state);
            if (parried) { enemy.damageCooldown = 600; return; }
          }
          const rawDmg = Math.round(enemy.dashDamage * (1 - ps.damageReduction));
          const absorbed = this.applyIncomingDamage(state, player, rawDmg, enemy);
          if (!absorbed && rawDmg >= FREEZE_HEAVY_DAMAGE_THRESHOLD) {
            render.freezeFrames(FREEZE_PRESETS.player_hit);
          }
          enemy.damageCooldown = 800;
        }
        return;
      }

      if (enemy instanceof Bomber) {
        if (enemy.isTouchingPlayer(player) && player.iFrames <= 0) {
          const rawDmg = Math.round(enemy.contactDmg * (1 - ps.damageReduction));
          this.applyIncomingDamage(state, player, rawDmg, enemy);
        }
        return;
      }

      if (!enemy.isMeleeHittingPlayer(player)) return;
      if (enemy.isStunned) return;

      if (player.isParrying) {
        const parried = this.resolveParry(player, enemy, state);
        if (parried) return;
      }

      if (player.iFrames > 0) return;

      if (enemy instanceof Tank) {
        const rawDmg = Math.round(enemy.meleeDamage * (1 - ps.damageReduction));
        const absorbed = this.applyIncomingDamage(state, player, rawDmg, enemy);
        if (!absorbed) {
          enemy.applyKnockback(player);
          if (rawDmg >= FREEZE_HEAVY_DAMAGE_THRESHOLD) {
            render.freezeFrames(FREEZE_PRESETS.player_hit);
          }
        }
      } else if (enemy instanceof Shooter) {
        const rawDmg = Math.round(enemy.meleeDamage * (1 - ps.damageReduction));
        const absorbed = this.applyIncomingDamage(state, player, rawDmg, enemy);
        if (!absorbed) enemy.applyHitKnockbackToPlayer(player);
      } else if (enemy instanceof Grunt) {
        const rawDmg = Math.round(enemy.meleeDamage * (1 - ps.damageReduction));
        const absorbed = this.applyIncomingDamage(state, player, rawDmg, enemy);
        if (!absorbed) enemy.applyHitKnockbackToPlayer(player);
      } else {
        const rawDmg = Math.round(15 * (1 - ps.damageReduction));
        this.applyIncomingDamage(state, player, rawDmg, enemy);
      }
    });

    // ── Separation ────────────────────────────────────────────
    this.separateEnemies(state.enemies, worldW, worldH);

    // ── Safe zone barrier ─────────────────────────────────────
    if (state.shopNpc?.isActive) {
      this.enforceSafeZone(state.enemies, state.shopNpc);
    }

    // ── Weapon input + hit resolution ─────────────────────────
    this.weaponSystem.processInput(player);

    const playerCX = player.x + player.width  / 2;
    const playerCY = player.y + player.height / 2;
    const isHeavy  = player.attackType === "heavy" || player.attackType === "charged_heavy";
    const isLight  = player.attackType === "light" || player.attackType === "charged_light";

    const atkBonus = ps.atkBonus + ps.lastStandBonus(player) + ConsumableSystem.wrathAtkBonus(state);
    const passive  = ps.weaponPassive;

    if (passive?.id === 'glaive' && player.isAttacking) {
      player.stamina = Math.max(0, player.stamina - GLAIVE_EXTRA_COST);
    }

    tickRiposte(16);
    const riposteMult  = passive?.id === 'riposte'  && isRiposteActive()    ? RIPOSTE_MULT : 1.0;
    const momentumMult = passive?.id === 'momentum' && player.dashTimer > 0 ? 2.0          : 1.0;
    const iaijutsuMult = passive?.id === 'iaijutsu' && player.attackType === 'charged_light' ? 1.4 : 1.0;

    const hitEnemies = this.weaponSystem.resolveHitsCustom(
      player, state.enemies, atkBonus,
      (enemy: BaseEnemy, amount: number, isFirstHit: boolean) => {
        let finalAmt = enemy.isStunned ? Math.round(amount * PARRY_VULN_MULT) : amount;
        finalAmt = Math.round(finalAmt * riposteMult * momentumMult * iaijutsuMult);

        if (enemy instanceof Bomber && !enemy.hasExploded) {
          enemy.triggerExplosion();
          this.handleBomberExplosion(state, enemy, player, ps);
          return;
        }

        if (passive?.id === 'precision' && isLight && enemy instanceof Tank) {
          enemy.takeDamage(finalAmt);
        } else if (enemy instanceof Tank) {
          enemy.takeDamageFrom(finalAmt, playerCX, playerCY, isHeavy);
        } else {
          enemy.takeDamage(finalAmt);
        }

        if (isRendMarked(enemy)) {
          enemy.takeDamage(REND_BONUS_DAMAGE);
          clearRendMark(enemy);
        }
        passive?.onHit?.(player, enemy, finalAmt, state);

        this.emitHitFeedback(state, enemy, finalAmt, player.attackType, render, isFirstHit);
      }
    );

    // ── Executioner (boon) — heavy-kill shockwave ──────────────
    if (isHeavy && ps.hasBoon("executioner")) {
      const execLevel = ps.getBoonLevel("executioner");
      hitEnemies.forEach((enemy) => {
        if (enemy.isDead) {
          triggerExecutionerShockwave(execLevel, state, enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
        }
      });
    }

    // ── Kill tracking + loot rolls ────────────────────────────
    const before      = state.enemies.length;
    const deadEnemies = state.enemies.filter((e) => e.isDead);
    state.enemies     = state.enemies.filter((e) => !e.isDead);
    const justKilled  = before - state.enemies.length;

    const brLevel = ps.getBoonLevel('blood_reaper');

    if (justKilled > 0) {
      state.kills      += justKilled;
      state.alive      -= justKilled;
      state.totalKills += justKilled;

      // Sync farming alive count after removing dead enemies
      this.syncFarmingAliveCount(justKilled);

      deadEnemies.forEach((enemy) => {
        const type: keyof typeof CONSUMABLE_DROP_CHANCE =
          enemy instanceof Tank    ? "tank"    :
          enemy instanceof Shooter ? "shooter" :
          enemy instanceof Dasher  ? "dasher"  :
          enemy instanceof Bomber  ? "bomber"  :
                                     "grunt";

        const goldType: "grunt" | "shooter" | "tank" | "boss" =
          enemy instanceof Tank    ? "tank"    :
          enemy instanceof Shooter ? "shooter" :
                                     "grunt";

        const killMult    = goldMultiplierForKills(state.kills, threshold);
        const variantMult = enemy.goldMultiplier;
        this.goldSystem.spawnFromEnemy(
          state,
          enemy.x + enemy.width  / 2,
          enemy.y + enemy.height / 2,
          goldType,
          killMult * variantMult
        );

        state.particles.push(...spawnBurst(
          enemy.x + enemy.width  / 2,
          enemy.y + enemy.height / 2,
          enemy.color, 6
        ));

        if (enemy.isVolatile && !(enemy instanceof Bomber)) {
          this.handleVolatileExplosion(state, enemy, player, ps, render);
        }

        const cBaseChance = CONSUMABLE_DROP_CHANCE[type];
        const cChance     = isElite ? cBaseChance * ELITE_CONSUMABLE_MULT : cBaseChance;
        if (Math.random() < cChance) {
          const consumableDef = getRandomConsumableDrop();
          state.consumableDrops.push(new ConsumableDrop(
            enemy.x + enemy.width  / 2 + (Math.random() - 0.5) * 20,
            enemy.y + enemy.height / 2 + (Math.random() - 0.5) * 20,
            consumableDef
          ));
        }

        if (ps.healOnKill > 0) {
          player.hp = Math.min(player.maxHp, player.hp + ps.healOnKill);
        }
        passive?.onKill?.(player, enemy, state);
        onBloodReaperKill(brLevel, enemy, state.enemies, state);
      });
    }

    // ── Consumable drop auto-pickup ───────────────────────────
    state.consumableDrops = state.consumableDrops.filter((drop) => {
      if (drop.collected) return false;
      drop.update(player);
      if (drop.collected) {
        state.playerConsumables.addToBag(drop.def, 1);
        state.particles.push(...spawnBurst(drop.x, drop.y,
          drop.def.kind === 'potion' ? '#a78bfa' : '#38bdf8', 5, 0.8));
        return false;
      }
      return true;
    });

    // ── Wave spawning ─────────────────────────────────────────
    const now          = Date.now();
    const graceElapsed = now - state.roomEntryTime;
    const graceDone    = graceElapsed >= GRACE_PERIOD_MS;

    let farmingBatchSpawned: number | null = null;

    if (!thresholdMet) {
      // ── Pre-threshold: normal wave spawning ──────────────────
      const killsLeft = threshold - state.kills;
      if (killsLeft > 0 && state.alive === 0 && graceDone && now - state.lastSpawn > 1000) {
        const baseCount  = Math.min(WAVE_SIZE, killsLeft);
        const spawnCount = isElite
          ? Math.min(Math.round(WAVE_SIZE * ELITE_WAVE_MULT), killsLeft)
          : baseCount;

        const newWave = isElite
          ? spawnEliteWave(spawnCount, worldW, worldH, rs.floor)
          : spawnWave(spawnCount, worldW, worldH, rs.roomInCycle, rs.floor);

        state.enemies.push(...newWave);
        state.alive     = spawnCount;
        state.lastSpawn = now;
      }
    } else {
      // ── Post-threshold: batch farming mode ───────────────────
      // Elite rooms keep the old random spawn since farming isn't
      // the intended loop there (player should push to boss).
      if (isElite) {
        if (now - state.lastSpawn > 3000) {
          const [newEnemy] = spawnEliteWave(1, worldW, worldH, rs.floor);
          state.enemies.push(newEnemy);
          state.alive    += 1;
          state.lastSpawn = now;
        }
      } else {
        farmingBatchSpawned = this.tickFarmingBatches(state, rs, worldW, worldH);
      }
    }

    // ── Projectiles ───────────────────────────────────────────
    state.projectiles.forEach((proj) => {
      proj.update();
      if (!proj.isHittingPlayer(player)) return;

      if (player.isParrying) {
        const parried = player.tryParry();
        if (parried) {
          proj.isDone = true;
          state.particles.push(...spawnBurst(proj.x, proj.y, "#38bdf8", 6, 1.0));
          state.playerStats.weaponPassive?.onParry?.(player, state);
          return;
        }
      }

      if (player.iFrames > 0) { proj.isDone = true; return; }

      const rawDmg = Math.round(proj.damage * (1 - ps.damageReduction));
      this.applyIncomingDamage(state, player, rawDmg, null);
      proj.isDone = true;
    });
    state.projectiles = state.projectiles.filter((p) => !p.isDone);

    // ── Stamina regen ─────────────────────────────────────────
    if (player.stamina < player.maxStamina) {
      player.stamina = Math.min(player.maxStamina, player.stamina + ps.staminaRegenRate);
    }

    // ── Gold collection ───────────────────────────────────────
    const goldCollected = this.goldSystem.update(state, player);
    state.totalGoldEarned += goldCollected;

    return { event: null, goldCollected, farmingBatchSpawned };
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // ============================================================
  draw(state: GameState, ctx: CanvasRenderingContext2D, camera: Camera, player: Player, worldW: number) {
    state.door?.draw(ctx, camera);
    state.shopNpc?.draw(ctx, camera, worldW);
    state.enemies.forEach((e)           => e.draw(ctx, camera));
    state.projectiles.forEach((p)       => p.draw(ctx, camera));
    state.consumableDrops.forEach((d)   => d.draw(ctx, camera));
    this.goldSystem.draw(state, ctx, camera);

    state.particles.forEach((p)   => p.update());
    state.particles = state.particles.filter((p) => !p.isDone);
    state.particles.forEach((p)   => p.draw(ctx, camera));

    state.hitSparks.forEach((s)   => s.update());
    state.hitSparks = state.hitSparks.filter((s) => !s.isDone);
    state.hitSparks.forEach((s)   => s.draw(ctx, camera));

    this.weaponSystem.draw(ctx, player, camera);
  }
}