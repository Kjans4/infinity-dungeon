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

  // True when player is close enough to press F.
  // Updated every frame by HordeSystem.
  playerIsNear: boolean = false;

  // Animation
  private pulseTimer: number = 0;

  constructor(worldW: number) {
    // Top center of the world
    this.x = worldW / 2 - this.width / 2;
    this.y = 20;
  }

  // ============================================================
  // [🧱 BLOCK: Activate]
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
  // [🧱 BLOCK: Check Player Proximity]
  // Circle check — sets playerIsNear so GameCanvas can open the
  // next room on F-press rather than on collision.
  // ============================================================
  checkPlayerProximity(player: Player): void {
    if (!this.isActive) { this.playerIsNear = false; return; }
    const cx   = this.x + this.width  / 2;
    const cy   = this.y + this.height / 2;
    const px   = player.x + player.width  / 2;
    const py   = player.y + player.height / 2;
    const dist = Math.sqrt((cx - px) ** 2 + (cy - py) ** 2);
    this.playerIsNear = dist < 80; // slightly larger than the box
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // Inactive = faint gray outline (hinted but not usable).
  // Active   = glowing green pulsing box + F prompt when nearby.
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);

    if (!this.isActive) {
      ctx.strokeStyle = "rgba(100,100,100,0.3)";
      ctx.lineWidth   = 2;
      ctx.strokeRect(sx, sy, this.width, this.height);
      return;
    }

    const pulse = Math.sin(this.pulseTimer / 300) * 0.4 + 0.6;

    ctx.shadowColor = "#4ade80";
    ctx.shadowBlur  = 20 * pulse;

    ctx.fillStyle = `rgba(74, 222, 128, ${0.15 * pulse})`;
    ctx.fillRect(sx, sy, this.width, this.height);

    ctx.strokeStyle = `rgba(74, 222, 128, ${pulse})`;
    ctx.lineWidth   = 3;
    ctx.strokeRect(sx, sy, this.width, this.height);

    ctx.shadowBlur  = 0;
    ctx.shadowColor = "transparent";

    ctx.fillStyle = `rgba(74, 222, 128, ${pulse})`;
    ctx.font      = "bold 11px 'Courier New'";
    ctx.textAlign = "center";
    ctx.fillText("NEXT", sx + this.width / 2, sy + this.height / 2 - 6);
    ctx.fillText("ROOM", sx + this.width / 2, sy + this.height / 2 + 8);

    // F prompt — only when player is nearby
    if (this.playerIsNear) {
      ctx.font      = "bold 8px 'Courier New'";
      ctx.fillStyle = "rgba(248,250,252,0.9)";
      ctx.fillText("[F] ENTER", sx + this.width / 2, sy + this.height + 14);
    }

    ctx.textAlign = "left";
  }

  // ============================================================
  // [🧱 BLOCK: Collision Check — kept for legacy safety]
  // Unused by HordeSystem now but kept in case other code reads it.
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