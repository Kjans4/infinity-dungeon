// src/engine/enemy/boss/Colossus.ts
import { Player }                         from "../../Player";
import { Camera }                         from "../../Camera";
import { BaseEnemy, rollVariants }        from "../BaseEnemy";
import { Projectile }                     from "../Projectile";
import { rectCenter, circleCircle }       from "../../Collision";
import { getBossHpScale, getBossDamageScale } from "../../RoomManager";

// ============================================================
// [🧱 BLOCK: Colossus States]
// ============================================================
type ColossusState =
  | 'chase'
  | 'warn_stomp'
  | 'stomping'
  | 'stomp_chain'
  | 'warn_quake'
  | 'quaking'
  | 'cooldown';

// ============================================================
// [🧱 BLOCK: Stats]
// Base HP raised: 650 → 1100
// All damage raised and floor-scaled via getBossDamageScale
// ============================================================
const STATS = {
  baseHp:              1100,
  size:                100,
  speed:               0.9,    // was 0.7
  rageSpeed:           1.7,    // was 1.3
  xpValue:             20,
  color:               '#475569',
  armorBrokenColor:    '#dc2626',
  baseContactDamage:   38,
  baseStompDamage:     55,
  stompRadius:         150,
  baseQuakeDamage:     32,
  damageCooldown:      800,
};

const ARMOR_REDUCTION    = 0.65;
const HEAVY_ARMOR_PIERCE = 0.35;

// ============================================================
// [🧱 BLOCK: Timing Constants]
// More aggressive — shorter chases and warns.
// Stomp chain now always active (not just enraged).
// Rage at 60% HP.
// ============================================================
const WARN_MS      = 1300;   // was 1800
const WARN_RAGE    =  750;   // was 1100
const CHASE_MS     = 1600;   // was 2500
const CHASE_RAGE   =  900;   // was 1600
const COOL_MS      =  800;   // was 1200
const COOL_RAGE    =  450;   // was 700
const RAGE_THRESHOLD = 0.60;

// ============================================================
// [🧱 BLOCK: Colossus Class]
// ============================================================
export class Colossus extends BaseEnemy {
  readonly bossName = 'COLOSSUS';

  colossusState: ColossusState = 'chase';
  stateTimer:    number        = CHASE_MS;

  stompRadius:  number  = 0;
  stompActive:  boolean = false;
  stomp2Radius: number  = 0;
  stomp2Active: boolean = false;
  private stomp2Timer:  number = 0;
  private readonly STOMP2_ACTIVE_MS = 400;

  pendingProjectiles: Projectile[] = [];

  isEnraged:            boolean = false;
  justEnragedThisFrame: boolean = false;

  damageCooldown: number = 0;
  indicatorPulse: number = 0;

  private floor:    number;
  private dmgScale: number;

  constructor(x: number, y: number, floor: number = 1) {
    const hpScale = getBossHpScale(floor);
    super(x, y, STATS.size, STATS.speed,
      Math.round(STATS.baseHp * hpScale), STATS.xpValue, STATS.color);
    this.floor    = floor;
    this.dmgScale = getBossDamageScale(floor);
    this.applyVariants(rollVariants(floor, true));
  }

  // ============================================================
  // [🧱 BLOCK: Armor State]
  // ============================================================
  get isArmored(): boolean {
    return !this.isEnraged && this.hp / this.maxHp > RAGE_THRESHOLD;
  }

  // ============================================================
  // [🧱 BLOCK: Effective Damage — floor scaled + variant + rage]
  // ============================================================
  private get rageMult(): number { return this.isEnraged ? 1.25 : 1.0; }

  get contactDamage() { return Math.round(STATS.baseContactDamage * this.dmgScale * this.damageMult * this.rageMult); }
  get slamDamage()    { return Math.round(STATS.baseStompDamage   * this.dmgScale * this.damageMult * this.rageMult); }
  get shootDamage()   { return Math.round(STATS.baseQuakeDamage   * this.dmgScale * this.damageMult * this.rageMult); }

  // ============================================================
  // [🧱 BLOCK: takeDamage Override — armor + variant DR]
  // ============================================================
  takeDamage(amount: number, isHeavy = false): void {
    if (this.isDead) return;
    let final = amount;
    const variantDR = this.damageReduction;
    if (this.isArmored) {
      const reduction = isHeavy
        ? ARMOR_REDUCTION * (1 - HEAVY_ARMOR_PIERCE)
        : ARMOR_REDUCTION;
      final = Math.max(1, Math.round(amount * (1 - reduction) * (1 - variantDR)));
    } else if (variantDR > 0) {
      final = Math.max(1, Math.round(amount * (1 - variantDR)));
    }
    super.takeDamage(final);
  }

  // ============================================================
  // [🧱 BLOCK: Rage Check — 60% HP]
  // ============================================================
  private checkRage(): void {
    if (!this.isEnraged && this.hp / this.maxHp <= RAGE_THRESHOLD) {
      this.isEnraged            = true;
      this.justEnragedThisFrame = true;
      this.speed                = STATS.rageSpeed;
      this.color                = STATS.armorBrokenColor;
    }
  }

  // ============================================================
  // [🧱 BLOCK: Fire Quake Projectiles]
  // ============================================================
  private fireQuake(ecx: number, ecy: number): void {
    const angles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
    const dmg    = this.shootDamage;
    angles.forEach((angle) => {
      const tx = ecx + Math.cos(angle) * 400;
      const ty = ecy + Math.sin(angle) * 400;
      this.pendingProjectiles.push(new Projectile(ecx, ecy, tx, ty, dmg));
    });
  }

  private get warnMs():  number { return this.isEnraged ? WARN_RAGE  : WARN_MS;  }
  private get chaseMs(): number { return this.isEnraged ? CHASE_RAGE : CHASE_MS; }
  private get coolMs():  number { return this.isEnraged ? COOL_RAGE  : COOL_MS;  }

  // ============================================================
  // [🧱 BLOCK: Pick Attack]
  // Stomp chain is now always the follow-up after stomp (not just enraged).
  // Enraged also adds quake option.
  // ============================================================
  private pickAttack(): ColossusState {
    if (this.isEnraged) return Math.random() < 0.5 ? 'warn_stomp' : 'warn_quake';
    return 'warn_stomp';
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // [🧱 BLOCK: Death Fix — instant death on decay]
  // See Brute.ts for full rationale: BaseEnemy.takeDamage() puts
  // the enemy into a 380ms isDecaying state instead of isDead.
  // Horde enemies tick that timer themselves; bosses never did,
  // so they'd get stuck at 0 HP forever, still fighting and
  // immune to further damage. Convert decay into instant death.
  // ============================================================
  update(player: Player, worldW: number, worldH: number) {
    if (this.isDecaying) { this.triggerInstantDeath(); }
    if (this.isDead) return;

    this.justEnragedThisFrame = false;
    this.tickHitFlash();
    this.tickVariantPulse();
    this.tickRegen();
    this.stateTimer     -= 16;
    this.indicatorPulse += 16;
    if (this.damageCooldown > 0) this.damageCooldown -= 16;

    if (this.stomp2Active) {
      this.stomp2Timer -= 16;
      if (this.stomp2Timer <= 0) { this.stomp2Active = false; this.stomp2Radius = 0; }
    }

    this.checkRage();

    const { x: pcx, y: pcy } = rectCenter(player);
    const { x: ecx, y: ecy } = rectCenter(this);
    const dx   = pcx - ecx;
    const dy   = pcy - ecy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    switch (this.colossusState) {
      case 'chase':
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
        this.x += this.vx; this.y += this.vy;
        if (this.stateTimer <= 0) {
          this.colossusState = this.pickAttack();
          this.stateTimer    = this.warnMs;
          this.indicatorPulse = 0;
          this.vx = 0; this.vy = 0;
        }
        break;

      case 'warn_stomp':
        this.vx = 0; this.vy = 0;
        this.stompRadius = STATS.stompRadius * (1 - this.stateTimer / this.warnMs);
        if (this.stateTimer <= 0) {
          this.colossusState = 'stomping';
          this.stateTimer    = 500;
          this.stompActive   = true;
          this.stompRadius   = STATS.stompRadius;
        }
        break;

      case 'stomping':
        if (this.stateTimer <= 0) {
          this.stompActive = false; this.stompRadius = 0;
          // Stomp chain always follows stomp now (not just when enraged)
          this.colossusState = 'stomp_chain';
          this.stateTimer    = this.warnMs * 0.6;
          this.stomp2Radius  = 0;
        }
        break;

      case 'stomp_chain':
        this.stomp2Radius = STATS.stompRadius * 0.75 * (1 - this.stateTimer / (this.warnMs * 0.6));
        if (this.stateTimer <= 0) {
          this.stomp2Active = true;
          this.stomp2Radius = STATS.stompRadius * 0.75;
          this.stomp2Timer  = this.STOMP2_ACTIVE_MS;
          this.colossusState = 'cooldown';
          this.stateTimer    = this.coolMs;
        }
        break;

      case 'warn_quake':
        this.vx = 0; this.vy = 0;
        if (this.stateTimer <= 0) {
          this.colossusState = 'quaking';
          this.stateTimer    = 300;
          this.fireQuake(ecx, ecy);
        }
        break;

      case 'quaking':
        if (this.stateTimer <= 0) { this.colossusState = 'cooldown'; this.stateTimer = this.coolMs; }
        break;

      case 'cooldown':
        this.vx = 0; this.vy = 0;
        if (this.stateTimer <= 0) { this.colossusState = 'chase'; this.stateTimer = this.chaseMs; }
        break;
    }

    this.clampToWorld(worldW, worldH);
  }

  // ============================================================
  // [🧱 BLOCK: Collision Checks]
  // ============================================================
  isCollidingWithPlayer(player: Player): boolean {
    return this.damageCooldown <= 0 && !this.isDead &&
      player.x < this.x + this.width  &&
      player.x + player.width  > this.x &&
      player.y < this.y + this.height &&
      player.y + player.height > this.y;
  }

  isSlamHittingPlayer(player: Player): boolean {
    const { x: cx, y: cy } = rectCenter(this);
    const { x: px, y: py } = rectCenter(player);
    if (this.stompActive  && circleCircle(cx, cy, this.stompRadius,  px, py, 1)) return true;
    if (this.stomp2Active && circleCircle(cx, cy, this.stomp2Radius, px, py, 1)) return true;
    return false;
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

    if (this.colossusState === 'warn_stomp' || this.stompActive) {
      const pulse = Math.sin(this.indicatorPulse / 140) * 0.3 + 0.7;
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(1, this.stompRadius), 0, Math.PI * 2);
      if (this.stompActive) {
        ctx.fillStyle   = "rgba(255,255,255,0.1)"; ctx.fill();
        ctx.strokeStyle = "rgba(239,68,68,0.9)";   ctx.lineWidth = 5; ctx.stroke();
      } else {
        ctx.strokeStyle = `rgba(239,68,68,${pulse})`; ctx.lineWidth = 3; ctx.stroke();
      }
    }

    if (this.colossusState === 'stomp_chain' || this.stomp2Active) {
      const pulse = Math.sin(this.indicatorPulse / 110) * 0.3 + 0.7;
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(1, this.stomp2Radius), 0, Math.PI * 2);
      if (this.stomp2Active) {
        ctx.fillStyle   = "rgba(255,200,180,0.1)"; ctx.fill();
        ctx.strokeStyle = "rgba(249,115,22,0.9)";  ctx.lineWidth = 4; ctx.stroke();
      } else {
        ctx.strokeStyle = `rgba(249,115,22,${pulse})`; ctx.lineWidth = 2; ctx.stroke();
      }
    }

    if (this.colossusState === 'warn_quake') {
      const pulse = Math.sin(this.indicatorPulse / 100) * 0.4 + 0.6;
      [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach((angle) => {
        ctx.strokeStyle = `rgba(250,204,21,${pulse})`;
        ctx.lineWidth   = 1; ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * 220, cy + Math.sin(angle) * 220);
        ctx.stroke(); ctx.setLineDash([]);
      });
    }

    if (this.isArmored) {
      const pulse = Math.sin(this.indicatorPulse / 200) * 0.15 + 0.35;
      ctx.beginPath(); ctx.arc(cx, cy, this.width / 2 + 12, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(148,163,184,${pulse})`; ctx.lineWidth = 5; ctx.stroke();
    }

    if (this.isEnraged) {
      const pulse = Math.sin(this.indicatorPulse / 80) * 0.3 + 0.4;
      ctx.beginPath(); ctx.arc(cx, cy, this.width / 2 + 10, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(220,38,38,${pulse})`; ctx.lineWidth = 4; ctx.stroke();
    }

    this.drawVariantAura(ctx, sx, sy);

    const bodyColor =
      this.isHit                          ? '#ffffff' :
      this.stompActive                    ? '#ef4444' :
      this.stomp2Active                   ? '#f97316' :
      this.colossusState === 'quaking'    ? '#facc15' :
      this.isEnraged                      ? '#b91c1c' :
      this.color;

    this.drawBody(ctx, sx, sy, bodyColor);

    const barW = this.width * 2.2;
    this.drawHpBar(ctx, sx - this.width * 0.6, sy, barW, -16);

    if (!this.isEnraged) {
      const markerX = sx - this.width * 0.6 + barW * RAGE_THRESHOLD;
      ctx.fillStyle = "rgba(148,163,184,0.8)";
      ctx.fillRect(markerX - 1, sy - 17, 2, 7);
    }

    const label = this.isArmored
      ? `🛡 ${this.bossName}`
      : this.isEnraged ? `⚡ UNSHACKLED` : this.bossName;

    ctx.fillStyle = this.isEnraged ? "#f87171" : this.isArmored ? "#94a3b8" : "rgba(255,255,255,0.7)";
    ctx.font      = `bold 10px 'Courier New'`;
    ctx.textAlign = "center";
    ctx.fillText(label, cx, sy - 22);
    ctx.textAlign = "left";

    this.drawVariantIndicators(ctx, sx - this.width * 0.6, sy, barW, -16);
  }
}