// src/engine/systems/WeaponSystem.ts
import { Player }  from "../Player";
import { Camera }  from "../Camera";
import { Grunt }   from "../enemy/Grunt";
import { Shooter } from "../enemy/Shooter";
import { Tank }    from "../enemy/Tank";
import { Boss }    from "../enemy/Boss";

// ============================================================
// [🧱 BLOCK: Charge Multipliers]
// Applied to base weapon stats for charged releases.
// ============================================================
const CHARGED_LIGHT_DMG_MULT    = 2.5;
const CHARGED_LIGHT_RANGE_MULT  = 1.6;   // arc range / circle radius
const CHARGED_HEAVY_DMG_MULT    = 2.0;
const CHARGED_HEAVY_RANGE_MULT  = 1.5;

// ============================================================
// [🧱 BLOCK: WeaponSystem]
// ============================================================
export class WeaponSystem {

  // ============================================================
  // [🧱 BLOCK: Process Input]
  // With the new charge system, tap attacks are fired directly
  // from Player's charge state machine.  This method now only
  // handles the legacy path (processInput kept for compatibility;
  // it short-circuits because Player handles key edge detection).
  // ============================================================
  processInput(player: Player): void {
    // Charge state machine in Player handles everything.
    // Nothing needed here — kept for API compatibility.
  }

  // ============================================================
  // [🧱 BLOCK: Effective Attack Mode]
  // Maps attackType (including charged variants) → weapon mode.
  // ============================================================
  private effectiveMode(attackType: string): 'light' | 'heavy' {
    return attackType === 'charged_light' ? 'light' : 'heavy';
  }

  // ============================================================
  // [🧱 BLOCK: Damage for Current Attack]
  // Applies charge multiplier if applicable.
  // ============================================================
  private computeDamage(player: Player, atkBonus: number): number {
    if (!player.equippedWeapon || !player.attackType) return 0;
    const mode   = this.effectiveMode(player.attackType);
    const base   = player.equippedWeapon.getAttack(mode).damage + atkBonus;
    if (player.attackType === 'charged_light') return Math.round(base * CHARGED_LIGHT_DMG_MULT);
    if (player.attackType === 'charged_heavy') return Math.round(base * CHARGED_HEAVY_DMG_MULT);
    return base;
  }

  // ============================================================
  // [🧱 BLOCK: Hit Test (charged-aware)]
  // Scales the hitbox range/radius when a charged attack fires.
  // ============================================================
  private hitTestCharged(
    player:  Player,
    ex: number, ey: number,
    eW: number, eH: number
  ): boolean {
    if (!player.equippedWeapon || !player.attackType) return false;

    const weapon     = player.equippedWeapon;
    const mode       = this.effectiveMode(player.attackType);
    const atk        = weapon.getAttack(mode);
    const isCharged  = player.attackType === 'charged_light' || player.attackType === 'charged_heavy';
    const rangeMult  = player.attackType === 'charged_light' ? CHARGED_LIGHT_RANGE_MULT : CHARGED_HEAVY_RANGE_MULT;
    const facing     = (mode === 'heavy' && player.lockedFacing) ? player.lockedFacing : player.facing;

    const px = player.x + player.width  / 2;
    const py = player.y + player.height / 2;

    if (!isCharged) {
      return weapon.hitTest(px, py, facing, mode, ex, ey, eW, eH);
    }

    // For charged attacks, patch the hitbox shape inline
    const shape = atk.hitbox;
    switch (shape.kind) {
      case 'arc': {
        const scaledRange = shape.range * rangeMult;
        const dx   = ex - px;
        const dy   = ey - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > scaledRange + Math.max(eW, eH) / 2) return false;
        if (dist < 20) return true;
        const facingAngle = Math.atan2(facing.y, facing.x);
        const enemyAngle  = Math.atan2(dy, dx);
        let   diff        = enemyAngle - facingAngle;
        while (diff >  Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        // Charged light arc is full 180° regardless of weapon arc angle
        const halfAngle = player.attackType === 'charged_light'
          ? Math.PI * 0.75
          : shape.arcAngle / 2;
        return Math.abs(diff) <= halfAngle;
      }
      case 'circle': {
        const scaledR = shape.radius * rangeMult;
        const dx   = ex - px;
        const dy   = ey - py;
        return Math.sqrt(dx * dx + dy * dy) < scaledR + Math.max(eW, eH) / 2;
      }
      case 'rect': {
        const scaledLen = shape.length * rangeMult;
        const angle = Math.atan2(facing.y, facing.x);
        const cos   = Math.cos(-angle);
        const sin   = Math.sin(-angle);
        const dx    = ex - px;
        const dy    = ey - py;
        const lx    = dx * cos - dy * sin;
        const ly    = dx * sin + dy * cos;
        const halfW = (shape.width * rangeMult) / 2 + Math.max(eW, eH) / 2;
        return lx >= -(eW / 2) && lx <= scaledLen + eW / 2 && Math.abs(ly) < halfW;
      }
    }
  }

  // ============================================================
  // [🧱 BLOCK: Resolve Hits vs Enemies]
  // ============================================================
  resolveHits(
    player:   Player,
    enemies:  (Grunt | Shooter | Tank)[],
    atkBonus: number
  ): (Grunt | Shooter | Tank)[] {
    if (!player.isAttacking || !player.equippedWeapon || !player.attackType) return [];

    const damage = this.computeDamage(player, atkBonus);
    const hit: (Grunt | Shooter | Tank)[] = [];

    enemies.forEach((enemy) => {
      if (enemy.isDead) return;
      const ex = enemy.x + enemy.width  / 2;
      const ey = enemy.y + enemy.height / 2;
      if (this.hitTestCharged(player, ex, ey, enemy.width, enemy.height)) {
        enemy.takeDamage(damage);
        hit.push(enemy);
      }
    });

    return hit;
  }

  // ============================================================
  // [🧱 BLOCK: Resolve Hits Custom]
  // ============================================================
  resolveHitsCustom(
    player:   Player,
    enemies:  (Grunt | Shooter | Tank)[],
    atkBonus: number,
    onHit:    (enemy: Grunt | Shooter | Tank, amount: number) => void
  ): (Grunt | Shooter | Tank)[] {
    if (!player.isAttacking || !player.equippedWeapon || !player.attackType) return [];

    const damage = this.computeDamage(player, atkBonus);
    const hit: (Grunt | Shooter | Tank)[] = [];

    enemies.forEach((enemy) => {
      if (enemy.isDead) return;
      const ex = enemy.x + enemy.width  / 2;
      const ey = enemy.y + enemy.height / 2;
      if (this.hitTestCharged(player, ex, ey, enemy.width, enemy.height)) {
        onHit(enemy, damage);
        hit.push(enemy);
      }
    });

    return hit;
  }

  // ============================================================
  // [🧱 BLOCK: Resolve Hit vs Boss]
  // ============================================================
  resolveHitBoss(
    player:   Player,
    boss:     Boss,
    atkBonus: number
  ): boolean {
    if (!player.isAttacking || !player.equippedWeapon || !player.attackType) return false;

    const damage = this.computeDamage(player, atkBonus);
    const bx = boss.x + boss.width  / 2;
    const by = boss.y + boss.height / 2;

    if (this.hitTestCharged(player, bx, by, boss.width, boss.height)) {
      boss.takeDamage(damage);
      return true;
    }
    return false;
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // Renders charged attack visuals with scaled hitbox.
  // ============================================================
  draw(
    ctx:    CanvasRenderingContext2D,
    player: Player,
    camera: Camera
  ): void {
    if (!player.isAttacking || !player.equippedWeapon || !player.attackType) return;

    const mode       = this.effectiveMode(player.attackType);
    const atk        = player.equippedWeapon.getAttack(mode);
    const isCharged  = player.attackType === 'charged_light' || player.attackType === 'charged_heavy';
    const rangeMult  = player.attackType === 'charged_light' ? CHARGED_LIGHT_RANGE_MULT : CHARGED_HEAVY_RANGE_MULT;
    const facing     = (mode === 'heavy' && player.lockedFacing) ? player.lockedFacing : player.facing;

    const sx = camera.toScreenX(player.x + player.width  / 2);
    const sy = camera.toScreenY(player.y + player.height / 2);

    if (!isCharged) {
      player.equippedWeapon.drawAttack(ctx, sx, sy, facing, mode);
      return;
    }

    // ── Draw scaled charged attack visual ─────────────────
    const shape = atk.hitbox;
    // Brighter color for charged
    const color = player.attackType === 'charged_light'
      ? "rgba(255,255,255,0.85)"
      : "rgba(251,191,36,0.90)";

    ctx.fillStyle   = color;
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2;

    switch (shape.kind) {
      case 'arc': {
        const scaledRange = shape.range * rangeMult;
        const angle       = Math.atan2(facing.y, facing.x);
        const halfAngle   = player.attackType === 'charged_light'
          ? Math.PI * 0.75
          : shape.arcAngle / 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.arc(sx, sy, scaledRange, angle - halfAngle, angle + halfAngle);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'circle': {
        ctx.beginPath();
        ctx.arc(sx, sy, shape.radius * rangeMult, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'rect': {
        const angle = Math.atan2(facing.y, facing.x);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(angle);
        ctx.fillRect(0, -(shape.width * rangeMult) / 2, shape.length * rangeMult, shape.width * rangeMult);
        ctx.restore();
        break;
      }
    }
  }
}