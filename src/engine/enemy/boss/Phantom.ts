// src/engine/enemy/boss/Phantom.ts
import { Player }                         from "../../Player";
import { Camera }                         from "../../Camera";
import { BaseEnemy, rollVariants }        from "../BaseEnemy";
import { Projectile }                     from "../Projectile";
import { rectCenter, circleCircle }       from "../../Collision";

// ============================================================
// [🧱 BLOCK: Phantom States]
// ============================================================
type PhantomState =
  | 'fade_out'
  | 'blink'
  | 'fade_in'
  | 'warn_ring'
  | 'firing_ring'
  | 'warn_aimed'
  | 'firing_aimed'
  | 'cooldown';

// ============================================================
// [🧱 BLOCK: Stats]
// HP buffed: 220 → 300 base
// ============================================================
const STATS = {
  baseHp:       300,   // ↑ was 220
  size:         56,
  speed:        0,
  xpValue:      20,
  color:        '#a855f7',
  rageColor:    '#6d28d9',
  ringDamage:   10,
  aimedDamage:  18,
  ringCount:    8,
  rageRingCount:12,
};

const BLINK_MARGIN = 120;
const FADE_MS    = 500;
const WARN_MS    = 1200;
const WARN_RAGE  = 750;
const COOL_MS    = 1400;
const COOL_RAGE  = 900;

// ============================================================
// [🧱 BLOCK: Phantom Class]
// ============================================================
export class Phantom extends BaseEnemy {
  readonly bossName = 'PHANTOM';

  phantomState: PhantomState = 'cooldown';
  stateTimer:   number       = 800;

  alpha:        number = 1;
  isIntangible: boolean = false;

  pendingProjectiles: Projectile[] = [];

  isEnraged:            boolean = false;
  justEnragedThisFrame: boolean = false;

  private floor:       number;
  private blinkTarget: { x: number; y: number } = { x: 0, y: 0 };
  private indicatorPulse: number = 0;
  private aimDir: { x: number; y: number } = { x: 0, y: 1 };

  constructor(x: number, y: number, floor: number = 1) {
    const hpScale = 1 + (floor - 1) * 0.50;
    super(x, y, STATS.size, STATS.speed,
      Math.round(STATS.baseHp * hpScale), STATS.xpValue, STATS.color);
    this.floor = floor;
    this.applyVariants(rollVariants(floor, true));
  }

  // ============================================================
  // [🧱 BLOCK: Effective Damage]
  // ============================================================
  get ringDamageFinal()  { return Math.round(STATS.ringDamage  * this.damageMult); }
  get aimedDamageFinal() { return Math.round(STATS.aimedDamage * this.damageMult); }

  get contactDamage() { return 0; }
  get slamDamage()    { return 0; }
  get shootDamage()   { return this.aimedDamageFinal; }

  // ============================================================
  // [🧱 BLOCK: Rage Check]
  // ============================================================
  private checkRage(): void {
    if (!this.isEnraged && this.hp / this.maxHp <= 0.5) {
      this.isEnraged            = true;
      this.justEnragedThisFrame = true;
      this.color                = STATS.rageColor;
    }
  }

  // ============================================================
  // [🧱 BLOCK: Override takeDamage — intangible blocks hits]
  // ============================================================
  takeDamage(amount: number): void {
    if (this.isIntangible) return;
    super.takeDamage(amount);
  }

  // ============================================================
  // [🧱 BLOCK: Pick Safe Blink Position]
  // ============================================================
  private pickBlinkTarget(worldW: number, worldH: number, player: Player): { x: number; y: number } {
    const { x: px, y: py } = rectCenter(player);
    let best = { x: worldW / 2, y: worldH / 2 };
    let bestDist = 0;
    for (let attempt = 0; attempt < 8; attempt++) {
      const tx = BLINK_MARGIN + Math.random() * (worldW - BLINK_MARGIN * 2);
      const ty = BLINK_MARGIN + Math.random() * (worldH - BLINK_MARGIN * 2);
      const d  = Math.sqrt((tx - px) ** 2 + (ty - py) ** 2);
      if (d > bestDist) { bestDist = d; best = { x: tx, y: ty }; }
    }
    return best;
  }

  // ============================================================
  // [🧱 BLOCK: Fire Ring]
  // ============================================================
  private fireRing(ecx: number, ecy: number): void {
    const count = this.isEnraged ? STATS.rageRingCount : STATS.ringCount;
    const dmg   = this.ringDamageFinal;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const tx = ecx + Math.cos(angle) * 300;
      const ty = ecy + Math.sin(angle) * 300;
      this.pendingProjectiles.push(new Projectile(ecx, ecy, tx, ty, dmg));
    }
  }

  // ============================================================
  // [🧱 BLOCK: Fire Aimed Volley]
  // ============================================================
  private fireAimed(ecx: number, ecy: number, pcx: number, pcy: number): void {
    const base  = Math.atan2(pcy - ecy, pcx - ecx);
    const count = this.floor >= 2 ? 3 : 1;
    const step  = Math.PI / 10;
    const dmg   = this.aimedDamageFinal;
    for (let i = 0; i < count; i++) {
      const offset = (i - Math.floor(count / 2)) * step;
      const angle  = base + offset;
      const tx = ecx + Math.cos(angle) * 350;
      const ty = ecy + Math.sin(angle) * 350;
      this.pendingProjectiles.push(new Projectile(ecx, ecy, tx, ty, dmg));
    }
  }

  private pickAttack(): PhantomState {
    return Math.random() < 0.5 ? 'warn_ring' : 'warn_aimed';
  }

  private get warnMs(): number  { return this.isEnraged ? WARN_RAGE : WARN_MS; }
  private get coolMs(): number  { return this.isEnraged ? COOL_RAGE : COOL_MS; }

  // ============================================================
  // [🧱 BLOCK: Update]
  // ============================================================
  update(player: Player, worldW: number, worldH: number) {
    if (this.isDead) return;

    this.justEnragedThisFrame = false;
    this.tickHitFlash();
    this.tickVariantPulse();
    this.tickRegen();
    this.stateTimer     -= 16;
    this.indicatorPulse += 16;
    this.checkRage();

    const { x: pcx, y: pcy } = rectCenter(player);
    const { x: ecx, y: ecy } = rectCenter(this);

    switch (this.phantomState) {
      case 'cooldown':
        this.alpha        = 1;
        this.isIntangible = false;
        if (this.stateTimer <= 0) {
          this.blinkTarget  = this.pickBlinkTarget(worldW, worldH, player);
          this.phantomState = 'fade_out';
          this.stateTimer   = FADE_MS;
          this.isIntangible = true;
        }
        break;

      case 'fade_out':
        this.alpha = Math.max(0, this.stateTimer / FADE_MS);
        if (this.stateTimer <= 0) { this.phantomState = 'blink'; this.stateTimer = 50; }
        break;

      case 'blink':
        this.alpha = 0;
        this.x     = this.blinkTarget.x - this.width  / 2;
        this.y     = this.blinkTarget.y - this.height / 2;
        if (this.stateTimer <= 0) { this.phantomState = 'fade_in'; this.stateTimer = FADE_MS; }
        break;

      case 'fade_in':
        this.alpha = 1 - (this.stateTimer / FADE_MS);
        if (this.stateTimer <= 0) {
          this.alpha        = 1;
          this.isIntangible = false;
          this.phantomState = this.pickAttack();
          this.stateTimer   = this.warnMs;
          this.indicatorPulse = 0;
          const dx = pcx - (this.x + this.width  / 2);
          const dy = pcy - (this.y + this.height / 2);
          const d  = Math.sqrt(dx * dx + dy * dy) || 1;
          this.aimDir = { x: dx / d, y: dy / d };
        }
        break;

      case 'warn_ring':
        if (this.stateTimer <= 0) {
          this.phantomState = 'firing_ring';
          this.stateTimer   = 200;
          this.fireRing(ecx, ecy);
        }
        break;

      case 'firing_ring':
        if (this.stateTimer <= 0) { this.phantomState = 'cooldown'; this.stateTimer = this.coolMs; }
        break;

      case 'warn_aimed':
        if (this.stateTimer > 300) {
          const dx = pcx - ecx; const dy = pcy - ecy;
          const d  = Math.sqrt(dx * dx + dy * dy) || 1;
          this.aimDir = { x: dx / d, y: dy / d };
        }
        if (this.stateTimer <= 0) {
          this.phantomState = 'firing_aimed';
          this.stateTimer   = 200;
          this.fireAimed(ecx, ecy, pcx, pcy);
        }
        break;

      case 'firing_aimed':
        if (this.stateTimer <= 0) { this.phantomState = 'cooldown'; this.stateTimer = this.coolMs; }
        break;
    }

    this.clampToWorld(worldW, worldH);
  }

  isCollidingWithPlayer(_player: Player): boolean { return false; }
  isSlamHittingPlayer(_player: Player): boolean   { return false; }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    if (this.isDead) return;

    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);
    const cx = sx + this.width  / 2;
    const cy = sy + this.height / 2;

    ctx.globalAlpha = this.alpha;

    if (this.phantomState === 'warn_ring') {
      const progress = 1 - this.stateTimer / this.warnMs;
      const pulse    = Math.sin(this.indicatorPulse / 120) * 0.3 + 0.7;
      ctx.beginPath();
      ctx.arc(cx, cy, 20 + progress * 80, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(168,85,247,${pulse})`;
      ctx.lineWidth   = 2;
      ctx.stroke();
    }

    if (this.phantomState === 'warn_aimed') {
      const pulse = Math.sin(this.indicatorPulse / 100) * 0.4 + 0.6;
      const count = this.floor >= 2 ? 3 : 1;
      const step  = Math.PI / 10;
      const base  = Math.atan2(this.aimDir.y, this.aimDir.x);
      for (let i = 0; i < count; i++) {
        const a = base + (i - Math.floor(count / 2)) * step;
        ctx.strokeStyle = `rgba(239,68,68,${i === Math.floor(count / 2) ? pulse : pulse * 0.5})`;
        ctx.lineWidth   = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * 220, cy + Math.sin(a) * 220);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (this.isEnraged) {
      const pulse = Math.sin(this.indicatorPulse / 80) * 0.3 + 0.4;
      ctx.beginPath();
      ctx.arc(cx, cy, this.width / 2 + 10, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(109,40,217,${pulse})`;
      ctx.lineWidth   = 3;
      ctx.stroke();
    }

    if (this.isIntangible && this.alpha > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, this.width / 2 + 4, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(168,85,247,0.6)`;
      ctx.lineWidth   = 2;
      ctx.setLineDash([3, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    this.drawVariantAura(ctx, sx, sy);

    const bodyColor =
      this.isHit                          ? '#ffffff' :
      this.phantomState === 'firing_ring' ? '#c084fc' :
      this.phantomState === 'firing_aimed'? '#f87171' :
      this.isEnraged                      ? '#7c3aed' :
      STATS.color;

    this.drawBody(ctx, sx, sy, bodyColor);
    ctx.globalAlpha = this.alpha;

    const barW = this.width * 2;
    this.drawHpBar(ctx, sx - this.width / 2, sy, barW, -14);

    if (!this.isEnraged) {
      const markerX = sx - this.width / 2 + barW * 0.5;
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillRect(markerX - 1, sy - 15, 2, 6);
    }

    ctx.fillStyle = this.isEnraged ? "#c084fc" : "rgba(255,255,255,0.7)";
    ctx.font      = `bold 10px 'Courier New'`;
    ctx.textAlign = "center";
    ctx.fillText(this.isEnraged ? "⚡ UNBOUND" : this.bossName, cx, sy - 20);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;

    this.drawVariantIndicators(ctx, sx - this.width / 2, sy, barW, -14);
  }
}