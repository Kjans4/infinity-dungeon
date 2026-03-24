// src/engine/enemy/Shooter.ts
import { Player } from "../Player";
import { Camera } from "../Camera";
import { BaseEnemy } from "./BaseEnemy";
import { Projectile } from "./Projectile";
import { AttackState } from "./types";

// ============================================================
// [🧱 BLOCK: Shooter Stats]
// ============================================================
const SHOOTER_STATS = {
  speed:          1.1,
  hp:             20,
  size:           24,
  color:          '#f59e0b',
  xpValue:        2,
  preferredDist:  180,
  // Ranged
  rangedRange:    200,
  rangedWindup:   800,
  rangedDamage:   12,
  rangedCooldown: 2000,
  // Melee fallback (desperation)
  meleeRange:     60,
  meleeWindup:    400,
  meleeDamage:    8,
  meleeCooldown:  1200,
};

// ============================================================
// [🧱 BLOCK: Shooter Class]
// Maintains preferred distance, fires ranged projectiles.
// Falls back to melee if player gets too close.
// ============================================================
export class Shooter extends BaseEnemy {
  // Attack state
  attackState:       AttackState           = 'chase';
  attackTimer:       number                = 0;
  attackCooldown:    number                = 0;
  currentMode:       'melee' | 'ranged'   = 'ranged';
  strikeDir:         { x: number; y: number } = { x: 0, y: 1 };

  // Projectile fired this frame — collected by GameCanvas
  pendingProjectile: Projectile | null = null;

  constructor(x: number, y: number, floor: number = 1) {
    const speedScale = 1 + (floor - 1) * 0.15;
    const hpScale    = 1 + (floor - 1) * 0.20;

    super(
      x, y,
      SHOOTER_STATS.size,
      SHOOTER_STATS.speed * speedScale,
      Math.round(SHOOTER_STATS.hp * hpScale),
      SHOOTER_STATS.xpValue,
      SHOOTER_STATS.color,
    );
  }

  // ============================================================
  // [🧱 BLOCK: Update — Shooter State Machine]
  // ============================================================
  update(player: Player, worldW: number, worldH: number) {
    if (this.isDead) return;

    this.tickHitFlash();
    this.attackTimer    -= 16;
    this.attackCooldown -= 16;

    const pcx  = player.x + player.width  / 2;
    const pcy  = player.y + player.height / 2;
    const ecx  = this.x   + this.width    / 2;
    const ecy  = this.y   + this.height   / 2;
    const dx   = pcx - ecx;
    const dy   = pcy - ecy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    switch (this.attackState) {

      case 'chase': {
        this.maintainDistance(dx, dy, dist);

        const canAttack = this.attackCooldown <= 0;

        // Melee fallback — player too close
        if (canAttack && dist <= SHOOTER_STATS.meleeRange) {
          this.currentMode = 'melee';
          this.attackState = 'windup';
          this.attackTimer = SHOOTER_STATS.meleeWindup;
          this.vx = 0; this.vy = 0;
          break;
        }

        // Ranged attack — in preferred zone
        if (canAttack && dist <= SHOOTER_STATS.rangedRange) {
          this.currentMode = 'ranged';
          this.attackState = 'windup';
          this.attackTimer = SHOOTER_STATS.rangedWindup;
          this.vx = 0; this.vy = 0;
        }
        break;
      }

      case 'windup':
        this.vx = 0; this.vy = 0;

        // Lock aim late in the windup so fast players can still dodge
        if (this.attackTimer <= 150) {
          this.strikeDir = { x: dx / dist, y: dy / dist };
        }

        if (this.attackTimer <= 0) {
          this.attackState = 'strike';
          this.attackTimer = 150;

          // Fire projectile on ranged strike
          if (this.currentMode === 'ranged') {
            this.pendingProjectile = new Projectile(
              ecx, ecy, pcx, pcy,
              SHOOTER_STATS.rangedDamage
            );
          }
        }
        break;

      case 'strike':
        if (this.currentMode === 'melee') {
          this.x += this.strikeDir.x * 2;
          this.y += this.strikeDir.y * 2;
        }

        if (this.attackTimer <= 0) {
          const cd = this.currentMode === 'ranged'
            ? SHOOTER_STATS.rangedCooldown
            : SHOOTER_STATS.meleeCooldown;
          this.attackState    = 'cooldown';
          this.attackTimer    = cd;
          this.attackCooldown = cd;
        }
        break;

      case 'cooldown':
        this.maintainDistance(dx, dy, dist);
        if (this.attackTimer <= 0) this.attackState = 'chase';
        break;
    }

    this.clampToWorld(worldW, worldH);
  }

  // ============================================================
  // [🧱 BRICK: Maintain Preferred Distance]
  // ============================================================
  private maintainDistance(dx: number, dy: number, dist: number) {
    const diff = dist - SHOOTER_STATS.preferredDist;
    if (Math.abs(diff) > 20) {
      const dir = diff > 0 ? 1 : -1;
      this.vx   = (dx / dist) * this.speed * dir;
      this.vy   = (dy / dist) * this.speed * dir;
      this.x   += this.vx;
      this.y   += this.vy;
    } else {
      this.vx = 0; this.vy = 0;
    }
  }

  // ============================================================
  // [🧱 BLOCK: Melee Hit Check]
  // ============================================================
  isMeleeHittingPlayer(player: Player): boolean {
    if (this.attackState !== 'strike' || this.currentMode !== 'melee') return false;

    const ecx      = this.x + this.width  / 2;
    const ecy      = this.y + this.height / 2;
    const hitX     = ecx + this.strikeDir.x * 45;
    const hitY     = ecy + this.strikeDir.y * 45;
    const hitSize  = 24;

    const nearestX = Math.max(player.x, Math.min(hitX, player.x + player.width));
    const nearestY = Math.max(player.y, Math.min(hitY, player.y + player.height));
    const distSq   = (hitX - nearestX) ** 2 + (hitY - nearestY) ** 2;
    return distSq < hitSize * hitSize;
  }

  get meleeDamage() { return SHOOTER_STATS.meleeDamage; }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    if (this.isDead) return;
    if (!camera.isVisible(this.x, this.y, this.width, this.height)) return;

    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);
    const cx = sx + this.width  / 2;
    const cy = sy + this.height / 2;

    // ── Windup indicator ──
    if (this.attackState === 'windup') {
      const windupTime = this.currentMode === 'ranged'
        ? SHOOTER_STATS.rangedWindup
        : SHOOTER_STATS.meleeWindup;
      const progress = 1 - Math.max(0, this.attackTimer) / windupTime;
      const color    = this.currentMode === 'ranged'
        ? `rgba(250, 204, 21, ${0.4 + progress * 0.5})`
        : `rgba(249, 115, 22, ${0.4 + progress * 0.5})`;

      ctx.beginPath();
      ctx.arc(cx, cy, 32 * (1 - progress * 0.4), 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2;
      ctx.stroke();

      // Dashed aim line for ranged
      if (this.currentMode === 'ranged') {
        ctx.strokeStyle = `rgba(250, 204, 21, 0.35)`;
        ctx.lineWidth   = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + this.strikeDir.x * 180, cy + this.strikeDir.y * 180);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // ── Melee strike hitbox ──
    if (this.attackState === 'strike' && this.currentMode === 'melee') {
      const hitX = cx + this.strikeDir.x * 40;
      const hitY = cy + this.strikeDir.y * 40;
      ctx.beginPath();
      ctx.arc(hitX, hitY, 18, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(249, 115, 22, 0.45)";
      ctx.fill();
    }

    // ── Body color by state ──
    const bodyColor =
      this.attackState === 'windup' && this.currentMode === 'ranged'  ? '#fde047' :
      this.attackState === 'windup' && this.currentMode === 'melee'   ? '#fb923c' :
      this.attackState === 'strike' && this.currentMode === 'ranged'  ? '#facc15' :
      this.attackState === 'strike' && this.currentMode === 'melee'   ? '#f97316' :
      this.color;

    this.drawBody(ctx, sx, sy, bodyColor);
    this.drawHpBar(ctx, sx, sy);
  }
}