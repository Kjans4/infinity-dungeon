// src/engine/enemy/BaseEnemy.ts
import { Player } from "../Player";
import { Camera } from "../Camera";

// ============================================================
// [🧱 BLOCK: BaseEnemy]
// Contains everything every enemy shares:
//   - position, size, velocity
//   - hp, isDead, isHit flash
//   - takeDamage()
//   - drawHpBar() helper
//   - drawBody() helper
// Subclasses (Grunt, Shooter, Boss) extend this and add
// their own attack state machines.
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
  // [🧱 BLOCK: Take Damage]
  // Shared by all enemy types.
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
  // Call inside subclass update() every frame.
  // ============================================================
  protected tickHitFlash() {
    if (this.isHit) {
      this.hitFlashTimer -= 16;
      if (this.hitFlashTimer <= 0) this.isHit = false;
    }
  }

  // ============================================================
  // [🧱 BLOCK: Clamp to World]
  // Call at end of subclass update() every frame.
  // ============================================================
  protected clampToWorld(worldW: number, worldH: number) {
    this.x = Math.max(0, Math.min(worldW - this.width,  this.x));
    this.y = Math.max(0, Math.min(worldH - this.height, this.y));
  }

  // ============================================================
  // [🧱 BLOCK: Draw HP Bar]
  // Shared bar drawn above every enemy.
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
  }

  // ============================================================
  // [🧱 BLOCK: Draw Body]
  // Draws the base colored rectangle with hit flash.
  // Subclasses can override color before calling this.
  // ============================================================
  protected drawBody(
    ctx: CanvasRenderingContext2D,
    sx: number, sy: number,
    overrideColor?: string
  ) {
    ctx.fillStyle = this.isHit ? '#ffffff' : (overrideColor ?? this.color);
    ctx.fillRect(sx, sy, this.width, this.height);
  }

  // ============================================================
  // [🧱 BLOCK: Abstract Interface]
  // Every subclass must implement update() and draw().
  // ============================================================
  abstract update(player: Player, worldW: number, worldH: number): void;
  abstract draw(ctx: CanvasRenderingContext2D, camera: Camera): void;
}