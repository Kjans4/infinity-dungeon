// src/engine/systems/WeaponSystem.ts
import { Player }     from "../Player";
import { Camera }     from "../Camera";
import { BaseEnemy }  from "../enemy/BaseEnemy";

// ============================================================
// [🧱 BLOCK: Charge Multipliers]
// ============================================================
const CHARGED_LIGHT_DMG_MULT    = 2.5;
const CHARGED_LIGHT_RANGE_MULT  = 1.6;
const CHARGED_HEAVY_DMG_MULT    = 2.0;
const CHARGED_HEAVY_RANGE_MULT  = 1.5;

// ============================================================
// [🧱 BLOCK: WeaponSystem]
// ============================================================
export class WeaponSystem {

  // ============================================================
  // [🧱 BLOCK: Process Input]
  // ============================================================
  processInput(player: Player): void {
    // Charge state machine in Player handles everything.
  }

  // ============================================================
  // [🧱 BLOCK: Effective Attack Mode]
  // ============================================================
  private effectiveMode(attackType: string): 'light' | 'heavy' {
    return attackType === 'charged_light' ? 'light' : 'heavy';
  }

  // ============================================================
  // [🧱 BLOCK: Damage for Current Attack]
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
  // Checks player.attackHitSet — skips any enemy already hit
  // this swing. Adds newly-hit enemies to the set.
  // This ensures each enemy is struck exactly once per swing,
  // regardless of how many frames the attack hitbox is active.
  // Guard ensures attackHitSet is always a valid Set instance.
  // ============================================================
  resolveHits(
    player:   Player,
    enemies:  BaseEnemy[],
    atkBonus: number
  ): BaseEnemy[] {
    if (!player.isAttacking || !player.equippedWeapon || !player.attackType) return [];

    // Safety guard — protects against stale Player refs / hot-reload edge cases.
    if (!player.attackHitSet) player.attackHitSet = new Set();

    const damage = this.computeDamage(player, atkBonus);
    const hit: BaseEnemy[] = [];

    enemies.forEach((enemy) => {
      if (enemy.isDead) return;
      // ── Per-swing dedup ────────────────────────────────────
      if (player.attackHitSet.has(enemy)) return;

      const ex = enemy.x + enemy.width  / 2;
      const ey = enemy.y + enemy.height / 2;
      if (this.hitTestCharged(player, ex, ey, enemy.width, enemy.height)) {
        player.attackHitSet.add(enemy);
        enemy.takeDamage(damage);
        hit.push(enemy);
      }
    });

    return hit;
  }

  // ============================================================
  // [🧱 BLOCK: Resolve Hits Custom]
  // Same per-swing dedup as resolveHits.
  // onHit callback receives the enemy and computed damage.
  // Returns true via isFirstHit flag so callers can gate
  // feedback (freeze frames, sparks) to the first contact only.
  // Guard ensures attackHitSet is always a valid Set instance.
  // ============================================================
  resolveHitsCustom(
    player:   Player,
    enemies:  BaseEnemy[],
    atkBonus: number,
    onHit:    (enemy: BaseEnemy, amount: number, isFirstHit: boolean) => void
  ): BaseEnemy[] {
    if (!player.isAttacking || !player.equippedWeapon || !player.attackType) return [];

    // Safety guard — protects against stale Player refs / hot-reload edge cases.
    if (!player.attackHitSet) player.attackHitSet = new Set();

    const damage = this.computeDamage(player, atkBonus);
    const hit: BaseEnemy[] = [];

    enemies.forEach((enemy) => {
      if (enemy.isDead) return;
      // ── Per-swing dedup ────────────────────────────────────
      // isFirstHit = true only the first time this enemy is
      // struck during the current attack swing.
      const isFirstHit = !player.attackHitSet.has(enemy);

      const ex = enemy.x + enemy.width  / 2;
      const ey = enemy.y + enemy.height / 2;
      if (this.hitTestCharged(player, ex, ey, enemy.width, enemy.height)) {
        if (isFirstHit) player.attackHitSet.add(enemy);
        onHit(enemy, damage, isFirstHit);
        hit.push(enemy);
      }
    });

    return hit;
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
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

    const shape = atk.hitbox;
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