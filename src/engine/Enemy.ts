// src/engine/Enemy.ts
import { Player } from "./Player";
import { Camera } from "./Camera";

// ============================================================
// [🧱 BLOCK: Enemy Types]
// ============================================================
export type EnemyType = 'grunt' | 'shooter';

// ============================================================
// [🧱 BLOCK: Attack States]
// Shared by both enemy types.
// ============================================================
type AttackState = 'chase' | 'windup' | 'strike' | 'cooldown';

// ============================================================
// [🧱 BLOCK: Enemy Config Table]
// ============================================================
const ENEMY_CONFIG: Record<EnemyType, {
  speed:        number;
  hp:           number;
  size:         number;
  color:        string;
  xpValue:      number;
  // Melee
  meleeRange:   number;
  meleeWindup:  number;  // ms
  meleeDamage:  number;
  meleeCooldown:number;  // ms
  // Ranged (shooter only, 0 = no ranged)
  rangedRange:  number;
  rangedWindup: number;
  rangedDamage: number;
  rangedCooldown: number;
  preferredDist:  number; // distance shooter tries to maintain
}> = {
  grunt: {
    speed:          1.4,
    hp:             30,
    size:           28,
    color:          '#a855f7',
    xpValue:        1,
    meleeRange:     60,
    meleeWindup:    600,
    meleeDamage:    15,
    meleeCooldown:  1500,
    rangedRange:    0,
    rangedWindup:   0,
    rangedDamage:   0,
    rangedCooldown: 0,
    preferredDist:  0,
  },
  shooter: {
    speed:          1.1,
    hp:             20,
    size:           24,
    color:          '#f59e0b',
    xpValue:        2,
    meleeRange:     60,
    meleeWindup:    400,
    meleeDamage:    8,
    meleeCooldown:  1200,
    rangedRange:    200,
    rangedWindup:   800,
    rangedDamage:   12,
    rangedCooldown: 2000,
    preferredDist:  180,
  },
};

// ============================================================
// [🧱 BLOCK: Projectile Class]
// Fired by shooters. Travels in a straight line, despawns
// after 400px or on player hit.
// ============================================================
export class Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage:          number;
  distanceTraveled: number = 0;
  maxDistance:      number = 400;
  radius:           number = 6;
  isDone:           boolean = false;

  constructor(x: number, y: number, targetX: number, targetY: number, damage: number) {
    this.x      = x;
    this.y      = y;
    this.damage = damage;

    const dx   = targetX - x;
    const dy   = targetY - y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const speed = 4;
    this.vx = (dx / dist) * speed;
    this.vy = (dy / dist) * speed;
  }

  // ============================================================
  // [🧱 BLOCK: Projectile Update]
  // ============================================================
  update() {
    if (this.isDone) return;
    this.x += this.vx;
    this.y += this.vy;
    this.distanceTraveled += Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (this.distanceTraveled >= this.maxDistance) this.isDone = true;
  }

  // ============================================================
  // [🧱 BLOCK: Projectile Draw]
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    if (this.isDone) return;
    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);

    // Outer glow
    ctx.beginPath();
    ctx.arc(sx, sy, this.radius + 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(239, 68, 68, 0.25)";
    ctx.fill();

    // Core bullet
    ctx.beginPath();
    ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.fill();

    // Bright center
    ctx.beginPath();
    ctx.arc(sx, sy, this.radius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = "#fca5a5";
    ctx.fill();
  }

  // ============================================================
  // [🧱 BLOCK: Projectile Hit Check]
  // Circle vs circle — projectile radius vs player hitbox center
  // ============================================================
  isHittingPlayer(player: Player): boolean {
    if (this.isDone) return false;
    const px   = player.x + player.width  / 2;
    const py   = player.y + player.height / 2;
    const dist = Math.sqrt((this.x - px) ** 2 + (this.y - py) ** 2);
    return dist < this.radius + player.width / 2;
  }
}

// ============================================================
// [🧱 BLOCK: Enemy Class]
// ============================================================
export class Enemy {
  type:    EnemyType;
  x:       number;
  y:       number;
  width:   number;
  height:  number;
  vx:      number = 0;
  vy:      number = 0;
  speed:   number;

  // Stats
  hp:             number;
  maxHp:          number;
  xpValue:        number;
  color:          string;
  isDead:         boolean = false;
  isHit:          boolean = false;
  hitFlashTimer:  number  = 0;

  // ── Attack State Machine ──────────────────────────────────
  attackState:    AttackState = 'chase';
  attackTimer:    number      = 0;  // Countdown ms for current state
  attackCooldown: number      = 0;  // Global cooldown after any attack

  // Locked aim direction (set at windup end)
  strikeDir: { x: number; y: number } = { x: 0, y: 1 };

  // Pending projectile — collected by GameCanvas each frame
  pendingProjectile: Projectile | null = null;

  // Track which mode triggered the current attack (melee vs ranged)
  currentAttackMode: 'melee' | 'ranged' = 'melee';

  // Config shorthand
  private cfg: typeof ENEMY_CONFIG[EnemyType];

  constructor(x: number, y: number, type: EnemyType = 'grunt', floor: number = 1) {
    this.type = type;
    this.x    = x;
    this.y    = y;
    this.cfg  = ENEMY_CONFIG[type];

    const speedScale = 1 + (floor - 1) * 0.15;
    const hpScale    = 1 + (floor - 1) * 0.20;

    this.width   = this.cfg.size;
    this.height  = this.cfg.size;
    this.speed   = this.cfg.speed * speedScale;
    this.hp      = Math.round(this.cfg.hp * hpScale);
    this.maxHp   = this.hp;
    this.xpValue = this.cfg.xpValue;
    this.color   = this.cfg.color;
  }

  // ============================================================
  // [🧱 BLOCK: Update — Attack State Machine]
  // ============================================================
  update(player: Player, worldW: number, worldH: number) {
    if (this.isDead) return;

    // Tick timers
    this.attackTimer   -= 16;
    this.attackCooldown -= 16;

    if (this.isHit) {
      this.hitFlashTimer -= 16;
      if (this.hitFlashTimer <= 0) this.isHit = false;
    }

    // Distance to player center
    const pcx  = player.x + player.width  / 2;
    const pcy  = player.y + player.height / 2;
    const ecx  = this.x   + this.width    / 2;
    const ecy  = this.y   + this.height   / 2;
    const dx   = pcx - ecx;
    const dy   = pcy - ecy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    // ── [🧱 BRICK: State Machine] ──────────────────────────
    switch (this.attackState) {

      // ── CHASE ──────────────────────────────────────────────
      case 'chase': {
        const canAttack = this.attackCooldown <= 0;

        if (this.type === 'shooter') {
          this.updateShooterMovement(dx, dy, dist, worldW, worldH);

          // Ranged trigger — preferred distance
          if (canAttack && dist <= this.cfg.rangedRange && dist > this.cfg.meleeRange) {
            this.currentAttackMode = 'ranged';
            this.attackState       = 'windup';
            this.attackTimer       = this.cfg.rangedWindup;
            this.vx = 0; this.vy = 0;
            break;
          }
        } else {
          // Grunt — always chase
          this.moveToward(dx, dy, dist);
        }

        // Melee trigger — both types
        if (canAttack && dist <= this.cfg.meleeRange) {
          this.currentAttackMode = 'melee';
          this.attackState       = 'windup';
          this.attackTimer       = this.cfg.meleeWindup;
          this.vx = 0; this.vy = 0;
        }
        break;
      }

      // ── WINDUP ─────────────────────────────────────────────
      case 'windup': {
        // Stop moving during windup — telegraphing the attack
        this.vx = 0; this.vy = 0;

        // Lock aim direction right before striking
        if (this.attackTimer <= 100) {
          this.strikeDir = { x: dx / dist, y: dy / dist };
        }

        if (this.attackTimer <= 0) {
          this.attackState = 'strike';
          this.attackTimer = 150; // Strike lasts 150ms

          // Shooter fires projectile on transition to strike
          if (this.currentAttackMode === 'ranged') {
            this.pendingProjectile = new Projectile(
              ecx, ecy,
              pcx, pcy,
              this.cfg.rangedDamage
            );
          }
        }
        break;
      }

      // ── STRIKE ─────────────────────────────────────────────
      case 'strike': {
        // Grunt lunges slightly forward during melee strike
        if (this.currentAttackMode === 'melee') {
          this.x += this.strikeDir.x * 2;
          this.y += this.strikeDir.y * 2;
        }

        if (this.attackTimer <= 0) {
          this.attackState = 'cooldown';
          const cd = this.currentAttackMode === 'ranged'
            ? this.cfg.rangedCooldown
            : this.cfg.meleeCooldown;
          this.attackTimer   = cd;
          this.attackCooldown = cd;
        }
        break;
      }

      // ── COOLDOWN ───────────────────────────────────────────
      case 'cooldown': {
        // Resume chasing during cooldown
        if (this.type === 'shooter') {
          this.updateShooterMovement(dx, dy, dist, worldW, worldH);
        } else {
          this.moveToward(dx, dy, dist);
        }

        if (this.attackTimer <= 0) {
          this.attackState = 'chase';
        }
        break;
      }
    }

    // Clamp to world
    this.x = Math.max(0, Math.min(worldW - this.width,  this.x));
    this.y = Math.max(0, Math.min(worldH - this.height, this.y));
  }

  // ============================================================
  // [🧱 BRICK: Move Toward Player]
  // ============================================================
  private moveToward(dx: number, dy: number, dist: number) {
    this.vx = (dx / dist) * this.speed;
    this.vy = (dy / dist) * this.speed;
    this.x += this.vx;
    this.y += this.vy;
  }

  // ============================================================
  // [🧱 BRICK: Shooter Movement — maintain preferred distance]
  // Chases if too far, backs away if too close.
  // ============================================================
  private updateShooterMovement(
    dx: number, dy: number, dist: number,
    worldW: number, worldH: number
  ) {
    const preferred = this.cfg.preferredDist;
    const diff      = dist - preferred;

    if (Math.abs(diff) > 20) {
      const dir = diff > 0 ? 1 : -1; // Chase or retreat
      this.vx   = (dx / dist) * this.speed * dir;
      this.vy   = (dy / dist) * this.speed * dir;
      this.x   += this.vx;
      this.y   += this.vy;
    } else {
      this.vx = 0;
      this.vy = 0;
    }
  }

  // ============================================================
  // [🧱 BLOCK: Melee Hit Check]
  // Called by GameCanvas during 'strike' state.
  // Returns true if the strike hitbox overlaps the player.
  // ============================================================
  isMeleeHittingPlayer(player: Player): boolean {
    if (this.attackState !== 'strike' || this.currentAttackMode !== 'melee') return false;

    const ecx     = this.x + this.width  / 2;
    const ecy     = this.y + this.height / 2;
    const hitX    = ecx + this.strikeDir.x * 45;
    const hitY    = ecy + this.strikeDir.y * 45;
    const hitSize = 28;

    // Circle vs rect
    const nearestX = Math.max(player.x, Math.min(hitX, player.x + player.width));
    const nearestY = Math.max(player.y, Math.min(hitY, player.y + player.height));
    const distSq   = (hitX - nearestX) ** 2 + (hitY - nearestY) ** 2;
    return distSq < hitSize * hitSize;
  }

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

    // ── [🧱 BRICK: Windup Indicator] ──────────────────────
    if (this.attackState === 'windup') {
      const progress = 1 - Math.max(0, this.attackTimer) /
        (this.currentAttackMode === 'ranged'
          ? this.cfg.rangedWindup
          : this.cfg.meleeWindup);

      const indicatorColor = this.currentAttackMode === 'ranged'
        ? `rgba(250, 204, 21, ${0.4 + progress * 0.5})`  // Yellow for ranged
        : `rgba(249, 115, 22, ${0.4 + progress * 0.5})`; // Orange for melee

      // Shrinking ring — fills as windup completes
      const maxR = 36;
      const r    = maxR * (1 - progress * 0.5);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = indicatorColor;
      ctx.lineWidth   = 2;
      ctx.stroke();
    }

    // ── [🧱 BRICK: Strike Hitbox Visual] ──────────────────
    if (this.attackState === 'strike' && this.currentAttackMode === 'melee') {
      const hitX = cx + this.strikeDir.x * 45;
      const hitY = cy + this.strikeDir.y * 45;
      ctx.beginPath();
      ctx.arc(hitX, hitY, 20, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(249, 115, 22, 0.5)";
      ctx.fill();
    }

    // ── [🧱 BRICK: Body] ──────────────────────────────────
    let bodyColor = this.isHit ? '#ffffff' : this.color;
    if (this.attackState === 'windup') {
      bodyColor = this.currentAttackMode === 'ranged' ? '#fde047' : '#fb923c';
    }
    if (this.attackState === 'strike') {
      bodyColor = this.currentAttackMode === 'ranged' ? '#facc15' : '#f97316';
    }
    ctx.fillStyle = bodyColor;
    ctx.fillRect(sx, sy, this.width, this.height);

    // ── [🧱 BRICK: HP Bar] ────────────────────────────────
    const hpRatio = this.hp / this.maxHp;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(sx, sy - 8, this.width, 4);
    ctx.fillStyle = hpRatio > 0.5 ? '#4ade80' : hpRatio > 0.25 ? '#facc15' : '#f87171';
    ctx.fillRect(sx, sy - 8, this.width * hpRatio, 4);

    // ── [🧱 BRICK: Shooter aim line] ──────────────────────
    if (this.type === 'shooter' && this.attackState === 'windup' && this.currentAttackMode === 'ranged') {
      ctx.strokeStyle = "rgba(250, 204, 21, 0.4)";
      ctx.lineWidth   = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + this.strikeDir.x * 200, cy + this.strikeDir.y * 200);
      ctx.stroke();
      ctx.setLineDash([]);
    }
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
}

// ============================================================
// [🧱 BLOCK: Spawn Helper]
// roomInCycle controls enemy mix:
//   1 → grunts only
//   2 → grunts + shooters
// ============================================================
export function spawnWave(
  count:        number,
  worldW:       number,
  worldH:       number,
  roomInCycle:  1 | 2 | 3 = 1,
  floor:        number    = 1
): Enemy[] {
  const enemies: Enemy[] = [];
  const margin = 60;

  for (let i = 0; i < count; i++) {
    // Room 2: last 3 of every batch are shooters
    const type: EnemyType =
      roomInCycle === 2 && i >= count - Math.floor(count * 0.4)
        ? 'shooter'
        : 'grunt';

    const edge = Math.floor(Math.random() * 4);
    let x = 0, y = 0;
    switch (edge) {
      case 0: x = Math.random() * worldW; y = margin;              break;
      case 1: x = Math.random() * worldW; y = worldH - margin;     break;
      case 2: x = margin;                  y = Math.random() * worldH; break;
      case 3: x = worldW - margin;        y = Math.random() * worldH; break;
    }
    enemies.push(new Enemy(x, y, type, floor));
  }
  return enemies;
}