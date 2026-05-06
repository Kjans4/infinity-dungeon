// src/engine/Player.ts
import { InputHandler }     from "./Input";
import { Camera }           from "./Camera";
import { Weapon }           from "./items/Weapon";
import { AttackDef }        from "./items/types";
import { getPlayerSprites } from "./PlayerSprites";

// ============================================================
// [🧱 BLOCK: Constants]
// ============================================================
const DASH_DURATION = 200;
const DASH_IFRAMES  = 180;

const CHARGE_LIGHT_THRESHOLD  = 400;
const CHARGE_HEAVY_THRESHOLD  = 600;
const CHARGE_LIGHT_SPEED_MULT = 0.60;

// Block / Parry timing
const PARRY_TAP_MAX_MS  = 220;
const PARRY_WINDOW_MS   = 500;
const PARRY_COOLDOWN_MS = 600;

// Block stamina costs
const BLOCK_ENTRY_COST  = 20;
const BLOCK_HOLD_DRAIN  = 0.3;
const BLOCK_HIT_COST    = 12;
const BLOCK_HIT_IFRAMES = 300;

// ============================================================
// [🧱 BLOCK: Sprite Layout Constants]
// ============================================================
const HITBOX_W   = 32;
const HITBOX_H   = 32;
const DRAW_SIZE  = 100;
const DRAW_OFF_X = (HITBOX_W - DRAW_SIZE) / 2;
const DRAW_OFF_Y = (HITBOX_H - DRAW_SIZE) / 2;

// ============================================================
// [🧱 BLOCK: Idle Animation Constants]
// ============================================================
const BREATHE_AMPLITUDE = 2.0;
const BREATHE_PERIOD    = 1500;
const SWAY_AMPLITUDE    = 1.5;
const SWAY_PERIOD       = 2500;
const SWAY_PHASE_OFFSET = 800;

// ============================================================
// [🧱 BLOCK: Walk Animation Constants]
// ============================================================
const WALK_FRAME_MS     = 150;
const WALK_SPEED_THRESH = 0.3;

// ============================================================
// [🧱 BLOCK: Arm Animation Constants]
// ============================================================
const ARM_WALK_MAX_ANGLE = 20;
const ARM_WALK_PERIOD    = WALK_FRAME_MS * 2;
const PUNCH_TRAVEL       = 14;
const PUNCH_OUT_MS       = 80;
const PUNCH_BACK_MS      = 120;
const PUNCH_TOTAL_MS     = PUNCH_OUT_MS + PUNCH_BACK_MS;
const CHARGE_PULL_MAX    = 10;

// ============================================================
// [🧱 BLOCK: Sword Arc Constants]
// Arc sweeps from START_DEG to END_DEG around the grip pivot.
// Always same rotational direction regardless of facing.
// Light: ±60°  Heavy: ±80°
// Grip pivot sits at ~35% from left, 50% from top of the
// 100px draw rect — center of the guard in the sprite.
// ============================================================
const SWORD_PIVOT_X      = DRAW_SIZE * 0.35;  // 35px — guard horizontal
const SWORD_PIVOT_Y      = DRAW_SIZE * 0.50;  // 50px — guard vertical

const SWORD_ARC_LIGHT_START = -60;   // degrees
const SWORD_ARC_LIGHT_END   =  60;
const SWORD_ARC_HEAVY_START = -80;
const SWORD_ARC_HEAVY_END   =  80;

// Attack durations used to compute sweep progress
const SWORD_LIGHT_DURATION        = 300;   // ms — must match Weapon.ts fists light duration
const SWORD_HEAVY_DURATION        = 450;
const SWORD_CHARGED_LIGHT_DURATION= Math.round(SWORD_LIGHT_DURATION * 1.4);
const SWORD_CHARGED_HEAVY_DURATION= Math.round(SWORD_HEAVY_DURATION * 1.4);

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
  width:  number = HITBOX_W;
  height: number = HITBOX_H;
  vx: number = 0; vy: number = 0;

  accel:    number = 0.8;
  friction: number = 0.85;
  maxSpeed: number = 5;

  hp:         number = 100;
  maxHp:      number = 100;
  maxStamina: number = 100;
  stamina:    number = 100;

  isDashing:        boolean = false;
  dashTimer:        number  = 0;
  dashCost:         number  = 30;
  isAttacking:      boolean = false;
  isHeavyAttacking: boolean = false;
  isHit:            boolean = false;
  hitFlashTimer:    number  = 0;
  attackType:       'light' | 'heavy' | 'charged_light' | 'charged_heavy' | null = null;
  attackTimer:      number  = 0;
  attackDuration:   number  = 0;   // total duration of current attack — for sword sweep progress
  heavyCooldown:    number  = 0;
  iFrames:          number  = 0;
  facing:           { x: number; y: number } = { x: 0, y: 1 };
  lockedFacing:     { x: number; y: number } | null = null;

  chargeState:  ChargeState = 'none';
  chargeTimer:  number      = 0;
  chargeVisual: number      = 0;

  blockState:   BlockState = 'none';
  blockTimer:   number     = 0;
  parrySuccess: boolean    = false;

  // ============================================================
  // [🧱 BLOCK: Consumable State Flags]
  // ============================================================
  isInvisible: boolean = false;

  equippedWeapon: Weapon;
  lastInput:      InputHandler | null = null;

  private prevLight: boolean = false;
  private prevHeavy: boolean = false;
  private prevBlock: boolean = false;

  // ============================================================
  // [🧱 BLOCK: Animation State]
  // ============================================================
  private walkTimer:  number = 0;
  private walkFrame:  number = 0;
  private animClock:  number = 0;

  // Arm animation
  private punchArm:     'right' | 'left' = 'right';
  private punchTimer:   number           = 0;
  private punchingArm:  'right' | 'left' = 'right';
  private walkArmAngle: number           = 0;
  private walkArmDir:   number           = 1;

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
  // [🧱 BLOCK: Sword Equipped Check]
  // ============================================================
  private get hasSword(): boolean {
    return this.equippedWeapon.type === 'sword';
  }

  // ============================================================
  // [🧱 BLOCK: Sword Sweep Angle]
  // Returns the current sword rotation in degrees based on
  // attackTimer progress through the attack duration.
  // Returns null when not attacking (idle/walk position).
  // ============================================================
  private getSwordSwingAngle(): number | null {
    if (!this.isAttacking || !this.attackType) return null;

    const isHeavy   = this.attackType === 'heavy' || this.attackType === 'charged_heavy';
    const startDeg  = isHeavy ? SWORD_ARC_HEAVY_START : SWORD_ARC_LIGHT_START;
    const endDeg    = isHeavy ? SWORD_ARC_HEAVY_END   : SWORD_ARC_LIGHT_END;

    // attackTimer counts DOWN from attackDuration to 0
    // progress 0 = start of attack, 1 = end
    const progress  = this.attackDuration > 0
      ? 1 - (this.attackTimer / this.attackDuration)
      : 0;
    const clamped   = Math.max(0, Math.min(1, progress));

    // Ease-in-out for a natural arc feel
    const eased = clamped < 0.5
      ? 2 * clamped * clamped
      : 1 - Math.pow(-2 * clamped + 2, 2) / 2;

    return startDeg + (endDeg - startDeg) * eased;
  }

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
        this.attackDuration   = 0;
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
    if (this.heavyCooldown > 0) this.heavyCooldown  -= 16;
    if (this.iFrames       > 0) this.iFrames        -= 16;
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= 16;
      if (this.hitFlashTimer <= 0) this.isHit = false;
    }

    if (this.chargeState !== 'none') this.chargeVisual += 16;
    else                              this.chargeVisual  = 0;

    // ── Walk animation ────────────────────────────────────────
    const isMoving = Math.abs(this.vx) + Math.abs(this.vy) > WALK_SPEED_THRESH;
    if (isMoving) {
      this.walkTimer += 16;
      if (this.walkTimer >= WALK_FRAME_MS) {
        this.walkTimer = 0;
        this.walkFrame = this.walkFrame === 0 ? 1 : 0;
      }
    } else {
      this.walkTimer = 0;
      this.walkFrame = 0;
    }

    this.animClock += 16;
    this.updateArmAnimation(isMoving);

    this.prevLight = lightDown;
    this.prevHeavy = heavyDown;
    this.prevBlock = blockDown;
  }

  // ============================================================
  // [🧱 BLOCK: Arm Animation Tick]
  // ============================================================
  private updateArmAnimation(isMoving: boolean): void {
    if (this.punchTimer > 0) {
      this.punchTimer = Math.max(0, this.punchTimer - 16);
    }

    if (isMoving) {
      this.walkArmAngle += this.walkArmDir * (ARM_WALK_MAX_ANGLE * 2 / (ARM_WALK_PERIOD / 16));
      if (this.walkArmAngle >=  ARM_WALK_MAX_ANGLE) {
        this.walkArmAngle =  ARM_WALK_MAX_ANGLE;
        this.walkArmDir   = -1;
      } else if (this.walkArmAngle <= -ARM_WALK_MAX_ANGLE) {
        this.walkArmAngle = -ARM_WALK_MAX_ANGLE;
        this.walkArmDir   =  1;
      }
    } else {
      this.walkArmAngle *= 0.82;
      if (Math.abs(this.walkArmAngle) < 0.5) this.walkArmAngle = 0;
    }
  }

  // ============================================================
  // [🧱 BLOCK: Trigger Punch Animation]
  // ============================================================
  private triggerPunchAnimation(): void {
    this.punchingArm = this.punchArm;
    this.punchTimer  = PUNCH_TOTAL_MS;
    this.punchArm    = this.punchArm === 'right' ? 'left' : 'right';
  }

  // ============================================================
  // [🧱 BLOCK: Block / Parry State Machine]
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
            this.blockState = 'parrying';
            this.blockTimer = 0;
          } else {
            this.blockState = 'parry_cooldown';
            this.blockTimer = PARRY_COOLDOWN_MS;
          }
        } else if (this.blockTimer > PARRY_TAP_MAX_MS) {
          if (this.stamina >= BLOCK_ENTRY_COST) {
            this.stamina   -= BLOCK_ENTRY_COST;
            this.blockState = 'blocking';
          } else {
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
    if (!this.hasSword) this.triggerPunchAnimation();
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
    this.attackDuration = mode === 'light'
      ? SWORD_CHARGED_LIGHT_DURATION
      : SWORD_CHARGED_HEAVY_DURATION;
    this.attackTimer   = this.attackDuration;
    if (mode === 'heavy') {
      this.heavyCooldown    = atk.cooldown;
      this.isHeavyAttacking = true;
      this.lockedFacing     = { ...this.facing };
    }
    if (mode === 'light') {
      this.vx += this.facing.x * 4;
      this.vy += this.facing.y * 4;
    }
    if (!this.hasSword) this.triggerPunchAnimation();
  }

  // ============================================================
  // [🧱 BLOCK: Start Weapon Attack]
  // ============================================================
  startWeaponAttack(mode: 'light' | 'heavy', atk: AttackDef): void {
    this.stamina        -= atk.staminaCost;
    this.isAttacking     = true;
    this.attackType      = mode;
    this.attackDuration  = atk.duration;
    this.attackTimer     = atk.duration;
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
  // ============================================================
  applyBlockedHit(rawDamage: number): number {
    if (this.blockState !== 'blocking') return rawDamage;
    if (this.stamina <= 0) {
      this.blockState = 'none';
      this.blockTimer = 0;
      return rawDamage;
    }
    this.stamina = Math.max(0, this.stamina - BLOCK_HIT_COST);
    this.iFrames = Math.max(this.iFrames, BLOCK_HIT_IFRAMES);
    if (this.stamina <= 0) {
      this.blockState = 'none';
      this.blockTimer = 0;
    }
    return 0;
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
  // [🧱 BLOCK: Draw — Idle Offsets]
  // ============================================================
  private getIdleOffsets(isMoving: boolean): { breatheY: number; swayX: number } {
    if (isMoving) return { breatheY: 0, swayX: 0 };
    const breatheY = Math.sin((this.animClock / BREATHE_PERIOD) * Math.PI * 2)
      * BREATHE_AMPLITUDE;
    const swayX    = Math.sin(((this.animClock - SWAY_PHASE_OFFSET) / SWAY_PERIOD) * Math.PI * 2)
      * SWAY_AMPLITUDE;
    return { breatheY, swayX };
  }

  // ============================================================
  // [🧱 BLOCK: Draw — Arm Offsets]
  // ============================================================
  private getArmOffsets(
    arm:      'left' | 'right',
    isMoving: boolean,
    breatheY: number,
  ): { tx: number; ty: number; rotateDeg: number; pivotX: number; pivotY: number } {
    const facingX = this.facing.x;
    const facingY = this.facing.y;
    const pivotX  = DRAW_SIZE / 2;
    const pivotY  = DRAW_SIZE * 0.25;

    // 1. Punch translate (fists only — sword uses arc instead)
    if (!this.hasSword && this.punchTimer > 0 && this.punchingArm === arm) {
      const t = this.punchTimer;
      let travel: number;
      if (t > PUNCH_BACK_MS) {
        travel = ((t - PUNCH_BACK_MS) / PUNCH_OUT_MS) * PUNCH_TRAVEL;
      } else {
        travel = (t / PUNCH_BACK_MS) * PUNCH_TRAVEL;
      }
      return { tx: facingX * travel, ty: facingY * travel + breatheY, rotateDeg: 0, pivotX, pivotY };
    }

    // 2. Charge pull-back — right arm (both fists and sword)
    const isCharging = this.chargeState !== 'none';
    if (isCharging && arm === 'right') {
      const chargeThreshold = (this.chargeState === 'charging_heavy' || this.chargeState === 'charged_heavy')
        ? CHARGE_HEAVY_THRESHOLD
        : CHARGE_LIGHT_THRESHOLD;
      const pull = Math.min(this.chargeTimer / chargeThreshold, 1) * CHARGE_PULL_MAX;
      return { tx: -facingX * pull, ty: -facingY * pull + breatheY, rotateDeg: 0, pivotX, pivotY };
    }

    // 3. Walk pendulum
    if (isMoving) {
      const angle = arm === 'right' ? this.walkArmAngle : -this.walkArmAngle;
      return { tx: 0, ty: 0, rotateDeg: angle, pivotX, pivotY };
    }

    // 4. Idle breathe
    return { tx: 0, ty: breatheY, rotateDeg: 0, pivotX, pivotY };
  }

  // ============================================================
  // [🧱 BLOCK: Draw — Single Arm / Weapon Layer]
  // Applies translate + pivot rotation then draws the image.
  // ============================================================
  private drawImageLayer(
    ctx:    CanvasRenderingContext2D,
    img:    HTMLImageElement,
    baseX:  number,
    baseY:  number,
    opts:   { tx: number; ty: number; rotateDeg: number; pivotX: number; pivotY: number }
  ): void {
    const { tx, ty, rotateDeg, pivotX, pivotY } = opts;
    const drawX = baseX + tx;
    const drawY = baseY + ty;

    if (rotateDeg === 0) {
      ctx.drawImage(img, drawX, drawY, DRAW_SIZE, DRAW_SIZE);
      return;
    }

    const rad     = (rotateDeg * Math.PI) / 180;
    const absPixX = drawX + pivotX;
    const absPixY = drawY + pivotY;

    ctx.save();
    ctx.translate(absPixX, absPixY);
    ctx.rotate(rad);
    ctx.translate(-absPixX, -absPixY);
    ctx.drawImage(img, drawX, drawY, DRAW_SIZE, DRAW_SIZE);
    ctx.restore();
  }

  // ============================================================
  // [🧱 BLOCK: Draw — Sword Layer]
  // Sword inherits the right arm's idle/walk transforms when not
  // attacking. During an attack it overrides with the arc sweep.
  // The arc rotation pivots around the guard point (SWORD_PIVOT_X/Y).
  // ============================================================
  private drawSword(
    ctx:      CanvasRenderingContext2D,
    baseX:    number,
    baseY:    number,
    armOpts:  { tx: number; ty: number; rotateDeg: number; pivotX: number; pivotY: number },
    breatheY: number,
  ): void {
    const s = getPlayerSprites();

    const swingAngle = this.getSwordSwingAngle();

    if (swingAngle !== null) {
      // ── Attack arc — override arm transforms, use swing angle ─
      const rad     = (swingAngle * Math.PI) / 180;
      const absPixX = baseX + SWORD_PIVOT_X;
      const absPixY = baseY + breatheY + SWORD_PIVOT_Y;

      ctx.save();
      ctx.translate(absPixX, absPixY);
      ctx.rotate(rad);
      ctx.translate(-absPixX, -absPixY);
      ctx.drawImage(s.sword, baseX, baseY + breatheY, DRAW_SIZE, DRAW_SIZE);
      ctx.restore();
    } else {
      // ── Idle / walk — follow right arm exactly ────────────────
      this.drawImageLayer(ctx, s.sword, baseX, baseY, armOpts);
    }
  }

  // ============================================================
  // [🧱 BLOCK: Draw — Sprite Layers]
  // Layer order:
  //   1. feet
  //   2. left_arm  (behind body)
  //   3. body
  //   4. head
  //   5. right_arm (in front of body)
  //   6. sword     (on top of right_arm, sword only)
  // ============================================================
  private drawSpriteLayers(
    ctx:       CanvasRenderingContext2D,
    sx:        number,
    sy:        number,
    isMoving:  boolean,
    tintColor: string | null
  ): void {
    const s = getPlayerSprites();
    const { breatheY, swayX } = this.getIdleOffsets(isMoving);

    const feetImg = isMoving
      ? (this.walkFrame === 0 ? s.feetMoving1 : s.feetMoving2)
      : s.feetIdle;

    const dx = sx + DRAW_OFF_X;
    const dy = sy + DRAW_OFF_Y;
    const dw = DRAW_SIZE;
    const dh = DRAW_SIZE;

    // ── Facing flip ───────────────────────────────────────────
    const facingLeft = this.facing.x < -0.1;
    const centerX    = sx + HITBOX_W / 2;

    ctx.save();
    if (facingLeft) {
      ctx.translate(centerX, 0);
      ctx.scale(-1, 1);
      ctx.translate(-centerX, 0);
    }

    // ── 1. Feet ───────────────────────────────────────────────
    ctx.drawImage(feetImg, dx, dy, dw, dh);

    // ── 2. Left arm (behind body) ─────────────────────────────
    const leftArmOpts = this.getArmOffsets('left', isMoving, breatheY);
    this.drawImageLayer(ctx, s.leftArm, dx, dy, leftArmOpts);

    // ── 3. Body ───────────────────────────────────────────────
    ctx.drawImage(s.body, dx, dy + breatheY, dw, dh);

    // ── 4. Head ───────────────────────────────────────────────
    ctx.drawImage(s.head, dx + swayX, dy + breatheY, dw, dh);

    // ── 5. Right arm ─────────────────────────────────────────
    const rightArmOpts = this.getArmOffsets('right', isMoving, breatheY);
    this.drawImageLayer(ctx, s.rightArm, dx, dy, rightArmOpts);

    // ── 6. Sword (on top of right arm, sword equipped only) ───
    if (this.hasSword) {
      this.drawSword(ctx, dx, dy, rightArmOpts, breatheY);
    }

    // ── Tint overlay ──────────────────────────────────────────
    if (tintColor) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.drawImage(feetImg,    dx,         dy,            dw, dh);
      ctx.drawImage(s.leftArm,  dx,         dy,            dw, dh);
      ctx.drawImage(s.body,     dx,         dy + breatheY, dw, dh);
      ctx.drawImage(s.head,     dx + swayX, dy + breatheY, dw, dh);
      ctx.drawImage(s.rightArm, dx,         dy,            dw, dh);
      if (this.hasSword) ctx.drawImage(s.sword, dx, dy, dw, dh);
      ctx.globalAlpha              = 0.55;
      ctx.fillStyle                = tintColor;
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillRect(dx, dy, dw, dh);
      ctx.globalAlpha              = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.restore();
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (!this.isInvisible &&
        !this.isHit &&
        this.iFrames > 0 &&
        !this.isDashing &&
        Math.floor(Date.now() / 50) % 2 === 0) {
      return;
    }

    if (this.isInvisible) return;

    const sx = camera.toScreenX(this.x);
    const sy = camera.toScreenY(this.y);
    const cx = sx + this.width  / 2;
    const cy = sy + this.height / 2;

    const isMoving = Math.abs(this.vx) + Math.abs(this.vy) > WALK_SPEED_THRESH;

    // ── Dash afterimage ───────────────────────────────────────
    if (this.isDashing) {
      const progress = this.dashTimer / DASH_DURATION;
      ctx.globalAlpha = 0.25 * progress;
      if (getPlayerSprites().ready) {
        this.drawSpriteLayers(ctx, sx - this.vx * 2, sy - this.vy * 2, isMoving, '#38bdf8');
      } else {
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(sx - this.vx * 2, sy - this.vy * 2, this.width, this.height);
      }
      ctx.globalAlpha = 1;
    }

    // ── Charge glow ring ──────────────────────────────────────
    if (this.chargeState !== 'none') {
      const isLight  = this.chargeState === 'charging_light' || this.chargeState === 'charged_light';
      const isReady  = this.chargeState === 'charged_light'  || this.chargeState === 'charged_heavy';
      const pulse    = Math.sin(this.chargeVisual / (isReady ? 60 : 120)) * 0.35 + 0.65;
      const progress = isLight
        ? Math.min(this.chargeTimer / CHARGE_LIGHT_THRESHOLD, 1)
        : Math.min(this.chargeTimer / CHARGE_HEAVY_THRESHOLD, 1);
      const radius = 24 + progress * 18;
      const color  = isLight
        ? `rgba(255,255,255,${pulse * 0.85})`
        : `rgba(251,191,36,${pulse * 0.9})`;

      ctx.beginPath();
      ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = isLight
        ? `rgba(255,255,255,${pulse * 0.25})`
        : `rgba(251,191,36,${pulse * 0.25})`;
      ctx.lineWidth = 6;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth   = isReady ? 3 : 2;
      ctx.stroke();

      if (isReady) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius - 4, 0, Math.PI * 2);
        ctx.fillStyle = isLight
          ? `rgba(255,255,255,${pulse * 0.08})`
          : `rgba(251,191,36,${pulse * 0.10})`;
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

    // ── Tint color ────────────────────────────────────────────
    const tintColor: string | null =
      this.isHit                                              ? '#ffffff'  :
      this.isDashing                                          ? '#38bdf8'  :
      this.blockState === 'parrying'                          ? '#7dd3fc'  :
      this.blockState === 'blocking'                          ? '#94a3b8'  :
      this.chargeState === 'charged_light'                    ? '#e2e8f0'  :
      this.chargeState === 'charged_heavy'                    ? '#fde68a'  :
      (this.isChargingLight || this.isChargingHeavy)          ? '#fca5a5'  :
      null;

    // ── Sprite layers ─────────────────────────────────────────
    if (getPlayerSprites().ready) {
      this.drawSpriteLayers(ctx, sx, sy, isMoving, tintColor);
    } else {
      ctx.fillStyle = tintColor ?? '#f87171';
      ctx.fillRect(sx, sy, this.width, this.height);
    }

    // ── HP bar ────────────────────────────────────────────────
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