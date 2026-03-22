// src/engine/Enemy.ts
import { Player } from "./Player";
import { Camera } from "./Camera";

// ============================================================
// [🧱 BLOCK: Enemy Types]
// ============================================================
export type EnemyType = 'grunt';

// ============================================================
// [🧱 BLOCK: Enemy Config Table]
// ============================================================
const ENEMY_CONFIG: Record<EnemyType, {
  speed: number;
  hp: number;
  size: number;
  damage: number;
  color: string;
  xpValue: number;
}> = {
  grunt: {
    speed:    1.4,
    hp:       30,
    size:     28,
    damage:   10,
    color:    '#a855f7',
    xpValue:  1,
  },
};

// ============================================================
// [🧱 BLOCK: Enemy Class]
// ============================================================
export class Enemy {
  type: EnemyType;
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number = 0;
  vy: number = 0;
  speed: number;
  hp: number;
  maxHp: number;
  damage: number;
  xpValue: number;
  color: string;
  isDead: boolean = false;
  isHit: boolean = false;
  hitFlashTimer: number = 0;
  damageCooldown: number = 0;

  constructor(x: number, y: number, type: EnemyType = 'grunt') {
    this.type   = type;
    this.x      = x;
    this.y      = y;

    const cfg    = ENEMY_CONFIG[type];
    this.width   = cfg.size;
    this.height  = cfg.size;
    this.speed   = cfg.speed;
    this.hp      = cfg.hp;
    this.maxHp   = cfg.hp;
    this.damage  = cfg.damage;
    this.color   = cfg.color;
    this.xpValue = cfg.xpValue;
  }

  // ============================================================
  // [🧱 BLOCK: Update — AI Brain]
  // worldW / worldH replace canvasW / canvasH — enemies are
  // now clamped to the full world boundary, not the screen.
  // ============================================================
  update(player: Player, worldW: number, worldH: number) {
    if (this.isDead) return;

    // [🧱 BRICK: Follow Logic]
    const targetX = player.x + player.width  / 2;
    const targetY = player.y + player.height / 2;
    const dx      = targetX - (this.x + this.width  / 2);
    const dy      = targetY - (this.y + this.height / 2);
    const dist    = Math.sqrt(dx * dx + dy * dy);

    if (dist > 1) {
      this.vx = (dx / dist) * this.speed;
      this.vy = (dy / dist) * this.speed;
    }

    this.x += this.vx;
    this.y += this.vy;

    // [🧱 BRICK: World Boundary Clamp]
    this.x = Math.max(0, Math.min(worldW - this.width,  this.x));
    this.y = Math.max(0, Math.min(worldH - this.height, this.y));

    // [🧱 BRICK: Hit Flash Timer]
    if (this.isHit) {
      this.hitFlashTimer -= 16;
      if (this.hitFlashTimer <= 0) this.isHit = false;
    }

    // [🧱 BRICK: Damage Cooldown Tick]
    if (this.damageCooldown > 0) this.damageCooldown -= 16;
  }

  // ============================================================
  // [🧱 BLOCK: Draw — Camera Aware]
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    if (this.isDead) return;

    // Skip if off screen (performance boost)
    if (!camera.isVisible(this.x, this.y, this.width, this.height)) return;

    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);

    // [🧱 BRICK: Body]
    ctx.fillStyle = this.isHit ? '#ffffff' : this.color;
    ctx.fillRect(sx, sy, this.width, this.height);

    // [🧱 BRICK: HP Bar]
    const hpRatio = this.hp / this.maxHp;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(sx, sy - 8, this.width, 4);
    ctx.fillStyle = hpRatio > 0.5 ? '#4ade80' : hpRatio > 0.25 ? '#facc15' : '#f87171';
    ctx.fillRect(sx, sy - 8, this.width * hpRatio, 4);
  }

  // ============================================================
  // [🧱 BLOCK: Take Damage]
  // ============================================================
  takeDamage(amount: number) {
    if (this.damageCooldown > 0 || this.isDead) return;
    this.hp            -= amount;
    this.isHit          = true;
    this.hitFlashTimer  = 100;
    this.damageCooldown = 200;
    if (this.hp <= 0) { this.hp = 0; this.isDead = true; }
  }

  // ============================================================
  // [🧱 BLOCK: Contact Damage Check]
  // ============================================================
  isCollidingWithPlayer(player: Player): boolean {
    return (
      this.damageCooldown <= 0 &&
      !this.isDead &&
      this.x < player.x + player.width  &&
      this.x + this.width  > player.x   &&
      this.y < player.y + player.height &&
      this.y + this.height > player.y
    );
  }
}

// ============================================================
// [🧱 BLOCK: Spawn Helper]
// Spawns across the full world boundary so enemies come
// from all over the arena, not just near the screen edge.
// ============================================================
export function spawnWave(
  count: number,
  worldW: number,
  worldH: number,
  type: EnemyType = 'grunt'
): Enemy[] {
  const enemies: Enemy[] = [];
  const margin = 60;

  for (let i = 0; i < count; i++) {
    const edge = Math.floor(Math.random() * 4);
    let x = 0, y = 0;

    switch (edge) {
      case 0: x = Math.random() * worldW; y = margin;              break; // Top
      case 1: x = Math.random() * worldW; y = worldH - margin;     break; // Bottom
      case 2: x = margin;                  y = Math.random() * worldH; break; // Left
      case 3: x = worldW - margin;        y = Math.random() * worldH; break; // Right
    }

    enemies.push(new Enemy(x, y, type));
  }

  return enemies;
}