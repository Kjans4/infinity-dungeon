// src/engine/enemy/Shooter.ts
import { Player } from "../Player";
import { Camera } from "../Camera";
import { BaseEnemy, rollVariants } from "./BaseEnemy";
import { Projectile } from "./Projectile";
import { AttackState } from "./types";
import { getEnemySpeedScale, getEnemyHpScale } from "../RoomManager";
import { rectCenter } from "../Collision";

// ============================================================
// [🧱 BLOCK: Shooter Stats]
// HP buffed: 45 → 70 base
// ============================================================
const SHOOTER_STATS = {
  speed:          1.1,
  hp:             70,   // ↑ was 45
  size:           24,
  color:          '#f59e0b',
  xpValue:        2,
  preferredDist:  180,
  rangedRange:    200,
  rangedWindup:   800,
  rangedDamage:   12,
  rangedCooldown: 2000,
  meleeRange:     60,
  meleeWindup:    400,
  meleeDamage:    8,
  meleeCooldown:  1200,
  hitKnockback:   2.0,
};

const SPREAD_ANGLES = [-Math.PI / 12, 0, Math.PI / 12];

// ============================================================
// [🧱 BLOCK: Shooter Class]
// ============================================================
export class Shooter extends BaseEnemy {
  attackState:        AttackState              = 'chase';
  attackTimer:        number                   = 0;
  attackCooldown:     number                   = 0;
  currentMode:        'melee' | 'ranged'       = 'ranged';
  strikeDir:          { x: number; y: number } = { x: 0, y: 1 };
  pendingProjectiles: Projectile[]             = [];

  get pendingProjectile(): Projectile | null {
    return this.pendingProjectiles[0] ?? null;
  }

  private floor: number;

  constructor(x: number, y: number, floor: number = 1) {
    super(
      x, y,
      SHOOTER_STATS.size,
      SHOOTER_STATS.speed * getEnemySpeedScale(floor),
      Math.round(SHOOTER_STATS.hp * getEnemyHpScale(floor)),
      SHOOTER_STATS.xpValue,
      SHOOTER_STATS.color,
    );
    this.floor = floor;
    this.applyVariants(rollVariants(floor));
  }

  // ============================================================
  // [🧱 BLOCK: Effective Damage with Berserker Mult]
  // ============================================================
  get meleeDamage()  { return Math.round(SHOOTER_STATS.meleeDamage  * this.damageMult); }
  get rangedDamage() { return Math.round(SHOOTER_STATS.rangedDamage * this.damageMult); }

  // ============================================================
  // [🧱 BLOCK: Fire Projectiles]
  // ============================================================
  private fireProjectiles(ecx: number, ecy: number, pcx: number, pcy: number) {
    const baseAngle = Math.atan2(pcy - ecy, pcx - ecx);
    const dmg       = this.rangedDamage;

    if (this.floor < 2) {
      this.pendingProjectiles.push(
        new Projectile(ecx, ecy, pcx, pcy, dmg)
      );
    } else {
      SPREAD_ANGLES.forEach((offset) => {
        const angle = baseAngle + offset;
        const tx    = ecx + Math.cos(angle) * 200;
        const ty    = ecy + Math.sin(angle) * 200;
        this.pendingProjectiles.push(
          new Projectile(ecx, ecy, tx, ty, dmg)
        );
      });
    }
  }

  private get rangedCooldown(): number {
    return this.floor >= 4 ? 1400 : SHOOTER_STATS.rangedCooldown;
  }

  // ============================================================
  // [🧱 BLOCK: Apply Hit Knockback to Player]
  // ============================================================
  applyHitKnockbackToPlayer(player: Player): void {
    const { x: ecx, y: ecy } = rectCenter(this);
    const { x: pcx, y: pcy } = rectCenter(player);
    const dx   = pcx - ecx;
    const dy   = pcy - ecy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    player.vx += (dx / dist) * SHOOTER_STATS.hitKnockback;
    player.vy += (dy / dist) * SHOOTER_STATS.hitKnockback;
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // ============================================================
  update(player: Player, worldW: number, worldH: number) {
    if (this.isDead) return;

    this.tickHitFlash();
    this.tickVariantPulse();
    this.tickRegen();
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

        if (canAttack && dist <= SHOOTER_STATS.meleeRange) {
          this.currentMode = 'melee';
          this.attackState = 'windup';
          this.attackTimer = SHOOTER_STATS.meleeWindup;
          this.vx = 0; this.vy = 0;
          break;
        }
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
        if (this.attackTimer <= 150) {
          this.strikeDir = { x: dx / dist, y: dy / dist };
        }
        if (this.attackTimer <= 0) {
          this.attackState = 'strike';
          this.attackTimer = 150;
          if (this.currentMode === 'ranged') {
            this.fireProjectiles(ecx, ecy, pcx, pcy);
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
            ? this.rangedCooldown
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

    if (this.floor >= 2 && this.attackState === 'windup' && this.currentMode === 'ranged') {
      ctx.fillStyle = "rgba(250,204,21,0.9)";
      ctx.font      = "bold 8px 'Courier New'";
      ctx.textAlign = "center";
      ctx.fillText("×3", cx, sy - 10);
      ctx.textAlign = "left";
    }

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

      if (this.currentMode === 'ranged') {
        const angles    = this.floor >= 2 ? SPREAD_ANGLES : [0];
        const baseAngle = Math.atan2(this.strikeDir.y, this.strikeDir.x);
        angles.forEach((offset) => {
          const a = baseAngle + offset;
          ctx.strokeStyle = `rgba(250, 204, 21, ${offset === 0 ? 0.35 : 0.18})`;
          ctx.lineWidth   = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(a) * 180, cy + Math.sin(a) * 180);
          ctx.stroke();
          ctx.setLineDash([]);
        });
      }
    }

    if (this.attackState === 'strike' && this.currentMode === 'melee') {
      const hitX = cx + this.strikeDir.x * 40;
      const hitY = cy + this.strikeDir.y * 40;
      ctx.beginPath();
      ctx.arc(hitX, hitY, 18, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(249, 115, 22, 0.45)";
      ctx.fill();
    }

    this.drawVariantAura(ctx, sx, sy);

    const bodyColor =
      this.attackState === 'windup' && this.currentMode === 'ranged'  ? '#fde047' :
      this.attackState === 'windup' && this.currentMode === 'melee'   ? '#fb923c' :
      this.attackState === 'strike' && this.currentMode === 'ranged'  ? '#facc15' :
      this.attackState === 'strike' && this.currentMode === 'melee'   ? '#f97316' :
      this.color;

    this.drawBody(ctx, sx, sy, bodyColor);
    this.drawHpBar(ctx, sx, sy);
    this.drawVariantIndicators(ctx, sx, sy);
  }
}