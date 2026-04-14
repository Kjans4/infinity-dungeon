// src/engine/enemy/boss/Brute.ts
import { Player }                               from "../../Player";
import { Camera }                               from "../../Camera";
import { BaseEnemy }                            from "../BaseEnemy";
import { Projectile }                           from "../Projectile";
import { rectOverlap, circleCircle, rectCenter } from "../../Collision";

// ============================================================
// [🧱 BLOCK: Boss States]
// ============================================================
type BruteState =
  | 'chase'
  | 'warn_charge'
  | 'charging'
  | 'warn_slam'
  | 'slamming'
  | 'slamming2'
  | 'warn_shoot'
  | 'shooting'
  | 'cooldown';

// ============================================================
// [🧱 BLOCK: Stats]
// ============================================================
const STATS = {
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
  slam2MaxRadius: 80,
  chargeSpeed:    14,
  rageChargeSpeed:20,
  shootDamage:    15,
};

const WARN_NORMAL  = 1500;
const WARN_FLOOR4  =  900;
const WARN_RAGE    =  700;
const CHASE_NORMAL = 3000;
const CHASE_RAGE   = 1800;

const SPREAD_ANGLES = [-Math.PI / 9, 0, Math.PI / 9];

// ============================================================
// [🧱 BLOCK: Brute Class]
// Floor 1: charge | slam
// Floor 2+: charge | slam | shoot
// Floor 3+: charge | double-slam | shoot
// ============================================================
export class Brute extends BaseEnemy {
  readonly bossName = 'BRUTE';

  bossState:  BruteState = 'chase';
  stateTimer: number     = CHASE_NORMAL;

  chargeDir: { x: number; y: number } = { x: 0, y: 0 };

  slamRadius:  number  = 0;
  slamActive:  boolean = false;
  slam2Radius: number  = 0;
  slam2Active: boolean = false;
  private slam2ActiveTimer: number = 0;
  private readonly SLAM2_ACTIVE_MS  = 350;

  pendingProjectiles: Projectile[] = [];

  isEnraged:            boolean = false;
  justEnragedThisFrame: boolean = false;

  damageCooldown: number = 0;
  indicatorPulse: number = 0;

  private floor: number;

  constructor(x: number, y: number, floor: number = 1) {
    const hpScale = 1 + (floor - 1) * 0.50;
    super(x, y, STATS.size, STATS.baseSpeed,
      Math.round(STATS.baseHp * hpScale), STATS.xpValue, STATS.color);
    this.floor = floor;
  }

  // ============================================================
  // [🧱 BLOCK: Computed Timings]
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
    return this.isEnraged ? STATS.rageChargeSpeed : STATS.chargeSpeed;
  }

  // ============================================================
  // [🧱 BLOCK: Pick Next Attack]
  // ============================================================
  private pickNextAttack(): BruteState {
    const roll = Math.random();
    if (this.floor < 2) return roll < 0.5 ? 'warn_charge' : 'warn_slam';
    if (roll < 0.33) return 'warn_charge';
    if (roll < 0.66) return 'warn_slam';
    return 'warn_shoot';
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
  // [🧱 BLOCK: Fire Spread]
  // ============================================================
  private fireSpread(ecx: number, ecy: number, pcx: number, pcy: number): void {
    const baseAngle = Math.atan2(pcy - ecy, pcx - ecx);
    SPREAD_ANGLES.forEach((offset) => {
      const angle = baseAngle + offset;
      const tx = ecx + Math.cos(angle) * 300;
      const ty = ecy + Math.sin(angle) * 300;
      this.pendingProjectiles.push(new Projectile(ecx, ecy, tx, ty, STATS.shootDamage));
    });
  }

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

    if (this.slam2Active) {
      this.slam2ActiveTimer -= 16;
      if (this.slam2ActiveTimer <= 0) { this.slam2Active = false; this.slam2Radius = 0; }
    }

    this.checkRage();

    const { x: pcx, y: pcy } = rectCenter(player);
    const { x: ecx, y: ecy } = rectCenter(this);
    const dx   = pcx - ecx;
    const dy   = pcy - ecy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    switch (this.bossState) {
      case 'chase':
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
        this.x += this.vx; this.y += this.vy;
        if (this.stateTimer <= 0) {
          this.bossState  = this.pickNextAttack();
          this.stateTimer = this.warnDuration;
          this.indicatorPulse = 0;
        }
        break;

      case 'warn_charge':
        this.vx = 0; this.vy = 0;
        if (this.stateTimer <= 300) this.chargeDir = { x: dx / dist, y: dy / dist };
        if (this.stateTimer <= 0) { this.bossState = 'charging'; this.stateTimer = 600; }
        break;

      case 'charging':
        this.x += this.chargeDir.x * this.currentChargeSpeed;
        this.y += this.chargeDir.y * this.currentChargeSpeed;
        if (this.stateTimer <= 0) { this.bossState = 'cooldown'; this.stateTimer = 800; }
        break;

      case 'warn_slam':
        this.vx = 0; this.vy = 0;
        this.slamRadius = STATS.slamMaxRadius * (1 - this.stateTimer / this.warnDuration);
        if (this.stateTimer <= 0) {
          this.bossState = 'slamming'; this.stateTimer = 400;
          this.slamActive = true; this.slamRadius = STATS.slamMaxRadius;
        }
        break;

      case 'slamming':
        if (this.stateTimer <= 0) {
          this.slamActive = false; this.slamRadius = 0;
          if (this.floor >= 3) {
            this.bossState = 'slamming2'; this.stateTimer = this.warnDuration; this.slam2Radius = 0;
          } else {
            this.bossState = 'cooldown'; this.stateTimer = 1000;
          }
        }
        break;

      case 'slamming2':
        this.slam2Radius = STATS.slam2MaxRadius * (1 - this.stateTimer / this.warnDuration);
        if (this.stateTimer <= 0) {
          this.slam2Active = true;
          this.slam2Radius = STATS.slam2MaxRadius;
          this.slam2ActiveTimer = this.SLAM2_ACTIVE_MS;
          this.bossState = 'cooldown'; this.stateTimer = 1200;
        }
        break;

      case 'warn_shoot':
        this.vx = 0; this.vy = 0;
        if (this.stateTimer <= 200) this.chargeDir = { x: dx / dist, y: dy / dist };
        if (this.stateTimer <= 0) {
          this.bossState = 'shooting'; this.stateTimer = 300;
          this.fireSpread(ecx, ecy, pcx, pcy);
        }
        break;

      case 'shooting':
        if (this.stateTimer <= 0) { this.bossState = 'cooldown'; this.stateTimer = 1000; }
        break;

      case 'cooldown':
        this.vx = 0; this.vy = 0;
        if (this.stateTimer <= 0) { this.bossState = 'chase'; this.stateTimer = this.chaseDuration; }
        break;
    }

    this.clampToWorld(worldW, worldH);
  }

  // ============================================================
  // [🧱 BLOCK: Collision Checks]
  // ============================================================
  isCollidingWithPlayer(player: Player): boolean {
    return this.damageCooldown <= 0 && !this.isDead && rectOverlap(this, player);
  }

  isSlamHittingPlayer(player: Player): boolean {
    const { x: cx, y: cy } = rectCenter(this);
    const { x: px, y: py } = rectCenter(player);
    if (this.slamActive  && circleCircle(cx, cy, this.slamRadius,  px, py, 1)) return true;
    if (this.slam2Active && circleCircle(cx, cy, this.slam2Radius, px, py, 1)) return true;
    return false;
  }

  get contactDamage() { return STATS.damage; }
  get slamDamage()    { return STATS.slamDamage; }
  get shootDamage()   { return STATS.shootDamage; }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    if (this.isDead) return;

    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);
    const cx = sx + this.width  / 2;
    const cy = sy + this.height / 2;

    // Slam 1
    if (this.bossState === 'warn_slam' || this.bossState === 'slamming') {
      const pulse = Math.sin(this.indicatorPulse / 150) * 0.3 + 0.7;
      if (this.bossState === 'slamming') {
        ctx.beginPath(); ctx.arc(cx, cy, this.slamRadius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.fill();
        ctx.strokeStyle = "rgba(255,100,100,0.9)"; ctx.lineWidth = 4; ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(cx, cy, this.slamRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(239,68,68,${pulse})`; ctx.lineWidth = 3; ctx.stroke();
      }
    }

    // Slam 2
    if (this.bossState === 'slamming2' || this.slam2Active) {
      const pulse = Math.sin(this.indicatorPulse / 120) * 0.3 + 0.7;
      ctx.beginPath(); ctx.arc(cx, cy, this.slam2Radius || STATS.slam2MaxRadius, 0, Math.PI * 2);
      if (this.slam2Active) {
        ctx.fillStyle = "rgba(255,200,200,0.12)"; ctx.fill();
        ctx.strokeStyle = "rgba(255,150,150,0.9)"; ctx.lineWidth = 3; ctx.stroke();
      } else {
        ctx.strokeStyle = `rgba(249,115,22,${pulse})`; ctx.lineWidth = 2; ctx.stroke();
      }
    }

    // Charge warn
    if (this.bossState === 'warn_charge') {
      const pulse = Math.sin(this.indicatorPulse / 100) * 0.4 + 0.6;
      ctx.beginPath(); ctx.arc(cx, cy, 65, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(250,204,21,${pulse})`; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + this.chargeDir.x * 55, cy + this.chargeDir.y * 55);
      ctx.strokeStyle = `rgba(250,204,21,${pulse})`; ctx.lineWidth = 2; ctx.stroke();
    }

    // Shoot warn
    if (this.bossState === 'warn_shoot') {
      const pulse = Math.sin(this.indicatorPulse / 100) * 0.4 + 0.6;
      ctx.beginPath(); ctx.arc(cx, cy, 55, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(56,189,248,${pulse})`; ctx.lineWidth = 3; ctx.stroke();
      const baseAngle = Math.atan2(this.chargeDir.y, this.chargeDir.x);
      SPREAD_ANGLES.forEach((offset) => {
        const a = baseAngle + offset;
        ctx.strokeStyle = `rgba(56,189,248,${offset === 0 ? 0.4 : 0.2})`;
        ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * 200, cy + Math.sin(a) * 200); ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    // Rage aura
    if (this.isEnraged) {
      const pulse = Math.sin(this.indicatorPulse / 80) * 0.3 + 0.4;
      ctx.beginPath(); ctx.arc(cx, cy, this.width / 2 + 8, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(127,29,29,${pulse})`; ctx.lineWidth = 3; ctx.stroke();
    }

    const bodyColor =
      this.isHit                    ? '#ffffff' :
      this.bossState === 'charging' ? '#f97316' :
      this.bossState === 'slamming' ? '#ef4444' :
      this.bossState === 'slamming2'? '#f87171' :
      this.bossState === 'shooting' ? '#38bdf8' :
      this.isEnraged                ? '#991b1b' :
      STATS.color;

    this.drawBody(ctx, sx, sy, bodyColor);

    const barW = this.width * 2;
    this.drawHpBar(ctx, sx - this.width / 2, sy, barW, -14);

    if (!this.isEnraged) {
      const markerX = sx - this.width / 2 + barW * 0.5;
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillRect(markerX - 1, sy - 15, 2, 6);
    }

    ctx.fillStyle = this.isEnraged ? "#f87171" : "rgba(255,255,255,0.7)";
    ctx.font = `bold 10px 'Courier New'`;
    ctx.textAlign = "center";
    ctx.fillText(this.isEnraged ? "⚡ ENRAGED" : this.bossName, cx, sy - 20);
    ctx.textAlign = "left";
  }
}