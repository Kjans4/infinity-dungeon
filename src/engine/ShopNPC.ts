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

// Proximity radius — player must be within this many px of the
// NPC centre to see the "F" prompt. Generous enough that the
// player doesn't have to stand on top of the NPC.
const INTERACT_RADIUS = 70;

export class ShopNPC {
  x:        number;
  y:        number;
  width:    number = NPC_W;
  height:   number = NPC_H;
  isActive: boolean = false;

  // True when player is close enough to interact — updated
  // every frame by HordeSystem so draw() can show the prompt.
  playerIsNear: boolean = false;

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
  // [🧱 BLOCK: Is Near Player]
  // Circle proximity check — used by HordeSystem each frame to
  // set playerIsNear. GameCanvas then watches this flag and opens
  // the shop only when the player presses F. This prevents the
  // shop from re-opening the moment it is closed while the player
  // is still standing next to the NPC.
  // ============================================================
  checkPlayerProximity(player: Player): void {
    if (!this.isActive) { this.playerIsNear = false; return; }
    const cx  = this.x + this.width  / 2;
    const cy  = this.y + this.height / 2;
    const px  = player.x + player.width  / 2;
    const py  = player.y + player.height / 2;
    const dist = Math.sqrt((cx - px) ** 2 + (cy - py) ** 2);
    this.playerIsNear = dist < INTERACT_RADIUS;
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

    // ── "F" interact prompt — only shown when player is close ──
    if (this.playerIsNear) {
      ctx.font      = "bold 8px 'Courier New'";
      ctx.fillStyle = "rgba(248,250,252,0.9)";
      ctx.fillText("[F] TALK", sx + this.width / 2, sy + this.height + 14);
    } else {
      ctx.font      = "7px 'Courier New'";
      ctx.fillStyle = "rgba(148,163,184,0.5)";
      ctx.fillText("SHOP", sx + this.width / 2, sy + this.height + 12);
    }

    ctx.textAlign = "left";
  }
}