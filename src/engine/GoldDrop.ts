// src/engine/GoldDrop.ts
import { Player } from "./Player";
import { Camera } from "./Camera";

// ============================================================
// [🧱 BLOCK: GoldDrop Class]
// Spawned on enemy death. Player walks over to collect.
// Disappears after 30 seconds to prevent clutter.
// ============================================================
export class GoldDrop {
  x:       number;
  y:       number;
  amount:  number;
  radius:  number = 8;

  collected:   boolean = false;
  lifetime:    number  = 30000; // 30 seconds in ms
  elapsed:     number  = 0;

  // Gentle float animation
  private floatOffset: number = Math.random() * Math.PI * 2;

  constructor(x: number, y: number, amount: number) {
    this.x      = x;
    this.y      = y;
    this.amount = amount;
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // ============================================================
  update(player: Player) {
    if (this.collected) return;

    this.elapsed += 16;
    if (this.elapsed >= this.lifetime) {
      this.collected = true; // Despawn
      return;
    }

    // Pickup check — player center within collection radius
    const px   = player.x + player.width  / 2;
    const py   = player.y + player.height / 2;
    const dist = Math.sqrt((this.x - px) ** 2 + (this.y - py) ** 2);

    if (dist < this.radius + player.width / 2) {
      this.collected = true;
    }
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // Yellow circle with subtle float animation.
  // Fades out in the last 5 seconds.
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    if (this.collected) return;
    if (!camera.isVisible(this.x, this.y, this.radius * 2, this.radius * 2)) return;

    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);

    // Float bob
    const floatY = Math.sin(this.elapsed / 400 + this.floatOffset) * 2;

    // Fade in last 5 seconds
    const fadeStart = this.lifetime - 5000;
    const alpha     = this.elapsed > fadeStart
      ? 1 - (this.elapsed - fadeStart) / 5000
      : 1;

    // Outer glow
    ctx.globalAlpha = alpha * 0.3;
    ctx.beginPath();
    ctx.arc(sx, sy + floatY, this.radius + 4, 0, Math.PI * 2);
    ctx.fillStyle = "#facc15";
    ctx.fill();

    // Core coin
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(sx, sy + floatY, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#facc15";
    ctx.fill();

    // Shine
    ctx.beginPath();
    ctx.arc(sx - 2, sy + floatY - 2, this.radius * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = "#fef08a";
    ctx.fill();

    ctx.globalAlpha = 1;
  }
}