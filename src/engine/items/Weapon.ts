// src/engine/items/Weapon.ts
import { WeaponDef, WeaponType, AttackDef, HitboxShape } from "./types";
import { getWeapon } from "./WeaponRegistry";

// ============================================================
// [🧱 BLOCK: Weapon Class]
// Holds the active weapon state and exposes:
//   - draw()    → renders the attack visual on canvas
//   - hitTest()   → checks if a world point is inside hitbox
// ============================================================
export class Weapon {
  def: WeaponDef;

  constructor(type: WeaponType = 'sword') {
    this.def = getWeapon(type);
  }

  get type(): WeaponType { return this.def.type; }
  get name(): string     { return this.def.name; }
  get icon(): string     { return this.def.icon; }

  getAttack(mode: 'light' | 'heavy'): AttackDef {
    return mode === 'light' ? this.def.light : this.def.heavy;
  }

  // ============================================================
  // [🧱 BLOCK: Draw Attack Visual]
  // Called from WeaponSystem.draw() when isAttacking is true.
  // px/py = player center in SCREEN coords
  // facing = normalized direction vector
  // ============================================================
  drawAttack(
    ctx:    CanvasRenderingContext2D,
    px:     number,
    py:     number,
    facing: { x: number; y: number },
    mode:   'light' | 'heavy'
  ) {
    const atk   = this.getAttack(mode);
    const shape = atk.hitbox;

    ctx.fillStyle   = atk.color;
    ctx.strokeStyle = atk.color;
    ctx.lineWidth   = 2;

    switch (shape.kind) {

      // ── Sword — fan arc ────────────────────────────────────
      case 'arc': {
        const angle     = Math.atan2(facing.y, facing.x);
        const halfAngle = shape.arcAngle / 2;

        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.arc(px, py, shape.range, angle - halfAngle, angle + halfAngle);
        ctx.closePath();
        ctx.fill();
        break;
      }

      // ── Axe — full circle ──────────────────────────────────
      case 'circle': {
        ctx.beginPath();
        ctx.arc(px, py, shape.radius, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      // ── Spear — rotated rectangle ──────────────────────────
      case 'rect': {
        const angle = Math.atan2(facing.y, facing.x);

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle);

        // Draw rect starting from player center extending forward
        ctx.fillRect(
          0,                        // Start at player center
          -shape.width / 2,         // Centered vertically
          shape.length,             // Extends forward
          shape.width
        );

        ctx.restore();
        break;
      }
    }
  }

  // ============================================================
  // [🧱 BLOCK: Hit Test]
  // Returns true if a world-space point (ex, ey) — typically
  // an enemy center — falls inside the attack hitbox.
  //
  // px/py    = player center in WORLD coords
  // facing   = normalized direction
  // mode     = 'light' | 'heavy'
  // ex/ey    = enemy center in WORLD coords
  // eW/eH    = enemy width/height (for rect overlap)
  // ============================================================
  hitTest(
    px: number, py: number,
    facing: { x: number; y: number },
    mode:   'light' | 'heavy',
    ex: number, ey: number,
    eW: number, eH: number
  ): boolean {
    const atk   = this.getAttack(mode);
    const shape = atk.hitbox;

    switch (shape.kind) {

      // ── Sword — point-in-arc ───────────────────────────────
      case 'arc': {
        const dx   = ex - px;
        const dy   = ey - py;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > shape.range) return false;

        const facingAngle = Math.atan2(facing.y, facing.x);
        const enemyAngle  = Math.atan2(dy, dx);
        let   diff        = enemyAngle - facingAngle;

        // Normalize angle difference to [-π, π]
        while (diff >  Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        return Math.abs(diff) <= shape.arcAngle / 2;
      }

      // ── Axe — circle vs enemy center ──────────────────────
      case 'circle': {
        const dx   = ex - px;
        const dy   = ey - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < shape.radius + Math.max(eW, eH) / 2;
      }

      // ── Spear — rotated rect vs enemy rect ─────────────────
      case 'rect': {
        const angle = Math.atan2(facing.y, facing.x);
        const cos   = Math.cos(-angle);
        const sin   = Math.sin(-angle);

        // Transform enemy center into spear's local space
        const ldx  = ex - px;
        const ldy  = ey - py;
        const lx   = ldx * cos - ldy * sin;
        const ly   = ldx * sin + ldy * cos;

        // Check overlap in local space
        const halfW = shape.width  / 2 + eW / 2;
        const halfL = shape.length / 2 + eH / 2;

        // Spear starts at player center (0) and extends to shape.length
        const spearCenterX = shape.length / 2;

        return (
          Math.abs(lx - spearCenterX) < halfL &&
          Math.abs(ly)                 < halfW
        );
      }
    }
  }
}