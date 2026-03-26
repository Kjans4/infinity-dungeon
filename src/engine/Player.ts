// src/engine/Player.ts
import { InputHandler } from "./Input";
import { Camera } from "./Camera";

export class Player {
  // [🧱 BLOCK: Properties] -----------------------------------------
  x: number; y: number;
  width: number = 32; height: number = 32;
  vx: number = 0; vy: number = 0;

  // Physics Constants
  accel: number = 0.8;
  friction: number = 0.85;
  maxSpeed: number = 5;

  // Stats
  hp: number = 100;
  maxHp: number = 100;
  maxStamina: number = 100;
  stamina: number = 100;

  // States
  isDashing:        boolean                    = false;
  isAttacking:      boolean                    = false;
  isHeavyAttacking: boolean                    = false; // ← locks movement
  isHit:            boolean                    = false; // [NEW]
  hitFlashTimer:    number                     = 0;     // [NEW]
  attackType:       'light' | 'heavy' | null   = null;
  attackTimer:      number                     = 0;
  heavyCooldown:    number                     = 0;
  iFrames:          number                     = 0;
  facing:           { x: number; y: number }   = { x: 0, y: 1 };
  lockedFacing:     { x: number; y: number } | null = null; // ← locked on heavy press

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  update(input: InputHandler) {
    // [🧱 BLOCK: Movement Logic] -----------------------------------
    let inputX = 0; let inputY = 0;
    if (input.movement.up)    inputY -= 1;
    if (input.movement.down)  inputY += 1;
    if (input.movement.left)  inputX -= 1;
    if (input.movement.right) inputX += 1;

    // Only apply movement if NOT in a heavy attack
    if (!this.isHeavyAttacking) {
      if (inputX !== 0 || inputY !== 0) {
        const length = Math.sqrt(inputX * inputX + inputY * inputY);
        inputX /= length; inputY /= length;
        this.vx += inputX * this.accel;
        this.vy += inputY * this.accel;
        // Update facing only when moving freely
        this.facing = { x: inputX, y: inputY };
      }
    } else {
      // Halted — bleed velocity to zero fast
      this.vx *= 0.5;
      this.vy *= 0.5;
    }

    // [🧱 BLOCK: Combat & Dash Execution] --------------------------
    if (input.movement.dash && this.stamina >= 30 && !this.isDashing && !this.isAttacking) {
      this.stamina     -= 30;
      this.isDashing    = true;
      this.vx          *= 4;
      this.vy          *= 4;
      setTimeout(() => { this.isDashing = false; }, 200);
    }

    if (!this.isAttacking && !this.isDashing) {
      if (input.movement.light && this.stamina >= 10) {
        this.performAttack('light', 10, 150);
      } else if (input.movement.heavy && this.stamina >= 25 && this.heavyCooldown <= 0) {
        // Lock facing at the moment K is pressed
        this.lockedFacing = { ...this.facing };
        this.performAttack('heavy', 25, 400);
        this.heavyCooldown    = 1200;
        this.isHeavyAttacking = true;
      }
    }

    // [🧱 BLOCK: Attack Timer] -------------------------------------
    if (this.isAttacking) {
      this.attackTimer -= 16;
      if (this.attackTimer <= 0) {
        this.isAttacking      = false;
        this.isHeavyAttacking = false;
        this.lockedFacing     = null;
        this.attackType       = null;
      }
    }

    // [🧱 BLOCK: Physics Solver] -----------------------------------
    this.vx *= this.friction;
    this.vy *= this.friction;

    const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    const topSpeed     = this.isDashing ? 20 : this.maxSpeed;

    if (currentSpeed > topSpeed) {
      this.vx = (this.vx / currentSpeed) * topSpeed;
      this.vy = (this.vy / currentSpeed) * topSpeed;
    }

    this.x += this.vx;
    this.y += this.vy;

    // [🧱 BLOCK: Resources Logic] ----------------------------------
    if (this.stamina < this.maxStamina) {
      this.stamina += 0.4;
    }

    // Tick cooldowns
    if (this.heavyCooldown > 0) this.heavyCooldown -= 16;
    
    // Tick i-frames and hit flash
    if (this.iFrames > 0)       this.iFrames       -= 16;
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= 16;
      if (this.hitFlashTimer <= 0) this.isHit = false;
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    // Visual Feedback: Flicker the player when in i-frames (but not during initial white flash)
    if (!this.isHit && this.iFrames > 0 && Math.floor(Date.now() / 50) % 2 === 0) {
       return; 
    }

    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);

    // [🧱 BLOCK: Render Combat Visuals] --------------------------
    if (this.isAttacking) {
      ctx.fillStyle = this.attackType === 'light'
        ? "rgba(255, 255, 255, 0.6)"
        : "rgba(251, 191, 36, 0.7)";

      const range   = this.attackType === 'light' ? 35 : 55;
      const size    = this.attackType === 'light' ? 15 : 25;
      
      const dir     = (this.attackType === 'heavy' && this.lockedFacing)  ? this.lockedFacing  : this.facing;
      const attackX = (sx + this.width  / 2) + dir.x * range;
      const attackY = (sy + this.height / 2) + dir.y * range;

      ctx.beginPath();
      ctx.arc(attackX, attackY, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // [🧱 BLOCK: Render Player] ----------------------------------
    // Flash white on hit, blue on dash, red normally
    ctx.fillStyle = this.isHit 
      ? "#ffffff" 
      : this.isDashing 
        ? "#38bdf8" 
        : "#f87171";
    ctx.fillRect(sx, sy, this.width, this.height);

    // [🧱 BLOCK: Render UI Bars] ---------------------------------
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(sx, sy - 15, this.width, 4);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(sx, sy - 15, (this.hp / this.maxHp) * this.width, 4);

    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(sx, sy - 8, (this.stamina / this.maxStamina) * this.width, 4);
  }

  // [🧱 BLOCK: Attack Helper] --------------------------------------
  performAttack(type: 'light' | 'heavy', cost: number, duration: number) {
    this.stamina     -= cost;
    this.isAttacking  = true;
    this.attackType   = type;
    this.attackTimer  = duration;

    const lungeForce = type === 'light' ? 6 : 10;
    this.vx += this.facing.x * lungeForce;
    this.vy += this.facing.y * lungeForce;
  }

  // [🧱 BLOCK: Take Hit] -------------------------------------------
  takeHit(amount: number) {
    if (this.iFrames > 0) return; // Already invincible
    this.hp           = Math.max(0, this.hp - amount);
    this.isHit        = true;
    // Variable flash duration — bigger hits flash longer
    this.hitFlashTimer = amount >= 25 ? 300 : 150;
    this.iFrames       = amount >= 25 ? 800 : 600;
  }
}