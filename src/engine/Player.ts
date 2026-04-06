// src/engine/Player.ts
import { InputHandler } from "./Input";
import { Camera }       from "./Camera";
import { Weapon }       from "./items/Weapon";
import { AttackDef }    from "./items/types";

// ============================================================
// [🧱 BLOCK: Dash Constants]
// DASH_DURATION  — how long the dash lasts in ms (matches old setTimeout)
// DASH_IFRAMES   — invincibility window granted during a dash.
//                  Slightly shorter than the full dash so the tail end
//                  of the slide can still be punished.
// ============================================================
const DASH_DURATION = 200;
const DASH_IFRAMES  = 180;

export class Player {
  // [🧱 BLOCK: Properties]
  x: number; y: number;
  width:  number = 32;
  height: number = 32;
  vx: number = 0; vy: number = 0;

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
  dashTimer:        number                   = 0;   // counts down in update()
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

  // Weapon — initialized in constructor to avoid Turbopack issues
  equippedWeapon: Weapon;
  lastInput:      InputHandler | null = null;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    // Default bare fists — no weapon equipped
    this.equippedWeapon = new Weapon('fists');
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // ============================================================
  update(input: InputHandler) {
    this.lastInput = input;

    // Movement
    let inputX = 0; let inputY = 0;
    if (input.movement.up)    inputY -= 1;
    if (input.movement.down)  inputY += 1;
    if (input.movement.left)  inputX -= 1;
    if (input.movement.right) inputX += 1;

    if (!this.isHeavyAttacking) {
      if (inputX !== 0 || inputY !== 0) {
        const len   = Math.sqrt(inputX * inputX + inputY * inputY);
        inputX /= len; inputY /= len;
        this.vx += inputX * this.accel;
        this.vy += inputY * this.accel;
        this.facing = { x: inputX, y: inputY };
      }
    } else {
      this.vx *= 0.5;
      this.vy *= 0.5;
    }

    // ── Dash ─────────────────────────────────────────────────
    // Trigger: C pressed, enough stamina, not already dashing/attacking.
    // Uses dashTimer (decremented below) instead of setTimeout so the
    // dash respects pause state and never fires after game-over.
    // Grants DASH_IFRAMES of invincibility so the player can dodge
    // through projectiles and melee attacks.
    if (input.movement.dash && this.stamina >= 30 && !this.isDashing && !this.isAttacking) {
      this.stamina   -= 30;
      this.isDashing  = true;
      this.dashTimer  = DASH_DURATION;
      this.iFrames    = Math.max(this.iFrames, DASH_IFRAMES); // don't shorten existing iframes
      this.vx        *= 4;
      this.vy        *= 4;
    }

    // Tick dash timer
    if (this.isDashing) {
      this.dashTimer -= 16;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
        this.dashTimer = 0;
      }
    }

    // Attack timer
    if (this.isAttacking) {
      this.attackTimer -= 16;
      if (this.attackTimer <= 0) {
        this.isAttacking      = false;
        this.isHeavyAttacking = false;
        this.lockedFacing     = null;
        this.attackType       = null;
      }
    }

    // Physics
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

    // Resources
    if (this.stamina < this.maxStamina) this.stamina += 0.4;
    if (this.heavyCooldown > 0) this.heavyCooldown  -= 16;
    if (this.iFrames       > 0) this.iFrames        -= 16;
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= 16;
      if (this.hitFlashTimer <= 0) this.isHit = false;
    }
  }

  // ============================================================
  // [🧱 BLOCK: Start Weapon Attack]
  // Called by WeaponSystem.processInput() only.
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
  // iFrames from a hit do not override a longer dash iFrame window.
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
  // During a dash, render a faint afterimage trail effect by
  // drawing the player slightly more transparent.
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    // Flicker during hit i-frames (not during dash i-frames —
    // the dash has its own blue color cue instead)
    if (!this.isHit && this.iFrames > 0 && !this.isDashing && Math.floor(Date.now() / 50) % 2 === 0) {
      return;
    }

    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);

    // ── Dash afterimage ──────────────────────────────────────
    // Draw a faded ghost slightly behind the player to sell the
    // speed of the dodge without any extra data structures.
    if (this.isDashing) {
      const progress = this.dashTimer / DASH_DURATION; // 1→0 as dash ends
      ctx.globalAlpha = 0.25 * progress;
      ctx.fillStyle   = "#38bdf8";
      ctx.fillRect(sx - this.vx * 2, sy - this.vy * 2, this.width, this.height);
      ctx.globalAlpha = 1;
    }

    // Body
    ctx.fillStyle = this.isHit
      ? "#ffffff"
      : this.isDashing
        ? "#38bdf8"
        : "#f87171";
    ctx.fillRect(sx, sy, this.width, this.height);
  }
}