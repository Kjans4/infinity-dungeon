// src/engine/enemy/BaseEnemy.ts
import { Player } from "../Player";
import { Camera } from "../Camera";

// ============================================================
// [🧱 BLOCK: BaseEnemy]
// Contains everything every enemy shares:
//   - position, size, velocity
//   - hp, isDead, isHit flash
//   - stunTimer / isStunned — set by parry system
//   - takeDamage()
//   - drawHpBar() / drawBody() helpers
// ============================================================
export abstract class BaseEnemy {
  // --- Position & Size ---
  x:      number;
  y:      number;
  width:  number;
  height: number;

  // --- Physics ---
  vx: number = 0;
  vy: number = 0;
  speed: number;

  // --- Stats ---
  hp:      number;
  maxHp:   number;
  xpValue: number;
  color:   string;

  // --- State ---
  isDead:         boolean = false;
  isHit:          boolean = false;
  hitFlashTimer:  number  = 0;

  // --- Stun (applied by parry) ---
  stunTimer:      number  = 0;   // ms remaining
  get isStunned(): boolean { return this.stunTimer > 0; }

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
    this.hp       = hp;
    this.maxHp    = hp;
    this.xpValue  = xpValue;
    this.color    = color;
  }

  // ============================================================
  // [🧱 BLOCK: Apply Stun]
  // Called by HordeSystem on successful parry.
  // ============================================================
  applyStun(durationMs: number): void {
    if (this.isDead) return;
    this.stunTimer = Math.max(this.stunTimer, durationMs);
  }

  // ============================================================
  // [🧱 BLOCK: Take Damage]
  // ============================================================
  takeDamage(amount: number) {
    if (this.isDead) return;
    this.hp           -= amount;
    this.isHit         = true;
    this.hitFlashTimer = 100;
    if (this.hp <= 0) { this.hp = 0; this.isDead = true; }
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
  // [🧱 BLOCK: Tick Stun]
  // Call inside subclass update() before any AI logic.
  // Returns true if enemy is still stunned (skip AI).
  // ============================================================
  protected tickStun(): boolean {
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
  // [🧱 BLOCK: Clamp to World]
  // ============================================================
  protected clampToWorld(worldW: number, worldH: number) {
    this.x = Math.max(0, Math.min(worldW - this.width,  this.x));
    this.y = Math.max(0, Math.min(worldH - this.height, this.y));
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
    const hpRatio = this.hp / this.maxHp;

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(sx, sy + offsetY, w, 4);

    ctx.fillStyle = hpRatio > 0.5 ? '#4ade80'
      : hpRatio > 0.25            ? '#facc15'
      : '#f87171';
    ctx.fillRect(sx, sy + offsetY, w * hpRatio, 4);

    // ── Stun indicator — cyan bar above HP bar ──────────────
    if (this.isStunned) {
      const stunPct = this.stunTimer / 1200; // assume max 1200ms stun
      ctx.fillStyle = "rgba(56,189,248,0.5)";
      ctx.fillRect(sx, sy + offsetY - 4, w * Math.min(stunPct, 1), 3);
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
    // Stun flashes cyan
    const color = this.isStunned
      ? (Math.floor(Date.now() / 80) % 2 === 0 ? "#7dd3fc" : (overrideColor ?? this.color))
      : this.isHit ? '#ffffff'
      : (overrideColor ?? this.color);
    ctx.fillStyle = color;
    ctx.fillRect(sx, sy, this.width, this.height);
  }

  // ============================================================
  // [🧱 BLOCK: Abstract Interface]
  // ============================================================
  abstract update(player: Player, worldW: number, worldH: number): void;
  abstract draw(ctx: CanvasRenderingContext2D, camera: Camera): void;
}