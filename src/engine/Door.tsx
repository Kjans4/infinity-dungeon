// src/engine/Door.ts
import { Player } from "./Player";
import { Camera } from "./Camera";

// ============================================================
// [🧱 BLOCK: Door Class]
// Placeholder box that appears at top-center of the world
// once the kill threshold is met. Player walks into it to
// advance to the next room.
// ============================================================
export class Door {
  x: number;
  y: number;
  width:  number = 80;
  height: number = 60;
  isActive: boolean = false;

  // Animation
  private pulseTimer: number = 0;

  constructor(worldW: number) {
    // Top center of the world
    this.x = worldW / 2 - this.width / 2;
    this.y = 20;
  }

  // ============================================================
  // [🧱 BLOCK: Activate]
  // Called when kill threshold is reached.
  // ============================================================
  activate() {
    this.isActive = true;
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // ============================================================
  update() {
    if (!this.isActive) return;
    this.pulseTimer += 16;
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // Inactive = faint gray outline (hinted but not usable).
  // Active   = glowing green pulsing box.
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);

    if (!this.isActive) {
      // Faint placeholder — visible but not usable yet
      ctx.strokeStyle = "rgba(100,100,100,0.3)";
      ctx.lineWidth   = 2;
      ctx.strokeRect(sx, sy, this.width, this.height);
      return;
    }

    // Pulsing glow effect
    const pulse = Math.sin(this.pulseTimer / 300) * 0.4 + 0.6; // 0.2 → 1.0

    // Outer glow
    ctx.shadowColor = "#4ade80";
    ctx.shadowBlur  = 20 * pulse;

    // Fill
    ctx.fillStyle = `rgba(74, 222, 128, ${0.15 * pulse})`;
    ctx.fillRect(sx, sy, this.width, this.height);

    // Border
    ctx.strokeStyle = `rgba(74, 222, 128, ${pulse})`;
    ctx.lineWidth   = 3;
    ctx.strokeRect(sx, sy, this.width, this.height);

    // Reset shadow so it doesn't bleed onto other draws
    ctx.shadowBlur  = 0;
    ctx.shadowColor = "transparent";

    // Label
    ctx.fillStyle   = `rgba(74, 222, 128, ${pulse})`;
    ctx.font        = "bold 11px 'Courier New'";
    ctx.textAlign   = "center";
    ctx.fillText("NEXT", sx + this.width / 2, sy + this.height / 2 - 6);
    ctx.fillText("ROOM", sx + this.width / 2, sy + this.height / 2 + 8);
    ctx.textAlign   = "left"; // Reset
  }

  // ============================================================
  // [🧱 BLOCK: Collision Check]
  // AABB — same pattern as enemy contact check.
  // ============================================================
  isCollidingWithPlayer(player: Player): boolean {
    if (!this.isActive) return false;
    return (
      player.x < this.x + this.width  &&
      player.x + player.width  > this.x &&
      player.y < this.y + this.height &&
      player.y + player.height > this.y
    );
  }
}