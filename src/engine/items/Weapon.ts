// src/engine/items/Weapon.ts
import { WeaponDef, WeaponType, AttackDef } from "./types";
import { getWeapon } from "./WeaponRegistry";

// ============================================================
// [🧱 BLOCK: Weapon Class]
// Holds the active weapon definition and exposes two methods:
//   drawAttack() — renders the hitbox shape on canvas
//   hitTest()    — checks if a world point is inside hitbox
//
// No Camera import needed — callers pass screen coords to
// drawAttack() and world coords to hitTest() directly.
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
  // px/py   = player CENTER in SCREEN coords (already offset)
  // facing  = normalized direction vector
  // mode    = which attack was triggered
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

      // ── Sword — fan arc ──────────────────────────────────
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

      // ── Axe — full circle ─────────────────────────────────
      case 'circle': {
        ctx.beginPath();
        ctx.arc(px, py, shape.radius, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      // ── Spear — rotated rectangle ─────────────────────────
      case 'rect': {
        const angle = Math.atan2(facing.y, facing.x);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle);
        // Starts at player center, extends forward by length
        ctx.fillRect(0, -shape.width / 2, shape.length, shape.width);
        ctx.restore();
        break;
      }
    }
  }

  // ============================================================
  // [🧱 BLOCK: Hit Test]
  // All coords are WORLD space.
  // px/py  = player CENTER
  // facing = normalized direction
  // ex/ey  = enemy CENTER
  // eW/eH  = enemy size (used to add overlap tolerance)
  // ============================================================
  hitTest(
    px:     number,
    py:     number,
    facing: { x: number; y: number },
    mode:   'light' | 'heavy',
    ex:     number,
    ey:     number,
    eW:     number,
    eH:     number
  ): boolean {
    const shape = this.getAttack(mode).hitbox;

    switch (shape.kind) {

      // ── Sword arc — angle + distance check ───────────────
      case 'arc': {
        const dx   = ex - px;
        const dy   = ey - py;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Enemy edge must be within range
        if (dist > shape.range + Math.max(eW, eH) / 2) return false;

        // Very close enemies always hit regardless of angle
        if (dist < 20) return true;

        const facingAngle = Math.atan2(facing.y, facing.x);
        const enemyAngle  = Math.atan2(dy, dx);
        let   diff        = enemyAngle - facingAngle;

        // Normalize to [-π, π]
        while (diff >  Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        return Math.abs(diff) <= shape.arcAngle / 2;
      }

      // ── Axe circle — distance from player ────────────────
      case 'circle': {
        const dx   = ex - px;
        const dy   = ey - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < shape.radius + Math.max(eW, eH) / 2;
      }

      // ── Spear rect — rotated AABB ─────────────────────────
      case 'rect': {
        const angle = Math.atan2(facing.y, facing.x);
        const cos   = Math.cos(-angle);
        const sin   = Math.sin(-angle);

        // Transform enemy center into spear's local space
        const dx = ex - px;
        const dy = ey - py;
        const lx = dx * cos - dy * sin;
        const ly = dx * sin + dy * cos;

        // Spear runs from x=0 to x=length, centered on y=0
        const halfW = shape.width  / 2 + Math.max(eW, eH) / 2;

        return (
          lx >= -(eW / 2) &&
          lx <= shape.length + eW / 2 &&
          Math.abs(ly) < halfW
        );
      }
    }
  }
}