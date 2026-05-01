// src/engine/ConsumableDrop.ts
import { Player }        from "./Player";
import { Camera }        from "./Camera";
import { ConsumableDef } from "./ConsumableRegistry";
import { distSq }        from "./Collision";

// ============================================================
// [🧱 BLOCK: Constants]
// ============================================================
const AUTO_COLLECT_RADIUS = 48; // px — walk over to auto-collect
const LIFETIME_MS         = 25000; // 25s before despawn

// ============================================================
// [🧱 BLOCK: ConsumableDrop Class]
// Spawned on enemy death. Player walks over to auto-collect
// into their bag (no Inventory interaction needed).
// Potions = amber/purple ring, Scrolls = cyan ring.
// ============================================================
export class ConsumableDrop {
  x:         number;
  y:         number;
  def:       ConsumableDef;
  radius:    number = 10;

  collected: boolean = false;

  private elapsed:     number = 0;
  private pulseTimer:  number = Math.random() * Math.PI * 2;
  private floatOffset: number = Math.random() * Math.PI * 2;

  constructor(x: number, y: number, def: ConsumableDef) {
    this.x   = x;
    this.y   = y;
    this.def = def;
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // Auto-collects when player walks within AUTO_COLLECT_RADIUS.
  // Despawns after LIFETIME_MS.
  // ============================================================
  update(player: Player): void {
    if (this.collected) return;

    this.elapsed    += 16;
    this.pulseTimer += 0.06;

    if (this.elapsed >= LIFETIME_MS) {
      this.collected = true;
      return;
    }

    const px = player.x + player.width  / 2;
    const py = player.y + player.height / 2;
    const d2 = distSq(this.x, this.y, px, py);
    if (d2 < (AUTO_COLLECT_RADIUS + player.width / 2) ** 2) {
      this.collected = true;
    }
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (this.collected) return;

    const sx    = camera.toScreenX(this.x);
    const sy    = camera.toScreenY(this.y);
    const pulse = Math.sin(this.pulseTimer) * 0.3 + 0.7;
    const floatY = Math.sin(this.elapsed / 500 + this.floatOffset) * 2.5;

    // Fade out in last 5s
    const fadeStart = LIFETIME_MS - 5000;
    const alpha     = this.elapsed > fadeStart
      ? Math.max(0, 1 - (this.elapsed - fadeStart) / 5000)
      : 1;

    const isPotion = this.def.kind === 'potion';
    const ringColor = isPotion ? '#a78bfa' : '#38bdf8';  // purple vs cyan
    const coreColor = isPotion ? '#7c3aed' : '#0e7490';
    const glowColor = isPotion ? 'rgba(167,139,250,0.4)' : 'rgba(56,189,248,0.4)';

    ctx.save();
    ctx.globalAlpha = alpha;

    // ── Outer glow ────────────────────────────────────────────
    ctx.beginPath();
    ctx.arc(sx, sy + floatY, this.radius + 10, 0, Math.PI * 2);
    ctx.fillStyle = glowColor.replace('0.4', String(0.15 * pulse));
    ctx.fill();

    // ── Pulsing ring ──────────────────────────────────────────
    ctx.beginPath();
    ctx.arc(sx, sy + floatY, this.radius + 5, 0, Math.PI * 2);
    ctx.strokeStyle = `${ringColor}${Math.round(pulse * 80).toString(16).padStart(2, '0')}`;
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // ── Dark core ─────────────────────────────────────────────
    ctx.beginPath();
    ctx.arc(sx, sy + floatY, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8,6,3,0.92)';
    ctx.fill();
    ctx.strokeStyle = ringColor;
    ctx.lineWidth   = 2;
    ctx.stroke();

    // ── Icon ──────────────────────────────────────────────────
    ctx.font         = '11px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.def.icon, sx, sy + floatY);

    // ── Kind label ────────────────────────────────────────────
    const label = isPotion ? 'POTION' : 'SCROLL';
    const labelY = Math.sin(this.pulseTimer * 0.6) * 2;
    ctx.font         = 'bold 7px \'Courier New\'';
    ctx.fillStyle    = ringColor;
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, sx, sy + floatY - this.radius - 3 + labelY);

    ctx.globalAlpha  = 1;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }
}