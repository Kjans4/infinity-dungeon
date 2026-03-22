// src/engine/Enemy.ts

import { Player } from "./Player";

// ============================================================
// [🧱 BLOCK: Enemy Types]
// Add new enemy variants here later (e.g. 'ranged', 'boss')
// ============================================================
export type EnemyType = 'grunt';

// ============================================================
// [🧱 BLOCK: Enemy Config Table]
// Tune stats per enemy type in one place — no magic numbers
// scattered across the codebase.
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
    speed: 1.4,
    hp: 30,
    size: 28,
    damage: 10,
    color: '#a855f7',   // Purple grunt
    xpValue: 1,         // Counts as 1 kill toward the threshold
  },
};

// ============================================================
// [🧱 BLOCK: Enemy Class]
// ============================================================
export class Enemy {
  // --- Identity ---
  type: EnemyType;

  // --- Position & Size ---
  x: number;
  y: number;
  width: number;
  height: number;

  // --- Physics ---
  vx: number = 0;
  vy: number = 0;
  speed: number;

  // --- Stats ---
  hp: number;
  maxHp: number;
  damage: number;
  xpValue: number;

  // --- Visual ---
  color: string;

  // --- State ---
  isDead: boolean = false;
  isHit: boolean = false;        // Flash white when struck
  hitFlashTimer: number = 0;     // How long the flash lasts (ms)
  damageCooldown: number = 0;    // Prevents multi-hit in one frame

  constructor(x: number, y: number, type: EnemyType = 'grunt') {
    this.type = type;
    this.x = x;
    this.y = y;

    const cfg = ENEMY_CONFIG[type];
    this.width = cfg.size;
    this.height = cfg.size;
    this.speed = cfg.speed;
    this.hp = cfg.hp;
    this.maxHp = cfg.hp;
    this.damage = cfg.damage;
    this.color = cfg.color;
    this.xpValue = cfg.xpValue;
  }

  // ============================================================
  // [🧱 BLOCK: Update — AI Brain]
  // Called every frame from GameCanvas.tsx
  // ============================================================
  update(player: Player, canvasWidth: number, canvasHeight: number) {
    if (this.isDead) return;

    // --- [🧱 BRICK: Follow Logic] ---
    // Calculate the vector from this enemy toward the player's center
    const targetX = player.x + player.width / 2;
    const targetY = player.y + player.height / 2;

    const dx = targetX - (this.x + this.width / 2);
    const dy = targetY - (this.y + this.height / 2);
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 1) {
      // Normalize then apply speed
      this.vx = (dx / dist) * this.speed;
      this.vy = (dy / dist) * this.speed;
    }

    this.x += this.vx;
    this.y += this.vy;

    // --- [🧱 BRICK: Arena Boundary Clamp] ---
    // Keeps enemies inside the canvas edges
    this.x = Math.max(0, Math.min(canvasWidth - this.width, this.x));
    this.y = Math.max(0, Math.min(canvasHeight - this.height, this.y));

    // --- [🧱 BRICK: Hit Flash Timer] ---
    if (this.isHit) {
      this.hitFlashTimer -= 16;
      if (this.hitFlashTimer <= 0) {
        this.isHit = false;
      }
    }

    // --- [🧱 BRICK: Damage Cooldown Tick] ---
    if (this.damageCooldown > 0) {
      this.damageCooldown -= 16;
    }
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // ============================================================
  draw(ctx: CanvasRenderingContext2D) {
    if (this.isDead) return;

    // --- [🧱 BRICK: Body] ---
    ctx.fillStyle = this.isHit ? '#ffffff' : this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // --- [🧱 BRICK: HP Bar] ---
    const barWidth = this.width;
    const barHeight = 4;
    const barY = this.y - 8;
    const hpRatio = this.hp / this.maxHp;

    // Background
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(this.x, barY, barWidth, barHeight);

    // Foreground — green → red as HP drops
    ctx.fillStyle = hpRatio > 0.5 ? '#4ade80' : hpRatio > 0.25 ? '#facc15' : '#f87171';
    ctx.fillRect(this.x, barY, barWidth * hpRatio, barHeight);
  }

  // ============================================================
  // [🧱 BLOCK: Take Damage]
  // Called from Collision.ts when a player attack lands
  // ============================================================
  takeDamage(amount: number) {
    if (this.damageCooldown > 0 || this.isDead) return;

    this.hp -= amount;
    this.isHit = true;
    this.hitFlashTimer = 100;     // Flash for 100ms
    this.damageCooldown = 200;    // Can't be hit again for 200ms

    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
    }
  }

  // ============================================================
  // [🧱 BLOCK: Contact Damage Check]
  // Returns true if this enemy is overlapping the player
  // and is ready to deal damage (cooldown elapsed).
  // Checked every frame in GameCanvas.tsx
  // ============================================================
  isCollidingWithPlayer(player: Player): boolean {
    return (
      this.damageCooldown <= 0 &&
      !this.isDead &&
      this.x < player.x + player.width &&
      this.x + this.width > player.x &&
      this.y < player.y + player.height &&
      this.y + this.height > player.y
    );
  }
}

// ============================================================
// [🧱 BLOCK: Spawn Helper]
// Call this at the start of each room.
// Enemies spawn at random positions along the arena edges
// so they always walk inward toward the player.
//
// Usage in GameCanvas.tsx:
//   enemiesRef.current = spawnWave(count, canvasWidth, canvasHeight);
// ============================================================
export function spawnWave(
  count: number,
  canvasWidth: number,
  canvasHeight: number,
  type: EnemyType = 'grunt'
): Enemy[] {
  const enemies: Enemy[] = [];
  const margin = 40; // Distance from the very edge so they're fully visible

  for (let i = 0; i < count; i++) {
    // Pick one of the 4 edges at random
    const edge = Math.floor(Math.random() * 4);
    let x = 0;
    let y = 0;

    switch (edge) {
      case 0: // Top edge
        x = Math.random() * canvasWidth;
        y = margin;
        break;
      case 1: // Bottom edge
        x = Math.random() * canvasWidth;
        y = canvasHeight - margin;
        break;
      case 2: // Left edge
        x = margin;
        y = Math.random() * canvasHeight;
        break;
      case 3: // Right edge
        x = canvasWidth - margin;
        y = Math.random() * canvasHeight;
        break;
    }

    enemies.push(new Enemy(x, y, type));
  }

  return enemies;
}