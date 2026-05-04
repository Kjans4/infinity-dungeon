// src/engine/Player.ts
import { InputHandler }   from "./Input";
import { Camera }         from "./Camera";
import { Weapon }         from "./items/Weapon";
import { AttackDef }      from "./items/types";
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
// All offsets are relative to (sx, sy) — the top-left of the
// 32×32 hitbox in screen space.
//
// The PNG files have significant transparent padding around the
// actual art, so each layer is drawn at the full 32×32 box and
// stacked with vertical overlap so they appear as one character.
//
// Layout within the 32px tall box:
//   Head  — top ~56%    (-2..16px)
//   Body  — middle ~56% (10..28px)
//   Feet  — bottom ~44% (20..34px)
//
// Adjust DY values if art sits differently in your PNG files.
// ============================================================
const HITBOX_W = 32;
const HITBOX_H = 32;

const HEAD_W = HITBOX_W;  const HEAD_H = 18;
const BODY_W = HITBOX_W;  const BODY_H = 18;
const FEET_W = HITBOX_W;  const FEET_H = 14;

const HEAD_DY = -2;   // slightly above box top so the helmet clears
const BODY_DY = 10;   // overlaps bottom of head
const FEET_DY = 20;   // overlaps bottom of body, sits at box bottom

// ============================================================
// [🧱 BLOCK: Idle Animation Constants]
// Breathe: body + head bob vertically on a slow sine
// Sway:    head drifts horizontally on a slower, offset sine
// ============================================================
const BREATHE_AMPLITUDE = 2.0;    // px up/down
const BREATHE_PERIOD    = 1500;   // ms per full cycle
const SWAY_AMPLITUDE    = 1.5;    // px left/right (head only)
const SWAY_PERIOD       = 2500;   // ms per full cycle
const SWAY_PHASE_OFFSET = 800;    // ms — head sways slightly behind breathe

// ============================================================
// [🧱 BLOCK: Walk Animation Constants]
// ============================================================
const WALK_FRAME_MS      = 150;   // ms per foot frame alternation
const WALK_SPEED_THRESH  = 0.3;   // min speed to count as moving

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
  // walkTimer    — accumulates ms, flips foot frame at threshold
  // walkFrame    — 0 = feetMoving1, 1 = feetMoving2
  // animClock    — global ms clock for idle sine waves
  // ============================================================
  private walkTimer: number  = 0;
  private walkFrame: number  = 0;
  private animClock: number  = 0;

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
    if (this.heavyCooldown > 0) this.heavyCooldown  -= 16;
    if (this.iFrames       > 0) this.iFrames        -= 16;
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= 16;
      if (this.hitFlashTimer <= 0) this.isHit = false;
    }

    if (this.chargeState !== 'none') this.chargeVisual += 16;
    else                              this.chargeVisual  = 0;

    // ── Walk animation clock ──────────────────────────────────
    const isMoving = Math.abs(this.vx) + Math.abs(this.vy) > WALK_SPEED_THRESH;
    if (isMoving) {
      this.walkTimer += 16;
      if (this.walkTimer >= WALK_FRAME_MS) {
        this.walkTimer = 0;
        this.walkFrame = this.walkFrame === 0 ? 1 : 0;
      }
    } else {
      // Reset to idle stance when stopping
      this.walkTimer = 0;
      this.walkFrame = 0;
    }

    // ── Global animation clock ────────────────────────────────
    this.animClock += 16;

    this.prevLight = lightDown;
    this.prevHeavy = heavyDown;
    this.prevBlock = blockDown;
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
  // [🧱 BLOCK: Draw — Idle Animation Helpers]
  // Returns the current breathe and sway offsets for this frame.
  // Both are 0 while moving so motion doesn't fight the idle anim.
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
  // [🧱 BLOCK: Draw — Sprite Layers]
  // Draws feet → body → head tightly stacked within the hitbox.
  // Flips all layers horizontally when facing left (facing.x < 0).
  // tintColor: null = no tint, string = color overlay on hit/charge.
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

    const feetImg  = isMoving
      ? (this.walkFrame === 0 ? s.feetMoving1 : s.feetMoving2)
      : s.feetIdle;

    // ── Flip transform for left-facing ────────────────────────
    // Translate to sprite center, scale(-1,1), translate back.
    // This mirrors all three layers around the hitbox center X.
    const facingLeft = this.facing.x < -0.1;
    const centerX    = sx + HITBOX_W / 2;

    ctx.save();
    if (facingLeft) {
      ctx.translate(centerX, 0);
      ctx.scale(-1, 1);
      ctx.translate(-centerX, 0);
    }

    // ── Feet (no breathe — grounded) ─────────────────────────
    ctx.drawImage(feetImg, sx, sy + FEET_DY, FEET_W, FEET_H);

    // ── Body (breathes) ───────────────────────────────────────
    ctx.drawImage(s.body, sx, sy + BODY_DY + breatheY, BODY_W, BODY_H);

    // ── Head (breathes + sways; sway mirrors with flip) ───────
    // When flipped, swayX direction is already mirrored by the
    // ctx transform, so we apply it normally here.
    ctx.drawImage(s.head, sx + swayX, sy + HEAD_DY + breatheY, HEAD_W, HEAD_H);

    // ── Tint overlay ──────────────────────────────────────────
    if (tintColor) {
      // Redraw layers under source-atop to colorize sprite pixels only
      ctx.globalCompositeOperation = 'source-atop';
      ctx.drawImage(feetImg, sx,          sy + FEET_DY,              FEET_W, FEET_H);
      ctx.drawImage(s.body,  sx,          sy + BODY_DY + breatheY,   BODY_W, BODY_H);
      ctx.drawImage(s.head,  sx + swayX,  sy + HEAD_DY + breatheY,   HEAD_W, HEAD_H);

      ctx.globalAlpha              = 0.55;
      ctx.fillStyle                = tintColor;
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillRect(sx, sy + HEAD_DY, HITBOX_W, FEET_DY + FEET_H - HEAD_DY);

      ctx.globalAlpha              = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.restore();
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // Sprite version — replaces the colored fillRect body.
  // Falls back to fillRect if sprites haven't loaded yet.
  // All combat overlays (charge ring, parry ring, block ring,
  // parry flash, dash afterimage, HP/stamina bars) are preserved.
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    // ── iFrame flicker (not during invisibility) ──────────────
    if (!this.isInvisible &&
        !this.isHit &&
        this.iFrames > 0 &&
        !this.isDashing &&
        Math.floor(Date.now() / 50) % 2 === 0) {
      return;
    }

    // ── Skip full draw when invisible ─────────────────────────
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

    // ── Determine tint color for combat states ─────────────────
    // null = no tint (normal rendering)
    const tintColor: string | null =
      this.isHit                                              ? '#ffffff'  :
      this.isDashing                                          ? '#38bdf8'  :
      this.blockState === 'parrying'                          ? '#7dd3fc'  :
      this.blockState === 'blocking'                          ? '#94a3b8'  :
      this.chargeState === 'charged_light'                    ? '#e2e8f0'  :
      this.chargeState === 'charged_heavy'                    ? '#fde68a'  :
      (this.isChargingLight || this.isChargingHeavy)          ? '#fca5a5'  :
      null;

    // ── Sprite body (or fallback rect) ────────────────────────
    if (getPlayerSprites().ready) {
      this.drawSpriteLayers(ctx, sx, sy, isMoving, tintColor);
    } else {
      // Fallback colored rect while sprites are loading
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