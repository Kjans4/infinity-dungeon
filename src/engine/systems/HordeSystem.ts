// src/engine/systems/HordeSystem.ts
import { Player }                               from "../Player";
import { Camera }                               from "../Camera";
import { Door }                                 from "../Door";
import { ShopNPC }                              from "../ShopNPC";
import { ItemDrop }                             from "../ItemDrop";
import { BaseEnemy }                            from "../enemy/BaseEnemy";
import { Grunt, Shooter, Tank, spawnWave }      from "../enemy";
import { Dasher }                               from "../enemy/Dasher";
import { Bomber }                               from "../enemy/Bomber";
import { spawnEliteWave }                       from "../enemy/spawn";
import { RoomState }                            from "../RoomManager";
import { GameState, PENDING_LOOT_CAP }          from "../GameState";
import { GoldSystem }                           from "./GoldSystem";
import { WeaponSystem }                         from "./WeaponSystem";
import { RenderSystem }                         from "./RenderSystem";
import { ConsumableSystem }                     from "../ConsumableSystem";
import { spawnBurst, spawnHitSpark, spawnDamageNumber } from "../Particle";
import { getRandomShopItems }                   from "../items/ItemPool";
import { circleCircle, rectCenter }             from "../Collision";
import {
  isRendMarked, clearRendMark, REND_BONUS_DAMAGE,
  isRiposteActive, tickRiposte, RIPOSTE_MULT, GLAIVE_EXTRA_COST,
} from "../WeaponPassiveRegistry";
import {
  tryIronWardenReflect,
  applyShadowWalkerFreeze,
  onBloodReaperKill,
} from "../items/ArmorRegistry";

// ============================================================
// [🧱 BLOCK: Constants]
// ============================================================
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
// [🧱 BLOCK: Item Drop Chances]
// ============================================================
const DROP_CHANCE = {
  grunt:   0.03,
  shooter: 0.06,
  tank:    0.12,
  dasher:  0.05,
  bomber:  0.08,
};
const ELITE_DROP_MULT = 1.5;

// ============================================================
// [🧱 BLOCK: Volatile Explosion Constants]
// ============================================================
const VOLATILE_EXPLODE_RADIUS = 55;
const VOLATILE_EXPLODE_DAMAGE = 20;

type AnyHordeEnemy = Grunt | Shooter | Tank | Dasher | Bomber;

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
  const ownedArmorIds   = Object.values(state.playerStats.armorSlots)
    .filter(Boolean).map((a) => a!.id);
  const pendingCharmIds = state.pendingLoot.filter((i) => i.kind === "charm").map((i) => i.id);
  const pendingWeaponId = state.pendingLoot.find((i) => i.kind === "weapon")?.id ?? null;
  const pendingArmorIds = state.pendingLoot.filter((i) => i.kind === "armor").map((i) => i.id);
  const pool = getRandomShopItems(
    [...ownedCharmIds, ...pendingCharmIds],
    ownedWeaponId ?? pendingWeaponId,
    [...ownedArmorIds, ...pendingArmorIds],
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
    state.projectiles   = [];
    state.goldDrops     = [];
    state.itemDrops     = [];
    state.particles     = [];
    state.hitSparks     = [];
    state.damageNumbers = [];
    state.boss          = null;
    state.enemies       = [];

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
    state.enemies       = [];
    state.projectiles   = [];
    state.goldDrops     = [];
    state.itemDrops     = [];
    state.particles     = [];
    state.hitSparks     = [];
    state.damageNumbers = [];
    state.door          = null;
    state.shopNpc       = null;
    state.kills         = 0;
    state.alive         = 0;
    state.lastSpawn     = 0;
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
  // Single helper that applies Iron Potion reduction, Ward
  // absorb, block, and takeHit in the correct order.
  // Returns true if damage was fully absorbed (Ward or iFrames).
  // ============================================================
  private applyIncomingDamage(
    state:    GameState,
    player:   Player,
    rawDamage:number,
    source:   BaseEnemy | null = null
  ): boolean {
    if (player.iFrames > 0) return true;

    // Ward Scroll — absorb the hit entirely
    if (ConsumableSystem.wardCanAbsorb(state)) {
      ConsumableSystem.consumeWardHit(state);
      state.particles.push(...spawnBurst(
        player.x + player.width  / 2,
        player.y + player.height / 2,
        '#a78bfa', 6, 1.0
      ));
      return true;
    }

    // Iron Potion damage reduction (multiplicative on top of base DR)
    const ironMult = ConsumableSystem.ironDamageReductionMult(state);
    let   dmg      = Math.round(rawDamage * ironMult);

    dmg = this.resolveBlock(player, dmg);
    if (dmg > 0) player.takeHit(dmg);

    // Iron Warden reflect — source is null for projectiles
    if (source !== null) {
      const iw5Count = state.playerStats.getEquippedSetCounts()['iron_warden'] ?? 0;
      tryIronWardenReflect(iw5Count, source);
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
    render:     RenderSystem
  ): void {
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
  ): { event: null; goldCollected: number } {
    const ps        = state.playerStats;
    const isElite   = rs.phase === 'elite';
    const threshold = this.getThreshold(rs.floor, isElite);
    const thresholdMet = state.kills >= threshold;

    // ── Phantom Potion — is player invisible? ─────────────────
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

    // ── Shadow Walker 5pc — freeze on dash ───────────────────
    const sw5Count = ps.getEquippedSetCounts()['shadow_walker'] ?? 0;
    if (sw5Count >= 5) {
      const wasDashing = (player as any)._wasDashingLastFrame ?? false;
      const isDashing  = player.dashTimer > 0;
      if (isDashing && !wasDashing) {
        applyShadowWalkerFreeze(sw5Count, state.enemies);
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
      // ── Phantom Potion — enemies lose aggro ───────────────
      // When invisible the enemy skips its normal update (no
      // chase / attack). It does NOT freeze — it simply idles
      // so it continues to wander if it has wander logic, or
      // just stands still. We still run stun logic below so
      // stuns applied before invisibility keep ticking.
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
        // Still tick stun timer while invisible so it doesn't
        // get frozen at full stun duration
        if (enemy.isStunned) {
          (enemy as any).stunTimer -= 16;
          if ((enemy as any).stunTimer < 0) (enemy as any).stunTimer = 0;
        }
      }

      // ── Drain projectiles from Shooters ───────────────────
      if (enemy instanceof Shooter && enemy.pendingProjectiles.length > 0) {
        state.projectiles.push(...enemy.pendingProjectiles);
        enemy.pendingProjectiles = [];
      }

      // ── Bomber explosion detection ────────────────────────
      if (enemy instanceof Bomber) {
        if (enemy.isExploding) {
          this.handleBomberExplosion(state, enemy, player, ps);
        }
      }

      if (enemy.isDead) return;

      // ── Windup-phase parry window ─────────────────────────
      // Skip melee contact checks while invisible
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

      // ── Dasher dash-hit ───────────────────────────────────
      if (enemy instanceof Dasher) {
        if (enemy.isDashHittingPlayer(player) && player.iFrames <= 0) {
          if (player.isParrying) {
            const parried = this.resolveParry(player, enemy, state);
            if (parried) { enemy.damageCooldown = 600; return; }
          }
          const rawDmg = Math.round(enemy.dashDamage * (1 - ps.damageReduction));
          this.applyIncomingDamage(state, player, rawDmg, enemy);
          enemy.damageCooldown = 800;
        }
        return;
      }

      // ── Bomber body contact ───────────────────────────────
      if (enemy instanceof Bomber) {
        if (enemy.isTouchingPlayer(player) && player.iFrames <= 0) {
          const rawDmg = Math.round(enemy.contactDmg * (1 - ps.damageReduction));
          this.applyIncomingDamage(state, player, rawDmg, enemy);
        }
        return;
      }

      // ── Standard melee contact ────────────────────────────
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
        if (!absorbed) enemy.applyKnockback(player);
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

    // ── Wrath Potion ATK bonus stacks additively ───────────────
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
      (enemy: BaseEnemy, amount: number) => {
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
        this.emitHitFeedback(state, enemy, finalAmt, player.attackType, render);
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

    const br5Count = ps.getEquippedSetCounts()['blood_reaper'] ?? 0;

    if (justKilled > 0) {
      state.kills      += justKilled;
      state.alive      -= justKilled;
      state.totalKills += justKilled;

      deadEnemies.forEach((enemy) => {
        const type: keyof typeof DROP_CHANCE =
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
        passive?.onKill?.(player, enemy, state);
        onBloodReaperKill(br5Count, enemy, state.enemies, state);
      });
    }

    // ── Item drop pickup ──────────────────────────────────────
    state.itemDrops = state.itemDrops.filter((drop) => {
      if (drop.collected) return false;
      drop.update(player);
      if (state.pendingLoot.length >= PENDING_LOOT_CAP) return !drop.collected;
      if (drop.playerIsNear) { state.pendingLoot.push(drop.item); return false; }
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
    state.enemies.forEach((e)     => e.draw(ctx, camera));
    state.projectiles.forEach((p) => p.draw(ctx, camera));
    state.itemDrops.forEach((d)   => d.draw(ctx, camera));
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