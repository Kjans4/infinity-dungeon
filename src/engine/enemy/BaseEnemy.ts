// src/engine/enemy/BaseEnemy.ts
import { Player } from "../Player";
import { Camera } from "../Camera";

// ============================================================
// [🧱 BLOCK: Enemy Variant Types]
// Each variant modifies stats and adds a visual indicator.
// An enemy can hold up to 2 variants (2nd roll at floor 4+).
// ============================================================
export type VariantType =
  | 'tough'
  | 'swift'
  | 'berserker'
  | 'armored'
  | 'volatile'
  | 'regenerating';

export interface EnemyVariant {
  type:        VariantType;
  label:       string;       // shown above HP bar
  color:       string;       // accent color for indicator
  tintColor:   string | null; // body tint override (null = no tint)
}

// ============================================================
// [🧱 BLOCK: Variant Definitions]
// ============================================================
export const VARIANT_DEFS: Record<VariantType, EnemyVariant> = {
  tough:       { type: 'tough',       label: '🔴 Tough',       color: '#dc2626', tintColor: '#7f1d1d' },
  swift:       { type: 'swift',       label: '⚡ Swift',       color: '#06b6d4', tintColor: '#0e7490' },
  berserker:   { type: 'berserker',   label: '🔥 Berserker',   color: '#ef4444', tintColor: null      },
  armored:     { type: 'armored',     label: '🛡 Armored',     color: '#94a3b8', tintColor: '#475569' },
  volatile:    { type: 'volatile',    label: '💥 Volatile',    color: '#f97316', tintColor: null      },
  regenerating:{ type: 'regenerating',label: '💚 Regen',       color: '#4ade80', tintColor: null      },
};

// ============================================================
// [🧱 BLOCK: Death Animation Constants]
// ============================================================
const DEATH_DURATION_MS = 380;

// ============================================================
// [🧱 BLOCK: Variant Roll]
// Called at spawn. Returns 0, 1, or 2 variants depending on
// floor. Bosses use a separate (slightly lower) roll chance.
// ============================================================
const ALL_VARIANT_TYPES: VariantType[] = [
  'tough', 'swift', 'berserker', 'armored', 'volatile', 'regenerating',
];

export function rollVariants(floor: number, isBoss: boolean = false): VariantType[] {
  // Base chance: 15% floor 1, +2% per floor, cap 35%
  const baseChance = Math.min(0.35, 0.15 + (floor - 1) * 0.02);
  const chance     = isBoss ? baseChance * 0.6 : baseChance;

  if (Math.random() > chance) return [];

  // Pick first variant
  const pool   = [...ALL_VARIANT_TYPES];
  const idx1   = Math.floor(Math.random() * pool.length);
  const first  = pool.splice(idx1, 1)[0];
  const result: VariantType[] = [first];

  // Floor 4+: 25% chance for a second variant
  if (floor >= 4 && Math.random() < 0.25) {
    const idx2  = Math.floor(Math.random() * pool.length);
    result.push(pool[idx2]);
  }

  return result;
}

// ============================================================
// [🧱 BLOCK: BaseEnemy]
// ============================================================
export abstract class BaseEnemy {
  // Position & Size
  x:      number;
  y:      number;
  width:  number;
  height: number;

  // Physics
  vx: number = 0;
  vy: number = 0;
  speed: number;

  // Stats
  // 🚫 REMOVED: hp: number; <-- This was causing the duplicate identifier error
  maxHp:   number;
  xpValue: number;
  color:   string;

  // ============================================================
  // [🧱 BLOCK: Death State]
  // ============================================================
  private _hp:        number  = 0;
  private _deathTimer: number = 0;

  // Getter and Setter seamlessly expose 'hp' to the rest of your game engine
  get hp(): number { return this._hp; }
  set hp(v: number) { this._hp = v; }

  get deathTimer(): number  { return this._deathTimer; }

  get isDead():    boolean { return this._hp <= 0 && this._deathTimer <= 0; }
  get isDecaying():boolean { return this._hp <= 0 && this._deathTimer  > 0; }

  // Legacy write — some subclasses set isDead = true directly (Bomber).
  set isDead(v: boolean) {
    if (v) this.triggerInstantDeath();
  }

  // State
  isHit:          boolean = false;
  hitFlashTimer:  number  = 0;

  // Stun
  stunTimer:      number  = 0;
  get isStunned(): boolean { return this.stunTimer > 0; }

  // ============================================================
  // [🧱 BLOCK: Variant State]
  // ============================================================
  variants:          VariantType[] = [];
  damageMult:        number = 1.0;   // berserker: +25% outgoing
  damageReduction:   number = 0.0;   // armored: 30% reduction
  isVolatile:        boolean = false; // explodes on death
  regenRate:         number = 0;     // hp/s (regenerating: 2)
  private regenAccum: number = 0;    // accumulated regen sub-hp

  // Pulse timer for variant visual effects
  variantPulse: number = 0;

  constructor(
    x: number, y: number,
    size: number, speed: number,
    hp: number, xpValue: number, color: string
  ) {
    this.x        = x;
    this.y        = y;
    this.width    = size;
    this.height   = size;
    this.speed    = speed;
    this._hp      = hp;
    this.maxHp    = hp;
    this.xpValue  = xpValue;
    this.color    = color;
  }
  

  // ============================================================
  // [🧱 BLOCK: Trigger Instant Death]
  // Skips the decay animation entirely. Used by Bomber
  // (explosion handles its own VFX) and the isDead setter shim.
  // ============================================================
  triggerInstantDeath(): void {
    this._hp         = 0;
    this._deathTimer = 0;
  }

  // ============================================================
  // [🧱 BLOCK: Apply Variants]
  // ============================================================
  applyVariants(variantTypes: VariantType[]): void {
    this.variants = variantTypes;

    for (const vt of variantTypes) {
      switch (vt) {
        case 'tough':
          this._hp    = Math.round(this._hp * 1.40);
          this.maxHp  = this._hp;
          break;
        case 'swift':
          this.speed *= 1.30;
          break;
        case 'berserker':
          this.damageMult = 1.25;
          break;
        case 'armored':
          this.damageReduction = 0.30;
          break;
        case 'volatile':
          this.isVolatile = true;
          break;
        case 'regenerating':
          this.regenRate = 2;
          break;
      }
    }
  }

  // ============================================================
  // [🧱 BLOCK: Has Variant Helper]
  // ============================================================
  hasVariant(type: VariantType): boolean {
    return this.variants.includes(type);
  }

  // ============================================================
  // [🧱 BLOCK: Gold Multiplier]
  // ============================================================
  get goldMultiplier(): number {
    return this.variants.length > 0 ? 1.5 * this.variants.length : 1.0;
  }

  // ============================================================
  // [🧱 BLOCK: Apply Stun]
  // ============================================================
  applyStun(durationMs: number): void {
    if (this.isDead || this.isDecaying) return;
    this.stunTimer = Math.max(this.stunTimer, durationMs);
  }

  // ============================================================
  // [🧱 BLOCK: Take Damage]
  // When hp hits 0, starts the decay timer instead of marking
  // isDead immediately, giving the death animation time to play.
  // ============================================================
  takeDamage(amount: number) {
    if (this.isDead || this.isDecaying) return;
    const final = this.damageReduction > 0
      ? Math.max(1, Math.round(amount * (1 - this.damageReduction)))
      : amount;
    this._hp -= final;
    if (this._hp <= 0) {
      this._hp         = 0;
      this._deathTimer = DEATH_DURATION_MS;
    } else {
      this.isHit         = true;
      this.hitFlashTimer = 100;
    }
  }

  // ============================================================
  // [🧱 BLOCK: Tick Hit Flash]
  // ============================================================
  protected tickHitFlash() {
    if (this.isHit) {
      this.hitFlashTimer -= 16;
      if (this.hitFlashTimer <= 0) this.isHit = false;
    }
  }

  // ============================================================
  // [🧱 BLOCK: Tick Death]
  // Call at the top of subclass update() when isDecaying is true.
  // Returns true while the animation is still running.
  // When it returns false the enemy transitions to isDead and
  // will be filtered out by HordeSystem on the next frame.
  // ============================================================
  protected tickDeath(): boolean {
    if (!this.isDecaying) return false;
    this._deathTimer -= 16;
    if (this._deathTimer < 0) this._deathTimer = 0;
    return this._deathTimer > 0;
  }

  // ============================================================
  // [🧱 BLOCK: Tick Stun]
  // ============================================================
  tickStun(): boolean {
    if (this.stunTimer > 0) {
      this.stunTimer -= 16;
      if (this.stunTimer < 0) this.stunTimer = 0;
      this.vx = 0;
      this.vy = 0;
      return true;
    }
    return false;
  }

  // ============================================================
  // [🧱 BLOCK: Tick Regen]
  // ============================================================
  protected tickRegen(): void {
    if (this.isDead || this.isDecaying || this.regenRate <= 0) return;
    this.regenAccum += this.regenRate * (16 / 1000);
    if (this.regenAccum >= 1) {
      const heal       = Math.floor(this.regenAccum);
      this.regenAccum -= heal;
      this._hp         = Math.min(this.maxHp, this._hp + heal);
    }
  }

  // ============================================================
  // [🧱 BLOCK: Tick Variant Pulse]
  // ============================================================
  protected tickVariantPulse(): void {
    this.variantPulse += 16;
  }

  // ============================================================
  // [🧱 BLOCK: Clamp to World]
  // ============================================================
  protected clampToWorld(worldW: number, worldH: number) {
    this.x = Math.max(0, Math.min(worldW - this.width,  this.x));
    this.y = Math.max(0, Math.min(worldH - this.height, this.y));
  }

  // ============================================================
  // [🧱 BLOCK: Draw Death Effect]
  // Shrinks and fades the enemy body square over DEATH_DURATION_MS.
  // Progress 0 = just died (full size), 1 = gone.
  // The square also drifts upward slightly for extra read.
  // ============================================================
  protected drawDeathEffect(
    ctx: CanvasRenderingContext2D,
    sx:  number,
    sy:  number,
  ): void {
    if (!this.isDecaying) return;

    const progress = 1 - (this._deathTimer / DEATH_DURATION_MS); // 0→1
    const scale    = 1 - progress * 0.85;                         // 1→0.15
    const alpha    = 1 - progress;                                 // 1→0
    const riseY    = progress * 10;                               // drifts up

    const drawW  = this.width  * scale;
    const drawH  = this.height * scale;
    const drawX  = sx + (this.width  - drawW)  / 2;
    const drawY  = sy + (this.height - drawH)  / 2 - riseY;

    // Use enemy color; flash white on first few frames for impact
    const flashProgress = 1 - (this._deathTimer / DEATH_DURATION_MS);
    const isFlash       = flashProgress < 0.15;
    const bodyColor     = isFlash ? '#ffffff' : this.color;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = bodyColor;
    ctx.fillRect(drawX, drawY, drawW, drawH);

    // Small cross / X mark at center as the body shrinks away
    if (progress > 0.3) {
      const cx   = drawX + drawW / 2;
      const cy   = drawY + drawH / 2;
      const arm  = drawW * 0.4;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - arm, cy - arm); ctx.lineTo(cx + arm, cy + arm);
      ctx.moveTo(cx + arm, cy - arm); ctx.lineTo(cx - arm, cy + arm);
      ctx.stroke();
    }

    ctx.restore();
  }

  // ============================================================
  // [🧱 BLOCK: Draw HP Bar]
  // ============================================================
  protected drawHpBar(
    ctx: CanvasRenderingContext2D,
    sx: number, sy: number,
    barWidth?: number, offsetY: number = -8
  ) {
    const w       = barWidth ?? this.width;
    const hpRatio = this._hp / this.maxHp;

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(sx, sy + offsetY, w, 4);

    ctx.fillStyle = hpRatio > 0.5 ? '#4ade80'
      : hpRatio > 0.25            ? '#facc15'
      : '#f87171';
    ctx.fillRect(sx, sy + offsetY, w * hpRatio, 4);

    if (this.isStunned) {
      const stunPct = this.stunTimer / 1200;
      ctx.fillStyle = "rgba(56,189,248,0.5)";
      ctx.fillRect(sx, sy + offsetY - 4, w * Math.min(stunPct, 1), 3);
    }
  }

  // ============================================================
  // [🧱 BLOCK: Draw Variant Indicators]
  // ============================================================
  protected drawVariantIndicators(
    ctx: CanvasRenderingContext2D,
    sx: number, sy: number,
    barWidth?: number, offsetY: number = -8
  ): void {
    if (this.variants.length === 0) return;

    const w  = barWidth ?? this.width;
    const cx = sx + w / 2;

    this.variants.forEach((vt, i) => {
      const def  = VARIANT_DEFS[vt];
      const yOff = sy + offsetY - 10 - i * 12;

      ctx.font      = `bold 7px 'Courier New', monospace`;
      ctx.textAlign = "center";
      ctx.fillStyle = def.color;
      ctx.fillText(def.label, cx, yOff);
    });

    ctx.textAlign = "left";
  }

  // ============================================================
  // [🧱 BLOCK: Draw Variant Aura]
  // ============================================================
  protected drawVariantAura(
    ctx: CanvasRenderingContext2D,
    sx: number, sy: number
  ): void {
    if (this.variants.length === 0) return;

    const cx = sx + this.width  / 2;
    const cy = sy + this.height / 2;
    const r  = this.width / 2;

    for (const vt of this.variants) {
      const pulse = Math.sin(this.variantPulse / 150) * 0.3 + 0.5;

      switch (vt) {
        case 'swift': {
          ctx.beginPath();
          ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(6,182,212,${pulse})`;
          ctx.lineWidth   = 2;
          ctx.stroke();
          break;
        }
        case 'berserker': {
          ctx.beginPath();
          ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(239,68,68,${pulse * 0.8})`;
          ctx.lineWidth   = 3;
          ctx.stroke();
          break;
        }
        case 'armored': {
          ctx.beginPath();
          ctx.arc(cx, cy, r + 10, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(148,163,184,${pulse * 0.7})`;
          ctx.lineWidth   = 4;
          ctx.stroke();
          break;
        }
        case 'volatile': {
          const fastPulse = Math.sin(this.variantPulse / 80) * 0.4 + 0.6;
          ctx.beginPath();
          ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(249,115,22,${fastPulse})`;
          ctx.lineWidth   = 2;
          ctx.stroke();
          break;
        }
        case 'regenerating': {
          ctx.beginPath();
          ctx.arc(cx, cy, r + 7, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(74,222,128,${pulse * 0.6})`;
          ctx.lineWidth   = 2;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
          break;
        }
        case 'tough': {
          ctx.beginPath();
          ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(220,38,38,${pulse * 0.5})`;
          ctx.lineWidth   = 3;
          ctx.stroke();
          break;
        }
      }
    }
  }

  // ============================================================
  // [🧱 BLOCK: Draw Body]
  // ============================================================
  protected drawBody(
    ctx: CanvasRenderingContext2D,
    sx: number, sy: number,
    overrideColor?: string
  ) {
    let baseColor = overrideColor ?? this.color;

    if (!this.isHit && !this.isStunned && this.variants.length > 0) {
      const firstTint = VARIANT_DEFS[this.variants[0]].tintColor;
      if (firstTint) baseColor = firstTint;
    }

    const color = this.isStunned
      ? (Math.floor(Date.now() / 80) % 2 === 0 ? "#7dd3fc" : baseColor)
      : this.isHit ? '#ffffff'
      : baseColor;

    ctx.fillStyle = color;
    ctx.fillRect(sx, sy, this.width, this.height);
  }

  // ============================================================
  // [🧱 BLOCK: Abstract Interface]
  // ============================================================
  abstract update(player: Player, worldW: number, worldH: number): void;
  abstract draw(ctx: CanvasRenderingContext2D, camera: Camera): void;
}