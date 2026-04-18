// src/engine/Player.ts
import { InputHandler } from "./Input";
import { Camera }       from "./Camera";
import { Weapon }       from "./items/Weapon";
import { AttackDef }    from "./items/types";

// ============================================================
// [🧱 BLOCK: Constants]
// ============================================================
const DASH_DURATION = 200;
const DASH_IFRAMES  = 180;

const CHARGE_LIGHT_THRESHOLD = 400;
const CHARGE_HEAVY_THRESHOLD = 600;
const CHARGE_LIGHT_SPEED_MULT = 0.60;

// Block / Parry timing
const PARRY_TAP_MAX_MS  = 220;   // press under this → parry on release
const PARRY_WINDOW_MS   = 500;   // active parry hitbox window
const PARRY_COOLDOWN_MS = 600;   // lockout after any parry attempt

// Block stamina costs
const BLOCK_ENTRY_COST  = 20;    // upfront cost when entering blocking stance
const BLOCK_HOLD_DRAIN  = 0.3;   // stamina drained per frame while held (~18/s)
const BLOCK_HIT_COST    = 12;    // stamina drained per hit absorbed
const BLOCK_HIT_IFRAMES = 300;   // iFrames after absorbing a hit (prevents double-hits)

// ============================================================
// [🧱 BLOCK: Combat State Types]
// ============================================================
export type ChargeState =
  | 'none'
  | 'charging_light'
  | 'charged_light'
  | 'charging_heavy'
  | 'charged_heavy';

export type BlockState =
  | 'none'
  | 'parry_startup'
  | 'parrying'
  | 'parry_cooldown'
  | 'blocking';

// ============================================================
// [🧱 BLOCK: Player Class]
// ============================================================
export class Player {
  x: number; y: number;
  width:  number = 32;
  height: number = 32;
  vx: number = 0; vy: number = 0;

  accel:    number = 0.8;
  friction: number = 0.85;
  maxSpeed: number = 5;

  hp:         number = 100;
  maxHp:      number = 100;
  maxStamina: number = 100;
  stamina:    number = 100;

  isDashing:        boolean                  = false;
  dashTimer:        number                   = 0;
  dashCost:         number                   = 30;
  isAttacking:      boolean                  = false;
  isHeavyAttacking: boolean                  = false;
  isHit:            boolean                  = false;
  hitFlashTimer:    number                   = 0;
  attackType:       'light' | 'heavy' | 'charged_light' | 'charged_heavy' | null = null;
  attackTimer:      number                   = 0;
  heavyCooldown:    number                   = 0;
  iFrames:          number                   = 0;
  facing:           { x: number; y: number } = { x: 0, y: 1 };
  lockedFacing:     { x: number; y: number } | null = null;

  chargeState:  ChargeState = 'none';
  chargeTimer:  number      = 0;
  chargeVisual: number      = 0;

  blockState:   BlockState  = 'none';
  blockTimer:   number      = 0;
  parrySuccess: boolean     = false;

  equippedWeapon: Weapon;
  lastInput:      InputHandler | null = null;

  private prevLight: boolean = false;
  private prevHeavy: boolean = false;
  private prevBlock: boolean = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.equippedWeapon = new Weapon('fists');
  }

  // ============================================================
  // [🧱 BLOCK: Derived Helpers]
  // ============================================================
  get isBlocking(): boolean { return this.blockState === 'blocking'; }
  get isParrying(): boolean { return this.blockState === 'parrying'; }

  get isChargingLight(): boolean {
    return this.chargeState === 'charging_light' || this.chargeState === 'charged_light';
  }
  get isChargingHeavy(): boolean {
    return this.chargeState === 'charging_heavy' || this.chargeState === 'charged_heavy';
  }
  get chargedLightReady(): boolean { return this.chargeState === 'charged_light'; }
  get chargedHeavyReady(): boolean { return this.chargeState === 'charged_heavy'; }

  // ============================================================
  // [🧱 BLOCK: Update]
  // ============================================================
  update(input: InputHandler) {
    this.lastInput    = input;
    this.parrySuccess = false;

    const mov        = input.movement;
    const lightDown  = mov.light;
    const heavyDown  = mov.heavy;
    const blockDown  = mov.block;

    const lightJustPressed  = lightDown  && !this.prevLight;
    const lightJustReleased = !lightDown && this.prevLight;
    const heavyJustPressed  = heavyDown  && !this.prevHeavy;
    const heavyJustReleased = !heavyDown && this.prevHeavy;
    const blockJustPressed  = blockDown  && !this.prevBlock;
    const blockJustReleased = !blockDown && this.prevBlock;

    this.updateBlockParry(blockDown, blockJustPressed, blockJustReleased);
    this.updateCharge(
      lightDown, lightJustPressed, lightJustReleased,
      heavyDown, heavyJustPressed, heavyJustReleased
    );

    // ── Continuous block stamina drain ────────────────────────
    // Holding block drains stamina every frame. If it hits 0,
    // the block breaks — the player cannot hold indefinitely.
    if (this.blockState === 'blocking') {
      this.stamina -= BLOCK_HOLD_DRAIN;
      if (this.stamina <= 0) {
        this.stamina    = 0;
        this.blockState = 'none';
        this.blockTimer = 0;
      }
    }

    // ── Effective speed cap ───────────────────────────────────
    let speedMult = 1.0;
    if (this.isBlocking || this.isParrying) speedMult = 0.30;
    else if (this.isChargingLight)          speedMult = CHARGE_LIGHT_SPEED_MULT;

    // ── Movement ──────────────────────────────────────────────
    const movementLocked = this.isHeavyAttacking || this.isChargingHeavy;

    let inputX = 0; let inputY = 0;
    if (!movementLocked) {
      if (mov.up)    inputY -= 1;
      if (mov.down)  inputY += 1;
      if (mov.left)  inputX -= 1;
      if (mov.right) inputX += 1;
    }

    if (inputX !== 0 || inputY !== 0) {
      const len = Math.sqrt(inputX * inputX + inputY * inputY);
      inputX /= len; inputY /= len;
      this.vx += inputX * this.accel;
      this.vy += inputY * this.accel;
      if (!this.isHeavyAttacking && !this.isChargingHeavy) {
        this.facing = { x: inputX, y: inputY };
      }
    } else if (movementLocked) {
      this.vx *= 0.5;
      this.vy *= 0.5;
    }

    // ── Dash ──────────────────────────────────────────────────
    if (mov.dash && this.stamina >= this.dashCost && !this.isDashing && !this.isAttacking) {
      if (this.chargeState !== 'none') this.chargeState = 'none';
      this.stamina   -= this.dashCost;
      this.isDashing  = true;
      this.dashTimer  = DASH_DURATION;
      this.iFrames    = Math.max(this.iFrames, DASH_IFRAMES);
      this.vx        *= 4;
      this.vy        *= 4;
    }

    if (this.isDashing) {
      this.dashTimer -= 16;
      if (this.dashTimer <= 0) { this.isDashing = false; this.dashTimer = 0; }
    }

    // ── Attack timer tick ─────────────────────────────────────
    if (this.isAttacking) {
      this.attackTimer -= 16;
      if (this.attackTimer <= 0) {
        this.isAttacking      = false;
        this.isHeavyAttacking = false;
        this.lockedFacing     = null;
        this.attackType       = null;
      }
    }

    // ── Physics ───────────────────────────────────────────────
    this.vx *= this.friction;
    this.vy *= this.friction;
    const speed    = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    const topSpeed = this.isDashing ? 20 : this.maxSpeed * speedMult;
    if (speed > topSpeed) {
      this.vx = (this.vx / speed) * topSpeed;
      this.vy = (this.vy / speed) * topSpeed;
    }
    this.x += this.vx;
    this.y += this.vy;

    // ── Resources ─────────────────────────────────────────────
    // Stamina regen is handled by HordeSystem / BossSystem using
    // ps.staminaRegenRate so charm multipliers (Overclock, Berserker)
    // are respected. Player.update() must NOT add a second regen tick.
    if (this.heavyCooldown > 0) this.heavyCooldown  -= 16;
    if (this.iFrames       > 0) this.iFrames        -= 16;
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= 16;
      if (this.hitFlashTimer <= 0) this.isHit = false;
    }

    if (this.chargeState !== 'none') this.chargeVisual += 16;
    else                              this.chargeVisual  = 0;

    this.prevLight = lightDown;
    this.prevHeavy = heavyDown;
    this.prevBlock = blockDown;
  }

  // ============================================================
  // [🧱 BLOCK: Block / Parry State Machine]
  // Tap L  (< PARRY_TAP_MAX_MS)  → active parry window
  // Hold L (≥ PARRY_TAP_MAX_MS)  → blocking stance
  //
  // Entering blocking costs BLOCK_ENTRY_COST stamina upfront.
  // If the player can't afford it, the attempt is rejected with
  // a short cooldown — empty-stamina spam grants no protection.
  // ============================================================
  private updateBlockParry(
    blockDown:        boolean,
    blockJustPressed: boolean,
    blockJustReleased:boolean
  ): void {
    switch (this.blockState) {

      case 'none':
        if (blockJustPressed && !this.isAttacking && !this.isDashing) {
          this.blockState = 'parry_startup';
          this.blockTimer = 0;
        }
        break;

      case 'parry_startup':
        this.blockTimer += 16;
        if (blockJustReleased) {
          if (this.blockTimer <= PARRY_TAP_MAX_MS) {
            // Quick tap → enter active parry window
            this.blockState = 'parrying';
            this.blockTimer = 0;
          } else {
            // Slow release → no reward
            this.blockState = 'parry_cooldown';
            this.blockTimer = PARRY_COOLDOWN_MS;
          }
        } else if (this.blockTimer > PARRY_TAP_MAX_MS) {
          // Still held → try to enter block stance
          if (this.stamina >= BLOCK_ENTRY_COST) {
            this.stamina   -= BLOCK_ENTRY_COST;
            this.blockState = 'blocking';
          } else {
            // Not enough stamina to block — short penalty
            this.blockState = 'parry_cooldown';
            this.blockTimer = 300;
          }
          this.blockTimer = 0;
        }
        break;

      case 'parrying':
        this.blockTimer += 16;
        if (this.blockTimer >= PARRY_WINDOW_MS) {
          this.blockState = 'parry_cooldown';
          this.blockTimer = PARRY_COOLDOWN_MS;
        }
        break;

      case 'parry_cooldown':
        this.blockTimer -= 16;
        if (this.blockTimer <= 0) {
          this.blockState = 'none';
          this.blockTimer = 0;
        }
        break;

      case 'blocking':
        if (!blockDown) {
          this.blockState = 'none';
          this.blockTimer = 0;
        }
        break;
    }
  }

  // ============================================================
  // [🧱 BLOCK: Charge State Machine]
  // ============================================================
  private updateCharge(
    lightDown:        boolean,
    lightJustPressed: boolean,
    lightJustReleased:boolean,
    heavyDown:        boolean,
    heavyJustPressed: boolean,
    heavyJustReleased:boolean
  ): void {
    const blocked = this.isBlocking || this.isParrying || this.isAttacking || this.isDashing;

    switch (this.chargeState) {
      case 'none':
        if (!blocked) {
          if (lightJustPressed) {
            this.chargeState = 'charging_light';
            this.chargeTimer = 0;
          } else if (heavyJustPressed && this.heavyCooldown <= 0) {
            this.chargeState = 'charging_heavy';
            this.chargeTimer = 0;
          }
        }
        break;

      case 'charging_light':
        this.chargeTimer += 16;
        if (!lightDown) {
          this.fireNormalAttack('light');
          this.chargeState = 'none';
          this.chargeTimer = 0;
        } else if (this.chargeTimer >= CHARGE_LIGHT_THRESHOLD) {
          this.chargeState = 'charged_light';
        }
        break;

      case 'charged_light':
        this.chargeTimer += 16;
        if (!lightDown) {
          this.fireChargedAttack('light');
          this.chargeState = 'none';
          this.chargeTimer = 0;
        }
        break;

      case 'charging_heavy':
        this.chargeTimer += 16;
        if (!heavyDown) {
          if (this.heavyCooldown <= 0) this.fireNormalAttack('heavy');
          this.chargeState = 'none';
          this.chargeTimer = 0;
        } else if (this.chargeTimer >= CHARGE_HEAVY_THRESHOLD) {
          this.chargeState = 'charged_heavy';
        }
        break;

      case 'charged_heavy':
        this.chargeTimer += 16;
        if (!heavyDown) {
          this.fireChargedAttack('heavy');
          this.chargeState = 'none';
          this.chargeTimer = 0;
        }
        break;
    }
  }

  // ============================================================
  // [🧱 BLOCK: Fire Normal Attack]
  // ============================================================
  private fireNormalAttack(mode: 'light' | 'heavy'): void {
    if (!this.equippedWeapon) return;
    const atk = this.equippedWeapon.getAttack(mode);
    if (this.stamina < atk.staminaCost) return;
    this.startWeaponAttack(mode, atk);
  }

  // ============================================================
  // [🧱 BLOCK: Fire Charged Attack]
  // ============================================================
  private fireChargedAttack(mode: 'light' | 'heavy'): void {
    if (!this.equippedWeapon) return;
    const atk  = this.equippedWeapon.getAttack(mode);
    const cost = Math.round(atk.staminaCost * 1.5);
    if (this.stamina < cost) {
      this.fireNormalAttack(mode);
      return;
    }
    this.stamina -= cost;
    this.isAttacking   = true;
    this.attackType    = mode === 'light' ? 'charged_light' : 'charged_heavy';
    this.attackTimer   = Math.round(atk.duration * 1.4);
    if (mode === 'heavy') {
      this.heavyCooldown    = atk.cooldown;
      this.isHeavyAttacking = true;
      this.lockedFacing     = { ...this.facing };
    }
    if (mode === 'light') {
      this.vx += this.facing.x * 4;
      this.vy += this.facing.y * 4;
    }
  }

  // ============================================================
  // [🧱 BLOCK: Start Weapon Attack]
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
  // [🧱 BLOCK: Parry Hit]
  // Consumes the parry window and returns true on success.
  // ============================================================
  tryParry(): boolean {
    if (this.blockState !== 'parrying') return false;
    this.parrySuccess = true;
    this.blockState   = 'parry_cooldown';
    this.blockTimer   = PARRY_COOLDOWN_MS;
    return true;
  }

  // ============================================================
  // [🧱 BLOCK: Block Hit]
  // Returns 0 (full absorption) while blocking with stamina.
  // The stamina drain IS the cost — no HP damage on a clean block.
  // Grants brief iFrames so the same swing can't register twice.
  // Returns full rawDamage if block is broken (stamina = 0).
  // ============================================================
  applyBlockedHit(rawDamage: number): number {
    if (this.blockState !== 'blocking') return rawDamage;

    // Block shatters if stamina is already gone
    if (this.stamina <= 0) {
      this.blockState = 'none';
      this.blockTimer = 0;
      return rawDamage;
    }

    this.stamina = Math.max(0, this.stamina - BLOCK_HIT_COST);
    this.iFrames = Math.max(this.iFrames, BLOCK_HIT_IFRAMES);

    // If the last hit drained stamina to 0, break the block
    if (this.stamina <= 0) {
      this.blockState = 'none';
      this.blockTimer = 0;
    }

    return 0;   // full absorption — no HP damage
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
    if (!this.isHit && this.iFrames > 0 && !this.isDashing && Math.floor(Date.now() / 50) % 2 === 0) {
      return;
    }

    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);
    const cx = sx + this.width  / 2;
    const cy = sy + this.height / 2;

    // ── Dash afterimage ──────────────────────────────────────
    if (this.isDashing) {
      const progress = this.dashTimer / DASH_DURATION;
      ctx.globalAlpha = 0.25 * progress;
      ctx.fillStyle   = "#38bdf8";
      ctx.fillRect(sx - this.vx * 2, sy - this.vy * 2, this.width, this.height);
      ctx.globalAlpha = 1;
    }

    // ── Charge glow ring ─────────────────────────────────────
    if (this.chargeState !== 'none') {
      const isLight  = this.chargeState === 'charging_light' || this.chargeState === 'charged_light';
      const isReady  = this.chargeState === 'charged_light'  || this.chargeState === 'charged_heavy';
      const pulse    = Math.sin(this.chargeVisual / (isReady ? 60 : 120)) * 0.35 + 0.65;
      const progress = isLight
        ? Math.min(this.chargeTimer / CHARGE_LIGHT_THRESHOLD, 1)
        : Math.min(this.chargeTimer / CHARGE_HEAVY_THRESHOLD, 1);
      const radius   = 24 + progress * 18;
      const color    = isLight ? `rgba(255,255,255,${pulse * 0.85})` : `rgba(251,191,36,${pulse * 0.9})`;

      ctx.beginPath();
      ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = isLight ? `rgba(255,255,255,${pulse * 0.25})` : `rgba(251,191,36,${pulse * 0.25})`;
      ctx.lineWidth   = 6;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth   = isReady ? 3 : 2;
      ctx.stroke();

      if (isReady) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius - 4, 0, Math.PI * 2);
        ctx.fillStyle = isLight ? `rgba(255,255,255,${pulse * 0.08})` : `rgba(251,191,36,${pulse * 0.10})`;
        ctx.fill();
      }
    }

    // ── Block / Parry visual ──────────────────────────────────
    if (this.blockState === 'parrying') {
      const progress = this.blockTimer / PARRY_WINDOW_MS;
      const alpha    = 1 - progress;
      const pulse    = Math.sin(Date.now() / 60) * 0.15 + 0.85;
      ctx.beginPath();
      ctx.arc(cx, cy, 30, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(56,189,248,${alpha * pulse})`;
      ctx.lineWidth   = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(56,189,248,${alpha * 0.18})`;
      ctx.fill();
    }

    if (this.blockState === 'blocking') {
      // Shield ring dims as stamina depletes — visual warning before break
      const staminaPct = Math.max(0, this.stamina / this.maxStamina);
      const pulse      = Math.sin(Date.now() / 200) * 0.2 + 0.6;
      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(148,163,184,${pulse * staminaPct})`;
      ctx.lineWidth   = 2 + staminaPct * 2;
      ctx.stroke();
    }

    // ── Parry success flash ───────────────────────────────────
    if (this.parrySuccess) {
      ctx.beginPath();
      ctx.arc(cx, cy, 44, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(56,189,248,0.45)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 44, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(56,189,248,0.9)";
      ctx.lineWidth   = 2;
      ctx.stroke();
    }

    // ── Body ─────────────────────────────────────────────────
    ctx.fillStyle =
      this.isHit                            ? "#ffffff"  :
      this.isDashing                        ? "#38bdf8"  :
      this.blockState === 'parrying'        ? "#7dd3fc"  :
      this.blockState === 'blocking'        ? "#94a3b8"  :
      this.chargeState === 'charged_light'  ? "#e2e8f0"  :
      this.chargeState === 'charged_heavy'  ? "#fde68a"  :
      this.isChargingLight || this.isChargingHeavy ? "#fca5a5" :
      "#f87171";
    ctx.fillRect(sx, sy, this.width, this.height);

    // ── HP bar ───────────────────────────────────────────────
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(sx, sy - 15, this.width, 4);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(sx, sy - 15, (this.hp / this.maxHp) * this.width, 4);

    // ── Stamina bar ───────────────────────────────────────────
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(sx, sy - 9, this.width, 4);
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(sx, sy - 9, (this.stamina / this.maxStamina) * this.width, 4);
  }
}