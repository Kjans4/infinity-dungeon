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
  life:    number;      // ms remaining
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

    // Random burst direction + speed
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 1.5;
    this.vx     = Math.cos(angle) * speed;
    this.vy     = Math.sin(angle) * speed;

    // Random lifetime between 300–500ms
    this.maxLife = Math.random() * 200 + 300;
    this.life    = this.maxLife;
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // ============================================================
  update() {
    this.x    += this.vx;
    this.y    += this.vy;

    // Friction — slow down over time
    this.vx   *= 0.88;
    this.vy   *= 0.88;

    // Tick life + fade alpha
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
// [🧱 BLOCK: Spawn Burst Helper]
// Call when an enemy dies.
// count  → how many particles to spawn
// color  → enemy's color
// spread → size variation (default 1 = normal)
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