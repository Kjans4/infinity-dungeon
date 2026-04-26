// src/engine/enemy/Bomber.ts
import { Player }       from "../Player";
import { Camera }       from "../Camera";
import { BaseEnemy, rollVariants }    from "./BaseEnemy";
import { getEnemySpeedScale, getEnemyHpScale } from "../RoomManager";
import { circleCircle, rectCenter } from "../Collision";

// ============================================================
// [🧱 BLOCK: Constants]
// HP buffed: 50 → 75 base
// ============================================================
const BASE_HP         = 75;    // ↑ was 50
const BASE_SPEED      = 1.0;
const SIZE            = 30;
const COLOR           = "#f97316";
const XP_VALUE        = 4;

const ARM_RANGE       = 100;
const FUSE_MS         = 1200;
const EXPLODE_RADIUS  = 80;
const EXPLODE_RADIUS_FLOOR3 = 110;
const EXPLODE_DAMAGE  = 35;
const CONTACT_DAMAGE  = 8;

// ============================================================
// [🧱 BLOCK: Bomber States]
// ============================================================
type BomberState =
  | 'chase'
  | 'arming'
  | 'exploding'
  | 'dead';

// ============================================================
// [🧱 BLOCK: Bomber Class]
// ============================================================
export class Bomber extends BaseEnemy {
  private bomberState: BomberState = 'chase';
  private fuseTimer:   number      = 0;
  private floor:       number;

  isExploding:     boolean = false;
  explosionRadius: number  = 0;
  hasExploded:     boolean = false;

  private pulse: number = 0;

  pendingProjectile: null = null;

  constructor(x: number, y: number, floor: number = 1) {
    super(
      x, y,
      SIZE,
      BASE_SPEED * getEnemySpeedScale(floor),
      Math.round(BASE_HP * getEnemyHpScale(floor)),
      XP_VALUE,
      COLOR,
    );
    this.floor = floor;
    this.applyVariants(rollVariants(floor));
  }

  // ============================================================
  // [🧱 BLOCK: Explosion Radius by Floor]
  // ============================================================
  get explodeRadius(): number {
    // Volatile variant: explosion radius is NOT doubled since
    // Bomber already has a large base — keep it readable.
    return this.floor >= 3 ? EXPLODE_RADIUS_FLOOR3 : EXPLODE_RADIUS;
  }

  get explodeDamage(): number {
    return Math.round(EXPLODE_DAMAGE * this.damageMult);
  }

  get contactDmg(): number {
    return Math.round(CONTACT_DAMAGE * this.damageMult);
  }

  // ============================================================
  // [🧱 BLOCK: Trigger Explosion]
  // ============================================================
  triggerExplosion(): void {
    if (this.hasExploded) return;
    this.hasExploded  = true;
    this.isExploding  = true;
    this.isDead       = true;
    this.bomberState  = 'exploding';
    this.explosionRadius = this.explodeRadius;
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // ============================================================
  update(player: Player, worldW: number, worldH: number): void {
    if (this.isDead && this.bomberState !== 'exploding') return;
    if (this.bomberState === 'exploding') {
      this.isExploding = false;
      this.bomberState = 'dead';
      return;
    }

    this.tickHitFlash();
    this.tickVariantPulse();
    this.tickRegen();
    if (this.tickStun()) return;

    this.pulse += 16;

    const { x: pcx, y: pcy } = rectCenter(player);
    const { x: ecx, y: ecy } = rectCenter(this);
    const dx   = pcx - ecx;
    const dy   = pcy - ecy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    switch (this.bomberState) {

      case 'chase':
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
        this.x += this.vx;
        this.y += this.vy;

        if (dist <= ARM_RANGE) {
          this.bomberState = 'arming';
          this.fuseTimer   = FUSE_MS;
          this.vx = 0; this.vy = 0;
        }
        break;

      case 'arming':
        this.vx = (dx / dist) * this.speed * 0.5;
        this.vy = (dy / dist) * this.speed * 0.5;
        this.x += this.vx;
        this.y += this.vy;

        this.fuseTimer -= 16;

        if (dist > ARM_RANGE * 1.8) {
          this.bomberState = 'chase';
          this.fuseTimer   = 0;
        }

        if (this.fuseTimer <= 0) {
          this.triggerExplosion();
        }
        break;
    }

    this.clampToWorld(worldW, worldH);
  }

  // ============================================================
  // [🧱 BLOCK: Explosion Hit Check]
  // ============================================================
  isExplosionHittingPlayer(player: Player): boolean {
    const { x: ecx, y: ecy } = rectCenter(this);
    const { x: pcx, y: pcy } = rectCenter(player);
    return circleCircle(ecx, ecy, this.explodeRadius, pcx, pcy, player.width / 2);
  }

  // ============================================================
  // [🧱 BLOCK: Contact Damage Check]
  // ============================================================
  isTouchingPlayer(player: Player): boolean {
    if (this.bomberState !== 'chase' && this.bomberState !== 'arming') return false;
    return (
      player.x < this.x + this.width  &&
      player.x + player.width  > this.x &&
      player.y < this.y + this.height &&
      player.y + player.height > this.y
    );
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (this.isDead && this.bomberState !== 'exploding') return;
    if (!camera.isVisible(this.x, this.y, this.width, this.height)) return;

    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);
    const cx = sx + this.width  / 2;
    const cy = sy + this.height / 2;

    // Explosion flash
    if (this.bomberState === 'exploding') {
      const r = this.explodeRadius;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0,   "rgba(255,255,255,0.95)");
      grad.addColorStop(0.3, "rgba(253,186,116,0.85)");
      grad.addColorStop(0.7, "rgba(249,115,22,0.5)");
      grad.addColorStop(1,   "rgba(249,115,22,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      return;
    }

    const isArmed = this.bomberState === 'arming';

    if (isArmed) {
      const fuseProgress = 1 - Math.max(0, this.fuseTimer) / FUSE_MS;
      const urgency      = Math.sin(this.pulse / (80 - fuseProgress * 60)) * 0.4 + 0.6;

      ctx.beginPath();
      ctx.arc(cx, cy, this.explodeRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(249,115,22,${0.15 + fuseProgress * 0.25})`;
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, SIZE / 2 + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fuseProgress);
      ctx.strokeStyle = `rgba(239,68,68,${urgency})`;
      ctx.lineWidth   = 3;
      ctx.stroke();
    }

    this.drawVariantAura(ctx, sx, sy);

    const pulse = Math.sin(this.pulse / 120) * 0.3 + 0.7;
    const bodyColor =
      this.isHit  ? '#ffffff' :
      isArmed     ? `rgba(239,68,68,${0.7 + pulse * 0.3})` :
      COLOR;

    this.drawBody(ctx, sx, sy, bodyColor);

    if (isArmed) {
      const sparkPulse = Math.sin(this.pulse / 60) * 0.5 + 0.5;
      ctx.beginPath();
      ctx.arc(cx, sy - 2, 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(250,204,21,${sparkPulse})`;
      ctx.fill();
    }

    this.drawHpBar(ctx, sx, sy);
    this.drawVariantIndicators(ctx, sx, sy);
  }
}