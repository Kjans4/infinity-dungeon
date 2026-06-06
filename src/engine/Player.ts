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
// ============================================================
const SWORD_PIVOT_X      = DRAW_SIZE * 0.35;
const SWORD_PIVOT_Y      = DRAW_SIZE * 0.50;

const SWORD_ARC_LIGHT_START = -60;
const SWORD_ARC_LIGHT_END   =  60;
const SWORD_ARC_HEAVY_START = -80;
const SWORD_ARC_HEAVY_END   =  80;

const SWORD_LIGHT_DURATION         = 300;
const SWORD_HEAVY_DURATION         = 450;
const SWORD_CHARGED_LIGHT_DURATION = Math.round(SWORD_LIGHT_DURATION * 1.4);
const SWORD_CHARGED_HEAVY_DURATION = Math.round(SWORD_HEAVY_DURATION * 1.4);

// ============================================================
// [🧱 BLOCK: State Circle Constants]
// ============================================================
const STATE_CIRCLE_RADIUS = 26;

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
  attackDuration:   number  = 0;
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
  // [🧱 BLOCK: Hit Ring State]
  // Expanding red arc shown briefly when the player takes damage.
  // ============================================================
  private hitRingTimer:    number = 0;
  private readonly HIT_RING_MS = 220;

  // ============================================================
  // [🧱 BLOCK: Per-Swing Hit Registry]
  // ============================================================
  attackHitSet: Set<object> = new Set();

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

  private punchArm:    'right' | 'left' = 'right';
  private punchTimer:  number           = 0;
  private punchingArm: 'right' | 'left' = 'right';
  private walkArmAngle: number          = 0;
  private walkArmDir:   number          = 1;

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
  // ============================================================
  private getSwordSwingAngle(): number | null {
    if (!this.isAttacking || !this.attackType) return null;

    const isHeavy  = this.attackType === 'heavy' || this.attackType === 'charged_heavy';
    const startDeg = isHeavy ? SWORD_ARC_HEAVY_START : SWORD_ARC_LIGHT_START;
    const endDeg   = isHeavy ? SWORD_ARC_HEAVY_END   : SWORD_ARC_LIGHT_END;

    const progress = this.attackDuration > 0
      ? 1 - (this.attackTimer / this.attackDuration)
      : 0;
    const clamped  = Math.max(0, Math.min(1, progress));

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

    // ── Speed multiplier ──────────────────────────────────────
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

    // ── Attack timer ──────────────────────────────────────────
    if (this.isAttacking) {
      this.attackTimer -= 16;
      if (this.attackTimer <= 0) {
        this.isAttacking      = false;
        this.isHeavyAttacking = false;
        this.lockedFacing     = null;
        this.attackType       = null;
        this.attackDuration   = 0;
        this.attackHitSet.clear();
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

    // ── Timers ────────────────────────────────────────────────
    if (this.heavyCooldown > 0) this.heavyCooldown  -= 16;
    if (this.iFrames       > 0) this.iFrames        -= 16;
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= 16;
      if (this.hitFlashTimer <= 0) this.isHit = false;
    }
    if (this.hitRingTimer  > 0) this.hitRingTimer   -= 16;

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
    this.isAttacking    = true;
    this.attackType     = mode === 'light' ? 'charged_light' : 'charged_heavy';
    this.attackDuration = mode === 'light'
      ? SWORD_CHARGED_LIGHT_DURATION
      : SWORD_CHARGED_HEAVY_DURATION;
    this.attackTimer = this.attackDuration;
    this.attackHitSet.clear();
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
    this.attackHitSet.clear();
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
  // Also triggers the hit ring visual.
  // ============================================================
  takeHit(amount: number): void {
    if (this.iFrames > 0) return;
    this.hp            = Math.max(0, this.hp - amount);
    this.isHit         = true;
    this.hitFlashTimer = amount >= 25 ? 300 : 150;
    this.iFrames       = amount >= 25 ? 800 : 600;
    this.hitRingTimer  = this.HIT_RING_MS;
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

    const isCharging = this.chargeState !== 'none';
    if (isCharging && arm === 'right') {
      const chargeThreshold = (this.chargeState === 'charging_heavy' || this.chargeState === 'charged_heavy')
        ? CHARGE_HEAVY_THRESHOLD
        : CHARGE_LIGHT_THRESHOLD;
      const pull = Math.min(this.chargeTimer / chargeThreshold, 1) * CHARGE_PULL_MAX;
      return { tx: -facingX * pull, ty: -facingY * pull + breatheY, rotateDeg: 0, pivotX, pivotY };
    }

    if (isMoving) {
      const angle = arm === 'right' ? this.walkArmAngle : -this.walkArmAngle;
      return { tx: 0, ty: 0, rotateDeg: angle, pivotX, pivotY };
    }

    return { tx: 0, ty: breatheY, rotateDeg: 0, pivotX, pivotY };
  }

  // ============================================================
  // [🧱 BLOCK: Draw — Single Image Layer]
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
  // ============================================================
  private drawSword(
    ctx:      CanvasRenderingContext2D,
    baseX:    number,
    baseY:    number,
    armOpts:  { tx: number; ty: number; rotateDeg: number; pivotX: number; pivotY: number },
    breatheY: number,
  ): void {
    const s          = getPlayerSprites();
    const swingAngle = this.getSwordSwingAngle();

    if (swingAngle !== null) {
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
      this.drawImageLayer(ctx, s.sword, baseX, baseY, armOpts);
    }
  }

  // ============================================================
  // [🧱 BLOCK: Draw — Sprite Layers]
  // Wrapped in a full ctx.save()/restore() with explicit reset
  // of globalCompositeOperation and globalAlpha to prevent any
  // state leak from previous draw calls causing a visible box.
  // ============================================================
  private drawSpriteLayers(
    ctx:      CanvasRenderingContext2D,
    sx:       number,
    sy:       number,
    isMoving: boolean,
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

    const facingLeft = this.facing.x < -0.1;
    const centerX    = sx + HITBOX_W / 2;

    ctx.save();
    // ── Explicitly reset composite state before drawing sprites ─
    // Prevents any leaked globalCompositeOperation from prior
    // draw calls (circles, rings, etc.) causing a visible box.
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    if (facingLeft) {
      ctx.translate(centerX, 0);
      ctx.scale(-1, 1);
      ctx.translate(-centerX, 0);
    }

    ctx.drawImage(feetImg, dx, dy, dw, dh);

    const leftArmOpts = this.getArmOffsets('left', isMoving, breatheY);
    this.drawImageLayer(ctx, s.leftArm, dx, dy, leftArmOpts);

    ctx.drawImage(s.body, dx, dy + breatheY, dw, dh);
    ctx.drawImage(s.head, dx + swayX, dy + breatheY, dw, dh);

    const rightArmOpts = this.getArmOffsets('right', isMoving, breatheY);
    this.drawImageLayer(ctx, s.rightArm, dx, dy, rightArmOpts);

    if (this.hasSword) {
      this.drawSword(ctx, dx, dy, rightArmOpts, breatheY);
    }

    ctx.restore();
  }

  // ============================================================
  // [🧱 BLOCK: Draw — State Circle Behind Sprite]
  // Each branch is wrapped in save/restore to prevent state
  // leaking into drawSpriteLayers. Draws BEFORE the sprite.
  // ============================================================
  private drawStateCircle(
    ctx: CanvasRenderingContext2D,
    cx:  number,
    cy:  number,
  ): void {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    // ── Hit ring — expanding red arc ──────────────────────────
    if (this.hitRingTimer > 0) {
      const progress = 1 - this.hitRingTimer / this.HIT_RING_MS;
      const radius   = STATE_CIRCLE_RADIUS + progress * 20;
      const alpha    = this.hitRingTimer / this.HIT_RING_MS;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(239,68,68,${alpha})`;
      ctx.lineWidth   = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(239,68,68,${alpha * 0.25})`;
      ctx.fill();
    }

    // ── Dashing ───────────────────────────────────────────────
    if (this.isDashing) {
      const alpha = (this.dashTimer / DASH_DURATION) * 0.65;
      ctx.beginPath();
      ctx.arc(cx, cy, STATE_CIRCLE_RADIUS + 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(56,189,248,${alpha})`;
      ctx.fill();
    }

    // ── Parrying ──────────────────────────────────────────────
    if (this.blockState === 'parrying') {
      const progress = this.blockTimer / PARRY_WINDOW_MS;
      const alpha    = (1 - progress) * 0.60;
      ctx.beginPath();
      ctx.arc(cx, cy, STATE_CIRCLE_RADIUS + 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(125,211,252,${alpha})`;
      ctx.fill();
    }

    // ── Blocking ──────────────────────────────────────────────
    if (this.blockState === 'blocking') {
      const staminaPct = Math.max(0, this.stamina / this.maxStamina);
      ctx.beginPath();
      ctx.arc(cx, cy, STATE_CIRCLE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(148,163,184,${staminaPct * 0.55})`;
      ctx.fill();
    }

    // ── Charging light ────────────────────────────────────────
    if (this.chargeState === 'charging_light') {
      const progress = Math.min(this.chargeTimer / CHARGE_LIGHT_THRESHOLD, 1);
      const radius   = STATE_CIRCLE_RADIUS * (0.5 + progress * 0.7);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(252,165,165,${progress * 0.6})`;
      ctx.fill();
    }

    // ── Charged light ready ───────────────────────────────────
    if (this.chargeState === 'charged_light') {
      const pulse = Math.sin(this.chargeVisual / 80) * 0.2 + 0.7;
      ctx.beginPath();
      ctx.arc(cx, cy, STATE_CIRCLE_RADIUS + 6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(226,232,240,${pulse * 0.65})`;
      ctx.fill();
    }

    // ── Charging heavy ────────────────────────────────────────
    if (this.chargeState === 'charging_heavy') {
      const progress = Math.min(this.chargeTimer / CHARGE_HEAVY_THRESHOLD, 1);
      const radius   = STATE_CIRCLE_RADIUS * (0.5 + progress * 0.7);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(251,191,36,${progress * 0.6})`;
      ctx.fill();
    }

    // ── Charged heavy ready ───────────────────────────────────
    if (this.chargeState === 'charged_heavy') {
      const pulse = Math.sin(this.chargeVisual / 60) * 0.2 + 0.7;
      ctx.beginPath();
      ctx.arc(cx, cy, STATE_CIRCLE_RADIUS + 6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(253,230,138,${pulse * 0.70})`;
      ctx.fill();
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
      ctx.save();
      ctx.globalAlpha = 0.25 * progress;
      if (getPlayerSprites().ready) {
        this.drawSpriteLayers(ctx, sx - this.vx * 2, sy - this.vy * 2, isMoving);
      }
      ctx.restore();
    }

    // ── Charge outer glow ring ────────────────────────────────
    if (this.chargeState !== 'none') {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
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
      ctx.restore();
    }

    // ── Parry outer ring ──────────────────────────────────────
    if (this.blockState === 'parrying') {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      const progress = this.blockTimer / PARRY_WINDOW_MS;
      const alpha    = 1 - progress;
      const pulse    = Math.sin(Date.now() / 60) * 0.15 + 0.85;
      ctx.beginPath();
      ctx.arc(cx, cy, 30, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(56,189,248,${alpha * pulse})`;
      ctx.lineWidth   = 3;
      ctx.stroke();
      ctx.restore();
    }

    // ── Block outer ring ──────────────────────────────────────
    if (this.blockState === 'blocking') {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      const staminaPct = Math.max(0, this.stamina / this.maxStamina);
      const pulse      = Math.sin(Date.now() / 200) * 0.2 + 0.6;
      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(148,163,184,${pulse * staminaPct})`;
      ctx.lineWidth   = 2 + staminaPct * 2;
      ctx.stroke();
      ctx.restore();
    }

    // ── Parry success flash ───────────────────────────────────
    if (this.parrySuccess) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      ctx.arc(cx, cy, 44, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(56,189,248,0.45)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 44, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(56,189,248,0.9)";
      ctx.lineWidth   = 2;
      ctx.stroke();
      ctx.restore();
    }

    // ── State circle BEHIND sprite ────────────────────────────
    this.drawStateCircle(ctx, cx, cy);

    // ── Sprite layers ─────────────────────────────────────────
    if (getPlayerSprites().ready) {
      this.drawSpriteLayers(ctx, sx, sy, isMoving);
    }

    // ── HP bar ────────────────────────────────────────────────
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(sx, sy - 15, this.width, 4);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(sx, sy - 15, (this.hp / this.maxHp) * this.width, 4);
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(sx, sy - 9, this.width, 4);
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(sx, sy - 9, (this.stamina / this.maxStamina) * this.width, 4);
    ctx.restore();
  }
}