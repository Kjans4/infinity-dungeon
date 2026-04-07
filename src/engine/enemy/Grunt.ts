// src/engine/enemy/Grunt.ts
import { Player }       from "../Player";
import { Camera }       from "../Camera";
import { BaseEnemy }    from "./BaseEnemy";
import { AttackState }  from "./types";
import { getEnemySpeedScale, getEnemyHpScale } from "../RoomManager";
import { circleRect, rectCenter }              from "../Collision";

// ============================================================
// [🧱 BLOCK: Grunt Stats]
// ============================================================
const GRUNT_STATS = {
  speed:         1.4,
  hp:            65,
  size:          28,
  color:         '#a855f7',
  xpValue:       1,
  meleeRange:    60,
  meleeWindup:   600,
  meleeDamage:   15,
  meleeCooldown: 1500,
  // Hitbox circle radius for strike check
  strikeRadius:  28,
  strikeOffset:  45,   // how far ahead of center the hitbox spawns
};

// Dash lunge constants (Floor 3+)
const DASH_SPEED    = 10;
const DASH_DURATION = 200;
const DASH_RANGE    = 300;

type GruntState = AttackState | 'dash';

// ============================================================
// [🧱 BLOCK: Grunt Class]
// Floor 1-2: chase → windup → strike → cooldown
// Floor 3+:  chase → dash → windup → strike → cooldown
// ============================================================
export class Grunt extends BaseEnemy {
  attackState:    GruntState = 'chase';
  attackTimer:    number     = 0;
  attackCooldown: number     = 0;
  strikeDir: { x: number; y: number } = { x: 0, y: 1 };
  pendingProjectile: null = null;

  private floor: number;
  private dashTrail: { x: number; y: number; alpha: number }[] = [];

  constructor(x: number, y: number, floor: number = 1) {
    super(
      x, y,
      GRUNT_STATS.size,
      GRUNT_STATS.speed * getEnemySpeedScale(floor),
      Math.round(GRUNT_STATS.hp * getEnemyHpScale(floor)),
      GRUNT_STATS.xpValue,
      GRUNT_STATS.color,
    );
    this.floor = floor;
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // ============================================================
  update(player: Player, worldW: number, worldH: number) {
    if (this.isDead) return;

    this.tickHitFlash();
    this.attackTimer    -= 16;
    this.attackCooldown -= 16;

    const { x: pcx, y: pcy } = rectCenter(player);
    const { x: ecx, y: ecy } = rectCenter(this);
    const dx   = pcx - ecx;
    const dy   = pcy - ecy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    // Fade out dash trail every frame
    this.dashTrail = this.dashTrail
      .map((p) => ({ ...p, alpha: p.alpha - 0.08 }))
      .filter((p) => p.alpha > 0);

    switch (this.attackState) {

      // ── Chase ───────────────────────────────────────────
      case 'chase':
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
        this.x += this.vx;
        this.y += this.vy;

        if (dist <= GRUNT_STATS.meleeRange && this.attackCooldown <= 0) {
          if (this.floor >= 3 && dist > GRUNT_STATS.meleeRange + 20 && dist <= DASH_RANGE) {
            this.attackState = 'dash';
            this.attackTimer = DASH_DURATION;
            this.strikeDir   = { x: dx / dist, y: dy / dist };
          } else {
            this.attackState = 'windup';
            this.attackTimer = GRUNT_STATS.meleeWindup;
            this.vx = 0; this.vy = 0;
          }
        }
        break;

      // ── Dash (Floor 3+ only) ────────────────────────────
      case 'dash': {
        this.x += this.strikeDir.x * DASH_SPEED;
        this.y += this.strikeDir.y * DASH_SPEED;
        this.clampToWorld(worldW, worldH);

        this.dashTrail.push({
          x: this.x + this.width  / 2,
          y: this.y + this.height / 2,
          alpha: 0.6,
        });

        const { x: ncx, y: ncy } = rectCenter(this);
        const distNow = Math.sqrt((pcx - ncx) ** 2 + (pcy - ncy) ** 2);

        if (this.attackTimer <= 0 || distNow <= GRUNT_STATS.meleeRange) {
          this.attackState = 'windup';
          this.attackTimer = GRUNT_STATS.meleeWindup;
          this.vx = 0; this.vy = 0;
        }
        break;
      }

      // ── Windup ──────────────────────────────────────────
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

      // ── Strike ──────────────────────────────────────────
      case 'strike':
        this.x += this.strikeDir.x * 2;
        this.y += this.strikeDir.y * 2;
        if (this.attackTimer <= 0) {
          this.attackState    = 'cooldown';
          this.attackTimer    = GRUNT_STATS.meleeCooldown;
          this.attackCooldown = GRUNT_STATS.meleeCooldown;
        }
        break;

      // ── Cooldown ────────────────────────────────────────
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
  // [🧱 BLOCK: Melee Hit Check — uses circleRect from Collision]
  // The strike hitbox is a circle projected ahead of the grunt
  // center in the strike direction.
  // ============================================================
  isMeleeHittingPlayer(player: Player): boolean {
    if (this.attackState !== 'strike') return false;
    const { x: ecx, y: ecy } = rectCenter(this);
    const hitX = ecx + this.strikeDir.x * GRUNT_STATS.strikeOffset;
    const hitY = ecy + this.strikeDir.y * GRUNT_STATS.strikeOffset;
    return circleRect(hitX, hitY, GRUNT_STATS.strikeRadius, player);
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

    // ── Dash trail (Floor 3+) ────────────────────────────
    this.dashTrail.forEach((p) => {
      const tx = camera.toScreenX(p.x - this.width  / 2);
      const ty = camera.toScreenY(p.y - this.height / 2);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle   = '#a855f7';
      ctx.fillRect(tx, ty, this.width * 0.7, this.height * 0.7);
    });
    ctx.globalAlpha = 1;

    // ── Dash indicator ring ──────────────────────────────
    if (this.attackState === 'dash') {
      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.8)';
      ctx.lineWidth   = 2;
      ctx.stroke();
    }

    // ── Windup indicator ────────────────────────────────
    if (this.attackState === 'windup') {
      const progress = 1 - Math.max(0, this.attackTimer) / GRUNT_STATS.meleeWindup;
      const r        = 36 * (1 - progress * 0.5);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(249, 115, 22, ${0.4 + progress * 0.5})`;
      ctx.lineWidth   = 2;
      ctx.stroke();
    }

    // ── Strike hitbox ────────────────────────────────────
    if (this.attackState === 'strike') {
      const hitX = cx + this.strikeDir.x * GRUNT_STATS.strikeOffset;
      const hitY = cy + this.strikeDir.y * GRUNT_STATS.strikeOffset;
      ctx.beginPath();
      ctx.arc(hitX, hitY, GRUNT_STATS.strikeRadius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(249, 115, 22, 0.5)";
      ctx.fill();
    }

    const bodyColor =
      this.attackState === 'dash'   ? '#c084fc' :
      this.attackState === 'windup' ? '#fb923c' :
      this.attackState === 'strike' ? '#f97316' :
      this.color;

    this.drawBody(ctx, sx, sy, bodyColor);
    this.drawHpBar(ctx, sx, sy);
  }
}