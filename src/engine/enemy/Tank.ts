// src/engine/enemy/Tank.ts
import { BaseEnemy }  from "./BaseEnemy";
import { Player }     from "../Player";
import { Camera }     from "../Camera";
import { getEnemySpeedScale, getEnemyHpScale } from "../RoomManager";

// ============================================================
// [🧱 BLOCK: Constants]
// ============================================================
const BASE_HP         = 120;
const BASE_SPEED      = 0.75;
const SIZE            = 48;
const MELEE_RANGE     = 64;
const STRIKE_MS       = 150;
const COOLDOWN_MS     = 2500;
const BASE_DAMAGE     = 30;
const KNOCKBACK_FORCE = 8;
const XP_VALUE        = 25;

// Windup durations per floor tier:
//   Floor 1-2: 1000ms (full warning)
//   Floor 3:    600ms (reduced warning)
//   Floor 4+:     0ms (no windup — instant strike)
const WINDUP_F1 = 1000;
const WINDUP_F3 =  600;

const SHIELD_HP_THRESHOLD = 0.5;
const SHIELD_REDUCTION    = 0.70;
const HEAVY_SHIELD_PIERCE = 0.40;

const COLOR_SHIELDED = "#475569";
const COLOR_BROKEN   = "#dc2626";
const COLOR_WINDUP   = "#f97316";
const SHIELD_COLOR   = "rgba(148,163,184,0.55)";
const SHIELD_GLOW    = "rgba(148,163,184,0.2)";

type TankState = "chase" | "windup" | "strike" | "cooldown";

// ============================================================
// [🧱 BLOCK: Tank Class]
// Floor 1-2: chase → windup (1000ms) → strike → cooldown
// Floor 3:   chase → windup (600ms)  → strike → cooldown
// Floor 4+:  chase → strike (no windup — telegraphs nothing)
// ============================================================
export class Tank extends BaseEnemy {
  private tankState:  TankState = "chase";
  private stateTimer: number    = 0;
  private facingX:    number    = 0;
  private facingY:    number    = 1;
  private floor:      number;

  constructor(x: number, y: number, floor = 1) {
    super(
      x, y,
      SIZE,
      BASE_SPEED * getEnemySpeedScale(floor),
      Math.round(BASE_HP * getEnemyHpScale(floor)),
      XP_VALUE,
      COLOR_SHIELDED
    );
    this.floor = floor;
  }

  // ============================================================
  // [🧱 BLOCK: Windup Duration]
  // Returns 0 on Floor 4+ so the windup state is skipped.
  // ============================================================
  private get windupMs(): number {
    if (this.floor >= 4) return 0;
    if (this.floor >= 3) return WINDUP_F3;
    return WINDUP_F1;
  }

  // ============================================================
  // [🧱 BLOCK: Shield Helpers]
  // ============================================================
  get isShielded(): boolean {
    return this.hp / this.maxHp > SHIELD_HP_THRESHOLD;
  }

  private isFrontHit(fromX: number, fromY: number): boolean {
    const dx  = fromX - (this.x + SIZE / 2);
    const dy  = fromY - (this.y + SIZE / 2);
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const dot = (dx / len) * this.facingX + (dy / len) * this.facingY;
    return dot > 0.5;
  }

  // ============================================================
  // [🧱 BLOCK: takeDamage Override]
  // ============================================================
  takeDamage(amount: number, isHeavy = false): void {
    if (this.isDead) return;
    let final = amount;
    if (this.isShielded) {
      const reduction = isHeavy
        ? SHIELD_REDUCTION * (1 - HEAVY_SHIELD_PIERCE)
        : SHIELD_REDUCTION;
      final = Math.round(amount * (1 - reduction));
    }
    super.takeDamage(final);
    if (!this.isShielded) this.color = COLOR_BROKEN;
  }

  takeDamageFrom(
    amount: number,
    playerX: number,
    playerY: number,
    isHeavy = false
  ): void {
    if (this.isDead) return;
    let final = amount;
    if (this.isShielded && this.isFrontHit(playerX, playerY)) {
      const reduction = isHeavy
        ? SHIELD_REDUCTION * (1 - HEAVY_SHIELD_PIERCE)
        : SHIELD_REDUCTION;
      final = Math.round(amount * (1 - reduction));
    }
    super.takeDamage(final);
    if (!this.isShielded) this.color = COLOR_BROKEN;
  }

  // ============================================================
  // [🧱 BLOCK: isMeleeHittingPlayer]
  // ============================================================
  isMeleeHittingPlayer(player: Player): boolean {
    if (this.tankState !== "strike" || this.isDead) return false;
    const cx  = this.x + SIZE / 2;
    const cy  = this.y + SIZE / 2;
    const pcx = player.x + player.width  / 2;
    const pcy = player.y + player.height / 2;
    return Math.sqrt((cx - pcx) ** 2 + (cy - pcy) ** 2) < MELEE_RANGE + 10;
  }

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

    this.tickHitFlash();

    const cx   = this.x + SIZE / 2;
    const cy   = this.y + SIZE / 2;
    const pcx  = player.x + player.width  / 2;
    const pcy  = player.y + player.height / 2;
    const dx   = pcx - cx;
    const dy   = pcy - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    this.facingX = dx / dist;
    this.facingY = dy / dist;

    switch (this.tankState) {

      case "chase":
        if (dist > MELEE_RANGE) {
          this.x += (dx / dist) * this.speed;
          this.y += (dy / dist) * this.speed;
          this.clampToWorld(worldW, worldH);
        } else {
          // Floor 4+: skip windup entirely
          if (this.windupMs === 0) {
            this.tankState  = "strike";
            this.stateTimer = STRIKE_MS;
            // Lunge
            this.x += (dx / dist) * 12;
            this.y += (dy / dist) * 12;
          } else {
            this.tankState  = "windup";
            this.stateTimer = this.windupMs;
          }
        }
        break;

      case "windup":
        this.stateTimer -= 16;
        if (this.stateTimer <= 0) {
          this.tankState  = "strike";
          this.stateTimer = STRIKE_MS;
          this.x += (dx / dist) * 12;
          this.y += (dy / dist) * 12;
        }
        break;

      case "strike":
        this.stateTimer -= 16;
        if (this.stateTimer <= 0) {
          this.tankState  = "cooldown";
          this.stateTimer = COOLDOWN_MS;
        }
        break;

      case "cooldown":
        this.stateTimer -= 16;
        if (this.stateTimer <= 0) {
          this.tankState = "chase";
        }
        break;
    }
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (this.isDead) return;

    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);
    const cx = sx + SIZE / 2;
    const cy = sy + SIZE / 2;

    // ── Windup ring (not shown on Floor 4+ since windup is skipped) ──
    if (this.tankState === "windup" && this.windupMs > 0) {
      const progress = 1 - this.stateTimer / this.windupMs;
      ctx.beginPath();
      ctx.arc(cx, cy, SIZE / 2 + 10, 0, Math.PI * 2);
      ctx.strokeStyle = COLOR_WINDUP;
      ctx.lineWidth   = 2;
      ctx.globalAlpha = 0.4 + progress * 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // ── Floor 4+ danger indicator — red pulse during chase ──
    if (this.floor >= 4 && this.tankState === "chase") {
      ctx.beginPath();
      ctx.arc(cx, cy, SIZE / 2 + 6, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(239,68,68,0.5)";
      ctx.lineWidth   = 2;
      ctx.stroke();
    }

    this.drawBody(ctx, sx, sy);

    // ── Shield arc ────────────────────────────────────────
    if (this.isShielded) {
      const angle = Math.atan2(this.facingY, this.facingX);
      const arc   = Math.PI * 0.75;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, SIZE / 2 + 14, angle - arc / 2, angle + arc / 2);
      ctx.closePath();
      ctx.fillStyle = SHIELD_GLOW;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, SIZE / 2 + 14, angle - arc / 2, angle + arc / 2);
      ctx.strokeStyle = SHIELD_COLOR;
      ctx.lineWidth   = 3;
      ctx.stroke();
    }

    this.drawHpBar(ctx, sx, sy);

    // Shield threshold marker
    if (this.isShielded) {
      const barY    = sy - 8;
      const markerX = sx + SIZE * SHIELD_HP_THRESHOLD;
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillRect(markerX - 1, barY - 1, 2, 6);
    }
  }

  get meleeDamage(): number { return BASE_DAMAGE; }
}