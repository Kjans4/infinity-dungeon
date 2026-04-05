// src/engine/ShopNPC.ts
import { Player } from "./Player";
import { Camera } from "./Camera";

// ============================================================
// [🧱 BLOCK: ShopNPC Constants]
// The NPC sits to the right of the door.
// SAFE_ZONE_HEIGHT — how far south the safe zone extends below
//   the door's top edge. Enemies crossing north of this line
//   are pushed back by HordeSystem.
// ============================================================
const NPC_W          = 36;
const NPC_H          = 48;
const NPC_OFFSET_X   = 100;  // px right of door center
const SAFE_ZONE_HEIGHT = 160; // px below world top (y=0)

export class ShopNPC {
  x:        number;
  y:        number;
  width:    number = NPC_W;
  height:   number = NPC_H;
  isActive: boolean = false;

  // Safe zone — enemies cannot enter y < safeLineY
  safeLineY: number;

  private pulseTimer: number = 0;

  constructor(worldW: number) {
    const doorCenterX = worldW / 2;
    this.x         = doorCenterX + NPC_OFFSET_X;
    this.y         = 20;  // same top edge as Door
    this.safeLineY = SAFE_ZONE_HEIGHT;
  }

  // ============================================================
  // [🧱 BLOCK: Activate]
  // Called when kill threshold is reached (same moment Door activates).
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
  // [🧱 BLOCK: Is Safe Zone]
  // Returns true if a world-space point is inside the protected area.
  // HordeSystem calls this to block enemy pathfinding northward.
  // ============================================================
  isSafeZone(worldY: number): boolean {
    return worldY < this.safeLineY;
  }

  // ============================================================
  // [🧱 BLOCK: Collision With Player]
  // AABB — player touching NPC opens the shop.
  // ============================================================
  isCollidingWithPlayer(player: Player): boolean {
    if (!this.isActive) return false;
    return (
      player.x                  < this.x + this.width  &&
      player.x + player.width   > this.x               &&
      player.y                  < this.y + this.height &&
      player.y + player.height  > this.y
    );
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // Labeled box with pulsing teal glow when active.
  // Safe zone shown as a faint horizontal line across the world.
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera, worldW: number) {
    if (!this.isActive) return;

    const sx    = camera.toScreenX(this.x);
    const sy    = camera.toScreenY(this.y);
    const pulse = Math.sin(this.pulseTimer / 400) * 0.35 + 0.65;

    // ── Safe zone line (subtle, full world width) ──────────
    const lineY = camera.toScreenY(this.safeLineY);
    ctx.strokeStyle = "rgba(56,189,248,0.08)";
    ctx.lineWidth   = 1;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(camera.toScreenX(0),      lineY);
    ctx.lineTo(camera.toScreenX(worldW), lineY);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── NPC box ────────────────────────────────────────────
    ctx.shadowColor = "#38bdf8";
    ctx.shadowBlur  = 12 * pulse;

    ctx.fillStyle   = `rgba(14, 30, 50, 0.9)`;
    ctx.fillRect(sx, sy, this.width, this.height);

    ctx.strokeStyle = `rgba(56, 189, 248, ${pulse})`;
    ctx.lineWidth   = 2;
    ctx.strokeRect(sx, sy, this.width, this.height);

    ctx.shadowBlur  = 0;
    ctx.shadowColor = "transparent";

    // ── Label text ─────────────────────────────────────────
    ctx.fillStyle   = `rgba(56, 189, 248, ${pulse})`;
    ctx.font        = "bold 8px 'Courier New'";
    ctx.textAlign   = "center";
    ctx.fillText("SHOP",  sx + this.width / 2, sy + this.height / 2 - 6);
    ctx.fillText("NPC",   sx + this.width / 2, sy + this.height / 2 + 6);

    // ── "TALK" prompt below ────────────────────────────────
    ctx.font      = "7px 'Courier New'";
    ctx.fillStyle = "rgba(148,163,184,0.7)";
    ctx.fillText("▲ TALK", sx + this.width / 2, sy + this.height + 12);

    ctx.textAlign = "left";
  }
}