// src/engine/BossChest.ts
import { Player }        from "./Player";
import { Camera }        from "./Camera";
import { withinRadius }  from "./Collision";

// ============================================================
// [🧱 BLOCK: BossChest Class]
// Spawned at boss-death position. Placeholder visual — a plain
// box. Player presses F nearby to open, which grants 3 random
// boon choices (consumed by GameState.pendingBoonChoices + a
// picker UI, wired in a later batch). Boons are otherwise
// Shop-only — this chest is the one deliberate exception.
// ============================================================
export class BossChest {
  x: number;
  y: number;
  width:  number = 40;
  height: number = 36;

  opened: boolean = false;

  // True when player is close enough to press F.
  playerIsNear: boolean = false;

  private static readonly INTERACT_RADIUS = 70;

  // Animation
  private pulseTimer: number = 0;

  constructor(x: number, y: number) {
    this.x = x - this.width  / 2;
    this.y = y - this.height / 2;
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // ============================================================
  update() {
    if (this.opened) return;
    this.pulseTimer += 16;
  }

  // ============================================================
  // [🧱 BLOCK: Check Player Proximity]
  // ============================================================
  checkPlayerProximity(player: Player): void {
    if (this.opened) { this.playerIsNear = false; return; }
    this.playerIsNear = withinRadius(this, player, BossChest.INTERACT_RADIUS);
  }

  // ============================================================
  // [🧱 BLOCK: Open]
  // ============================================================
  open(): void {
    this.opened = true;
  }

  // ============================================================
  // [🧱 BLOCK: Draw — placeholder box]
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    if (this.opened) return;

    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);
    const pulse = Math.sin(this.pulseTimer / 260) * 0.35 + 0.65;

    ctx.save();

    ctx.shadowColor = "#f0c040";
    ctx.shadowBlur  = 16 * pulse;

    ctx.fillStyle = `rgba(240, 192, 64, 0.15)`;
    ctx.fillRect(sx, sy, this.width, this.height);

    ctx.strokeStyle = `rgba(240, 192, 64, ${pulse})`;
    ctx.lineWidth   = 3;
    ctx.strokeRect(sx, sy, this.width, this.height);

    ctx.shadowBlur  = 0;
    ctx.shadowColor = "transparent";

    ctx.fillStyle = `rgba(240, 192, 64, ${pulse})`;
    ctx.font      = "bold 18px 'Courier New'";
    ctx.textAlign = "center";
    ctx.fillText("?", sx + this.width / 2, sy + this.height / 2 + 6);

    if (this.playerIsNear) {
      ctx.font      = "bold 8px 'Courier New'";
      ctx.fillStyle = "rgba(248,250,252,0.9)";
      ctx.fillText("[F] OPEN", sx + this.width / 2, sy + this.height + 14);
    }

    ctx.textAlign = "left";
    ctx.restore();
  }
}
