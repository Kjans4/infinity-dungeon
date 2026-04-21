// src/engine/enemy/Dasher.ts
import { Player }       from "../Player";
import { Camera }       from "../Camera";
import { BaseEnemy }    from "./BaseEnemy";
import { getEnemySpeedScale, getEnemyHpScale } from "../RoomManager";
import { circleCircle, rectCenter } from "../Collision";

// ============================================================
// [🧱 BLOCK: Constants]
// ============================================================
const BASE_HP         = 35;
const BASE_SPEED      = 2.5;
const SIZE            = 22;
const COLOR           = "#06b6d4";
const XP_VALUE        = 3;

const DASH_SPEED      = 16;
const DASH_DURATION   = 180;   // ms
const DASH_DAMAGE     = 18;
const DASH_COOLDOWN   = 1800;  // ms between dash sequences
const WINDUP_MS       = 500;   // telegraph before dashing
const ENGAGE_RANGE    = 250;   // how close before winding up
const HIT_RADIUS      = 20;    // collision radius during dash

// Floor 3+: two consecutive dashes before cooldown
const DOUBLE_DASH_FLOOR = 3;

// ============================================================
// [🧱 BLOCK: Trail Point]
// ============================================================
interface TrailPoint {
  x: number; y: number; alpha: number;
}

// ============================================================
// [🧱 BLOCK: Dasher States]
// ============================================================
type DasherState =
  | 'chase'
  | 'windup'
  | 'dashing'
  | 'cooldown';

// ============================================================
// [🧱 BLOCK: Dasher Class]
// Fast melee enemy that winds up then dash-through-attacks.
// Floor 3+: performs two consecutive dashes before cooldown.
// ============================================================
export class Dasher extends BaseEnemy {
  private dasherState: DasherState = 'chase';
  private stateTimer:  number      = 0;
  private dashDir:     { x: number; y: number } = { x: 0, y: 1 };
  private trail:       TrailPoint[] = [];
  private dashCount:   number = 0;   // tracks double-dash on Floor 3+
  private floor:       number;

  pendingProjectile: null = null;

  // Damage cooldown so player can't be hit multiple times per dash
  damageCooldown: number = 0;

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
  // [🧱 BLOCK: Update]
  // ============================================================
  update(player: Player, worldW: number, worldH: number): void {
    if (this.isDead) return;

    this.tickHitFlash();
    if (this.tickStun()) return;

    this.stateTimer     -= 16;
    if (this.damageCooldown > 0) this.damageCooldown -= 16;

    // Fade trail
    this.trail = this.trail
      .map((p) => ({ ...p, alpha: p.alpha - 0.06 }))
      .filter((p) => p.alpha > 0);

    const { x: pcx, y: pcy } = rectCenter(player);
    const { x: ecx, y: ecy } = rectCenter(this);
    const dx   = pcx - ecx;
    const dy   = pcy - ecy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    switch (this.dasherState) {

      // ── Chase ───────────────────────────────────────────────
      case 'chase':
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
        this.x += this.vx;
        this.y += this.vy;

        if (dist <= ENGAGE_RANGE) {
          this.dasherState = 'windup';
          this.stateTimer  = WINDUP_MS;
          this.vx = 0; this.vy = 0;
          // Lock aim dir at start of windup
          this.dashDir = { x: dx / dist, y: dy / dist };
        }
        break;

      // ── Windup ──────────────────────────────────────────────
      case 'windup':
        this.vx = 0; this.vy = 0;
        // Keep updating aim until 120ms before dash fires
        if (this.stateTimer > 120) {
          const { x: nx, y: ny } = rectCenter(this);
          const ddx = pcx - nx;
          const ddy = pcy - ny;
          const dl  = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
          this.dashDir = { x: ddx / dl, y: ddy / dl };
        }
        if (this.stateTimer <= 0) {
          this.dasherState = 'dashing';
          this.stateTimer  = DASH_DURATION;
          this.dashCount++;
        }
        break;

      // ── Dashing ─────────────────────────────────────────────
      case 'dashing':
        this.x += this.dashDir.x * DASH_SPEED;
        this.y += this.dashDir.y * DASH_SPEED;
        this.clampToWorld(worldW, worldH);

        // Leave afterimage trail
        this.trail.push({
          x:     this.x + this.width  / 2,
          y:     this.y + this.height / 2,
          alpha: 0.55,
        });

        if (this.stateTimer <= 0) {
          this.vx = 0; this.vy = 0;

          // Floor 3+: double dash before cooldown
          const maxDashes = this.floor >= DOUBLE_DASH_FLOOR ? 2 : 1;
          if (this.dashCount < maxDashes) {
            // Brief windup before second dash
            this.dasherState = 'windup';
            this.stateTimer  = Math.round(WINDUP_MS * 0.6);
          } else {
            this.dashCount   = 0;
            this.dasherState = 'cooldown';
            this.stateTimer  = DASH_COOLDOWN;
          }
        }
        break;

      // ── Cooldown ────────────────────────────────────────────
      case 'cooldown':
        // Slowly orbit / reposition during cooldown
        this.vx = (dx / dist) * this.speed * 0.4;
        this.vy = (dy / dist) * this.speed * 0.4;
        this.x += this.vx;
        this.y += this.vy;

        if (this.stateTimer <= 0) {
          this.dasherState = 'chase';
        }
        break;
    }

    this.clampToWorld(worldW, worldH);
  }

  // ============================================================
  // [🧱 BLOCK: Dash Hit Check]
  // Only active while state === 'dashing'. Circle vs player center.
  // ============================================================
  isDashHittingPlayer(player: Player): boolean {
    if (this.dasherState !== 'dashing') return false;
    if (this.damageCooldown > 0) return false;
    const { x: ecx, y: ecy } = rectCenter(this);
    const { x: pcx, y: pcy } = rectCenter(player);
    return circleCircle(ecx, ecy, HIT_RADIUS, pcx, pcy, player.width / 2);
  }

  get dashDamage(): number { return DASH_DAMAGE; }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (this.isDead) return;
    if (!camera.isVisible(this.x, this.y, this.width, this.height)) return;

    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);
    const cx = sx + this.width  / 2;
    const cy = sy + this.height / 2;

    // ── Afterimage trail ──────────────────────────────────────
    this.trail.forEach((p) => {
      const tx = camera.toScreenX(p.x - this.width  / 2);
      const ty = camera.toScreenY(p.y - this.height / 2);
      ctx.globalAlpha = p.alpha * 0.7;
      ctx.fillStyle   = "#06b6d4";
      ctx.fillRect(tx, ty, this.width * 0.75, this.height * 0.75);
    });
    ctx.globalAlpha = 1;

    // ── Windup telegraph ──────────────────────────────────────
    if (this.dasherState === 'windup') {
      const progress = 1 - Math.max(0, this.stateTimer) / WINDUP_MS;
      const pulse    = Math.sin(Date.now() / 80) * 0.35 + 0.65;

      // Direction arrow line
      ctx.strokeStyle = `rgba(6,182,212,${pulse})`;
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(
        cx + this.dashDir.x * (60 + progress * 80),
        cy + this.dashDir.y * (60 + progress * 80)
      );
      ctx.stroke();
      ctx.setLineDash([]);

      // Charge ring
      ctx.beginPath();
      ctx.arc(cx, cy, 14 + progress * 10, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(6,182,212,${pulse * 0.8})`;
      ctx.lineWidth   = 2;
      ctx.stroke();
    }

    // ── Dashing speed lines ───────────────────────────────────
    if (this.dasherState === 'dashing') {
      ctx.strokeStyle = "rgba(6,182,212,0.6)";
      ctx.lineWidth   = 1;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - this.dashDir.x * i * 8, cy - this.dashDir.y * i * 8);
        ctx.lineTo(cx - this.dashDir.x * (i * 8 + 5), cy - this.dashDir.y * (i * 8 + 5));
        ctx.stroke();
      }
    }

    // ── Body ──────────────────────────────────────────────────
    const bodyColor =
      this.isHit                         ? '#ffffff' :
      this.dasherState === 'dashing'     ? '#67e8f9' :
      this.dasherState === 'windup'      ? '#0891b2' :
      COLOR;

    this.drawBody(ctx, sx, sy, bodyColor);
    this.drawHpBar(ctx, sx, sy);
  }
}