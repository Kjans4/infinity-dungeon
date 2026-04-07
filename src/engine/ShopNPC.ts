// src/engine/ShopNPC.ts
import { Player }        from "./Player";
import { Camera }        from "./Camera";
import { withinRadius }  from "./Collision";

// ============================================================
// [🧱 BLOCK: ShopNPC Constants]
// ============================================================
const NPC_W            = 36;
const NPC_H            = 48;
const NPC_OFFSET_X     = 100;
const SAFE_ZONE_HEIGHT = 160;
const INTERACT_RADIUS  = 70;

export class ShopNPC {
  x:        number;
  y:        number;
  width:    number = NPC_W;
  height:   number = NPC_H;
  isActive: boolean = false;

  // True when player is close enough to interact
  playerIsNear: boolean = false;

  // Enemies cannot enter y < safeLineY
  safeLineY: number;

  private pulseTimer: number = 0;

  constructor(worldW: number) {
    const doorCenterX = worldW / 2;
    this.x         = doorCenterX + NPC_OFFSET_X;
    this.y         = 20;
    this.safeLineY = SAFE_ZONE_HEIGHT;
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
  // [🧱 BLOCK: Is Safe Zone]
  // ============================================================
  isSafeZone(worldY: number): boolean {
    return worldY < this.safeLineY;
  }

  // ============================================================
  // [🧱 BLOCK: Check Player Proximity — uses withinRadius]
  // ============================================================
  checkPlayerProximity(player: Player): void {
    if (!this.isActive) { this.playerIsNear = false; return; }
    this.playerIsNear = withinRadius(this, player, INTERACT_RADIUS);
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera, worldW: number) {
    if (!this.isActive) return;

    const sx    = camera.toScreenX(this.x);
    const sy    = camera.toScreenY(this.y);
    const pulse = Math.sin(this.pulseTimer / 400) * 0.35 + 0.65;

    // ── Safe zone line ─────────────────────────────────────
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

    ctx.fillStyle   = `rgba(56, 189, 248, ${pulse})`;
    ctx.font        = "bold 8px 'Courier New'";
    ctx.textAlign   = "center";
    ctx.fillText("SHOP",  sx + this.width / 2, sy + this.height / 2 - 6);
    ctx.fillText("NPC",   sx + this.width / 2, sy + this.height / 2 + 6);

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