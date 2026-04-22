// src/engine/ItemDrop.ts
import { Player }        from "./Player";
import { Camera }        from "./Camera";
import { ShopItem }      from "./items/ItemPool";
import { circleCircle, rectCenter } from "./Collision";

// ============================================================
// [🧱 BLOCK: Constants]
// ============================================================
const PROXIMITY_RADIUS = 90;  // px — player must be within this to see drop in inventory

// ============================================================
// [🧱 BLOCK: ItemDrop Class]
// Spawned on enemy death. Sits on the ground indefinitely.
// Player opens Inventory while nearby to equip it directly.
// There is no auto-pickup — the item never despawns on its own.
// `collected` is set to true externally by GameCanvas when the
// player equips the item (or a swap pushes a new drop).
// ============================================================
export class ItemDrop {
  x:       number;
  y:       number;
  item:    ShopItem;
  radius:  number  = 12;

  // Set externally when the item is equipped or discarded
  collected: boolean = false;

  // True when player is within PROXIMITY_RADIUS — read by Inventory
  playerIsNear: boolean = false;

  private pulseTimer: number = Math.random() * Math.PI * 2;
  private elapsed:    number = 0;

  constructor(x: number, y: number, item: ShopItem) {
    this.x    = x;
    this.y    = y;
    this.item = item;
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // Ticks animation and proximity check each frame.
  // No auto-pickup, no despawn timer.
  // ============================================================
  update(player: Player): void {
    if (this.collected) return;

    this.elapsed    += 16;
    this.pulseTimer += 0.05;

    // Proximity check — used by Inventory to show/hide drop card
    const { x: px, y: py } = rectCenter(player);
    this.playerIsNear = circleCircle(
      this.x, this.y, PROXIMITY_RADIUS,
      px,     py,     1
    );
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // Color by item kind: weapon=blue, charm=yellow, armor=green.
  // Pulses with a proximity indicator ring when player is near.
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    if (this.collected) return;
    if (!camera.isVisible(this.x - 20, this.y - 20, 40, 40)) return;

    const sx    = camera.toScreenX(this.x);
    const sy    = camera.toScreenY(this.y);
    const pulse = Math.sin(this.pulseTimer) * 0.3 + 0.7;

    const color =
      this.item.kind === "weapon" ? "#38bdf8" :
      this.item.kind === "armor"  ? "#4ade80" :
                                    "#facc15";

    const kindLabel =
      this.item.kind === "weapon" ? "WEAPON" :
      this.item.kind === "armor"  ? "ARMOR"  :
                                    "CHARM";

    // ── Proximity ring — glows when player is near ────────────
    if (this.playerIsNear) {
      ctx.beginPath();
      ctx.arc(sx, sy, PROXIMITY_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,0.06)`;
      ctx.lineWidth   = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(sx, sy, this.radius + 14, 0, Math.PI * 2);
      ctx.strokeStyle = `${color}66`;
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }

    // ── Outer glow ring ───────────────────────────────────────
    ctx.globalAlpha = 0.25 * pulse;
    ctx.beginPath();
    ctx.arc(sx, sy, this.radius + 8, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // ── Inner circle ──────────────────────────────────────────
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(10,15,30,0.9)";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth   = this.playerIsNear ? 2.5 : 2;
    ctx.stroke();

    // ── Icon ──────────────────────────────────────────────────
    ctx.globalAlpha  = 1;
    ctx.font         = "13px sans-serif";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.item.icon, sx, sy);

    // ── Floating label ────────────────────────────────────────
    const floatY = Math.sin(this.pulseTimer * 0.8) * 3;
    ctx.font         = "bold 8px 'Courier New'";
    ctx.fillStyle    = color;
    ctx.textBaseline = "bottom";
    ctx.fillText(kindLabel, sx, sy - this.radius - 4 + floatY);

    // ── "Open inventory" hint when nearby ─────────────────────
    if (this.playerIsNear) {
      ctx.font         = "bold 7px 'Courier New'";
      ctx.fillStyle    = "rgba(248,250,252,0.75)";
      ctx.textBaseline = "top";
      ctx.fillText("[I] Inspect", sx, sy + this.radius + 6);
    }

    ctx.globalAlpha  = 1;
    ctx.textAlign    = "left";
    ctx.textBaseline = "alphabetic";
  }
}