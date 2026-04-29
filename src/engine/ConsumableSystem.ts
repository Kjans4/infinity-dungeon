// src/engine/ConsumableSystem.ts
import { GameState }          from "./GameState";
import { Player }             from "./Player";
import { ConsumableDef }      from "./ConsumableRegistry";
import {
  ConsumableProjectile,
  ConsumableExplosion,
} from "./ConsumableProjectile";
import { BaseEnemy }          from "./enemy/BaseEnemy";
import { distSq, dist }       from "./Collision";
import { spawnBurst, spawnHitSpark } from "./Particle";
import { Camera }             from "./Camera";

// ============================================================
// [🧱 BLOCK: Constants]
// ============================================================
const FIREBALL_SPEED     = 7;
const FIREBALL_RANGE     = 500;
const FIREBALL_RADIUS    = 10;
const FIREBALL_AOE       = 80;    // explosion radius

const FROST_RANGE        = 140;   // cone half-length
const FROST_HALF_ANGLE   = Math.PI * 0.35; // ~63° half-angle
const FROST_FREEZE_MS    = 2000;
const FROST_RADIUS       = 140;   // visual radius for instant hit

const LIGHTNING_SPEED    = 9;
const LIGHTNING_RANGE    = 400;
const LIGHTNING_RADIUS   = 8;
const LIGHTNING_CHAINS   = 3;
const LIGHTNING_CHAIN_R  = 140;   // px — chain search radius

const VOID_PULL_RANGE    = 200;   // enemies within this are pulled
const VOID_PULL_STRENGTH = 18;    // px per frame toward point
const VOID_RADIUS        = 200;   // visual radius

const BLINK_DISTANCE     = 300;
const BLINK_IFRAMES      = 400;

const WARD_VISUAL_RADIUS = 38;

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
      case 'health_potion':    this._applyHealthPotion(def, player);           break;
      case 'wrath_potion':     /* buff applied via PlayerConsumables timers */  break;
      case 'iron_potion':      /* buff applied via PlayerConsumables timers */  break;
      case 'phantom_potion':   /* buff applied via PlayerConsumables timers */  break;
      case 'fireball_scroll':  this._spawnFireball(def, player, state);         break;
      case 'frost_scroll':     this._applyFrost(def, player, state);            break;
      case 'lightning_scroll': this._spawnLightning(def, player, state);        break;
      case 'blink_scroll':     this._applyBlink(def, player, state);            break;
      case 'ward_scroll':      this._applyWard(player);                         break;
      case 'void_scroll':      this._applyVoid(def, player, state);             break;
    }
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // Called every frame (~16ms). Ticks projectiles, checks hits,
  // applies explosions. Also applies per-frame buff effects
  // (Wrath speed boost is applied to player here).
  // ============================================================
  update(state: GameState, player: Player, deltaMs: number = 16): void {
    const pc = state.playerConsumables;

    // ── Per-frame buff effects ────────────────────────────────

    // Wrath Potion — speed boost applied directly to player
    // Base maxSpeed is set by playerStats; we layer on top here.
    const wrathActive = pc.isActive('wrath_potion');
    if (wrathActive) {
      // Speed bonus applied every frame — no double-stack risk
      // because Player.update caps to maxSpeed and we reset each frame
      player.maxSpeed = state.playerStats.applySpeedOnly(player) + 1.5;
    } else {
      // Ensure speed is always correct from base stats
      player.maxSpeed = state.playerStats.applySpeedOnly(player);
    }

    // Phantom Potion — handled in draw (player invisible)
    // and in HordeSystem (enemies lose aggro when isInvisible)

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
    this.explosions  = this.explosions.filter((e) => !e.done);
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // Called after enemies are drawn. Projectiles + explosions
  // on top. Also draws Ward ring and Phantom shimmer on player.
  // ============================================================
  draw(
    ctx:    CanvasRenderingContext2D,
    camera: Camera,
    state:  GameState,
    player: Player,
  ): void {
    const pc = state.playerConsumables;

    // Explosions under projectiles
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
  // [🧱 BLOCK: Buff Query Helpers]
  // Used by HordeSystem and BossSystem to read active buffs
  // when computing damage received by the player.
  // ============================================================

  /** Flat ATK bonus from Wrath Potion (20) or 0. */
  static wrathAtkBonus(state: GameState): number {
    return state.playerConsumables.isActive('wrath_potion') ? 20 : 0;
  }

  /** Damage reduction multiplier from Iron Potion (0.6) or 1.0. */
  static ironDamageReductionMult(state: GameState): number {
    return state.playerConsumables.isActive('iron_potion') ? 0.6 : 1.0;
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
  // [🧱 BLOCK: Private — Health Potion]
  // ============================================================
  private _applyHealthPotion(def: ConsumableDef, player: Player): void {
    player.hp = Math.min(player.maxHp, player.hp + def.effectValue);
  }

  // ============================================================
  // [🧱 BLOCK: Private — Fireball Spawn]
  // ============================================================
  private _spawnFireball(def: ConsumableDef, player: Player, state: GameState): void {
    const cx = player.x + player.width  / 2;
    const cy = player.y + player.height / 2;
    const fx = player.facing.x;
    const fy = player.facing.y;

    // Total damage = base scroll damage + atkBonus
    const damage = def.effectValue + state.playerStats.atkBonus;

    this.projectiles.push(new ConsumableProjectile({
      x: cx, y: cy,
      vx: fx * FIREBALL_SPEED,
      vy: fy * FIREBALL_SPEED,
      facingX: fx, facingY: fy,
      kind:     'fireball',
      damage,
      speed:    FIREBALL_SPEED,
      maxRange: FIREBALL_RANGE,
      lifetime: 4000,
      radius:   FIREBALL_RADIUS,
      color:    '#fb923c',
    }));
  }

  // ============================================================
  // [🧱 BLOCK: Private — Frost Cone (instant AoE)]
  // ============================================================
  private _applyFrost(def: ConsumableDef, player: Player, state: GameState): void {
    const cx     = player.x + player.width  / 2;
    const cy     = player.y + player.height / 2;
    const fx     = player.facing.x;
    const fy     = player.facing.y;
    const damage = def.effectValue + state.playerStats.atkBonus;
    const facingAngle = Math.atan2(fy, fx);

    // Hit all enemies in cone
    for (const enemy of state.enemies) {
      if (enemy.isDead) continue;
      const ecx  = enemy.x + enemy.width  / 2;
      const ecy  = enemy.y + enemy.height / 2;
      const d    = dist(cx, cy, ecx, ecy);
      if (d > FROST_RANGE) continue;

      const angle = Math.atan2(ecy - cy, ecx - cx);
      let   diff  = angle - facingAngle;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > FROST_HALF_ANGLE) continue;

      enemy.takeDamage(damage);
      enemy.applyStun(FROST_FREEZE_MS);
      state.particles.push(...spawnHitSpark(ecx, ecy, '#93c5fd', 5));
    }

    // Visual — instant AoE projectile that lives 1 frame
    this.projectiles.push(new ConsumableProjectile({
      x: cx, y: cy,
      vx: 0, vy: 0,
      facingX: fx, facingY: fy,
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
  // [🧱 BLOCK: Private — Lightning Spawn]
  // ============================================================
  private _spawnLightning(def: ConsumableDef, player: Player, state: GameState): void {
    const cx     = player.x + player.width  / 2;
    const cy     = player.y + player.height / 2;
    const fx     = player.facing.x;
    const fy     = player.facing.y;
    const damage = def.effectValue + state.playerStats.atkBonus;

    this.projectiles.push(new ConsumableProjectile({
      x: cx, y: cy,
      vx: fx * LIGHTNING_SPEED,
      vy: fy * LIGHTNING_SPEED,
      facingX: fx, facingY: fy,
      kind:       'lightning',
      damage,
      speed:      LIGHTNING_SPEED,
      maxRange:   LIGHTNING_RANGE,
      lifetime:   4000,
      radius:     LIGHTNING_RADIUS,
      color:      '#7dd3fc',
      chainsLeft: LIGHTNING_CHAINS,
    }));
  }

  // ============================================================
  // [🧱 BLOCK: Private — Blink (teleport)]
  // ============================================================
  private _applyBlink(def: ConsumableDef, player: Player, state: GameState): void {
    const fx      = player.facing.x;
    const fy      = player.facing.y;
    const worldW  = state.screenW; // rough — clamped below
    const worldH  = state.screenH;

    const newX = player.x + fx * BLINK_DISTANCE;
    const newY = player.y + fy * BLINK_DISTANCE;

    // Clamp to safe world bounds — proper world bounds handled by caller
    player.x = Math.max(0, newX);
    player.y = Math.max(0, newY);

    // Grant i-frames through blink
    player.iFrames = Math.max(player.iFrames, BLINK_IFRAMES);

    // VFX at origin + destination
    const ocx = player.x + player.width  / 2;
    const ocy = player.y + player.height / 2;
    state.particles.push(...spawnBurst(ocx, ocy, '#38bdf8', 10, 1.3));
  }

  // ============================================================
  // [🧱 BLOCK: Private — Ward Shield]
  // Sets wardHits on the active ward slot.
  // ============================================================
  private _applyWard(player: Player): void {
    // Find the ward slot — it was just activated so durationMs was set
    // by PlayerConsumables.activateSlot before this is called.
    // We just need to set wardHits to the effectValue (3).
    // PlayerConsumables stores wardHits per slot.
    // We reach the slot through the player consumables in state —
    // passed by reference from GameCanvas, so we set it on the
    // correct slot object directly in ConsumableSystem.activate().
    // Ward hit count is set externally by GameCanvas after activate()
    // returns — see GameCanvas._applyConsumableEffect().
    // (Handled in GameCanvas directly for simplicity.)
  }

  // ============================================================
  // [🧱 BLOCK: Private — Void Pull (instant AoE)]
  // ============================================================
  private _applyVoid(def: ConsumableDef, player: Player, state: GameState): void {
    const cx = player.x + player.width  / 2;
    const cy = player.y + player.height / 2;
    const fx = player.facing.x;
    const fy = player.facing.y;

    // Pull point is ~120px ahead of the player in facing dir
    const px = cx + fx * 120;
    const py = cy + fy * 120;

    for (const enemy of state.enemies) {
      if (enemy.isDead) continue;
      const ecx = enemy.x + enemy.width  / 2;
      const ecy = enemy.y + enemy.height / 2;
      if (distSq(px, py, ecx, ecy) > VOID_PULL_RANGE * VOID_PULL_RANGE) continue;

      // Nudge enemy toward pull point
      const d  = dist(px, py, ecx, ecy);
      if (d < 4) continue;
      const dx = (px - ecx) / d;
      const dy = (py - ecy) / d;
      enemy.x += dx * VOID_PULL_STRENGTH;
      enemy.y += dy * VOID_PULL_STRENGTH;
    }

    // Visual indicator
    this.projectiles.push(new ConsumableProjectile({
      x: px, y: py,
      vx: 0, vy: 0,
      facingX: fx, facingY: fy,
      kind:     'void',
      damage:   0,
      speed:    0,
      maxRange: 0,
      lifetime: 400,
      radius:   VOID_RADIUS,
      color:    '#a78bfa',
    }));

    state.particles.push(...spawnBurst(px, py, '#a78bfa', 14, 1.5));
  }

  // ============================================================
  // [🧱 BLOCK: Private — Projectile Hit Checks]
  // Called per frame for each live projectile.
  // ============================================================
  private _checkProjectileHits(
    proj:   ConsumableProjectile,
    state:  GameState,
    player: Player,
  ): void {
    const enemies = state.enemies.filter((e) => !e.isDead);

    switch (proj.kind) {

      case 'fireball': {
        for (const enemy of enemies) {
          if (!proj.hitsEnemy(enemy)) continue;
          // Detonate
          proj.done = true;
          const cx  = proj.x;
          const cy  = proj.y;
          // AoE — damage all enemies in explosion radius
          for (const e of enemies) {
            const ecx = e.x + e.width  / 2;
            const ecy = e.y + e.height / 2;
            if (distSq(cx, cy, ecx, ecy) < FIREBALL_AOE * FIREBALL_AOE) {
              e.takeDamage(proj.damage);
              state.particles.push(...spawnHitSpark(ecx, ecy, '#fb923c', 4));
            }
          }
          this.explosions.push(new ConsumableExplosion(cx, cy, FIREBALL_AOE, '#fb923c'));
          state.particles.push(...spawnBurst(cx, cy, '#fb923c', 14, 1.6));
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

          // Chain to nearest other enemy
          if (proj.chainsLeft > 0) {
            proj.done = true;
            const ecx    = enemy.x + enemy.width  / 2;
            const ecy    = enemy.y + enemy.height / 2;
            const others = enemies
              .filter((e) => e !== enemy)
              .sort((a, b) =>
                distSq(ecx, ecy, a.x + a.width/2, a.y + a.height/2) -
                distSq(ecx, ecy, b.x + b.width/2, b.y + b.height/2)
              );
            const next = others.find((e) =>
              distSq(ecx, ecy, e.x + e.width/2, e.y + e.height/2) <
              LIGHTNING_CHAIN_R * LIGHTNING_CHAIN_R
            );
            if (next) {
              const ncx = next.x + next.width  / 2;
              const ncy = next.y + next.height / 2;
              const d   = dist(ecx, ecy, ncx, ncy);
              const vx  = ((ncx - ecx) / d) * LIGHTNING_SPEED;
              const vy  = ((ncy - ecy) / d) * LIGHTNING_SPEED;
              this.projectiles.push(new ConsumableProjectile({
                x: ecx, y: ecy, vx, vy,
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
          } else {
            proj.done = true;
          }
          return;
        }
        break;
      }

      // frost and void are instant — no per-frame hit checks needed
      default: break;
    }
  }
}