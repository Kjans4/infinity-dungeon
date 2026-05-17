// src/engine/ConsumableSystem.ts
import { GameState }          from "./GameState";
import { Player }             from "./Player";
import { ConsumableDef, getEffectsAtLevel, CONSUMABLE_REGISTRY } from "./ConsumableRegistry";
import {
  ConsumableProjectile,
  ConsumableExplosion,
} from "./ConsumableProjectile";
import { BaseEnemy }          from "./enemy/BaseEnemy";
import { AnyBoss }            from "./enemy/boss/index";
import { Colossus }           from "./enemy/boss/Colossus";
import { distSq, dist }       from "./Collision";
import { spawnBurst, spawnHitSpark } from "./Particle";
import { Camera }             from "./Camera";

// ============================================================
// [🧱 BLOCK: Constants]
// ============================================================
const FIREBALL_SPEED     = 7;
const FIREBALL_RADIUS    = 10;

const FROST_RANGE        = 140;
const FROST_HALF_ANGLE   = Math.PI * 0.35;
const FROST_RADIUS       = 140;

const LIGHTNING_SPEED    = 9;
const LIGHTNING_RANGE    = 400;
const LIGHTNING_RADIUS   = 8;
const LIGHTNING_CHAIN_R  = 140;

const VOID_PULL_STRENGTH_BOSS_MULT = 0.5;

const BLINK_IFRAMES      = 400;

const WARD_VISUAL_RADIUS = 38;

// ============================================================
// [🧱 BLOCK: Boss Hit Helpers]
// ============================================================
function bossTakeDamage(boss: AnyBoss, damage: number): void {
  if (boss instanceof Colossus) {
    boss.takeDamage(damage, false);
  } else {
    boss.takeDamage(damage);
  }
}

function bossCenterX(boss: AnyBoss): number { return boss.x + boss.width  / 2; }
function bossCenterY(boss: AnyBoss): number { return boss.y + boss.height / 2; }

// ============================================================
// [🧱 BLOCK: ConsumableSystem]
// Owns all in-flight consumable projectiles and explosions.
// Called from the game loop every frame.
// ============================================================
export class ConsumableSystem {
  projectiles: ConsumableProjectile[] = [];
  explosions:  ConsumableExplosion[]  = [];

  // ============================================================
  // [🧱 BLOCK: Activate]
  // Entry point called from GameCanvas when a slot is activated.
  // Dispatches to the correct handler based on consumable id.
  // ============================================================
  activate(
    def:    ConsumableDef,
    player: Player,
    state:  GameState,
  ): void {
    switch (def.id) {
      case 'health_potion':    this._applyHealthPotion(def, player, state);    break;
      case 'wrath_potion':     /* buff applied via PlayerConsumables timers */  break;
      case 'iron_potion':      /* buff applied via PlayerConsumables timers */  break;
      case 'phantom_potion':   /* buff applied via PlayerConsumables timers */  break;
      case 'fireball_scroll':  this._spawnFireball(def, player, state);        break;
      case 'frost_scroll':     this._applyFrost(def, player, state);           break;
      case 'lightning_scroll': this._spawnLightning(def, player, state);       break;
      case 'blink_scroll':     this._applyBlink(def, player, state);           break;
      case 'ward_scroll':      this._applyWard(player);                        break;
      case 'void_scroll':      this._applyVoid(def, player, state);            break;
    }
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // Called every frame (~16ms). Ticks projectiles, checks hits,
  // applies explosions. Also applies per-frame buff effects.
  // ============================================================
  update(state: GameState, player: Player, deltaMs: number = 16): void {
    const pc = state.playerConsumables;

    // ── Wrath Potion — speed boost applied directly to player ─
    const wrathActive = pc.isActive('wrath_potion');
    if (wrathActive) {
      player.maxSpeed = state.playerStats.applySpeedOnly(player) + 1.5;
    } else {
      player.maxSpeed = state.playerStats.applySpeedOnly(player);
    }

    // ── Tick projectiles ──────────────────────────────────────
    for (const proj of this.projectiles) {
      if (proj.done) continue;
      proj.update(deltaMs);
      if (proj.done) continue;
      this._checkProjectileHits(proj, state, player);
    }

    // ── Tick explosions ───────────────────────────────────────
    for (const exp of this.explosions) {
      exp.update(deltaMs);
    }

    // ── Prune dead objects ────────────────────────────────────
    this.projectiles = this.projectiles.filter((p) => !p.done);
    this.explosions  = this.explosions.filter((e)  => !e.done);
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // ============================================================
  draw(
    ctx:    CanvasRenderingContext2D,
    camera: Camera,
    state:  GameState,
    player: Player,
  ): void {
    const pc = state.playerConsumables;

    for (const exp of this.explosions) exp.draw(ctx, camera);
    for (const proj of this.projectiles) proj.draw(ctx, camera);

    // ── Ward ring ─────────────────────────────────────────────
    const wardActive = pc.isActive('ward_scroll');
    if (wardActive) {
      const wardSlot = pc.slots.find(
        (s) => s.assignedId === 'ward_scroll' && s.durationMs > 0
      );
      const hitsLeft = wardSlot?.wardHits ?? 0;
      if (hitsLeft > 0) {
        const sx    = camera.toScreenX(player.x + player.width  / 2);
        const sy    = camera.toScreenY(player.y + player.height / 2);
        const pulse = Math.sin(Date.now() / 150) * 0.2 + 0.8;
        ctx.save();
        ctx.beginPath();
        ctx.arc(sx, sy, WARD_VISUAL_RADIUS, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(167,139,250,${pulse * 0.85})`;
        ctx.lineWidth   = 2.5;
        ctx.shadowColor = "#a78bfa";
        ctx.shadowBlur  = 12 * pulse;
        ctx.stroke();
        ctx.restore();
      }
    }

    // ── Phantom shimmer ───────────────────────────────────────
    const phantomActive = pc.isActive('phantom_potion');
    if (phantomActive) {
      const sx    = camera.toScreenX(player.x);
      const sy    = camera.toScreenY(player.y);
      const pulse = Math.sin(Date.now() / 200) * 0.15 + 0.25;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle   = "#7dd3fc";
      ctx.fillRect(sx, sy, player.width, player.height);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  // ============================================================
  // [🧱 BLOCK: Reset]
  // ============================================================
  reset(): void {
    this.projectiles = [];
    this.explosions  = [];
  }

  // ============================================================
  // [🧱 BLOCK: Buff Query Helpers — Level-Aware]
  // Used by HordeSystem and BossSystem to read active buffs
  // when computing damage received by the player.
  // Uses direct static import of CONSUMABLE_REGISTRY — no require().
  // ============================================================

  /**
   * Flat ATK bonus from Wrath Potion — reads the leveled atkBonus.
   * Level 1: 25 | Level 2: 32 | Level 3: 40 | Level 4: 50 | Level 5: 65
   */
  static wrathAtkBonus(state: GameState): number {
    if (!state.playerConsumables.isActive('wrath_potion')) return 0;
    const level = state.playerConsumables.getLevel('wrath_potion');
    const def   = CONSUMABLE_REGISTRY['wrath_potion'];
    const fx    = getEffectsAtLevel(def, level);
    return fx[0] ?? 25;
  }

  /**
   * Damage reduction multiplier from Iron Potion — level-aware.
   * Returns (1 - reduction) so callers can multiply:
   *   e.g. level 1: reduction=0.40 → returns 0.60
   *        level 5: reduction=0.70 → returns 0.30
   * Stacks multiplicatively with charm/armor DR (handled in systems).
   */
  static ironDamageReductionMult(state: GameState): number {
    if (!state.playerConsumables.isActive('iron_potion')) return 1.0;
    const level     = state.playerConsumables.getLevel('iron_potion');
    const def       = CONSUMABLE_REGISTRY['iron_potion'];
    const fx        = getEffectsAtLevel(def, level);
    const reduction = fx[0] ?? 0.4;
    return 1.0 - reduction;
  }

  /** True when Phantom Potion is active — enemies should lose aggro. */
  static isPhantomActive(state: GameState): boolean {
    return state.playerConsumables.isActive('phantom_potion');
  }

  /** True when Ward is active AND has hits remaining. */
  static wardCanAbsorb(state: GameState): boolean {
    const slot = state.playerConsumables.slots.find(
      (s) => s.assignedId === 'ward_scroll' && s.durationMs > 0
    );
    return !!slot && slot.wardHits > 0;
  }

  /** Consume one Ward hit. Returns true if absorbed. */
  static consumeWardHit(state: GameState): boolean {
    const slot = state.playerConsumables.slots.find(
      (s) => s.assignedId === 'ward_scroll' && s.durationMs > 0
    );
    if (!slot || slot.wardHits <= 0) return false;
    slot.wardHits--;
    if (slot.wardHits <= 0) slot.durationMs = 0;
    return true;
  }

  // ============================================================
  // [🧱 BLOCK: Private — Health Potion (level-aware)]
  // ============================================================
  private _applyHealthPotion(def: ConsumableDef, player: Player, state: GameState): void {
    const level   = state.playerConsumables.getLevel(def.id);
    const fx      = getEffectsAtLevel(def, level);
    const healAmt = fx[0] ?? def.effectValue;
    player.hp = Math.min(player.maxHp, player.hp + healAmt);
  }

  // ============================================================
  // [🧱 BLOCK: Private — Fireball Spawn (level-aware)]
  // ============================================================
  private _spawnFireball(def: ConsumableDef, player: Player, state: GameState): void {
    const cx     = player.x + player.width  / 2;
    const cy     = player.y + player.height / 2;
    const fx_dir = player.facing.x;
    const fy_dir = player.facing.y;
    const level  = state.playerConsumables.getLevel(def.id);
    const fx     = getEffectsAtLevel(def, level);
    const damage = (fx[0] ?? 45) + state.playerStats.atkBonus;
    const aoe    = fx[1] ?? 90;

    this.projectiles.push(new ConsumableProjectile({
      x: cx, y: cy,
      vx: fx_dir * FIREBALL_SPEED,
      vy: fy_dir * FIREBALL_SPEED,
      facingX: fx_dir, facingY: fy_dir,
      kind:     'fireball',
      damage,
      speed:    FIREBALL_SPEED,
      maxRange: 500,
      lifetime: 4000,
      radius:   FIREBALL_RADIUS,
      color:    '#fb923c',
      // store aoe for detonation — piggyback via chainsLeft field as aoeRadius
      chainsLeft: aoe,
    }));
  }

  // ============================================================
  // [🧱 BLOCK: Private — Frost Cone (level-aware, instant AoE)]
  // ============================================================
  private _applyFrost(def: ConsumableDef, player: Player, state: GameState): void {
    const cx          = player.x + player.width  / 2;
    const cy          = player.y + player.height / 2;
    const fx_dir      = player.facing.x;
    const fy_dir      = player.facing.y;
    const level       = state.playerConsumables.getLevel(def.id);
    const fx          = getEffectsAtLevel(def, level);
    const damage      = (fx[0] ?? 28) + state.playerStats.atkBonus;
    const freezeMs    = fx[1] ?? 2000;
    const facingAngle = Math.atan2(fy_dir, fx_dir);

    // ── Horde enemies ─────────────────────────────────────────
    for (const enemy of state.enemies) {
      if (enemy.isDead) continue;
      const ecx = enemy.x + enemy.width  / 2;
      const ecy = enemy.y + enemy.height / 2;
      if (dist(cx, cy, ecx, ecy) > FROST_RANGE) continue;
      const angle = Math.atan2(ecy - cy, ecx - cx);
      let   diff  = angle - facingAngle;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > FROST_HALF_ANGLE) continue;
      enemy.takeDamage(damage);
      enemy.applyStun(freezeMs);
      state.particles.push(...spawnHitSpark(ecx, ecy, '#93c5fd', 5));
    }

    // ── Boss ─────────────────────────────────────────────────
    const boss = state.boss;
    if (boss && !boss.isDead) {
      const bcx = bossCenterX(boss);
      const bcy = bossCenterY(boss);
      if (dist(cx, cy, bcx, bcy) <= FROST_RANGE) {
        const angle = Math.atan2(bcy - cy, bcx - cx);
        let   diff  = angle - facingAngle;
        while (diff >  Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) <= FROST_HALF_ANGLE) {
          bossTakeDamage(boss, damage);
          state.particles.push(...spawnHitSpark(bcx, bcy, '#93c5fd', 8));
        }
      }
    }

    this.projectiles.push(new ConsumableProjectile({
      x: cx, y: cy,
      vx: 0, vy: 0,
      facingX: fx_dir, facingY: fy_dir,
      kind:     'frost',
      damage:   0,
      speed:    0,
      maxRange: 0,
      lifetime: 320,
      radius:   FROST_RADIUS,
      color:    '#93c5fd',
    }));

    state.particles.push(...spawnBurst(cx, cy, '#93c5fd', 12, 1.2));
  }

  // ============================================================
  // [🧱 BLOCK: Private — Lightning Spawn (level-aware)]
  // ============================================================
  private _spawnLightning(def: ConsumableDef, player: Player, state: GameState): void {
    const cx     = player.x + player.width  / 2;
    const cy     = player.y + player.height / 2;
    const fx_dir = player.facing.x;
    const fy_dir = player.facing.y;
    const level  = state.playerConsumables.getLevel(def.id);
    const fx     = getEffectsAtLevel(def, level);
    const damage = (fx[0] ?? 32) + state.playerStats.atkBonus;
    const chains = Math.round(fx[1] ?? 3);

    this.projectiles.push(new ConsumableProjectile({
      x: cx, y: cy,
      vx: fx_dir * LIGHTNING_SPEED,
      vy: fy_dir * LIGHTNING_SPEED,
      facingX: fx_dir, facingY: fy_dir,
      kind:       'lightning',
      damage,
      speed:      LIGHTNING_SPEED,
      maxRange:   LIGHTNING_RANGE,
      lifetime:   4000,
      radius:     LIGHTNING_RADIUS,
      color:      '#7dd3fc',
      chainsLeft: chains,
    }));
  }

  // ============================================================
  // [🧱 BLOCK: Private — Blink (level-aware teleport)]
  // ============================================================
  private _applyBlink(def: ConsumableDef, player: Player, state: GameState): void {
    const level    = state.playerConsumables.getLevel(def.id);
    const fx       = getEffectsAtLevel(def, level);
    const distance = fx[0] ?? 300;

    const fx_dir = player.facing.x;
    const fy_dir = player.facing.y;
    const newX   = player.x + fx_dir * distance;
    const newY   = player.y + fy_dir * distance;

    player.x = Math.max(0, newX);
    player.y = Math.max(0, newY);
    player.iFrames = Math.max(player.iFrames, BLINK_IFRAMES);

    const ocx = player.x + player.width  / 2;
    const ocy = player.y + player.height / 2;
    state.particles.push(...spawnBurst(ocx, ocy, '#38bdf8', 10, 1.3));
  }

  // ============================================================
  // [🧱 BLOCK: Private — Ward Shield (level-aware hit count)]
  // Ward hit count and duration are set by GameCanvas after
  // activate() via applyConsumableEffect. Level reading happens
  // there by calling getEffectsAtLevel directly.
  // ============================================================
  private _applyWard(_player: Player): void {
    // Handled in GameCanvas._applyConsumableEffect()
  }

  // ============================================================
  // [🧱 BLOCK: Private — Void Pull (level-aware)]
  // ============================================================
  private _applyVoid(def: ConsumableDef, player: Player, state: GameState): void {
    const cx     = player.x + player.width  / 2;
    const cy     = player.y + player.height / 2;
    const fx_dir = player.facing.x;
    const fy_dir = player.facing.y;

    const level       = state.playerConsumables.getLevel(def.id);
    const fx          = getEffectsAtLevel(def, level);
    const pullRange   = fx[0] ?? 160;
    const pullStrength= fx[1] ?? 20;

    // Pull point ~120px ahead in facing direction
    const px = cx + fx_dir * 120;
    const py = cy + fy_dir * 120;

    // ── Horde enemies ─────────────────────────────────────────
    for (const enemy of state.enemies) {
      if (enemy.isDead) continue;
      const ecx = enemy.x + enemy.width  / 2;
      const ecy = enemy.y + enemy.height / 2;
      if (distSq(px, py, ecx, ecy) > pullRange * pullRange) continue;
      const d = dist(px, py, ecx, ecy);
      if (d < 4) continue;
      enemy.x += ((px - ecx) / d) * pullStrength;
      enemy.y += ((py - ecy) / d) * pullStrength;
    }

    // ── Boss — half strength ──────────────────────────────────
    const boss = state.boss;
    if (boss && !boss.isDead) {
      const bcx = bossCenterX(boss);
      const bcy = bossCenterY(boss);
      if (distSq(px, py, bcx, bcy) <= pullRange * pullRange) {
        const d = dist(px, py, bcx, bcy);
        if (d >= 4) {
          boss.x += ((px - bcx) / d) * (pullStrength * VOID_PULL_STRENGTH_BOSS_MULT);
          boss.y += ((py - bcy) / d) * (pullStrength * VOID_PULL_STRENGTH_BOSS_MULT);
        }
      }
    }

    this.projectiles.push(new ConsumableProjectile({
      x: px, y: py,
      vx: 0, vy: 0,
      facingX: fx_dir, facingY: fy_dir,
      kind:     'void',
      damage:   0,
      speed:    0,
      maxRange: 0,
      lifetime: 400,
      radius:   pullRange,
      color:    '#a78bfa',
    }));

    state.particles.push(...spawnBurst(px, py, '#a78bfa', 14, 1.5));
  }

  // ============================================================
  // [🧱 BLOCK: Private — Projectile Hit Checks]
  // ============================================================
  private _checkProjectileHits(
    proj:   ConsumableProjectile,
    state:  GameState,
    player: Player,
  ): void {
    const enemies  = state.enemies.filter((e) => !e.isDead);
    const boss     = (state.boss && !state.boss.isDead) ? state.boss : null;

    switch (proj.kind) {

      case 'fireball': {
        for (const enemy of enemies) {
          if (!proj.hitsEnemy(enemy)) continue;
          this._detonateFireball(proj, state, enemies, boss);
          return;
        }
        if (boss && proj.hitsEnemy(boss)) {
          this._detonateFireball(proj, state, enemies, boss);
          return;
        }
        break;
      }

      case 'lightning': {
        for (const enemy of enemies) {
          if (!proj.hitsEnemy(enemy)) continue;
          enemy.takeDamage(proj.damage);
          state.particles.push(...spawnHitSpark(
            enemy.x + enemy.width  / 2,
            enemy.y + enemy.height / 2,
            '#7dd3fc', 5
          ));
          this._chainLightning(proj, state, enemies, boss,
            enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy);
          return;
        }
        if (boss && proj.hitsEnemy(boss)) {
          bossTakeDamage(boss, proj.damage);
          state.particles.push(...spawnHitSpark(
            bossCenterX(boss), bossCenterY(boss), '#7dd3fc', 8
          ));
          proj.done = true;
          return;
        }
        break;
      }

      default: break;
    }
  }

  // ============================================================
  // [🧱 BLOCK: Private — Fireball Detonate (level-aware AoE)]
  // aoeRadius is stored in proj.chainsLeft when spawned.
  // ============================================================
  private _detonateFireball(
    proj:    ConsumableProjectile,
    state:   GameState,
    enemies: BaseEnemy[],
    boss:    AnyBoss | null
  ): void {
    proj.done = true;
    const cx      = proj.x;
    const cy      = proj.y;
    const aoeR    = proj.chainsLeft > 0 ? proj.chainsLeft : 90; // aoeRadius stored here

    for (const e of enemies) {
      const ecx = e.x + e.width  / 2;
      const ecy = e.y + e.height / 2;
      if (distSq(cx, cy, ecx, ecy) < aoeR * aoeR) {
        e.takeDamage(proj.damage);
        state.particles.push(...spawnHitSpark(ecx, ecy, '#fb923c', 4));
      }
    }

    if (boss) {
      const bcx = bossCenterX(boss);
      const bcy = bossCenterY(boss);
      if (distSq(cx, cy, bcx, bcy) < aoeR * aoeR) {
        bossTakeDamage(boss, proj.damage);
        state.particles.push(...spawnHitSpark(bcx, bcy, '#fb923c', 8));
      }
    }

    this.explosions.push(new ConsumableExplosion(cx, cy, aoeR, '#fb923c'));
    state.particles.push(...spawnBurst(cx, cy, '#fb923c', 14, 1.6));
  }

  // ============================================================
  // [🧱 BLOCK: Private — Lightning Chain]
  // ============================================================
  private _chainLightning(
    proj:       ConsumableProjectile,
    state:      GameState,
    enemies:    BaseEnemy[],
    boss:       AnyBoss | null,
    fromX:      number,
    fromY:      number,
    hitEntity:  BaseEnemy | AnyBoss
  ): void {
    if (proj.chainsLeft <= 0) { proj.done = true; return; }
    proj.done = true;

    const others = enemies
      .filter((e) => e !== hitEntity)
      .sort((a, b) =>
        distSq(fromX, fromY, a.x + a.width / 2, a.y + a.height / 2) -
        distSq(fromX, fromY, b.x + b.width / 2, b.y + b.height / 2)
      );

    let chainTarget: BaseEnemy | AnyBoss | null = null;
    let chainDist = Infinity;

    const nextEnemy = others.find((e) =>
      distSq(fromX, fromY, e.x + e.width / 2, e.y + e.height / 2) <
      LIGHTNING_CHAIN_R * LIGHTNING_CHAIN_R
    );
    if (nextEnemy) {
      chainDist   = distSq(fromX, fromY, nextEnemy.x + nextEnemy.width / 2, nextEnemy.y + nextEnemy.height / 2);
      chainTarget = nextEnemy;
    }

    if (boss && boss !== hitEntity) {
      const bd = distSq(fromX, fromY, bossCenterX(boss), bossCenterY(boss));
      if (bd < LIGHTNING_CHAIN_R * LIGHTNING_CHAIN_R && bd < chainDist) {
        chainTarget = boss;
      }
    }

    if (!chainTarget) return;

    const tcx = (chainTarget as any).x + (chainTarget as any).width  / 2;
    const tcy = (chainTarget as any).y + (chainTarget as any).height / 2;
    const d   = dist(fromX, fromY, tcx, tcy);
    const vx  = ((tcx - fromX) / d) * LIGHTNING_SPEED;
    const vy  = ((tcy - fromY) / d) * LIGHTNING_SPEED;

    this.projectiles.push(new ConsumableProjectile({
      x: fromX, y: fromY, vx, vy,
      facingX: vx / LIGHTNING_SPEED,
      facingY: vy / LIGHTNING_SPEED,
      kind:       'lightning',
      damage:     proj.damage,
      speed:      LIGHTNING_SPEED,
      maxRange:   LIGHTNING_CHAIN_R + 20,
      lifetime:   2000,
      radius:     LIGHTNING_RADIUS,
      color:      '#7dd3fc',
      chainsLeft: proj.chainsLeft - 1,
    }));
  }
}