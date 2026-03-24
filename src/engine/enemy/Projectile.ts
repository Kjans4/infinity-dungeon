// src/engine/enemy/Projectile.ts
import { Camera } from "../Camera";
import { Player } from "../Player";

// ============================================================
// [🧱 BLOCK: Projectile Class]
// Fired by Shooter. Travels in a straight line, despawns
// after maxDistance or on player hit.
// ============================================================
export class Projectile {
  x:               number;
  y:               number;
  vx:              number;
  vy:              number;
  damage:          number;
  distanceTraveled: number  = 0;
  maxDistance:      number  = 400;
  radius:           number  = 6;
  isDone:           boolean = false;

  constructor(
    x: number, y: number,
    targetX: number, targetY: number,
    damage: number
  ) {
    this.x      = x;
    this.y      = y;
    this.damage = damage;

    const dx    = targetX - x;
    const dy    = targetY - y;
    const dist  = Math.sqrt(dx * dx + dy * dy) || 1;
    const speed = 4;
    this.vx = (dx / dist) * speed;
    this.vy = (dy / dist) * speed;
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // ============================================================
  update() {
    if (this.isDone) return;
    this.x += this.vx;
    this.y += this.vy;
    this.distanceTraveled += Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (this.distanceTraveled >= this.maxDistance) this.isDone = true;
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    if (this.isDone) return;
    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);

    // Outer glow
    ctx.beginPath();
    ctx.arc(sx, sy, this.radius + 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(239, 68, 68, 0.25)";
    ctx.fill();

    // Core bullet
    ctx.beginPath();
    ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.fill();

    // Bright center
    ctx.beginPath();
    ctx.arc(sx, sy, this.radius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = "#fca5a5";
    ctx.fill();
  }

  // ============================================================
  // [🧱 BLOCK: Hit Check — circle vs player center]
  // ============================================================
  isHittingPlayer(player: Player): boolean {
    if (this.isDone) return false;
    const px   = player.x + player.width  / 2;
    const py   = player.y + player.height / 2;
    const dist = Math.sqrt((this.x - px) ** 2 + (this.y - py) ** 2);
    return dist < this.radius + player.width / 2;
  }
}