// src/engine/ShopNPC.ts
import { Player }             from "./Player";
import { Camera }             from "./Camera";
import { withinRadius }       from "./Collision";
import { getShopNPCSprites }  from "./ShopNPCSprites";

// ============================================================
// [🧱 BLOCK: ShopNPC Constants]
// ============================================================
const NPC_W            = 36;
const NPC_H            = 48;
const NPC_OFFSET_X     = 100;
const SAFE_ZONE_HEIGHT = 160;
const INTERACT_RADIUS  = 70;

// ============================================================
// [🧱 BLOCK: Sprite Draw Constants]
// Same fixed-canvas alignment approach as Player.ts.
// Draw size is larger than hitbox — centered on it.
// ============================================================
const DRAW_SIZE  = 128;
const DRAW_OFF_X = (NPC_W - DRAW_SIZE) / 2;   // center horizontally on hitbox
const DRAW_OFF_Y = (NPC_H - DRAW_SIZE) / 2;   // center vertically on hitbox

// ============================================================
// [🧱 BLOCK: Idle Animation Constants]
// Head only — vertical breathe sine wave.
// Body is always static (no offset applied).
// ============================================================
const BREATHE_AMPLITUDE = 2.0;   // px up/down
const BREATHE_PERIOD    = 1600;  // ms per full cycle (slightly slower than player)

// ============================================================
// [🧱 BLOCK: ShopNPC Class]
// ============================================================
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

  // ============================================================
  // [🧱 BLOCK: Animation State]
  // animClock accumulates ms each update tick for the breathe sine.
  // pulseTimer drives the "[F] TALK" hint opacity.
  // ============================================================
  private animClock:  number = 0;
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
    this.animClock  += 16;
  }

  // ============================================================
  // [🧱 BLOCK: Is Safe Zone]
  // ============================================================
  isSafeZone(worldY: number): boolean {
    return worldY < this.safeLineY;
  }

  // ============================================================
  // [🧱 BLOCK: Check Player Proximity]
  // ============================================================
  checkPlayerProximity(player: Player): void {
    if (!this.isActive) { this.playerIsNear = false; return; }
    this.playerIsNear = withinRadius(this, player, INTERACT_RADIUS);
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // Body is drawn static. Head gets a vertical breathe offset.
  // The hitbox box is invisible — no strokeRect / fillRect.
  // Safe zone dashed line and interaction hint are preserved.
  // Falls back to the old text box if sprites haven't loaded yet.
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera, worldW: number) {
    if (!this.isActive) return;

    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);

    // ── Safe zone dashed line ──────────────────────────────
    const lineY = camera.toScreenY(this.safeLineY);
    ctx.strokeStyle = "rgba(56,189,248,0.08)";
    ctx.lineWidth   = 1;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(camera.toScreenX(0),      lineY);
    ctx.lineTo(camera.toScreenX(worldW), lineY);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Sprite draw ────────────────────────────────────────
    const s = getShopNPCSprites();

    if (s.ready) {
      const dx = sx + DRAW_OFF_X;
      const dy = sy + DRAW_OFF_Y;
      const dw = DRAW_SIZE;
      const dh = DRAW_SIZE;

      // Breathe offset — head only
      const breatheY = Math.sin((this.animClock / BREATHE_PERIOD) * Math.PI * 2)
        * BREATHE_AMPLITUDE;

      // Body — static
      ctx.drawImage(s.body, dx, dy, dw, dh);

      // Head — bobs vertically
      ctx.drawImage(s.head, dx, dy + breatheY, dw, dh);

    } else {
      // ── Fallback: minimal text label while sprites load ──
      ctx.fillStyle   = "rgba(14, 30, 50, 0.85)";
      ctx.fillRect(sx, sy, this.width, this.height);
      ctx.fillStyle   = "rgba(56, 189, 248, 0.9)";
      ctx.font        = "bold 8px 'Courier New'";
      ctx.textAlign   = "center";
      ctx.fillText("SHOP", sx + this.width / 2, sy + this.height / 2 - 4);
      ctx.fillText("NPC",  sx + this.width / 2, sy + this.height / 2 + 6);
      ctx.textAlign   = "left";
    }

    // ── Interaction hint ───────────────────────────────────
    if (this.playerIsNear) {
      const pulse = Math.sin(this.pulseTimer / 300) * 0.25 + 0.75;
      ctx.font      = "bold 8px 'Courier New'";
      ctx.fillStyle = `rgba(248,250,252,${pulse})`;
      ctx.textAlign = "center";
      ctx.fillText("[F] TALK", sx + this.width / 2, sy + this.height + 18);
      ctx.textAlign = "left";
    }
  }
}