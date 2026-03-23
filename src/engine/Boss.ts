// src/engine/Boss.ts
import { Player } from "./Player";
import { Camera } from "./Camera";

// ============================================================
// [🧱 BLOCK: Boss Attack States]
// ============================================================
type BossAttackState =
  | 'chase'        // Default — moves toward player
  | 'warn_charge'  // Yellow ring warning before charge
  | 'charging'     // Fast dash in locked direction
  | 'warn_slam'    // Red ring warning before slam
  | 'slamming'     // AoE explosion around boss
  | 'cooldown';    // Brief pause after attack

// ============================================================
// [🧱 BLOCK: Boss Class]
// ============================================================
export class Boss {
  // --- Position & Size ---
  x: number;
  y: number;
  width:  number = 80;
  height: number = 80;

  // --- Physics ---
  vx: number = 0;
  vy: number = 0;
  speed: number = 1.2;

  // --- Stats ---
  hp: number;
  maxHp: number;
  damage: number = 20;
  isDead: boolean = false;
  isHit:  boolean = false;
  hitFlashTimer:  number = 0;
  damageCooldown: number = 0;

  // --- Attack State Machine ---
  state:      BossAttackState = 'chase';
  stateTimer: number = 0;   // Counts down ms until state changes

  // Charge — locked direction
  chargeDir: { x: number; y: number } = { x: 0, y: 0 };

  // Slam — AoE radius grows during warning
  slamRadius:    number = 0;
  slamMaxRadius: number = 120;
  slamActive:    boolean = false; // True during the actual explosion frame

  // Indicator pulse
  indicatorPulse: number = 0;

  constructor(x: number, y: number, floor: number = 1) {
    this.x = x;
    this.y = y;

    // Scale HP with floor (+30% per floor)
    const hpScale = 1 + (floor - 1) * 0.30;
    this.hp    = Math.round(300 * hpScale);
    this.maxHp = this.hp;
  }

  // ============================================================
  // [🧱 BLOCK: Update — State Machine]
  // ============================================================
  update(player: Player, worldW: number, worldH: number) {
    if (this.isDead) return;

    this.stateTimer     -= 16;
    this.indicatorPulse += 16;

    if (this.isHit) {
      this.hitFlashTimer -= 16;
      if (this.hitFlashTimer <= 0) this.isHit = false;
    }
    if (this.damageCooldown > 0) this.damageCooldown -= 16;

    // --- [🧱 BRICK: State Transitions] ---
    switch (this.state) {

      case 'chase':
        this.moveToward(player);
        if (this.stateTimer <= 0) {
          // Randomly pick next attack
          this.state      = Math.random() < 0.5 ? 'warn_charge' : 'warn_slam';
          this.stateTimer = 1500; // 1.5s warning
          this.indicatorPulse = 0;
        }
        break;

      case 'warn_charge':
        // Lock the direction toward player NOW so player can react
        this.vx = 0; this.vy = 0;
        if (this.stateTimer <= 0) {
          const dx   = (player.x + player.width  / 2) - (this.x + this.width  / 2);
          const dy   = (player.y + player.height / 2) - (this.y + this.height / 2);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          this.chargeDir = { x: dx / dist, y: dy / dist };
          this.state      = 'charging';
          this.stateTimer = 600; // 0.6s charge
        }
        break;

      case 'charging':
        // Fast dash in locked direction
        this.x += this.chargeDir.x * 12;
        this.y += this.chargeDir.y * 12;
        if (this.stateTimer <= 0) {
          this.state      = 'cooldown';
          this.stateTimer = 800;
        }
        break;

      case 'warn_slam':
        this.vx = 0; this.vy = 0;
        // Grow the warning ring during the warning phase
        this.slamRadius = this.slamMaxRadius *
          (1 - this.stateTimer / 1500);
        if (this.stateTimer <= 0) {
          this.state      = 'slamming';
          this.stateTimer = 400;
          this.slamActive = true;
          this.slamRadius = this.slamMaxRadius;
        }
        break;

      case 'slamming':
        if (this.stateTimer <= 0) {
          this.slamActive = false;
          this.slamRadius = 0;
          this.state      = 'cooldown';
          this.stateTimer = 1000;
        }
        break;

      case 'cooldown':
        this.vx = 0; this.vy = 0;
        if (this.stateTimer <= 0) {
          this.state      = 'chase';
          this.stateTimer = 3000; // Chase for 3s before next attack
        }
        break;
    }

    // Clamp to world
    this.x = Math.max(0, Math.min(worldW - this.width,  this.x));
    this.y = Math.max(0, Math.min(worldH - this.height, this.y));
  }

  // ============================================================
  // [🧱 BRICK: Move Toward Player]
  // ============================================================
  private moveToward(player: Player) {
    const targetX = player.x + player.width  / 2;
    const targetY = player.y + player.height / 2;
    const dx      = targetX - (this.x + this.width  / 2);
    const dy      = targetY - (this.y + this.height / 2);
    const dist    = Math.sqrt(dx * dx + dy * dy) || 1;

    this.vx = (dx / dist) * this.speed;
    this.vy = (dy / dist) * this.speed;
    this.x += this.vx;
    this.y += this.vy;
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    if (this.isDead) return;

    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);
    const cx = sx + this.width  / 2;
    const cy = sy + this.height / 2;

    // --- [🧱 BRICK: Slam AoE Indicator] ---
    if (this.state === 'warn_slam' || this.state === 'slamming') {
      const pulse = Math.sin(this.indicatorPulse / 150) * 0.3 + 0.7;

      if (this.state === 'slamming') {
        // White flash explosion
        ctx.beginPath();
        ctx.arc(cx, cy, this.slamRadius, 0, Math.PI * 2);
        ctx.fillStyle   = "rgba(255,255,255,0.25)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,100,100,0.9)";
        ctx.lineWidth   = 4;
        ctx.stroke();
      } else {
        // Growing red warning ring
        ctx.beginPath();
        ctx.arc(cx, cy, this.slamRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(239, 68, 68, ${pulse})`;
        ctx.lineWidth   = 3;
        ctx.stroke();
      }
    }

    // --- [🧱 BRICK: Charge Indicator] ---
    if (this.state === 'warn_charge') {
      const pulse = Math.sin(this.indicatorPulse / 100) * 0.4 + 0.6;
      ctx.beginPath();
      ctx.arc(cx, cy, 60, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(250, 204, 21, ${pulse})`; // Yellow
      ctx.lineWidth   = 3;
      ctx.stroke();

      // Arrow showing locked direction (points toward player center during warn)
      ctx.strokeStyle = `rgba(250, 204, 21, ${pulse})`;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + this.chargeDir.x * 50, cy + this.chargeDir.y * 50);
      ctx.stroke();
    }

    // --- [🧱 BRICK: Boss Body] ---
    const bodyColor = this.isHit
      ? '#ffffff'
      : this.state === 'charging'
        ? '#f97316'   // Orange while charging
        : this.state === 'slamming'
          ? '#ef4444' // Red during slam
          : '#dc2626'; // Default dark red

    ctx.fillStyle = bodyColor;
    ctx.fillRect(sx, sy, this.width, this.height);

    // --- [🧱 BRICK: HP Bar] ---
    const barW    = this.width * 2;       // Wider bar for boss
    const barX    = sx - this.width / 2;  // Centered
    const barY    = sy - 14;
    const hpRatio = this.hp / this.maxHp;

    ctx.fillStyle = "#1e293b";
    ctx.fillRect(barX, barY, barW, 6);

    ctx.fillStyle = hpRatio > 0.5 ? '#4ade80' : hpRatio > 0.25 ? '#facc15' : '#ef4444';
    ctx.fillRect(barX, barY, barW * hpRatio, 6);

    // Boss label
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font      = "bold 10px 'Courier New'";
    ctx.textAlign = "center";
    ctx.fillText("BOSS", cx, sy - 18);
    ctx.textAlign = "left";
  }

  // ============================================================
  // [🧱 BLOCK: Take Damage]
  // ============================================================
  takeDamage(amount: number) {
    if (this.damageCooldown > 0 || this.isDead) return;
    this.hp            -= amount;
    this.isHit          = true;
    this.hitFlashTimer  = 80;
    this.damageCooldown = 150;
    if (this.hp <= 0) { this.hp = 0; this.isDead = true; }
  }

  // ============================================================
  // [🧱 BLOCK: Collision Checks]
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

  // Check if slam AoE hits the player
  isSlamHittingPlayer(player: Player): boolean {
    if (!this.slamActive) return false;
    const cx   = this.x + this.width  / 2;
    const cy   = this.y + this.height / 2;
    const px   = player.x + player.width  / 2;
    const py   = player.y + player.height / 2;
    const dist = Math.sqrt((cx - px) ** 2 + (cy - py) ** 2);
    return dist < this.slamRadius;
  }
}