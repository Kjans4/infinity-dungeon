// src/engine/enemy/Boss.ts
import { Player }                               from "../Player";
import { Camera }                               from "../Camera";
import { BaseEnemy }                            from "./BaseEnemy";
import { Projectile }                           from "./Projectile";
import { rectOverlap, circleCircle, rectCenter } from "../Collision";

// ============================================================
// [🧱 BLOCK: Boss States]
// ============================================================
type BossState =
  | 'chase'
  | 'warn_charge'
  | 'charging'
  | 'warn_slam'
  | 'slamming'
  | 'slamming2'    // double slam (Floor 3+)
  | 'warn_shoot'   // projectile spread (Floor 2+)
  | 'shooting'
  | 'cooldown';

// ============================================================
// [🧱 BLOCK: Boss Stats]
// ============================================================
const BOSS_STATS = {
  baseSpeed:      1.2,
  rageSpeed:      2.0,
  baseHp:         300,
  size:           80,
  color:          '#dc2626',
  rageColor:      '#7f1d1d',
  xpValue:        20,
  damage:         20,
  slamDamage:     30,
  slamMaxRadius:  120,
  slam2MaxRadius: 80,   // second slam is smaller
  chargeSpeed:    14,
  rageChargeSpeed:20,
  shootDamage:    15,
};

// Warn durations — floor and rage aware
const WARN_NORMAL  = 1500;
const WARN_FLOOR4  =  900;
const WARN_RAGE    =  700;
const CHASE_NORMAL = 3000;
const CHASE_RAGE   = 1800;

// Spread shot angles (Floor 2+): ±20°
const SPREAD_ANGLES = [-Math.PI / 9, 0, Math.PI / 9];

// ============================================================
// [🧱 BLOCK: Boss Class]
// ============================================================
export class Boss extends BaseEnemy {
  bossState:  BossState = 'chase';
  stateTimer: number    = CHASE_NORMAL;

  // Charge
  chargeDir: { x: number; y: number } = { x: 0, y: 0 };

  // Slam — timers replace setTimeout to respect pause state
  slamRadius:  number  = 0;
  slamActive:  boolean = false;
  slam2Radius: number  = 0;
  slam2Active: boolean = false;
  // How long the slam2 active window lasts (ms)
  private slam2ActiveTimer: number = 0;
  private readonly SLAM2_ACTIVE_MS  = 350;

  // Projectiles — drained by BossSystem each frame
  pendingProjectiles: Projectile[] = [];

  // Rage
  isEnraged:            boolean = false;
  justEnragedThisFrame: boolean = false;

  // Shared
  damageCooldown: number = 0;
  indicatorPulse: number = 0;

  private floor: number;

  constructor(x: number, y: number, floor: number = 1) {
    const hpScale = 1 + (floor - 1) * 0.50;
    super(
      x, y,
      BOSS_STATS.size,
      BOSS_STATS.baseSpeed,
      Math.round(BOSS_STATS.baseHp * hpScale),
      BOSS_STATS.xpValue,
      BOSS_STATS.color,
    );
    this.floor = floor;
  }

  // ============================================================
  // [🧱 BLOCK: Computed Timings]
  // Warn durations shrink with floor and rage.
  // ============================================================
  private get warnDuration(): number {
    if (this.isEnraged) return WARN_RAGE;
    if (this.floor >= 4) return WARN_FLOOR4;
    return WARN_NORMAL;
  }

  private get chaseDuration(): number {
    return this.isEnraged ? CHASE_RAGE : CHASE_NORMAL;
  }

  private get currentChargeSpeed(): number {
    return this.isEnraged ? BOSS_STATS.rageChargeSpeed : BOSS_STATS.chargeSpeed;
  }

  // ============================================================
  // [🧱 BLOCK: Pick Next Attack]
  // Floor 1:  charge | slam (50/50)
  // Floor 2+: charge | slam | shoot (33/33/33)
  // Floor 3+: charge | double-slam | shoot (33/33/33)
  // ============================================================
  private pickNextAttack(): BossState {
    const roll = Math.random();
    if (this.floor < 2) {
      return roll < 0.5 ? 'warn_charge' : 'warn_slam';
    }
    if (roll < 0.33) return 'warn_charge';
    if (roll < 0.66) return 'warn_slam';
    return 'warn_shoot';
  }

  // ============================================================
  // [🧱 BLOCK: Check Rage Trigger]
  // Triggers once when HP drops to or below 50%.
  // ============================================================
  private checkRage(): void {
    if (!this.isEnraged && this.hp / this.maxHp <= 0.5) {
      this.isEnraged            = true;
      this.justEnragedThisFrame = true;
      this.speed                = BOSS_STATS.rageSpeed;
      this.color                = BOSS_STATS.rageColor;
    }
  }

  // ============================================================
  // [🧱 BLOCK: Fire Spread Shot]
  // ============================================================
  private fireSpread(ecx: number, ecy: number, pcx: number, pcy: number): void {
    const baseAngle = Math.atan2(pcy - ecy, pcx - ecx);
    SPREAD_ANGLES.forEach((offset) => {
      const angle = baseAngle + offset;
      const tx    = ecx + Math.cos(angle) * 300;
      const ty    = ecy + Math.sin(angle) * 300;
      this.pendingProjectiles.push(
        new Projectile(ecx, ecy, tx, ty, BOSS_STATS.shootDamage)
      );
    });
  }

  // ============================================================
  // [🧱 BLOCK: Update — Boss State Machine]
  // slam2 active window is now frame-timer based (no setTimeout)
  // so it correctly pauses with the game loop.
  // ============================================================
  update(player: Player, worldW: number, worldH: number) {
    if (this.isDead) return;

    // Reset one-frame flag
    this.justEnragedThisFrame = false;

    this.tickHitFlash();
    this.stateTimer     -= 16;
    this.indicatorPulse += 16;
    if (this.damageCooldown > 0) this.damageCooldown -= 16;

    // Tick slam2 active window
    if (this.slam2Active) {
      this.slam2ActiveTimer -= 16;
      if (this.slam2ActiveTimer <= 0) {
        this.slam2Active  = false;
        this.slam2Radius  = 0;
      }
    }

    this.checkRage();

    const { x: pcx, y: pcy } = rectCenter(player);
    const { x: ecx, y: ecy } = rectCenter(this);
    const dx   = pcx - ecx;
    const dy   = pcy - ecy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    switch (this.bossState) {

      // ── Chase ───────────────────────────────────────────
      case 'chase':
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
        this.x += this.vx;
        this.y += this.vy;

        if (this.stateTimer <= 0) {
          this.bossState      = this.pickNextAttack();
          this.stateTimer     = this.warnDuration;
          this.indicatorPulse = 0;
        }
        break;

      // ── Warn Charge ─────────────────────────────────────
      case 'warn_charge':
        this.vx = 0; this.vy = 0;
        if (this.stateTimer <= 300) {
          this.chargeDir = { x: dx / dist, y: dy / dist };
        }
        if (this.stateTimer <= 0) {
          this.bossState  = 'charging';
          this.stateTimer = 600;
        }
        break;

      // ── Charging ────────────────────────────────────────
      case 'charging':
        this.x += this.chargeDir.x * this.currentChargeSpeed;
        this.y += this.chargeDir.y * this.currentChargeSpeed;
        if (this.stateTimer <= 0) {
          this.bossState  = 'cooldown';
          this.stateTimer = 800;
        }
        break;

      // ── Warn Slam ───────────────────────────────────────
      case 'warn_slam':
        this.vx = 0; this.vy = 0;
        this.slamRadius = BOSS_STATS.slamMaxRadius * (1 - this.stateTimer / this.warnDuration);
        if (this.stateTimer <= 0) {
          this.bossState  = 'slamming';
          this.stateTimer = 400;
          this.slamActive = true;
          this.slamRadius = BOSS_STATS.slamMaxRadius;
        }
        break;

      // ── Slamming ────────────────────────────────────────
      case 'slamming':
        if (this.stateTimer <= 0) {
          this.slamActive = false;
          this.slamRadius = 0;
          // Floor 3+: fire second slam immediately
          if (this.floor >= 3) {
            this.bossState  = 'slamming2';
            this.stateTimer = this.warnDuration;
            this.slam2Radius = 0;
          } else {
            this.bossState  = 'cooldown';
            this.stateTimer = 1000;
          }
        }
        break;

      // ── Slamming 2 (Floor 3+) ───────────────────────────
      // Uses a frame-based timer instead of setTimeout so it
      // respects game pause and doesn't drift on low FPS.
      case 'slamming2':
        this.slam2Radius = BOSS_STATS.slam2MaxRadius * (1 - this.stateTimer / this.warnDuration);
        if (this.stateTimer <= 0) {
          this.slam2Active      = true;
          this.slam2Radius      = BOSS_STATS.slam2MaxRadius;
          this.slam2ActiveTimer = this.SLAM2_ACTIVE_MS;
          this.bossState        = 'cooldown';
          this.stateTimer       = 1200;
        }
        break;

      // ── Warn Shoot (Floor 2+) ───────────────────────────
      case 'warn_shoot':
        this.vx = 0; this.vy = 0;
        // Lock aim late in windup
        if (this.stateTimer <= 200) {
          this.chargeDir = { x: dx / dist, y: dy / dist };
        }
        if (this.stateTimer <= 0) {
          this.bossState  = 'shooting';
          this.stateTimer = 300;
          this.fireSpread(ecx, ecy, pcx, pcy);
        }
        break;

      // ── Shooting ────────────────────────────────────────
      case 'shooting':
        if (this.stateTimer <= 0) {
          this.bossState  = 'cooldown';
          this.stateTimer = 1000;
        }
        break;

      // ── Cooldown ────────────────────────────────────────
      case 'cooldown':
        this.vx = 0; this.vy = 0;
        if (this.stateTimer <= 0) {
          this.bossState  = 'chase';
          this.stateTimer = this.chaseDuration;
        }
        break;
    }

    this.clampToWorld(worldW, worldH);
  }

  // ============================================================
  // [🧱 BLOCK: Collision Checks — now use Collision helpers]
  // ============================================================
  isCollidingWithPlayer(player: Player): boolean {
    return (
      this.damageCooldown <= 0 &&
      !this.isDead &&
      rectOverlap(this, player)
    );
  }

  isSlamHittingPlayer(player: Player): boolean {
    const { x: cx, y: cy } = rectCenter(this);
    const { x: px, y: py } = rectCenter(player);

    if (this.slamActive  && circleCircle(cx, cy, this.slamRadius,  px, py, 1)) return true;
    if (this.slam2Active && circleCircle(cx, cy, this.slam2Radius, px, py, 1)) return true;
    return false;
  }

  get contactDamage() { return BOSS_STATS.damage;      }
  get slamDamage()    { return BOSS_STATS.slamDamage;  }
  get shootDamage()   { return BOSS_STATS.shootDamage; }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    if (this.isDead) return;

    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);
    const cx = sx + this.width  / 2;
    const cy = sy + this.height / 2;

    // ── Slam 1 warning / active ──────────────────────────
    if (this.bossState === 'warn_slam' || this.bossState === 'slamming') {
      const pulse = Math.sin(this.indicatorPulse / 150) * 0.3 + 0.7;
      if (this.bossState === 'slamming') {
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

    // ── Slam 2 warning / active (Floor 3+) ───────────────
    if (this.bossState === 'slamming2' || this.slam2Active) {
      const pulse = Math.sin(this.indicatorPulse / 120) * 0.3 + 0.7;
      ctx.beginPath();
      ctx.arc(cx, cy, this.slam2Radius || BOSS_STATS.slam2MaxRadius, 0, Math.PI * 2);
      if (this.slam2Active) {
        ctx.fillStyle   = "rgba(255,200,200,0.12)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,150,150,0.9)";
        ctx.lineWidth   = 3;
        ctx.stroke();
      } else {
        ctx.strokeStyle = `rgba(249, 115, 22, ${pulse})`;
        ctx.lineWidth   = 2;
        ctx.stroke();
      }
    }

    // ── Charge warning ring ──────────────────────────────
    if (this.bossState === 'warn_charge') {
      const pulse = Math.sin(this.indicatorPulse / 100) * 0.4 + 0.6;
      ctx.beginPath();
      ctx.arc(cx, cy, 65, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(250, 204, 21, ${pulse})`;
      ctx.lineWidth   = 3;
      ctx.stroke();

      ctx.strokeStyle = `rgba(250, 204, 21, ${pulse})`;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + this.chargeDir.x * 55, cy + this.chargeDir.y * 55);
      ctx.stroke();
    }

    // ── Shoot warning ring (Floor 2+) ────────────────────
    if (this.bossState === 'warn_shoot') {
      const pulse = Math.sin(this.indicatorPulse / 100) * 0.4 + 0.6;
      // Cyan-blue ring to distinguish from charge
      ctx.beginPath();
      ctx.arc(cx, cy, 55, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(56, 189, 248, ${pulse})`;
      ctx.lineWidth   = 3;
      ctx.stroke();

      // Draw spread aim lines
      const baseAngle = Math.atan2(this.chargeDir.y, this.chargeDir.x);
      SPREAD_ANGLES.forEach((offset) => {
        const a = baseAngle + offset;
        ctx.strokeStyle = `rgba(56, 189, 248, ${offset === 0 ? 0.4 : 0.2})`;
        ctx.lineWidth   = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * 200, cy + Math.sin(a) * 200);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    // ── Rage aura ────────────────────────────────────────
    if (this.isEnraged) {
      const pulse = Math.sin(this.indicatorPulse / 80) * 0.3 + 0.4;
      ctx.beginPath();
      ctx.arc(cx, cy, this.width / 2 + 8, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(127, 29, 29, ${pulse})`;
      ctx.lineWidth   = 3;
      ctx.stroke();
    }

    // ── Body ─────────────────────────────────────────────
    const bodyColor =
      this.isHit                        ? '#ffffff'  :
      this.bossState === 'charging'     ? '#f97316'  :
      this.bossState === 'slamming'     ? '#ef4444'  :
      this.bossState === 'slamming2'    ? '#f87171'  :
      this.bossState === 'shooting'     ? '#38bdf8'  :
      this.isEnraged                    ? '#991b1b'  :
      BOSS_STATS.color;

    this.drawBody(ctx, sx, sy, bodyColor);

    // ── Wide HP bar ───────────────────────────────────────
    const barW = this.width * 2;
    const barX = sx - this.width / 2;
    this.drawHpBar(ctx, barX, sy, barW, -14);

    // ── Rage threshold marker on HP bar ──────────────────
    if (!this.isEnraged) {
      const markerX = barX + barW * 0.5;
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillRect(markerX - 1, sy - 15, 2, 6);
    }

    // ── BOSS label ────────────────────────────────────────
    ctx.fillStyle = this.isEnraged ? "#f87171" : "rgba(255,255,255,0.7)";
    ctx.font      = `bold 10px 'Courier New'`;
    ctx.textAlign = "center";
    ctx.fillText(this.isEnraged ? "⚡ ENRAGED" : "BOSS", cx, sy - 20);
    ctx.textAlign = "left";
  }
}