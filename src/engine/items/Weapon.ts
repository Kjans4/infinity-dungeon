// src/engine/items/Weapon.ts
import { WeaponDef, WeaponType, AttackDef } from "./types";
import { getWeaponDef } from "./WeaponRegistry";

export class Weapon {
  def: WeaponDef;

  constructor(type: WeaponType = 'sword') {
    this.def = getWeaponDef(type);
  }

  get type(): WeaponType { return this.def.type; }
  get name(): string     { return this.def.name; }
  get icon(): string     { return this.def.icon; }

  getAttack(mode: 'light' | 'heavy'): AttackDef {
    return mode === 'light' ? this.def.light : this.def.heavy;
  }

  // ============================================================
  // [🧱 BLOCK: Draw Attack Visual]
  // px/py = player CENTER in SCREEN coords (pre-converted)
  // ============================================================
  drawAttack(
    ctx:    CanvasRenderingContext2D,
    px:     number,
    py:     number,
    facing: { x: number; y: number },
    mode:   'light' | 'heavy'
  ): void {
    const atk   = this.getAttack(mode);
    const shape = atk.hitbox;

    ctx.fillStyle   = atk.color;
    ctx.strokeStyle = atk.color;
    ctx.lineWidth   = 2;

    switch (shape.kind) {
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
      case 'circle': {
        ctx.beginPath();
        ctx.arc(px, py, shape.radius, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'rect': {
        const angle = Math.atan2(facing.y, facing.x);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle);
        ctx.fillRect(0, -shape.width / 2, shape.length, shape.width);
        ctx.restore();
        break;
      }
    }
  }

  // ============================================================
  // [🧱 BLOCK: Hit Test]
  // All coords are WORLD space.
  // px/py = player CENTER, ex/ey = enemy CENTER
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
      case 'arc': {
        const dx   = ex - px;
        const dy   = ey - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > shape.range + Math.max(eW, eH) / 2) return false;
        if (dist < 20) return true;
        const facingAngle = Math.atan2(facing.y, facing.x);
        const enemyAngle  = Math.atan2(dy, dx);
        let   diff        = enemyAngle - facingAngle;
        while (diff >  Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        return Math.abs(diff) <= shape.arcAngle / 2;
      }
      case 'circle': {
        const dx   = ex - px;
        const dy   = ey - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < shape.radius + Math.max(eW, eH) / 2;
      }
      case 'rect': {
        const angle = Math.atan2(facing.y, facing.x);
        const cos   = Math.cos(-angle);
        const sin   = Math.sin(-angle);
        const dx    = ex - px;
        const dy    = ey - py;
        const lx    = dx * cos - dy * sin;
        const ly    = dx * sin + dy * cos;
        const halfW = shape.width / 2 + Math.max(eW, eH) / 2;
        return (
          lx >= -(eW / 2) &&
          lx <= shape.length + eW / 2 &&
          Math.abs(ly) < halfW
        );
      }
    }
  }
}