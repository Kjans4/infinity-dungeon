// src/engine/enemy/Boss.ts
import { Player } from "../Player";
import { Camera } from "../Camera";
import { BaseEnemy } from "./BaseEnemy";

// ============================================================
// [🧱 BLOCK: Boss Attack States]
// ============================================================
type BossState =
  | 'chase'
  | 'warn_charge'
  | 'charging'
  | 'warn_slam'
  | 'slamming'
  | 'cooldown';

// ============================================================
// [🧱 BLOCK: Boss Stats]
// ============================================================
const BOSS_STATS = {
  speed:        1.2,
  baseHp:       300,
  size:         80,
  color:        '#dc2626',
  xpValue:      20,
  damage:       20,
  slamDamage:   30,
  slamMaxRadius:120,
};

// ============================================================
// [🧱 BLOCK: Boss Class]
// Single large enemy with 3-phase attack pattern:
//   chase → warn_charge (yellow ring) → charging (fast dash)
//   chase → warn_slam   (red ring)    → slamming (AoE burst)
// ============================================================
export class Boss extends BaseEnemy {
  state:      BossState = 'chase';
  stateTimer: number    = 3000; // Start with 3s chase before first attack

  // Charge
  chargeDir: { x: number; y: number } = { x: 0, y: 0 };

  // Slam
  slamRadius:    number  = 0;
  slamActive:    boolean = false;

  // Shared
  damageCooldown:  number = 0;
  indicatorPulse:  number = 0;

  constructor(x: number, y: number, floor: number = 1) {
    const hpScale = 1 + (floor - 1) * 0.30;
    super(
      x, y,
      BOSS_STATS.size,
      BOSS_STATS.speed,
      Math.round(BOSS_STATS.baseHp * hpScale),
      BOSS_STATS.xpValue,
      BOSS_STATS.color,
    );
  }

  // ============================================================
  // [🧱 BLOCK: Update — Boss State Machine]
  // ============================================================
  update(player: Player, worldW: number, worldH: number) {
    if (this.isDead) return;

    this.tickHitFlash();
    this.stateTimer     -= 16;
    this.indicatorPulse += 16;
    if (this.damageCooldown > 0) this.damageCooldown -= 16;

    const pcx  = player.x + player.width  / 2;
    const pcy  = player.y + player.height / 2;
    const ecx  = this.x   + this.width    / 2;
    const ecy  = this.y   + this.height   / 2;
    const dx   = pcx - ecx;
    const dy   = pcy - ecy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    switch (this.state) {

      case 'chase':
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
        this.x += this.vx;
        this.y += this.vy;

        if (this.stateTimer <= 0) {
          // Randomly pick next attack pattern
          this.state          = Math.random() < 0.5 ? 'warn_charge' : 'warn_slam';
          this.stateTimer     = 1500;
          this.indicatorPulse = 0;
        }
        break;

      case 'warn_charge':
        // Stop — show yellow warning ring
        this.vx = 0; this.vy = 0;

        // Lock direction late so player can reposition
        if (this.stateTimer <= 300) {
          this.chargeDir = { x: dx / dist, y: dy / dist };
        }

        if (this.stateTimer <= 0) {
          this.state      = 'charging';
          this.stateTimer = 600;
        }
        break;

      case 'charging':
        // Fast dash in locked direction
        this.x += this.chargeDir.x * 14;
        this.y += this.chargeDir.y * 14;

        if (this.stateTimer <= 0) {
          this.state      = 'cooldown';
          this.stateTimer = 800;
        }
        break;

      case 'warn_slam':
        // Stop — grow red warning ring
        this.vx = 0; this.vy = 0;
        this.slamRadius = BOSS_STATS.slamMaxRadius * (1 - this.stateTimer / 1500);

        if (this.stateTimer <= 0) {
          this.state      = 'slamming';
          this.stateTimer = 400;
          this.slamActive = true;
          this.slamRadius = BOSS_STATS.slamMaxRadius;
        }
        break;

      case 'slamming':
        if (this.stateTimer <= 0) {
          this.slamActive = false;
          this.slamRadius = 0;
          this.state      = 'cooldown';
          this.stateTimer = 1000;
        }
        break;

      case 'cooldown':
        this.vx = 0; this.vy = 0;
        if (this.stateTimer <= 0) {
          this.state      = 'chase';
          this.stateTimer = 3000;
        }
        break;
    }

    this.clampToWorld(worldW, worldH);
  }

  // ============================================================
  // [🧱 BLOCK: Collision Checks]
  // ============================================================
  isCollidingWithPlayer(player: Player): boolean {
    return (
      this.damageCooldown <= 0 &&
      !this.isDead &&
      this.x < player.x + player.width  &&
      this.x + this.width  > player.x   &&
      this.y < player.y + player.height &&
      this.y + this.height > player.y
    );
  }

  isSlamHittingPlayer(player: Player): boolean {
    if (!this.slamActive) return false;
    const cx   = this.x + this.width  / 2;
    const cy   = this.y + this.height / 2;
    const px   = player.x + player.width  / 2;
    const py   = player.y + player.height / 2;
    return Math.sqrt((cx - px) ** 2 + (cy - py) ** 2) < this.slamRadius;
  }

  get contactDamage()  { return BOSS_STATS.damage;      }
  get slamDamage()     { return BOSS_STATS.slamDamage;  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    if (this.isDead) return;

    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);
    const cx = sx + this.width  / 2;
    const cy = sy + this.height / 2;

    // ── Slam warning ring ──
    if (this.state === 'warn_slam' || this.state === 'slamming') {
      const pulse = Math.sin(this.indicatorPulse / 150) * 0.3 + 0.7;

      if (this.state === 'slamming') {
        ctx.beginPath();
        ctx.arc(cx, cy, this.slamRadius, 0, Math.PI * 2);
        ctx.fillStyle   = "rgba(255,255,255,0.15)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,100,100,0.9)";
        ctx.lineWidth   = 4;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(cx, cy, this.slamRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(239, 68, 68, ${pulse})`;
        ctx.lineWidth   = 3;
        ctx.stroke();
      }
    }

    // ── Charge warning ring ──
    if (this.state === 'warn_charge') {
      const pulse = Math.sin(this.indicatorPulse / 100) * 0.4 + 0.6;
      ctx.beginPath();
      ctx.arc(cx, cy, 65, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(250, 204, 21, ${pulse})`;
      ctx.lineWidth   = 3;
      ctx.stroke();

      // Direction arrow
      ctx.strokeStyle = `rgba(250, 204, 21, ${pulse})`;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + this.chargeDir.x * 55, cy + this.chargeDir.y * 55);
      ctx.stroke();
    }

    // ── Body ──
    const bodyColor =
      this.isHit              ? '#ffffff'  :
      this.state === 'charging' ? '#f97316' :
      this.state === 'slamming' ? '#ef4444' :
      BOSS_STATS.color;

    this.drawBody(ctx, sx, sy, bodyColor);

    // ── Wide HP bar (2× width, centered) ──
    const barW = this.width * 2;
    const barX = sx - this.width / 2;
    this.drawHpBar(ctx, barX, sy, barW, -14);

    // ── BOSS label ──
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font      = "bold 10px 'Courier New'";
    ctx.textAlign = "center";
    ctx.fillText("BOSS", cx, sy - 20);
    ctx.textAlign = "left";
  }
}