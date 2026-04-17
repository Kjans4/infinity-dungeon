// src/engine/systems/HordeSystem.ts
import { Player }                               from "../Player";
import { Camera }                               from "../Camera";
import { Door }                                 from "../Door";
import { ShopNPC }                              from "../ShopNPC";
import { ItemDrop }                             from "../ItemDrop";
import { Grunt, Shooter, Tank, spawnWave }      from "../enemy";
import { spawnEliteWave }                       from "../enemy/spawn";
import { RoomState }                            from "../RoomManager";
import { GameState, PENDING_LOOT_CAP }          from "../GameState";
import { GoldSystem }                           from "./GoldSystem";
import { WeaponSystem }                         from "./WeaponSystem";
import { spawnBurst }                           from "../Particle";
import { getRandomShopItems }                   from "../items/ItemPool";
import { circleCircle, rectCenter }             from "../Collision";

const WAVE_SIZE              = 8;
const BASE_THRESHOLD         = 20;
const THRESHOLD_PER_FLOOR    = 5;
const ELITE_THRESHOLD_MULT   = 1.5;
const ELITE_WAVE_MULT        = 1.5;
const FARMING_SPAWN_INTERVAL = 3000;
const GRACE_PERIOD_MS        = 1500;

// ============================================================
// [🧱 BLOCK: Parry Constants]
// ============================================================
const PARRY_STUN_MS   = 1200;  // horde enemy stun duration on successful parry
const PARRY_VULN_MULT = 1.5;   // damage bonus vs stunned (parry-vulnerable) enemy

// Radius within which an enemy in windup also counts as
// "in range" for a player parry. Slightly larger than melee
// range so the player doesn't have to be pixel-perfect.
const PARRY_WINDUP_RADIUS = 80;

// ============================================================
// [🧱 BLOCK: Separation Constants]
// ============================================================
const SEPARATION_PASSES   = 2;
const SEPARATION_STRENGTH = 0.4;
const TANK_RADIUS_BONUS   = 10;

// ============================================================
// [🧱 BLOCK: Item Drop Chances]
// ============================================================
const DROP_CHANCE = {
  grunt:   0.03,
  shooter: 0.06,
  tank:    0.12,
};
const ELITE_DROP_MULT = 1.5;

function goldMultiplierForKills(kills: number, threshold: number): number {
  if (kills < threshold) return 1.0;
  const extraKills = kills - threshold;
  const tier       = Math.floor(extraKills / 10);
  return Math.max(0.20, 1.0 - tier * 0.20);
}

function rollItemDrop(
  state:  GameState,
  chance: number
): import("../items/ItemPool").ShopItem | null {
  if (Math.random() > chance) return null;
  const ownedCharmIds   = state.playerStats.charms.map((c) => c.id);
  const ownedWeaponId   = state.playerStats.equippedWeaponItem?.id ?? null;
  const pendingCharmIds = state.pendingLoot.filter((i) => i.kind === "charm").map((i) => i.id);
  const pendingWeaponId = state.pendingLoot.find((i) => i.kind === "weapon")?.id ?? null;
  const pool = getRandomShopItems(
    [...ownedCharmIds, ...pendingCharmIds],
    ownedWeaponId ?? pendingWeaponId,
    1
  );
  return pool[0] ?? null;
}

export class HordeSystem {
  private goldSystem   = new GoldSystem();
  private weaponSystem = new WeaponSystem();

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

    state.kills         = 0;
    state.alive         = 0;
    state.lastSpawn     = 0;
    state.roomEntryTime = Date.now();
    state.projectiles = [];
    state.goldDrops   = [];
    state.itemDrops   = [];
    state.particles   = [];
    state.boss        = null;
    state.enemies     = [];

    state.door          = new Door(worldW);
    state.door.isActive = false;
    state.shopNpc       = new ShopNPC(worldW);

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
    state.itemDrops   = [];
    state.particles   = [];
    state.door        = null;
    state.shopNpc     = null;
    state.kills       = 0;
    state.alive       = 0;
    state.lastSpawn   = 0;
  }

  // ============================================================
  // [🧱 BLOCK: Separate Enemies]
  // ============================================================
  private separateEnemies(
    enemies: (Grunt | Shooter | Tank)[],
    worldW:  number,
    worldH:  number
  ): void {
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
  private enforceSafeZone(
    enemies: (Grunt | Shooter | Tank)[],
    npc:     ShopNPC
  ): void {
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
  // Returns true when an enemy's center is within PARRY_WINDUP_RADIUS
  // of the player's center. Used to check windup-phase parries.
  // ============================================================
  private isEnemyInParryRange(player: Player, enemy: Grunt | Shooter | Tank): boolean {
    const { x: px, y: py } = rectCenter(player);
    const { x: ex, y: ey } = rectCenter(enemy);
    return circleCircle(px, py, PARRY_WINDUP_RADIUS, ex, ey, 1);
  }

  // ============================================================
  // [🧱 BLOCK: Resolve Parry]
  // Unified parry resolution used for both windup proximity and
  // direct melee contact. Stuns the enemy and spawns VFX.
  // Returns true if parry was triggered.
  // ============================================================
  private resolveParry(
    player:  Player,
    enemy:   Grunt | Shooter | Tank,
    state:   GameState
  ): boolean {
    if (!player.isParrying) return false;
    const hit = player.tryParry();
    if (!hit) return false;

    enemy.applyStun(PARRY_STUN_MS);
    state.particles.push(...spawnBurst(
      player.x + player.width  / 2,
      player.y + player.height / 2,
      "#38bdf8", 10, 1.3
    ));
    return true;
  }

  // ============================================================
  // [🧱 BLOCK: Resolve Block]
  // Returns final damage after block reduction (or full if not blocking).
  // ============================================================
  private resolveBlock(player: Player, rawDamage: number): number {
    if (player.isBlocking) return player.applyBlockedHit(rawDamage);
    return rawDamage;
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
  ): { event: null; goldCollected: number } {
    const ps        = state.playerStats;
    const isElite   = rs.phase === 'elite';
    const threshold = this.getThreshold(rs.floor, isElite);
    const thresholdMet = state.kills >= threshold;

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

    // ── Enemy update + combat resolution ─────────────────────
    state.enemies.forEach((enemy) => {

      // Stunned enemies freeze AI but still tick stun timer
      if (!enemy.isStunned) {
        enemy.update(player, worldW, worldH);
      } else {
        (enemy as any).stunTimer -= 16;
        if ((enemy as any).stunTimer < 0) (enemy as any).stunTimer = 0;
        enemy.vx = 0;
        enemy.vy = 0;
      }

      // Drain projectiles from Shooters
      if (enemy instanceof Shooter && enemy.pendingProjectiles.length > 0) {
        state.projectiles.push(...enemy.pendingProjectiles);
        enemy.pendingProjectiles = [];
      }

      // ── Windup-phase parry window ─────────────────────────
      // If the player taps parry while an enemy is winding up
      // AND within range, count it as a valid parry — this is
      // the core fix: parry no longer requires waiting for the
      // strike hitbox to land, which was nearly impossible.
      if (!enemy.isStunned && !enemy.isDead) {
        const isWindingUp =
          (enemy instanceof Grunt    && (enemy as any).attackState === 'windup') ||
          (enemy instanceof Shooter  && (enemy as any).attackState === 'windup') ||
          (enemy instanceof Tank     && (enemy as any).tankState   === 'windup');

        if (isWindingUp && this.isEnemyInParryRange(player, enemy)) {
          // Attempt parry — resolveParry handles the isParrying check
          this.resolveParry(player, enemy, state);
          // Note: if parry fires here we don't return — the strike
          // contact check below will be skipped anyway because the
          // enemy is now stunned.
        }
      }

      // ── Melee contact ────────────────────────────────────
      if (!enemy.isMeleeHittingPlayer(player)) return;
      if (enemy.isStunned) return;  // stunned enemy can't deal contact damage

      // Parry check on direct contact (fallback for fast enemies
      // or cases the windup check missed)
      if (player.isParrying) {
        const parried = this.resolveParry(player, enemy, state);
        if (parried) return;
      }

      if (player.iFrames > 0) return;

      let rawDmg: number;
      if (enemy instanceof Tank) {
        rawDmg = Math.round(enemy.meleeDamage * (1 - ps.damageReduction));
        rawDmg = this.resolveBlock(player, rawDmg);
        if (rawDmg > 0) {
          player.takeHit(rawDmg);
          enemy.applyKnockback(player);
        }
      } else if (enemy instanceof Shooter) {
        rawDmg = Math.round(8 * (1 - ps.damageReduction));
        rawDmg = this.resolveBlock(player, rawDmg);
        if (rawDmg > 0) player.takeHit(rawDmg);
      } else {
        rawDmg = Math.round(15 * (1 - ps.damageReduction));
        rawDmg = this.resolveBlock(player, rawDmg);
        if (rawDmg > 0) player.takeHit(rawDmg);
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

    const hitEnemies = this.weaponSystem.resolveHitsCustom(
      player, state.enemies, ps.atkBonus,
      (enemy, amount) => {
        // Parry-stunned enemies take bonus damage
        const finalAmt = enemy.isStunned ? Math.round(amount * PARRY_VULN_MULT) : amount;
        if (enemy instanceof Tank) {
          enemy.takeDamageFrom(finalAmt, playerCX, playerCY, isHeavy);
        } else {
          enemy.takeDamage(finalAmt);
        }
      }
    );

    if (isHeavy && ps.hasCharm("executioner")) {
      hitEnemies.forEach((enemy) => {
        if (enemy.isDead) {
          this.triggerShockwave(state, enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 25);
        }
      });
    }

    // ── Kill tracking + loot rolls ────────────────────────────
    const before      = state.enemies.length;
    const deadEnemies = state.enemies.filter((e) => e.isDead);
    state.enemies     = state.enemies.filter((e) => !e.isDead);
    const justKilled  = before - state.enemies.length;

    if (justKilled > 0) {
      state.kills      += justKilled;
      state.alive      -= justKilled;
      state.totalKills += justKilled;

      deadEnemies.forEach((enemy) => {
        const type =
          enemy instanceof Tank    ? "tank"    :
          enemy instanceof Shooter ? "shooter" :
                                     "grunt";

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

        if (state.pendingLoot.length < PENDING_LOOT_CAP) {
          const baseChance = DROP_CHANCE[type];
          const chance     = isElite ? baseChance * ELITE_DROP_MULT : baseChance;
          const dropped    = rollItemDrop(state, chance);
          if (dropped) {
            state.itemDrops.push(new ItemDrop(
              enemy.x + enemy.width  / 2,
              enemy.y + enemy.height / 2,
              dropped
            ));
          }
        }

        ps.charms.forEach((charm) => charm.onKill?.(player, ps.modifiers));
        if (ps.healOnKill > 0) {
          player.hp = Math.min(player.maxHp, player.hp + ps.healOnKill);
        }
      });
    }

    // ── Item drop pickup ──────────────────────────────────────
    state.itemDrops = state.itemDrops.filter((drop) => {
      if (drop.collected) return false;
      if (state.pendingLoot.length >= PENDING_LOOT_CAP) {
        drop.update(player);
        return !drop.collected;
      }
      const pickedUp = drop.update(player);
      if (pickedUp) { state.pendingLoot.push(drop.item); return false; }
      return !drop.collected;
    });

    // ── Wave spawning ─────────────────────────────────────────
    const now          = Date.now();
    const graceElapsed = now - state.roomEntryTime;
    const graceDone    = graceElapsed >= GRACE_PERIOD_MS;

    if (!thresholdMet) {
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
      if (now - state.lastSpawn > FARMING_SPAWN_INTERVAL) {
        const [newEnemy] = isElite
          ? spawnEliteWave(1, worldW, worldH, rs.floor)
          : spawnWave(1, worldW, worldH, rs.roomInCycle, rs.floor);
        state.enemies.push(newEnemy);
        state.alive    += 1;
        state.lastSpawn = now;
      }
    }

    // ── Projectiles (parry deflects, block absorbs) ───────────
    state.projectiles.forEach((proj) => {
      proj.update();
      if (!proj.isHittingPlayer(player)) return;

      if (player.isParrying) {
        const parried = player.tryParry();
        if (parried) {
          proj.isDone = true;
          state.particles.push(...spawnBurst(proj.x, proj.y, "#38bdf8", 6, 1.0));
          return;
        }
      }

      if (player.iFrames > 0) { proj.isDone = true; return; }

      let rawDmg = Math.round(proj.damage * (1 - ps.damageReduction));
      rawDmg = this.resolveBlock(player, rawDmg);
      if (rawDmg > 0) player.takeHit(rawDmg);
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

    return { event: null, goldCollected };
  }

  // ============================================================
  // [🧱 BLOCK: Shockwave]
  // ============================================================
  private triggerShockwave(state: GameState, cx: number, cy: number, damage: number) {
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
  draw(state: GameState, ctx: CanvasRenderingContext2D, camera: Camera, player: Player, worldW: number) {
    state.door?.draw(ctx, camera);
    state.shopNpc?.draw(ctx, camera, worldW);
    state.enemies.forEach((e)    => e.draw(ctx, camera));
    state.projectiles.forEach((p) => p.draw(ctx, camera));
    state.itemDrops.forEach((d)   => d.draw(ctx, camera));
    this.goldSystem.draw(state, ctx, camera);
    state.particles.forEach((p)   => p.update());
    state.particles = state.particles.filter((p) => !p.isDone);
    state.particles.forEach((p)   => p.draw(ctx, camera));
    this.weaponSystem.draw(ctx, player, camera);
  }
}