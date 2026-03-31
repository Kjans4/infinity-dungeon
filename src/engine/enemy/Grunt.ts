// src/engine/enemy/Grunt.ts
import { Player } from "../Player";
import { Camera } from "../Camera";
import { BaseEnemy } from "./BaseEnemy";
import { AttackState } from "./types";

// ============================================================
// [🧱 BLOCK: Grunt Stats]
// ============================================================
const GRUNT_STATS = {
  speed:         1.4,
  hp:            65,   // ↑ was 30 — takes ~4 light fist hits on floor 1
  size:          28,
  color:         '#a855f7',
  xpValue:       1,
  meleeRange:    60,
  meleeWindup:   600,
  meleeDamage:   15,
  meleeCooldown: 1500,
};

// ============================================================
// [🧱 BLOCK: Grunt Class]
// ============================================================
export class Grunt extends BaseEnemy {
  attackState:    AttackState = 'chase';
  attackTimer:    number      = 0;
  attackCooldown: number      = 0;
  strikeDir: { x: number; y: number } = { x: 0, y: 1 };
  pendingProjectile: null = null;

  constructor(x: number, y: number, floor: number = 1) {
    const speedScale = 1 + (floor - 1) * 0.15;
    const hpScale    = 1 + (floor - 1) * 0.20;
    super(
      x, y,
      GRUNT_STATS.size,
      GRUNT_STATS.speed * speedScale,
      Math.round(GRUNT_STATS.hp * hpScale),
      GRUNT_STATS.xpValue,
      GRUNT_STATS.color,
    );
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // ============================================================
  update(player: Player, worldW: number, worldH: number) {
    if (this.isDead) return;

    this.tickHitFlash();
    this.attackTimer    -= 16;
    this.attackCooldown -= 16;

    const pcx  = player.x + player.width  / 2;
    const pcy  = player.y + player.height / 2;
    const ecx  = this.x   + this.width    / 2;
    const ecy  = this.y   + this.height   / 2;
    const dx   = pcx - ecx;
    const dy   = pcy - ecy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    switch (this.attackState) {
      case 'chase':
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
        this.x += this.vx;
        this.y += this.vy;
        if (dist <= GRUNT_STATS.meleeRange && this.attackCooldown <= 0) {
          this.attackState = 'windup';
          this.attackTimer = GRUNT_STATS.meleeWindup;
          this.vx = 0; this.vy = 0;
        }
        break;

      case 'windup':
        this.vx = 0; this.vy = 0;
        if (this.attackTimer <= 100) {
          this.strikeDir = { x: dx / dist, y: dy / dist };
        }
        if (this.attackTimer <= 0) {
          this.attackState = 'strike';
          this.attackTimer = 150;
        }
        break;

      case 'strike':
        this.x += this.strikeDir.x * 2;
        this.y += this.strikeDir.y * 2;
        if (this.attackTimer <= 0) {
          this.attackState    = 'cooldown';
          this.attackTimer    = GRUNT_STATS.meleeCooldown;
          this.attackCooldown = GRUNT_STATS.meleeCooldown;
        }
        break;

      case 'cooldown':
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
        this.x += this.vx;
        this.y += this.vy;
        if (this.attackTimer <= 0) {
          this.attackState = 'chase';
        }
        break;
    }

    this.clampToWorld(worldW, worldH);
  }

  // ============================================================
  // [🧱 BLOCK: Melee Hit Check]
  // ============================================================
  isMeleeHittingPlayer(player: Player): boolean {
    if (this.attackState !== 'strike') return false;
    const ecx     = this.x + this.width  / 2;
    const ecy     = this.y + this.height / 2;
    const hitX    = ecx + this.strikeDir.x * 45;
    const hitY    = ecy + this.strikeDir.y * 45;
    const hitSize = 28;
    const nearestX = Math.max(player.x, Math.min(hitX, player.x + player.width));
    const nearestY = Math.max(player.y, Math.min(hitY, player.y + player.height));
    const distSq   = (hitX - nearestX) ** 2 + (hitY - nearestY) ** 2;
    return distSq < hitSize * hitSize;
  }

  get meleeDamage() { return GRUNT_STATS.meleeDamage; }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    if (this.isDead) return;
    if (!camera.isVisible(this.x, this.y, this.width, this.height)) return;

    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);
    const cx = sx + this.width  / 2;
    const cy = sy + this.height / 2;

    if (this.attackState === 'windup') {
      const progress = 1 - Math.max(0, this.attackTimer) / GRUNT_STATS.meleeWindup;
      const r        = 36 * (1 - progress * 0.5);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(249, 115, 22, ${0.4 + progress * 0.5})`;
      ctx.lineWidth   = 2;
      ctx.stroke();
    }

    if (this.attackState === 'strike') {
      const hitX = cx + this.strikeDir.x * 45;
      const hitY = cy + this.strikeDir.y * 45;
      ctx.beginPath();
      ctx.arc(hitX, hitY, 20, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(249, 115, 22, 0.5)";
      ctx.fill();
    }

    const bodyColor =
      this.attackState === 'windup' ? '#fb923c' :
      this.attackState === 'strike' ? '#f97316' :
      this.color;

    this.drawBody(ctx, sx, sy, bodyColor);
    this.drawHpBar(ctx, sx, sy);
  }
}