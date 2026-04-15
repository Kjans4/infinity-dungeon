// src/engine/enemy/boss/Shade.ts
import { Player }                         from "../../Player";
import { Camera }                         from "../../Camera";
import { BaseEnemy }                      from "../BaseEnemy";
import { Projectile }                     from "../Projectile";
import { rectCenter }                     from "../../Collision";

// ============================================================
// [🧱 BLOCK: Shade States]
// Fast agile melee boss. Smaller hitbox than any other boss.
// Dashes constantly — toward player to attack, away to evade.
// ============================================================
type ShadeState =
  | 'chase'
  | 'approach_dash'   // dashing toward player to close range
  | 'warn_lunge'      // winding up spear lunge
  | 'lunging'         // long thin rect hitbox active
  | 'evade_dash'      // dashing away from player after attack
  | 'cooldown';

// ============================================================
// [🧱 BLOCK: Stats]
// ============================================================
const STATS = {
  baseHp:         180,
  size:           44,           // smaller than any horde enemy
  speed:          3.5,
  rageSpeed:      5.0,
  color:          '#64748b',
  rageColor:      '#334155',
  xpValue:        20,
  lungeDamage:    32,
  lungeDamageRage:45,
  // Lunge hitbox — long thin rectangle ahead of boss center
  lungeLength:    140,
  lungeLengthRage:200,
  lungeWidth:     22,
  dashSpeed:      12,
  dashSpeedRage:  18,
  dashDuration:   180,    // ms
  dashDurationRage: 120,
  evadeDist:      220,    // how far the evade dash travels
};

// ============================================================
// [🧱 BLOCK: Trail Point]
// ============================================================
interface TrailPoint {
  x: number; y: number; alpha: number;
}

// ============================================================
// [🧱 BLOCK: Shade Class]
// ============================================================
export class Shade extends BaseEnemy {
  readonly bossName = 'SHADE';

  shadeState:  ShadeState = 'chase';
  stateTimer:  number     = 0;

  // No projectiles — melee only
  pendingProjectiles: Projectile[] = [];

  isEnraged:            boolean = false;
  justEnragedThisFrame: boolean = false;

  damageCooldown: number = 0;
  indicatorPulse: number = 0;

  // Lunge hitbox — active only during 'lunging' state
  lungeActive: boolean = false;
  // Direction locked at lunge start
  private lungeDir: { x: number; y: number } = { x: 0, y: 1 };
  // Dash direction
  private dashDir:  { x: number; y: number } = { x: 0, y: 1 };

  // Afterimage trail (enrage)
  private trail: TrailPoint[] = [];

  private floor: number;

  constructor(x: number, y: number, floor: number = 1) {
    const hpScale = 1 + (floor - 1) * 0.50;
    super(x, y, STATS.size,
      STATS.speed * (1 + (floor - 1) * 0.15),
      Math.round(STATS.baseHp * hpScale),
      STATS.xpValue,
      STATS.color
    );
    this.floor = floor;
  }

  // ============================================================
  // [🧱 BLOCK: Rage Check]
  // ============================================================
  private checkRage(): void {
    if (!this.isEnraged && this.hp / this.maxHp <= 0.5) {
      this.isEnraged            = true;
      this.justEnragedThisFrame = true;
      this.speed                = STATS.rageSpeed;
      this.color                = STATS.rageColor;
    }
  }

  // ============================================================
  // [🧱 BLOCK: Computed Values]
  // ============================================================
  private get dashSpeed():    number { return this.isEnraged ? STATS.dashSpeedRage    : STATS.dashSpeed;    }
  private get dashDuration(): number { return this.isEnraged ? STATS.dashDurationRage : STATS.dashDuration; }
  private get lungeLength():  number { return this.isEnraged ? STATS.lungeLengthRage  : STATS.lungeLength;  }
  private get lungeDmg():     number { return this.isEnraged ? STATS.lungeDamageRage  : STATS.lungeDamage;  }

  // ============================================================
  // [🧱 BLOCK: Pick Evade Direction]
  // Dashes directly away from player, with slight random offset
  // so it doesn't always end up in the same corner.
  // ============================================================
  private pickEvadeDir(player: Player): { x: number; y: number } {
    const { x: ecx, y: ecy } = rectCenter(this);
    const { x: pcx, y: pcy } = rectCenter(player);
    const dx    = ecx - pcx;
    const dy    = ecy - pcy;
    const dist  = Math.sqrt(dx * dx + dy * dy) || 1;
    // Base away direction + small random perpendicular nudge
    const perp  = (Math.random() - 0.5) * 0.6;
    const rx    = dx / dist + perp * (-dy / dist);
    const ry    = dy / dist + perp * (dx  / dist);
    const rlen  = Math.sqrt(rx * rx + ry * ry) || 1;
    return { x: rx / rlen, y: ry / rlen };
  }

  // ============================================================
  // [🧱 BLOCK: Lunge Hit Check]
  // Long thin rectangle projected ahead of boss center in
  // lungeDir. Checks overlap with player rect.
  // ============================================================
  isLungeHittingPlayer(player: Player): boolean {
    if (!this.lungeActive) return false;
    const { x: ecx, y: ecy } = rectCenter(this);
    const angle = Math.atan2(this.lungeDir.y, this.lungeDir.x);
    const cos   = Math.cos(-angle);
    const sin   = Math.sin(-angle);
    const pcx   = player.x + player.width  / 2;
    const pcy   = player.y + player.height / 2;
    const dx    = pcx - ecx;
    const dy    = pcy - ecy;
    const lx    = dx * cos - dy * sin;
    const ly    = dx * sin + dy * cos;
    const halfW = STATS.lungeWidth / 2 + player.width / 2;
    return (
      lx >= -(player.width / 2) &&
      lx <= this.lungeLength + player.width / 2 &&
      Math.abs(ly) < halfW
    );
  }

  get lungeDamage(): number { return this.lungeDmg; }

  // ============================================================
  // [🧱 BLOCK: Update]
  // ============================================================
  update(player: Player, worldW: number, worldH: number) {
    if (this.isDead) return;

    this.justEnragedThisFrame = false;
    this.tickHitFlash();
    this.stateTimer     -= 16;
    this.indicatorPulse += 16;
    if (this.damageCooldown > 0) this.damageCooldown -= 16;

    this.checkRage();

    // ── Trail update ──────────────────────────────────────
    if (this.isEnraged) {
      this.trail.push({ x: this.x + this.width / 2, y: this.y + this.height / 2, alpha: 0.5 });
    }
    this.trail = this.trail
      .map((p) => ({ ...p, alpha: p.alpha - 0.04 }))
      .filter((p) => p.alpha > 0);

    const { x: pcx, y: pcy } = rectCenter(player);
    const { x: ecx, y: ecy } = rectCenter(this);
    const dx   = pcx - ecx;
    const dy   = pcy - ecy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    switch (this.shadeState) {

      // ── Chase ─────────────────────────────────────────────
      case 'chase':
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
        this.x += this.vx;
        this.y += this.vy;

        // Close enough — wind up lunge. Shade also approach-dashes
        // from medium range to close the gap fast.
        if (dist < 80) {
          this.shadeState = 'warn_lunge';
          this.stateTimer = this.isEnraged ? 400 : 650;
          this.vx = 0; this.vy = 0;
          this.lungeDir = { x: dx / dist, y: dy / dist };
        } else if (dist < 300 && this.stateTimer <= 0) {
          // Approach dash to close distance
          this.dashDir    = { x: dx / dist, y: dy / dist };
          this.shadeState = 'approach_dash';
          this.stateTimer = this.dashDuration;
        }
        break;

      // ── Approach Dash ─────────────────────────────────────
      case 'approach_dash':
        this.x += this.dashDir.x * this.dashSpeed;
        this.y += this.dashDir.y * this.dashSpeed;
        this.clampToWorld(worldW, worldH);

        if (this.stateTimer <= 0) {
          this.shadeState = 'chase';
          this.stateTimer = this.isEnraged ? 300 : 500;
        }
        // If we got close enough mid-dash, start lunge immediately
        {
          const { x: nx, y: ny } = rectCenter(this);
          const d2 = Math.sqrt((pcx - nx) ** 2 + (pcy - ny) ** 2);
          if (d2 < 80) {
            const ddx = pcx - nx;
            const ddy = pcy - ny;
            const dl  = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
            this.lungeDir   = { x: ddx / dl, y: ddy / dl };
            this.shadeState = 'warn_lunge';
            this.stateTimer = this.isEnraged ? 400 : 650;
            this.vx = 0; this.vy = 0;
          }
        }
        break;

      // ── Warn Lunge ────────────────────────────────────────
      case 'warn_lunge':
        this.vx = 0; this.vy = 0;
        // Keep updating aim until last 150ms
        if (this.stateTimer > 150) {
          const { x: nx, y: ny } = rectCenter(this);
          const ddx = pcx - nx;
          const ddy = pcy - ny;
          const dl  = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
          this.lungeDir = { x: ddx / dl, y: ddy / dl };
        }
        if (this.stateTimer <= 0) {
          this.shadeState  = 'lunging';
          this.stateTimer  = 200;
          this.lungeActive = true;
          // Brief forward lunge movement
          this.vx = this.lungeDir.x * 6;
          this.vy = this.lungeDir.y * 6;
        }
        break;

      // ── Lunging ───────────────────────────────────────────
      case 'lunging':
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.85;
        this.vy *= 0.85;
        if (this.stateTimer <= 0) {
          this.lungeActive = false;
          this.vx = 0; this.vy = 0;
          // Immediately dash away
          this.dashDir    = this.pickEvadeDir(player);
          this.shadeState = 'evade_dash';
          this.stateTimer = this.dashDuration;
        }
        break;

      // ── Evade Dash ────────────────────────────────────────
      case 'evade_dash':
        this.x += this.dashDir.x * this.dashSpeed;
        this.y += this.dashDir.y * this.dashSpeed;
        this.clampToWorld(worldW, worldH);
        if (this.stateTimer <= 0) {
          this.shadeState = 'cooldown';
          this.stateTimer = this.isEnraged ? 400 : 700;
        }
        break;

      // ── Cooldown ──────────────────────────────────────────
      case 'cooldown':
        this.vx = 0; this.vy = 0;
        if (this.stateTimer <= 0) {
          this.shadeState = 'chase';
          this.stateTimer = 0;
        }
        break;
    }

    this.clampToWorld(worldW, worldH);
  }

  // ============================================================
  // [🧱 BLOCK: Collision — contact damage while dashing]
  // ============================================================
  isCollidingWithPlayer(player: Player): boolean {
    if (this.damageCooldown > 0 || this.isDead) return false;
    if (this.shadeState !== 'approach_dash' && this.shadeState !== 'evade_dash') return false;
    return (
      player.x < this.x + this.width  &&
      player.x + player.width  > this.x &&
      player.y < this.y + this.height &&
      player.y + player.height > this.y
    );
  }

  isSlamHittingPlayer(_player: Player): boolean { return false; }

  get contactDamage() { return 10; } // light dash graze damage
  get slamDamage()    { return 0;  }
  get shootDamage()   { return 0;  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    if (this.isDead) return;

    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);
    const cx = sx + this.width  / 2;
    const cy = sy + this.height / 2;

    // ── Afterimage trail (enrage) ─────────────────────────
    this.trail.forEach((p) => {
      const tx = camera.toScreenX(p.x - this.width  / 2);
      const ty = camera.toScreenY(p.y - this.height / 2);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle   = STATS.rageColor;
      ctx.fillRect(tx, ty, this.width * 0.7, this.height * 0.7);
    });
    ctx.globalAlpha = 1;

    // ── Lunge hitbox preview ──────────────────────────────
    if (this.shadeState === 'warn_lunge') {
      const progress = 1 - Math.max(0, this.stateTimer) / (this.isEnraged ? 400 : 650);
      const pulse    = Math.sin(this.indicatorPulse / 90) * 0.4 + 0.6;
      const angle    = Math.atan2(this.lungeDir.y, this.lungeDir.x);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.fillStyle   = `rgba(100,116,139,${0.2 + progress * 0.3})`;
      ctx.strokeStyle = `rgba(100,116,139,${pulse})`;
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.rect(0, -STATS.lungeWidth / 2, this.lungeLength, STATS.lungeWidth);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // ── Active lunge hitbox ───────────────────────────────
    if (this.lungeActive) {
      const angle = Math.atan2(this.lungeDir.y, this.lungeDir.x);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.fillStyle = "rgba(200,220,255,0.35)";
      ctx.beginPath();
      ctx.rect(0, -STATS.lungeWidth / 2, this.lungeLength, STATS.lungeWidth);
      ctx.fill();
      ctx.restore();
    }

    // ── Dash ring ─────────────────────────────────────────
    if (this.shadeState === 'approach_dash' || this.shadeState === 'evade_dash') {
      const color = this.shadeState === 'evade_dash'
        ? "rgba(100,116,139,0.7)"
        : "rgba(148,163,184,0.6)";
      ctx.beginPath();
      ctx.arc(cx, cy, this.width / 2 + 6, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2;
      ctx.stroke();
    }

    // ── Rage aura ─────────────────────────────────────────
    if (this.isEnraged) {
      const pulse = Math.sin(this.indicatorPulse / 70) * 0.3 + 0.4;
      ctx.beginPath();
      ctx.arc(cx, cy, this.width / 2 + 9, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(51,65,85,${pulse + 0.3})`;
      ctx.lineWidth   = 3;
      ctx.stroke();
    }

    // ── Body ──────────────────────────────────────────────
    const bodyColor =
      this.isHit                            ? '#ffffff'  :
      this.shadeState === 'lunging'         ? '#e2e8f0'  :
      this.shadeState === 'approach_dash'   ? '#94a3b8'  :
      this.shadeState === 'evade_dash'      ? '#475569'  :
      this.isEnraged                        ? '#334155'  :
      STATS.color;

    this.drawBody(ctx, sx, sy, bodyColor);

    // HP bar — narrower to match smaller size
    const barW = this.width * 1.8;
    this.drawHpBar(ctx, sx - this.width * 0.4, sy, barW, -12);

    if (!this.isEnraged) {
      const markerX = sx - this.width * 0.4 + barW * 0.5;
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillRect(markerX - 1, sy - 13, 2, 5);
    }

    ctx.fillStyle = this.isEnraged ? "#94a3b8" : "rgba(255,255,255,0.7)";
    ctx.font      = `bold 10px 'Courier New'`;
    ctx.textAlign = "center";
    ctx.fillText(this.isEnraged ? "⚡ PHANTOM STEP" : this.bossName, cx, sy - 17);
    ctx.textAlign = "left";
  }
}