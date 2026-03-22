// src/engine/Player.ts
import { InputHandler } from "./Input";

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
  maxStamina: number = 100;
  stamina: number = 100;

  // States
  isDashing: boolean = false;
  isAttacking: boolean = false;
  attackType: 'light' | 'heavy' | null = null;
  attackTimer: number = 0;
  facing: { x: number; y: number } = { x: 0, y: 1 };

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  update(input: InputHandler) {
    // [🧱 BLOCK: Movement Logic] -----------------------------------
    let inputX = 0; let inputY = 0;
    if (input.movement.up) inputY -= 1;
    if (input.movement.down) inputY += 1;
    if (input.movement.left) inputX -= 1;
    if (input.movement.right) inputX += 1;

    if (inputX !== 0 || inputY !== 0) {
      const length = Math.sqrt(inputX * inputX + inputY * inputY);
      inputX /= length; inputY /= length;
      
      this.vx += inputX * this.accel;
      this.vy += inputY * this.accel;
      
      this.facing = { x: inputX, y: inputY };
    }

    // [🧱 BLOCK: Combat & Dash Execution] --------------------------
    if (input.movement.dash && this.stamina >= 30 && !this.isDashing && !this.isAttacking) {
      this.stamina -= 30;
      this.isDashing = true;
      this.vx *= 4; this.vy *= 4;
      setTimeout(() => { this.isDashing = false; }, 200);
    }

    if (!this.isAttacking && !this.isDashing) {
      if (input.movement.light && this.stamina >= 10) {
        this.performAttack('light', 10, 150); 
      } else if (input.movement.heavy && this.stamina >= 25) {
        this.performAttack('heavy', 25, 400); 
      }
    }

    if (this.isAttacking) {
      this.attackTimer -= 16; 
      if (this.attackTimer <= 0) {
        this.isAttacking = false;
        this.attackType = null;
      }
    }

    // [🧱 BLOCK: Physics Solver] -----------------------------------
    this.vx *= this.friction;
    this.vy *= this.friction;

    const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    const topSpeed = this.isDashing ? 20 : this.maxSpeed;

    if (currentSpeed > topSpeed) {
      this.vx = (this.vx / currentSpeed) * topSpeed;
      this.vy = (this.vy / currentSpeed) * topSpeed;
    }

    this.x += this.vx;
    this.y += this.vy;

    if (this.stamina < this.maxStamina) {
      this.stamina += 0.4;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    // [🧱 BLOCK: Render Combat Visuals] ----------------------------
    if (this.isAttacking) {
      ctx.fillStyle = this.attackType === 'light' ? "rgba(255, 255, 255, 0.6)" : "rgba(251, 191, 36, 0.7)";
      
      const range = this.attackType === 'light' ? 35 : 55;
      const size = this.attackType === 'light' ? 15 : 25;
      const attackX = (this.x + this.width / 2) + (this.facing.x * range);
      const attackY = (this.y + this.height / 2) + (this.facing.y * range);
      
      ctx.beginPath();
      ctx.arc(attackX, attackY, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // [🧱 BLOCK: Render Player] ------------------------------------
    ctx.fillStyle = this.isDashing ? "#38bdf8" : "#f87171";
    ctx.fillRect(this.x, this.y, this.width, this.height);
    
    // [🧱 BLOCK: Render UI Bars] -----------------------------------
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(this.x, this.y - 10, this.width, 4);
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(this.x, this.y - 10, (this.stamina / this.maxStamina) * this.width, 4);
  }

  // [🧱 BLOCK: Attack Helper] --------------------------------------
  performAttack(type: 'light' | 'heavy', cost: number, duration: number) {
    this.stamina -= cost;
    this.isAttacking = true;
    this.attackType = type;
    this.attackTimer = duration;

    const lungeForce = type === 'light' ? 6 : 10;
    this.vx += this.facing.x * lungeForce;
    this.vy += this.facing.y * lungeForce;
  }
}