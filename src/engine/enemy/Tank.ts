// src/engine/enemy/Tank.ts
import { BaseEnemy }  from "./BaseEnemy";
import { Player }     from "../Player";
import { Camera }     from "../Camera";
import { getEnemySpeedScale, getEnemyHpScale } from "../RoomManager";

// ============================================================
// [🧱 BLOCK: Constants]
// ============================================================
const BASE_HP       = 120;
const BASE_SPEED    = 0.75;
const SIZE          = 48;
const MELEE_RANGE   = 64;
const WINDUP_MS     = 1000;
const STRIKE_MS     = 150;
const COOLDOWN_MS   = 2500;
const BASE_DAMAGE   = 30;
const KNOCKBACK_FORCE = 8;
const XP_VALUE      = 25; // Value provided to BaseEnemy

// Shield only active above this HP fraction
const SHIELD_HP_THRESHOLD = 0.5;
// Front-facing damage reduction when shielded
const SHIELD_REDUCTION    = 0.70;
// Heavy attack ignores this fraction of the shield
const HEAVY_SHIELD_PIERCE = 0.40;

// Colors
const COLOR_SHIELDED  = "#475569"; // Slate — shielded phase
const COLOR_BROKEN    = "#dc2626"; // Red   — shield broken
const COLOR_WINDUP    = "#f97316"; // Orange ring during windup
const SHIELD_COLOR    = "rgba(148,163,184,0.55)";
const SHIELD_GLOW     = "rgba(148,163,184,0.2)";

type TankState = "chase" | "windup" | "strike" | "cooldown";

// ============================================================
// [🧱 BLOCK: Tank Class]
// ============================================================
export class Tank extends BaseEnemy {
  // ── State machine ────────────────────────────────────────
  private state:     TankState = "chase";
  private stateTimer = 0;

  // ── Facing (for shield direction) ────────────────────────
  private facingX = 0;
  private facingY = 1;

  constructor(x: number, y: number, floor = 1) {
    const hpScale = getEnemyHpScale(floor);
    const speedScale = getEnemySpeedScale(floor);
    
    // Fixed: Super now receives all 7 arguments required by BaseEnemy
    super(
      x, 
      y, 
      SIZE, 
      BASE_SPEED * speedScale, 
      Math.round(BASE_HP * hpScale), 
      XP_VALUE, 
      COLOR_SHIELDED
    );
  }

  // ============================================================
  // [🧱 BLOCK: Shield Helpers]
  // ============================================================
  get isShielded(): boolean {
    return this.hp / this.maxHp > SHIELD_HP_THRESHOLD;
  }

  /**
   * Returns true if the attack is hitting the shielded front arc.
   * "Front" = within 90° of the Tank's facing direction toward player.
   */
  private isFrontHit(fromX: number, fromY: number): boolean {
    const dx = fromX - (this.x + SIZE / 2);
    const dy = fromY - (this.y + SIZE / 2);
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const dot = (dx / len) * this.facingX + (dy / len) * this.facingY;
    // dot > cos(90°/2) = cos(45°) ≈ 0.707
    return dot > 0.5;
  }

  // ============================================================
  // [🧱 BLOCK: takeDamage Override]
  // Applies shield reduction when shielded + front hit.
  // ============================================================
  takeDamage(amount: number, isHeavy = false): void {
    if (this.isDead) return;

    let finalAmount = amount;

    if (this.isShielded) {
      const reduction = isHeavy
        ? SHIELD_REDUCTION * (1 - HEAVY_SHIELD_PIERCE)
        : SHIELD_REDUCTION;
      finalAmount = Math.round(amount * (1 - reduction));
    }

    super.takeDamage(finalAmount);

    // Update color when shield breaks
    if (!this.isShielded) {
      this.color = COLOR_BROKEN;
    }
  }

  /**
   * Extended takeDamage that accepts player position for front-arc check.
   */
  takeDamageFrom(
    amount:   number,
    playerX:  number,
    playerY:  number,
    isHeavy = false
  ): void {
    if (this.isDead) return;

    let finalAmount = amount;

    if (this.isShielded && this.isFrontHit(playerX, playerY)) {
      const reduction = isHeavy
        ? SHIELD_REDUCTION * (1 - HEAVY_SHIELD_PIERCE)
        : SHIELD_REDUCTION;
      finalAmount = Math.round(amount * (1 - reduction));
    }

    super.takeDamage(finalAmount);

    if (!this.isShielded) {
      this.color = COLOR_BROKEN;
    }
  }

  // ============================================================
  // [🧱 BLOCK: isMeleeHittingPlayer Override]
  // Returns hit data including knockback direction.
  // ============================================================
  isMeleeHittingPlayer(player: Player): boolean {
    if (this.state !== "strike" || this.isDead) return false;
    const cx  = this.x + SIZE / 2;
    const cy  = this.y + SIZE / 2;
    const pcx = player.x + player.width  / 2;
    const pcy = player.y + player.height / 2;
    return Math.sqrt((cx - pcx) ** 2 + (cy - pcy) ** 2) < MELEE_RANGE + 10;
  }

  /**
   * Apply knockback to the player away from the Tank.
   */
  applyKnockback(player: Player): void {
    const cx  = this.x + SIZE / 2;
    const cy  = this.y + SIZE / 2;
    const pcx = player.x + player.width  / 2;
    const pcy = player.y + player.height / 2;
    const dx  = pcx - cx;
    const dy  = pcy - cy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    player.vx += (dx / len) * KNOCKBACK_FORCE;
    player.vy += (dy / len) * KNOCKBACK_FORCE;
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // ============================================================
  update(player: Player, worldW: number, worldH: number): void {
    if (this.isDead) return;

    this.tickHitFlash(); // Fixed: Renamed from updateHitFlash to match BaseEnemy

    const cx  = this.x + SIZE / 2;
    const cy  = this.y + SIZE / 2;
    const pcx = player.x + player.width  / 2;
    const pcy = player.y + player.height / 2;
    const dx  = pcx - cx;
    const dy  = pcy - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    // Always track facing toward player (for shield arc)
    this.facingX = dx / dist;
    this.facingY = dy / dist;

    switch (this.state) {
      // ── Chase ─────────────────────────────────────────────
      case "chase": {
        if (dist > MELEE_RANGE) {
          this.x += (dx / dist) * this.speed;
          this.y += (dy / dist) * this.speed;
          this.clampToWorld(worldW, worldH); // Fixed: Use base class helper
        } else {
          this.state      = "windup";
          this.stateTimer = WINDUP_MS;
        }
        break;
      }

      // ── Windup ────────────────────────────────────────────
      case "windup": {
        this.stateTimer -= 16; 
        if (this.stateTimer <= 0) {
          this.state      = "strike";
          this.stateTimer = STRIKE_MS;
          // Short lunge
          this.x += (dx / dist) * 12;
          this.y += (dy / dist) * 12;
        }
        break;
      }

      // ── Strike ────────────────────────────────────────────
      case "strike": {
        this.stateTimer -= 16;
        if (this.stateTimer <= 0) {
          this.state      = "cooldown";
          this.stateTimer = COOLDOWN_MS;
        }
        break;
      }

      // ── Cooldown ──────────────────────────────────────────
      case "cooldown": {
        this.stateTimer -= 16;
        if (this.stateTimer <= 0) {
          this.state = "chase";
        }
        break;
      }
    }
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (this.isDead) return;

    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);

    // ── Windup ring ───────────────────────────────────────
    if (this.state === "windup") {
      const progress = 1 - this.stateTimer / WINDUP_MS;
      const cx = sx + SIZE / 2;
      const cy = sy + SIZE / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, SIZE / 2 + 10, 0, Math.PI * 2);
      ctx.strokeStyle = COLOR_WINDUP;
      ctx.lineWidth   = 2;
      ctx.globalAlpha = 0.4 + progress * 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // ── Body ─────────────────────────────────────────────
    // Fixed: Uses base class drawBody and tickHitFlash property
    this.drawBody(ctx, sx, sy);

    // ── Shield arc (front face when shielded) ─────────────
    if (this.isShielded) {
      const cx    = sx + SIZE / 2;
      const cy    = sy + SIZE / 2;
      const angle = Math.atan2(this.facingY, this.facingX);
      const arc   = Math.PI * 0.75; // ±67.5° shield cone

      // Glow backing
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, SIZE / 2 + 14, angle - arc / 2, angle + arc / 2);
      ctx.closePath();
      ctx.fillStyle   = SHIELD_GLOW;
      ctx.fill();

      // Shield edge
      ctx.beginPath();
      ctx.arc(cx, cy, SIZE / 2 + 14, angle - arc / 2, angle + arc / 2);
      ctx.strokeStyle = SHIELD_COLOR;
      ctx.lineWidth   = 3;
      ctx.stroke();
    }

    // ── HP bar ────────────────────────────────────────────
    this.drawHpBar(ctx, sx, sy);

    // Shield threshold marker (Custom addition over base bar)
    if (this.isShielded) {
      const barY = sy - 8;
      const markerX = sx + SIZE * SHIELD_HP_THRESHOLD;
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillRect(markerX - 1, barY - 1, 2, 6);
    }
  }

  // ── Expose damage for HordeSystem ────────────────────────
  get meleeDamage(): number { return BASE_DAMAGE; }
}