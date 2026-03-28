// src/engine/Player.ts
import { InputHandler } from "./Input";
import { Camera }       from "./Camera";
import { Weapon }       from "./items/Weapon";
import { AttackDef }    from "./items/types";

export class Player {
  // [🧱 BLOCK: Properties]
  x: number; y: number;
  width:  number = 32;
  height: number = 32;
  vx: number = 0;
  vy: number = 0;

  // Physics
  accel:    number = 0.8;
  friction: number = 0.85;
  maxSpeed: number = 5;

  // Stats
  hp:         number = 100;
  maxHp:      number = 100;
  maxStamina: number = 100;
  stamina:    number = 100;

  // Combat state
  isDashing:        boolean                  = false;
  isAttacking:      boolean                  = false;
  isHeavyAttacking: boolean                  = false;
  isHit:            boolean                  = false;
  hitFlashTimer:    number                   = 0;
  attackType:       'light' | 'heavy' | null = null;
  attackTimer:      number                   = 0;
  heavyCooldown:    number                   = 0;
  iFrames:          number                   = 0;
  facing:           { x: number; y: number } = { x: 0, y: 1 };
  lockedFacing:     { x: number; y: number } | null = null;

  // Weapon system
  equippedWeapon: Weapon | null       = null;
  lastInput:      InputHandler | null = null;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    // Initialize weapon inside constructor to avoid Turbopack
    // module resolution timing issues with field initializers
    this.equippedWeapon = new Weapon('sword');
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // ============================================================
  update(input: InputHandler) {
    // Store for WeaponSystem.processInput()
    this.lastInput = input;

    // [🧱 BRICK: Movement]
    let inputX = 0;
    let inputY = 0;
    if (input.movement.up)    inputY -= 1;
    if (input.movement.down)  inputY += 1;
    if (input.movement.left)  inputX -= 1;
    if (input.movement.right) inputX += 1;

    if (!this.isHeavyAttacking) {
      if (inputX !== 0 || inputY !== 0) {
        const len = Math.sqrt(inputX * inputX + inputY * inputY);
        inputX /= len;
        inputY /= len;
        this.vx += inputX * this.accel;
        this.vy += inputY * this.accel;
        this.facing = { x: inputX, y: inputY };
      }
    } else {
      this.vx *= 0.5;
      this.vy *= 0.5;
    }

    // [🧱 BRICK: Dash]
    if (input.movement.dash && this.stamina >= 30 && !this.isDashing && !this.isAttacking) {
      this.stamina  -= 30;
      this.isDashing = true;
      this.vx       *= 4;
      this.vy       *= 4;
      setTimeout(() => { this.isDashing = false; }, 200);
    }

    // [🧱 BRICK: Attack Timer]
    if (this.isAttacking) {
      this.attackTimer -= 16;
      if (this.attackTimer <= 0) {
        this.isAttacking      = false;
        this.isHeavyAttacking = false;
        this.lockedFacing     = null;
        this.attackType       = null;
      }
    }

    // [🧱 BRICK: Physics]
    this.vx *= this.friction;
    this.vy *= this.friction;
    const speed    = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    const topSpeed = this.isDashing ? 20 : this.maxSpeed;
    if (speed > topSpeed) {
      this.vx = (this.vx / speed) * topSpeed;
      this.vy = (this.vy / speed) * topSpeed;
    }
    this.x += this.vx;
    this.y += this.vy;

    // [🧱 BRICK: Resources]
    if (this.stamina < this.maxStamina) this.stamina += 0.4;
    if (this.heavyCooldown  > 0) this.heavyCooldown  -= 16;
    if (this.iFrames        > 0) this.iFrames        -= 16;
    if (this.hitFlashTimer  > 0) {
      this.hitFlashTimer -= 16;
      if (this.hitFlashTimer <= 0) this.isHit = false;
    }
  }

  // ============================================================
  // [🧱 BLOCK: Start Weapon Attack]
  // Called by WeaponSystem.processInput() — never call directly.
  // ============================================================
  startWeaponAttack(mode: 'light' | 'heavy', atk: AttackDef): void {
    this.stamina      -= atk.staminaCost;
    this.isAttacking   = true;
    this.attackType    = mode;
    this.attackTimer   = atk.duration;

    if (mode === 'heavy') {
      this.heavyCooldown    = atk.cooldown;
      this.isHeavyAttacking = true;
      this.lockedFacing     = { ...this.facing };
    }
    if (mode === 'light') {
      this.vx += this.facing.x * 6;
      this.vy += this.facing.y * 6;
    }
  }

  // ============================================================
  // [🧱 BLOCK: Take Hit]
  // ============================================================
  takeHit(amount: number): void {
    if (this.iFrames > 0) return;
    this.hp            = Math.max(0, this.hp - amount);
    this.isHit         = true;
    this.hitFlashTimer = amount >= 25 ? 300 : 150;
    this.iFrames       = amount >= 25 ? 800 : 600;
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    // Flicker during i-frames (not during hit flash)
    if (!this.isHit && this.iFrames > 0 && Math.floor(Date.now() / 50) % 2 === 0) {
      return;
    }

    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);

    // Player body
    ctx.fillStyle = this.isHit
      ? "#ffffff"
      : this.isDashing
        ? "#38bdf8"
        : "#f87171";
    ctx.fillRect(sx, sy, this.width, this.height);

    // HP bar
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(sx, sy - 15, this.width, 4);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(sx, sy - 15, (this.hp / this.maxHp) * this.width, 4);

    // Stamina bar
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(sx, sy - 9, this.width, 4);
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(sx, sy - 9, (this.stamina / this.maxStamina) * this.width, 4);
  }
}