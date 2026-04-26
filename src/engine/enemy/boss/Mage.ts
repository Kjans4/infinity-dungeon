// src/engine/enemy/boss/Mage.ts
import { Player }                   from "../../Player";
import { Camera }                   from "../../Camera";
import { BaseEnemy, rollVariants }  from "../BaseEnemy";
import { Projectile }               from "../Projectile";
import { rectCenter }               from "../../Collision";

// ============================================================
// [🧱 BLOCK: Mage States]
// ============================================================
type MageState =
  | 'fade_out'
  | 'blink'
  | 'fade_in'
  | 'warn_homing'
  | 'firing_homing'
  | 'warn_burst'
  | 'firing_burst'
  | 'warn_illusion'
  | 'illusion_active'
  | 'cooldown';

// ============================================================
// [🧱 BLOCK: Homing Projectile]
// ============================================================
export class HomingProjectile extends Projectile {
  private homingDuration: number;
  private elapsed:        number = 0;
  private targetRef:      Player;
  private turnSpeed:      number = 0.04;

  constructor(
    x: number, y: number,
    targetX: number, targetY: number,
    damage: number,
    player: Player,
    homingMs: number = 1500
  ) {
    super(x, y, targetX, targetY, damage);
    const speed = 2.2;
    const dx    = targetX - x;
    const dy    = targetY - y;
    const dist  = Math.sqrt(dx * dx + dy * dy) || 1;
    this.vx             = (dx / dist) * speed;
    this.vy             = (dy / dist) * speed;
    this.maxDistance    = 700;
    this.radius         = 9;
    this.targetRef      = player;
    this.homingDuration = homingMs;
  }

  update() {
    if (this.isDone) return;
    this.elapsed += 16;
    if (this.elapsed < this.homingDuration) {
      const px   = this.targetRef.x + this.targetRef.width  / 2;
      const py   = this.targetRef.y + this.targetRef.height / 2;
      const dx   = px - this.x;
      const dy   = py - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const tx   = (dx / dist) * 2.2;
      const ty   = (dy / dist) * 2.2;
      this.vx += (tx - this.vx) * this.turnSpeed;
      this.vy += (ty - this.vy) * this.turnSpeed;
      const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy) || 1;
      this.vx   = (this.vx / spd) * 2.2;
      this.vy   = (this.vy / spd) * 2.2;
    }
    this.x += this.vx;
    this.y += this.vy;
    this.distanceTraveled += Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (this.distanceTraveled >= this.maxDistance) this.isDone = true;
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    if (this.isDone) return;
    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);
    const isHoming = this.elapsed < this.homingDuration;
    ctx.beginPath();
    ctx.arc(sx, sy, this.radius + 5, 0, Math.PI * 2);
    ctx.fillStyle = isHoming ? "rgba(13,148,136,0.3)" : "rgba(13,148,136,0.15)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = isHoming ? "#0d9488" : "#5eead4";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx, sy, this.radius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }
}

// ============================================================
// [🧱 BLOCK: Illusion Fake]
// ============================================================
export class MageFake {
  x:      number;
  y:      number;
  width:  number;
  height: number;
  isDead: boolean = false;
  alpha:  number  = 1;

  pendingProjectiles: Projectile[] = [];

  private fireTimer: number;
  private pulse:     number = 0;
  private player:    Player;
  private floor:     number;

  constructor(x: number, y: number, size: number, player: Player, floor: number) {
    this.x       = x;
    this.y       = y;
    this.width   = size;
    this.height  = size;
    this.player  = player;
    this.floor   = floor;
    this.fireTimer = 800 + Math.random() * 800;
  }

  takeDamage(_amount: number) { this.isDead = true; }

  update() {
    if (this.isDead) return;
    this.pulse     += 16;
    this.fireTimer -= 16;
    if (this.fireTimer <= 0) {
      this.fireFakeShot();
      this.fireTimer = 1200 + Math.random() * 600;
    }
  }

  private fireFakeShot() {
    const ecx = this.x + this.width  / 2;
    const ecy = this.y + this.height / 2;
    const pcx = this.player.x + this.player.width  / 2;
    const pcy = this.player.y + this.player.height / 2;
    const dx  = pcx - ecx;
    const dy  = pcy - ecy;
    const d   = Math.sqrt(dx * dx + dy * dy) || 1;
    const proj = new Projectile(ecx, ecy, ecx + dx / d * 300, ecy + dy / d * 300, 4);
    this.pendingProjectiles.push(proj);
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    if (this.isDead) return;
    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle   = "#0d9488";
    ctx.fillRect(sx, sy, this.width, this.height);
    const cx = sx + this.width  / 2;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font      = `bold 10px 'Courier New'`;
    ctx.textAlign = "center";
    ctx.fillText("MAGE", cx, sy - 6);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  }
}

// ============================================================
// [🧱 BLOCK: Mage Stats]
// HP buffed: 180 → 260 base
// ============================================================
const STATS = {
  baseHp:        260,   // ↑ was 180
  size:          52,
  speed:         0,
  xpValue:       20,
  color:         '#0d9488',
  rageColor:     '#0f766e',
  homingDamage:  28,
  burstDamage:   8,
  burstCount:    3,
  fakeCount:     2,
  rageHomingDmg: 38,
  rageBurstDmg:  12,
};

const BLINK_MARGIN = 120;
const FADE_MS      = 450;
const WARN_MS      = 1300;
const WARN_RAGE    = 800;
const COOL_MS      = 1200;
const COOL_RAGE    = 750;
const ILLUSION_MS  = 6000;

// ============================================================
// [🧱 BLOCK: Mage Class]
// ============================================================
export class Mage extends BaseEnemy {
  readonly bossName = 'MAGE';

  mageState:  MageState = 'cooldown';
  stateTimer: number    = 800;

  alpha:        number  = 1;
  isIntangible: boolean = false;

  pendingProjectiles: Projectile[] = [];

  isEnraged:            boolean = false;
  justEnragedThisFrame: boolean = false;

  fakes: MageFake[] = [];

  private floor:          number;
  private blinkTarget:    { x: number; y: number } = { x: 0, y: 0 };
  private indicatorPulse: number = 0;
  private aimDir:         { x: number; y: number } = { x: 0, y: 1 };
  private illusiontimer:  number = 0;
  private playerRef:      Player | null = null;

  constructor(x: number, y: number, floor: number = 1) {
    const hpScale = 1 + (floor - 1) * 0.50;
    super(x, y, STATS.size, STATS.speed,
      Math.round(STATS.baseHp * hpScale), STATS.xpValue, STATS.color);
    this.floor = floor;
    this.applyVariants(rollVariants(floor, true));
  }

  // ============================================================
  // [🧱 BLOCK: Effective Damage with Variant Mult]
  // ============================================================
  private get homingDmg()  { return Math.round((this.isEnraged ? STATS.rageHomingDmg : STATS.homingDamage) * this.damageMult); }
  private get burstDmg()   { return Math.round((this.isEnraged ? STATS.rageBurstDmg  : STATS.burstDamage)  * this.damageMult); }

  get contactDamage() { return 0; }
  get slamDamage()    { return 0; }
  get shootDamage()   { return this.homingDmg; }

  // ============================================================
  // [🧱 BLOCK: Override takeDamage — intangible]
  // ============================================================
  takeDamage(amount: number): void {
    if (this.isIntangible) return;
    super.takeDamage(amount);
  }

  isCollidingWithPlayer(_player: Player): boolean { return false; }
  isSlamHittingPlayer(_player: Player):   boolean { return false; }

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

  private pickBlinkTarget(worldW: number, worldH: number, player: Player): { x: number; y: number } {
    const { x: px, y: py } = rectCenter(player);
    let best = { x: worldW / 2, y: worldH / 2 };
    let bestDist = 0;
    for (let i = 0; i < 8; i++) {
      const tx = BLINK_MARGIN + Math.random() * (worldW - BLINK_MARGIN * 2);
      const ty = BLINK_MARGIN + Math.random() * (worldH - BLINK_MARGIN * 2);
      const d  = Math.sqrt((tx - px) ** 2 + (ty - py) ** 2);
      if (d > bestDist) { bestDist = d; best = { x: tx, y: ty }; }
    }
    return best;
  }

  private pickAttack(): MageState {
    if (this.isEnraged && this.fakes.length === 0 && Math.random() < 0.45) return 'warn_illusion';
    return Math.random() < 0.5 ? 'warn_homing' : 'warn_burst';
  }

  private get warnMs(): number { return this.isEnraged ? WARN_RAGE : WARN_MS; }
  private get coolMs(): number { return this.isEnraged ? COOL_RAGE : COOL_MS; }

  private fireHoming(ecx: number, ecy: number, player: Player): void {
    this.pendingProjectiles.push(
      new HomingProjectile(ecx, ecy, player.x + player.width / 2, player.y + player.height / 2, this.homingDmg, player, 1500)
    );
  }

  private fireBurst(ecx: number, ecy: number, pcx: number, pcy: number): void {
    const base = Math.atan2(pcy - ecy, pcx - ecx);
    const step = Math.PI / 14;
    for (let i = 0; i < STATS.burstCount; i++) {
      const angle = base + (i - 1) * step;
      const tx    = ecx + Math.cos(angle) * 400;
      const ty    = ecy + Math.sin(angle) * 400;
      const proj  = new Projectile(ecx, ecy, tx, ty, this.burstDmg);
      const dx = tx - ecx; const dy = ty - ecy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      proj.vx = (dx / dist) * 6;
      proj.vy = (dy / dist) * 6;
      this.pendingProjectiles.push(proj);
    }
  }

  private spawnFakes(worldW: number, worldH: number, player: Player): void {
    this.fakes = [];
    for (let i = 0; i < STATS.fakeCount; i++) {
      const tx = BLINK_MARGIN + Math.random() * (worldW - BLINK_MARGIN * 2);
      const ty = BLINK_MARGIN + Math.random() * (worldH - BLINK_MARGIN * 2);
      this.fakes.push(new MageFake(tx - STATS.size / 2, ty - STATS.size / 2, STATS.size, player, this.floor));
    }
    this.illusiontimer = ILLUSION_MS;
  }

  private doIllusionSwap(): void {
    if (this.fakes.length === 0) return;
    const swapIdx = Math.floor(Math.random() * this.fakes.length);
    const fake    = this.fakes[swapIdx];
    this.x = fake.x; this.y = fake.y;
    this.fakes.splice(swapIdx, 1);
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // ============================================================
  update(player: Player, worldW: number, worldH: number) {
    if (this.isDead) return;

    this.playerRef            = player;
    this.justEnragedThisFrame = false;
    this.tickHitFlash();
    this.tickVariantPulse();
    this.tickRegen();
    this.stateTimer     -= 16;
    this.indicatorPulse += 16;
    this.checkRage();

    if (this.fakes.length > 0) {
      this.illusiontimer -= 16;
      this.fakes.forEach((f) => f.update());
      this.fakes.forEach((f) => {
        if (f.pendingProjectiles.length > 0) {
          this.pendingProjectiles.push(...f.pendingProjectiles);
          f.pendingProjectiles = [];
        }
      });
      this.fakes = this.fakes.filter((f) => !f.isDead);
      if (this.illusiontimer <= 0) this.fakes = [];
    }

    const { x: pcx, y: pcy } = rectCenter(player);
    const { x: ecx, y: ecy } = rectCenter(this);

    switch (this.mageState) {
      case 'cooldown':
        this.alpha = 1; this.isIntangible = false;
        if (this.stateTimer <= 0) {
          this.blinkTarget  = this.pickBlinkTarget(worldW, worldH, player);
          this.mageState    = 'fade_out';
          this.stateTimer   = FADE_MS;
          this.isIntangible = true;
        }
        break;
      case 'fade_out':
        this.alpha = Math.max(0, this.stateTimer / FADE_MS);
        if (this.stateTimer <= 0) { this.mageState = 'blink'; this.stateTimer = 50; }
        break;
      case 'blink':
        this.alpha = 0;
        this.x = this.blinkTarget.x - this.width  / 2;
        this.y = this.blinkTarget.y - this.height / 2;
        if (this.isEnraged && this.fakes.length > 0 && Math.random() < 0.4) this.doIllusionSwap();
        if (this.stateTimer <= 0) { this.mageState = 'fade_in'; this.stateTimer = FADE_MS; }
        break;
      case 'fade_in':
        this.alpha = 1 - (this.stateTimer / FADE_MS);
        if (this.stateTimer <= 0) {
          this.alpha = 1; this.isIntangible = false;
          this.mageState = this.pickAttack();
          this.stateTimer = this.warnMs;
          this.indicatorPulse = 0;
          const dx = pcx - (this.x + this.width  / 2);
          const dy = pcy - (this.y + this.height / 2);
          const d  = Math.sqrt(dx * dx + dy * dy) || 1;
          this.aimDir = { x: dx / d, y: dy / d };
        }
        break;
      case 'warn_homing':
        if (this.stateTimer > 400) {
          const dx = pcx - ecx; const dy = pcy - ecy;
          const d  = Math.sqrt(dx * dx + dy * dy) || 1;
          this.aimDir = { x: dx / d, y: dy / d };
        }
        if (this.stateTimer <= 0) {
          this.mageState  = 'firing_homing';
          this.stateTimer = 250;
          this.fireHoming(ecx, ecy, player);
        }
        break;
      case 'firing_homing':
        if (this.stateTimer <= 0) { this.mageState = 'cooldown'; this.stateTimer = this.coolMs; }
        break;
      case 'warn_burst':
        if (this.stateTimer > 300) {
          const dx = pcx - ecx; const dy = pcy - ecy;
          const d  = Math.sqrt(dx * dx + dy * dy) || 1;
          this.aimDir = { x: dx / d, y: dy / d };
        }
        if (this.stateTimer <= 0) {
          this.mageState  = 'firing_burst';
          this.stateTimer = 200;
          this.fireBurst(ecx, ecy, pcx, pcy);
        }
        break;
      case 'firing_burst':
        if (this.stateTimer <= 0) { this.mageState = 'cooldown'; this.stateTimer = this.coolMs; }
        break;
      case 'warn_illusion':
        if (this.stateTimer <= 0) {
          this.mageState  = 'illusion_active';
          this.stateTimer = 300;
          this.spawnFakes(worldW, worldH, player);
        }
        break;
      case 'illusion_active':
        if (this.stateTimer <= 0) { this.mageState = 'cooldown'; this.stateTimer = this.coolMs; }
        break;
    }

    this.clampToWorld(worldW, worldH);
  }

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

    if (this.mageState === 'warn_homing') {
      const progress = 1 - this.stateTimer / this.warnMs;
      const pulse    = Math.sin(this.indicatorPulse / 100) * 0.3 + 0.7;
      ctx.beginPath(); ctx.arc(cx, cy, 15 + progress * 60, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(13,148,136,${pulse})`; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = `rgba(13,148,136,${pulse * 0.5})`; ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + this.aimDir.x * 200, cy + this.aimDir.y * 200); ctx.stroke();
      ctx.setLineDash([]);
    }

    if (this.mageState === 'warn_burst') {
      const pulse = Math.sin(this.indicatorPulse / 90) * 0.4 + 0.6;
      const base  = Math.atan2(this.aimDir.y, this.aimDir.x);
      const step  = Math.PI / 14;
      for (let i = 0; i < 3; i++) {
        const a = base + (i - 1) * step;
        ctx.strokeStyle = `rgba(239,68,68,${i === 1 ? pulse : pulse * 0.45})`;
        ctx.lineWidth = 1; ctx.setLineDash([4, 5]);
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * 220, cy + Math.sin(a) * 220); ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (this.mageState === 'warn_illusion') {
      const pulse = Math.sin(this.indicatorPulse / 80) * 0.4 + 0.6;
      for (let r = 20; r <= 60; r += 20) {
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(13,148,136,${pulse * (1 - r / 80)})`; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }

    if (this.isIntangible && this.alpha > 0) {
      ctx.beginPath(); ctx.arc(cx, cy, this.width / 2 + 4, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(13,148,136,0.6)`; ctx.lineWidth = 2;
      ctx.setLineDash([3, 5]); ctx.stroke(); ctx.setLineDash([]);
    }

    if (this.isEnraged) {
      const pulse = Math.sin(this.indicatorPulse / 75) * 0.3 + 0.4;
      ctx.beginPath(); ctx.arc(cx, cy, this.width / 2 + 10, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(15,118,110,${pulse})`; ctx.lineWidth = 3; ctx.stroke();
    }

    this.drawVariantAura(ctx, sx, sy);

    const bodyColor =
      this.isHit                             ? '#ffffff'  :
      this.mageState === 'firing_homing'     ? '#2dd4bf'  :
      this.mageState === 'firing_burst'      ? '#f87171'  :
      this.mageState === 'illusion_active'   ? '#99f6e4'  :
      this.isEnraged                         ? '#0f766e'  :
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

    ctx.fillStyle = this.isEnraged ? "#2dd4bf" : "rgba(255,255,255,0.7)";
    ctx.font = `bold 10px 'Courier New'`; ctx.textAlign = "center";
    ctx.fillText(this.isEnraged ? "⚡ ARCANE" : this.bossName, cx, sy - 20);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;

    this.fakes.forEach((f) => f.draw(ctx, camera));
    this.drawVariantIndicators(ctx, sx - this.width / 2, sy, barW, -14);
  }
}