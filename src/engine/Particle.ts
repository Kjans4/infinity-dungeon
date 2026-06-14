// src/engine/Particle.ts

import { Camera } from "./Camera";

// ============================================================
// [🧱 BLOCK: Particle Class]
// Small square that bursts from enemy death position.
// Flies outward, slows with friction, fades out.
// ============================================================
export class Particle {
  x:       number;
  y:       number;
  vx:      number;
  vy:      number;
  size:    number;
  color:   string;
  alpha:   number = 1;
  life:    number;
  maxLife: number;

  constructor(
    x:     number,
    y:     number,
    color: string,
    size:  number = 5
  ) {
    this.x     = x;
    this.y     = y;
    this.color = color;
    this.size  = size;

    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 1.5;
    this.vx     = Math.cos(angle) * speed;
    this.vy     = Math.sin(angle) * speed;

    this.maxLife = Math.random() * 200 + 300;
    this.life    = this.maxLife;
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // ============================================================
  update() {
    this.x    += this.vx;
    this.y    += this.vy;
    this.vx   *= 0.88;
    this.vy   *= 0.88;
    this.life -= 16;
    this.alpha = Math.max(0, this.life / this.maxLife);
  }

  get isDone(): boolean {
    return this.life <= 0;
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    if (this.isDone) return;

    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);

    ctx.globalAlpha = this.alpha;
    ctx.fillStyle   = this.color;
    ctx.fillRect(
      sx - this.size / 2,
      sy - this.size / 2,
      this.size,
      this.size
    );
    ctx.globalAlpha = 1;
  }
}

// ============================================================
// [🧱 BLOCK: Hit Spark Particle]
// Smaller, faster, shorter-lived than death burst.
// Used for weapon-hit feedback on enemies.
// ============================================================
export class HitSpark {
  x:       number;
  y:       number;
  vx:      number;
  vy:      number;
  size:    number;
  color:   string;
  alpha:   number = 1;
  life:    number;
  maxLife: number = 220;

  constructor(x: number, y: number, color: string) {
    this.x     = x;
    this.y     = y;
    this.color = color;
    this.size  = Math.random() * 2.5 + 1.5;
    this.life  = this.maxLife;

    // Faster and more directional than death particles
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 6 + 3;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  update() {
    this.x    += this.vx;
    this.y    += this.vy;
    this.vx   *= 0.80;
    this.vy   *= 0.80;
    this.life -= 16;
    this.alpha = Math.max(0, this.life / this.maxLife);
  }

  get isDone(): boolean { return this.life <= 0; }

  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    if (this.isDone) return;
    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle   = this.color;
    ctx.fillRect(sx - this.size / 2, sy - this.size / 2, this.size, this.size);
    ctx.globalAlpha = 1;
  }
}

// ============================================================
// [🧱 BLOCK: Damage Number]
// Floating damage text that rises and fades after a hit.
//
// color:
//   white  (#f1f5f9) = normal hit
//   yellow (#facc15) = charged light
//   orange (#fb923c) = heavy
//   red    (#ef4444) = charged heavy
//
// Visibility improvements:
//   - Larger base font sizes (14px normal, 18px heavy)
//   - Pop scale in first 80ms for punch feel
//   - Thick dark stroke outline (4px) for contrast over any bg
//   - Slower drift (-0.45) + longer life (750ms)
//   - Fade starts only in final 30% of life
// ============================================================
export class DamageNumber {
  x:       number;
  y:       number;
  value:   number;
  color:   string;
  alpha:   number  = 1;
  life:    number  = 750;
  maxLife: number  = 750;
  vy:      number  = -0.45;  // slower upward drift — stays on screen longer
  size:    number;
  isCrit:  boolean;

  constructor(x: number, y: number, value: number, color: string) {
    this.x      = x;
    this.y      = y;
    this.value  = value;
    this.color  = color;
    this.isCrit = value >= 20;
    // Larger sizes — normal 14px, heavy/crit 18px
    this.size   = this.isCrit ? 18 : 14;
    // Horizontal scatter so stacked numbers don't overlap
    this.x     += (Math.random() - 0.5) * 24;
  }

  update() {
    this.y    += this.vy;
    this.life -= 16;
    // Fade only in final 30% of life
    const fadeThreshold = this.maxLife * 0.30;
    this.alpha = this.life < fadeThreshold
      ? Math.max(0, this.life / fadeThreshold)
      : 1;
  }

  get isDone(): boolean { return this.life <= 0; }

  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    if (this.isDone) return;

    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);

    // Pop scale: scale up from 0.6 → 1.0 in first 80ms, then stay at 1.0
    const elapsed   = this.maxLife - this.life;
    const popDur    = 80;
    const popScale  = elapsed < popDur
      ? 0.6 + 0.4 * (elapsed / popDur)
      : 1.0;
    const fontSize  = Math.round(this.size * popScale);

    ctx.save();
    ctx.globalAlpha  = this.alpha;
    ctx.font         = `900 ${fontSize}px 'Courier New', monospace`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";

    // Thick dark stroke — creates solid outline readable over fog/tiles/enemies
    ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
    ctx.lineWidth   = 4;
    ctx.lineJoin    = "round";
    ctx.strokeText(String(this.value), sx, sy);

    // Colored fill on top
    ctx.fillStyle = this.color;
    ctx.fillText(String(this.value), sx, sy);

    ctx.restore();
  }
}

// ============================================================
// [🧱 BLOCK: Spawn Burst Helper]
// ============================================================
export function spawnBurst(
  x:      number,
  y:      number,
  color:  string,
  count:  number = 6,
  spread: number = 1
): Particle[] {
  return Array.from({ length: count }, () => {
    const size = (Math.random() * 3 + 3) * spread;
    return new Particle(x, y, color, size);
  });
}

// ============================================================
// [🧱 BLOCK: Spawn Hit Spark Helper]
// Fires 3–5 small sparks at the impact world position.
// color is determined by attack type at call site.
// ============================================================
export function spawnHitSpark(
  x:     number,
  y:     number,
  color: string,
  count: number = 4
): HitSpark[] {
  return Array.from({ length: count }, () => new HitSpark(x, y, color));
}

// ============================================================
// [🧱 BLOCK: Spawn Damage Number Helper]
// attackType drives color:
//   'light'         → white
//   'charged_light' → yellow
//   'heavy'         → orange-red
//   'charged_heavy' → bright red
// ============================================================
export function spawnDamageNumber(
  x:          number,
  y:          number,
  value:      number,
  attackType: string | null
): DamageNumber {
  const color =
    attackType === 'charged_heavy' ? '#ef4444' :
    attackType === 'heavy'         ? '#fb923c' :
    attackType === 'charged_light' ? '#facc15' :
                                     '#f1f5f9';
  return new DamageNumber(x, y, value, color);
}