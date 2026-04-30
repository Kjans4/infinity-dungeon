// src/engine/ConsumableProjectile.ts
import { Camera }    from "./Camera";
import { BaseEnemy } from "./enemy/BaseEnemy";
import { distSq }    from "./Collision";

// ============================================================
// [🧱 BLOCK: Projectile Types]
// ============================================================
export type ConsumableProjectileKind =
  | 'fireball'
  | 'frost'
  | 'lightning'
  | 'void';

// ============================================================
// [🧱 BLOCK: ConsumableProjectile Class]
// All scroll projectiles share this class.
// Kind-specific behaviour is handled in ConsumableSystem.
//
// fireball  — travels in facing dir, explodes on impact
// frost     — instant cone AoE, no travel (lifetime=1)
// lightning — travels, chains on first enemy hit
// void      — instant pull AoE at target point, no travel
// ============================================================
export class ConsumableProjectile {
  x:       number;
  y:       number;
  vx:      number;
  vy:      number;
  kind:    ConsumableProjectileKind;
  damage:  number;

  // Facing unit vector — used for cone/pull direction
  facingX: number;
  facingY: number;

  // Travel limits
  speed:      number;
  maxRange:   number;
  traveledSq: number = 0;

  // Lifecycle
  done:     boolean = false;
  lifetime: number;          // ms — for instant AOEs (frost/void) set to 1

  // Visual
  radius:  number;
  color:   string;
  private pulseTimer: number = 0;

  // Chain counter — lightning only
  chainsLeft: number = 0;

  constructor(opts: {
    x: number; y: number;
    vx: number; vy: number;
    facingX: number; facingY: number;
    kind:    ConsumableProjectileKind;
    damage:  number;
    speed:   number;
    maxRange:number;
    lifetime:number;
    radius:  number;
    color:   string;
    chainsLeft?: number;
  }) {
    this.x         = opts.x;
    this.y         = opts.y;
    this.vx        = opts.vx;
    this.vy        = opts.vy;
    this.facingX   = opts.facingX;
    this.facingY   = opts.facingY;
    this.kind      = opts.kind;
    this.damage    = opts.damage;
    this.speed     = opts.speed;
    this.maxRange  = opts.maxRange;
    this.lifetime  = opts.lifetime;
    this.radius    = opts.radius;
    this.color     = opts.color;
    this.chainsLeft = opts.chainsLeft ?? 0;
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // Returns true if the projectile hit something this frame
  // (caller handles damage + chain logic).
  // ============================================================
  update(deltaMs: number): void {
    if (this.done) return;

    this.lifetime   -= deltaMs;
    this.pulseTimer += deltaMs;

    if (this.lifetime <= 0) { this.done = true; return; }

    // Instant AOEs (frost/void) have lifetime=1 and no velocity
    if (this.vx === 0 && this.vy === 0) return;

    const dx = this.vx * (deltaMs / 16);
    const dy = this.vy * (deltaMs / 16);
    this.x          += dx;
    this.y          += dy;
    this.traveledSq += dx * dx + dy * dy;

    if (this.traveledSq >= this.maxRange * this.maxRange) {
      this.done = true;
    }
  }

  // ============================================================
  // [🧱 BLOCK: Hit Test — circle vs enemy rect]
  // ============================================================
  hitsEnemy(enemy: BaseEnemy): boolean {
    if (enemy.isDead) return false;
    const ecx = enemy.x + enemy.width  / 2;
    const ecy = enemy.y + enemy.height / 2;
    const r   = this.radius + Math.max(enemy.width, enemy.height) / 2;
    return distSq(this.x, this.y, ecx, ecy) < r * r;
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (this.done) return;
    const sx    = camera.toScreenX(this.x);
    const sy    = camera.toScreenY(this.y);
    const pulse = Math.sin(this.pulseTimer / 80) * 0.2 + 0.8;

    ctx.save();

    switch (this.kind) {

      // ── Fireball — orange core with glow ──────────────────
      case 'fireball': {
        ctx.shadowColor = "#fb923c";
        ctx.shadowBlur  = 18 * pulse;
        ctx.beginPath();
        ctx.arc(sx, sy, this.radius * 1.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(251,146,60,0.2)`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#fb923c";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx - this.radius * 0.3, sy - this.radius * 0.3, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = "#fef08a";
        ctx.fill();
        break;
      }

      // ── Frost — icy blue burst ring (instant AoE visual) ──
      case 'frost': {
        const progress = Math.max(0, 1 - this.lifetime / 1);
        ctx.beginPath();
        ctx.arc(sx, sy, this.radius * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(147,210,255,${pulse * 0.8})`;
        ctx.lineWidth   = 3;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sx, sy, this.radius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(147,210,255,0.15)`;
        ctx.fill();
        break;
      }

      // ── Lightning — bright white-cyan bolt ────────────────
      case 'lightning': {
        ctx.shadowColor = "#7dd3fc";
        ctx.shadowBlur  = 14 * pulse;
        ctx.beginPath();
        ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#7dd3fc";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx, sy, this.radius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        break;
      }

      // ── Void — purple swirling pull indicator ─────────────
      case 'void': {
        ctx.beginPath();
        ctx.arc(sx, sy, this.radius * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(167,139,250,${pulse * 0.7})`;
        ctx.lineWidth   = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sx, sy, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(167,139,250,0.2)`;
        ctx.fill();
        break;
      }
    }

    ctx.restore();
  }
}

// ============================================================
// [🧱 BLOCK: Explosion VFX]
// Drawn by ConsumableSystem when fireball detonates.
// ============================================================
export class ConsumableExplosion {
  x:        number;
  y:        number;
  radius:   number;
  maxRadius:number;
  lifetime: number = 300;
  maxLife:  number = 300;
  color:    string;
  done:     boolean = false;

  constructor(x: number, y: number, radius: number, color: string) {
    this.x         = x;
    this.y         = y;
    this.radius    = 0;
    this.maxRadius = radius;
    this.color     = color;
  }

  update(deltaMs: number): void {
    this.lifetime -= deltaMs;
    if (this.lifetime <= 0) { this.done = true; return; }
    const t      = 1 - this.lifetime / this.maxLife;
    this.radius  = this.maxRadius * Math.sin(t * Math.PI);
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (this.done) return;
    const sx    = camera.toScreenX(this.x);
    const sy    = camera.toScreenY(this.y);
    const alpha = (this.lifetime / this.maxLife) * 0.55;

    ctx.save();
    ctx.beginPath();
    ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
    ctx.fillStyle   = `rgba(251,146,60,${alpha})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(254,240,138,${alpha * 1.4})`;
    ctx.lineWidth   = 2;
    ctx.stroke();
    ctx.restore();
  }
}