// src/engine/ItemDrop.ts
import { Player }   from "./Player";
import { Camera }   from "./Camera";
import { ShopItem } from "./items/ItemPool";

// ============================================================
// [🧱 BLOCK: ItemDrop Class]
// Spawned on enemy death. Player walks over it to add the item
// to the pending loot queue (max 3). Does NOT equip directly —
// that happens in the shop when the player claims it for free.
// Despawns after 45 seconds.
// ============================================================
export class ItemDrop {
  x:       number;
  y:       number;
  item:    ShopItem;
  radius:  number  = 12;

  collected: boolean = false;
  lifetime:  number  = 45000; // 45s
  elapsed:   number  = 0;

  private pulseTimer: number = Math.random() * Math.PI * 2;

  constructor(x: number, y: number, item: ShopItem) {
    this.x    = x;
    this.y    = y;
    this.item = item;
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // Returns true if player walked over it AND loot queue had room.
  // Caller is responsible for checking pending loot cap.
  // ============================================================
  update(player: Player): boolean {
    if (this.collected) return false;

    this.elapsed     += 16;
    this.pulseTimer  += 0.05;

    if (this.elapsed >= this.lifetime) {
      this.collected = true;
      return false;
    }

    const px   = player.x + player.width  / 2;
    const py   = player.y + player.height / 2;
    const dist = Math.sqrt((this.x - px) ** 2 + (this.y - py) ** 2);

    if (dist < this.radius + player.width / 2) {
      this.collected = true;
      return true; // signal: picked up
    }
    return false;
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // Weapon drops pulse blue, charm drops pulse yellow.
  // A floating icon sits above the glow circle.
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    if (this.collected) return;
    if (!camera.isVisible(this.x - 20, this.y - 20, 40, 40)) return;

    const sx    = camera.toScreenX(this.x);
    const sy    = camera.toScreenY(this.y);
    const pulse = Math.sin(this.pulseTimer) * 0.3 + 0.7;

    // Fade out in last 8 seconds
    const fadeStart = this.lifetime - 8000;
    const alpha     = this.elapsed > fadeStart
      ? 1 - (this.elapsed - fadeStart) / 8000
      : 1;

    const color = this.item.kind === "weapon" ? "#38bdf8" : "#facc15";

    // Outer glow ring
    ctx.globalAlpha = alpha * 0.25 * pulse;
    ctx.beginPath();
    ctx.arc(sx, sy, this.radius + 8, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Inner circle
    ctx.globalAlpha = alpha * 0.85;
    ctx.beginPath();
    ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(10,15,30,0.9)";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2;
    ctx.stroke();

    // Icon
    ctx.globalAlpha = alpha;
    ctx.font        = "13px sans-serif";
    ctx.textAlign   = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.item.icon, sx, sy);

    // Floating label above
    const floatY = Math.sin(this.pulseTimer * 0.8) * 3;
    ctx.font        = "bold 8px 'Courier New'";
    ctx.fillStyle   = color;
    ctx.textBaseline = "bottom";
    ctx.fillText(
      this.item.kind === "weapon" ? "WEAPON" : "CHARM",
      sx, sy - this.radius - 4 + floatY
    );

    ctx.globalAlpha  = 1;
    ctx.textAlign    = "left";
    ctx.textBaseline = "alphabetic";
  }
}