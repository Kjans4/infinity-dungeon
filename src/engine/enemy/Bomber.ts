// src/engine/enemy/Bomber.ts
import { Player }       from "../Player";
import { Camera }       from "../Camera";
import { BaseEnemy }    from "./BaseEnemy";
import { getEnemySpeedScale, getEnemyHpScale } from "../RoomManager";
import { circleCircle, rectCenter } from "../Collision";

// ============================================================
// [🧱 BLOCK: Constants]
// ============================================================
const BASE_HP         = 50;
const BASE_SPEED      = 1.0;
const SIZE            = 30;
const COLOR           = "#f97316";
const XP_VALUE        = 4;

const ARM_RANGE       = 100;   // px — starts arming when this close
const FUSE_MS         = 1200;  // ms until explosion after arming
const EXPLODE_RADIUS  = 80;    // px
const EXPLODE_RADIUS_FLOOR3 = 110; // px (floor 3+)
const EXPLODE_DAMAGE  = 35;
const CONTACT_DAMAGE  = 8;     // light touch damage (not explosion)

// ============================================================
// [🧱 BLOCK: Bomber States]
// ============================================================
type BomberState =
  | 'chase'
  | 'arming'      // fuse lit — counting down
  | 'exploding'   // one-frame explosion trigger
  | 'dead';

// ============================================================
// [🧱 BLOCK: Bomber Class]
// Slow enemy that arms itself near the player and explodes.
// Also explodes on death from weapon hits.
// ============================================================
export class Bomber extends BaseEnemy {
  private bomberState: BomberState = 'chase';
  private fuseTimer:   number      = 0;
  private floor:       number;

  // Explosion state — read by HordeSystem to deal AoE damage
  isExploding:     boolean = false;
  explosionRadius: number  = 0;
  hasExploded:     boolean = false;

  // Visual pulse
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
  }

  // ============================================================
  // [🧱 BLOCK: Explosion Radius by Floor]
  // ============================================================
  get explodeRadius(): number {
    return this.floor >= 3 ? EXPLODE_RADIUS_FLOOR3 : EXPLODE_RADIUS;
  }

  get explodeDamage(): number { return EXPLODE_DAMAGE; }
  get contactDmg():   number  { return CONTACT_DAMAGE; }

  // ============================================================
  // [🧱 BLOCK: Trigger Explosion]
  // Called by HordeSystem when enemy dies from weapon hit,
  // OR called internally when fuse expires.
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
      // Explosion is one-frame — immediately clear
      this.isExploding = false;
      this.bomberState = 'dead';
      return;
    }

    this.tickHitFlash();
    if (this.tickStun()) return;

    this.pulse += 16;

    const { x: pcx, y: pcy } = rectCenter(player);
    const { x: ecx, y: ecy } = rectCenter(this);
    const dx   = pcx - ecx;
    const dy   = pcy - ecy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    switch (this.bomberState) {

      // ── Chase ─────────────────────────────────────────────
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

      // ── Arming ────────────────────────────────────────────
      case 'arming':
        // Keep slowly shuffling toward player while armed
        this.vx = (dx / dist) * this.speed * 0.5;
        this.vy = (dy / dist) * this.speed * 0.5;
        this.x += this.vx;
        this.y += this.vy;

        this.fuseTimer -= 16;

        // Re-disarm if player runs away far enough
        if (dist > ARM_RANGE * 1.8) {
          this.bomberState = 'chase';
          this.fuseTimer   = 0;
        }

        // Fuse expired → BOOM
        if (this.fuseTimer <= 0) {
          this.triggerExplosion();
        }
        break;
    }

    this.clampToWorld(worldW, worldH);
  }

  // ============================================================
  // [🧱 BLOCK: Explosion Hit Check]
  // Called by HordeSystem after triggerExplosion() is detected.
  // ============================================================
  isExplosionHittingPlayer(player: Player): boolean {
    const { x: ecx, y: ecy } = rectCenter(this);
    const { x: pcx, y: pcy } = rectCenter(player);
    return circleCircle(ecx, ecy, this.explodeRadius, pcx, pcy, player.width / 2);
  }

  // ============================================================
  // [🧱 BLOCK: Contact Damage Check]
  // Light body-collision damage while chasing.
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

    // ── Explosion flash ───────────────────────────────────────
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

    // ── Arm indicator — danger ring ───────────────────────────
    if (isArmed) {
      const fuseProgress = 1 - Math.max(0, this.fuseTimer) / FUSE_MS;
      const urgency      = Math.sin(this.pulse / (80 - fuseProgress * 60)) * 0.4 + 0.6;

      // Explosion preview ring
      ctx.beginPath();
      ctx.arc(cx, cy, this.explodeRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(249,115,22,${0.15 + fuseProgress * 0.25})`;
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      // Fuse countdown arc (fills clockwise)
      ctx.beginPath();
      ctx.arc(cx, cy, SIZE / 2 + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fuseProgress);
      ctx.strokeStyle = `rgba(239,68,68,${urgency})`;
      ctx.lineWidth   = 3;
      ctx.stroke();
    }

    // ── Body ──────────────────────────────────────────────────
    const pulse = Math.sin(this.pulse / 120) * 0.3 + 0.7;

    const bodyColor =
      this.isHit      ? '#ffffff' :
      isArmed         ? `rgba(239,68,68,${0.7 + pulse * 0.3})` :
      COLOR;

    this.drawBody(ctx, sx, sy, bodyColor);

    // ── Fuse spark on top ─────────────────────────────────────
    if (isArmed) {
      const sparkPulse = Math.sin(this.pulse / 60) * 0.5 + 0.5;
      ctx.beginPath();
      ctx.arc(cx, sy - 2, 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(250,204,21,${sparkPulse})`;
      ctx.fill();
    }

    this.drawHpBar(ctx, sx, sy);
  }
}