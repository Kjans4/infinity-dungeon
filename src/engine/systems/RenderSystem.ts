// src/engine/systems/RenderSystem.ts
import { Camera, WORLD_W, WORLD_H, BOSS_WORLD_W, BOSS_WORLD_H } from "../Camera";
import { DamageNumber } from "../Particle";
import { TileMap } from "../TileMap";

// ============================================================
// [🧱 BLOCK: Fog Constants]
// ============================================================
const FOG_RADIUS_BASE   = 250;
const FOG_FLICKER_AMP   = 8;
const FOG_FLICKER_SPEED = 0.004;
const FOG_OUTER_COLOR   = "rgba(5, 8, 20, 0.92)";

// ============================================================
// [🧱 BLOCK: Low HP Vignette Constants]
// ============================================================
const LOW_HP_THRESHOLD  = 0.25;
const LOW_HP_PULSE_FREQ = 0.003;
const LOW_HP_MIN_ALPHA  = 0.25;
const LOW_HP_MAX_ALPHA  = 0.55;

// ============================================================
// [🧱 BLOCK: Freeze Frame Presets]
// Duration in ms. Game loop skips update() calls during freeze
// but still renders — creates the "hit-stop" illusion.
//   light      — charged_light hit on enemy
//   heavy      — heavy / charged_heavy hit on enemy or boss
//   player_hit — player takes significant damage (≥threshold)
//   boss_slam  — boss slam / lunge lands on player
// ============================================================
export const FREEZE_PRESETS = {
  light:      32,
  heavy:      48,
  player_hit: 32,
  boss_slam:  48,
} as const;

// ============================================================
// [🧱 BLOCK: RenderSystem]
// Handles all canvas drawing that isn't tied to a specific
// entity — world background, tiles, boundary walls, fog.
// Also owns screen shake state, freeze frame state,
// and damage number rendering.
// ============================================================
export class RenderSystem {

  // ============================================================
  // [🧱 BLOCK: Screen Shake State]
  // ============================================================
  private shakeDuration:  number = 0;
  private shakeMagnitude: number = 0;
  private shakeX:         number = 0;
  private shakeY:         number = 0;

  // ============================================================
  // [🧱 BLOCK: Freeze Frame State]
  // _freezeMs > 0 means the game loop should skip update() this
  // tick. Decremented each tick by tickFreeze().
  // Only upgrades — a longer freeze is never cut short by a
  // shorter one.
  // ============================================================
  private _freezeMs: number = 0;

  get isFrozen(): boolean { return this._freezeMs > 0; }

  freezeFrames(ms: number): void {
    if (ms > this._freezeMs) this._freezeMs = ms;
  }

  tickFreeze(deltaMs: number): boolean {
    if (this._freezeMs <= 0) return false;
    this._freezeMs -= deltaMs;
    if (this._freezeMs < 0) this._freezeMs = 0;
    return this._freezeMs > 0;
  }

  // ============================================================
  // [🧱 BLOCK: Fog State]
  // ============================================================
  private flickerTime: number = 0;

  // ============================================================
  // [🧱 BLOCK: Low HP Vignette State]
  // ============================================================
  private lowHpPulseTime: number = 0;

  // ============================================================
  // [🧱 BLOCK: Trigger Shake]
  // ============================================================
  shake(type: 'micro' | 'light' | 'medium' | 'heavy' = 'light') {
    const presets = {
      micro:  { duration: 80,  magnitude: 2  },
      light:  { duration: 150, magnitude: 4  },
      medium: { duration: 250, magnitude: 8  },
      heavy:  { duration: 400, magnitude: 14 },
    };

    const p = presets[type];
    if (p.magnitude > this.shakeMagnitude) {
      this.shakeDuration  = p.duration;
      this.shakeMagnitude = p.magnitude;
    }
  }

  // ============================================================
  // [🧱 BLOCK: Clear]
  // ============================================================
  clear(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.restore();
    ctx.clearRect(0, 0, w, h);
    ctx.save();

    if (this.shakeDuration > 0) {
      this.shakeDuration  -= 16;
      const progress       = this.shakeDuration / 200;
      const mag            = this.shakeMagnitude * Math.max(0, progress);

      this.shakeX = (Math.random() * 2 - 1) * mag;
      this.shakeY = (Math.random() * 2 - 1) * mag;

      if (this.shakeDuration <= 0) {
        this.shakeDuration  = 0;
        this.shakeMagnitude = 0;
        this.shakeX         = 0;
        this.shakeY         = 0;
      }
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }

    ctx.translate(this.shakeX, this.shakeY);
  }

  // ============================================================
  // [🧱 BLOCK: Draw World]
  // tileMap is optional — if not provided falls back to dark fill.
  // ============================================================
  drawWorld(
    ctx:      CanvasRenderingContext2D,
    camera:   Camera,
    w:        number,
    h:        number,
    isBoss:   boolean,
    tileMap?: TileMap
  ) {
    ctx.fillStyle = "#090806";
    ctx.fillRect(0, 0, w, h);

    if (tileMap) {
      tileMap.draw(ctx, camera);
    }

    this.drawBounds(ctx, camera, isBoss);
  }

  // ============================================================
  // [🧱 BLOCK: Draw Fog]
  // Full-screen radial gradient overlay centered on the player's
  // screen position. Call AFTER all entities and player are drawn,
  // BEFORE damage numbers.
  // ============================================================
  drawFog(
    ctx:    CanvasRenderingContext2D,
    px:     number,
    py:     number,
    w:      number,
    h:      number,
    isBoss: boolean = false
  ): void {
    this.flickerTime += FOG_FLICKER_SPEED;

    const flicker =
      Math.sin(this.flickerTime * 1.0) * FOG_FLICKER_AMP * 0.6 +
      Math.sin(this.flickerTime * 2.7) * FOG_FLICKER_AMP * 0.4;

    const radius = FOG_RADIUS_BASE + flicker;

    const grad = ctx.createRadialGradient(px, py, 0, px, py, radius * 2.2);
    grad.addColorStop(0.00, "rgba(0, 0, 0, 0)");
    grad.addColorStop(0.35, "rgba(0, 0, 0, 0)");
    grad.addColorStop(0.65, "rgba(0, 0, 0, 0.55)");
    grad.addColorStop(1.00, isBoss ? "rgba(0, 0, 0, 0.92)" : "rgba(20, 20, 20, 0.92)");

    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // ============================================================
  // [🧱 BLOCK: Draw Low HP Vignette]
  // Pulsing red radial vignette at screen edges when HP ≤ 25%.
  // Call AFTER drawFog(), BEFORE damage numbers.
  // ============================================================
  drawLowHpVignette(
    ctx:     CanvasRenderingContext2D,
    w:       number,
    h:       number,
    hpRatio: number
  ): void {
    if (hpRatio > LOW_HP_THRESHOLD) return;

    this.lowHpPulseTime += LOW_HP_PULSE_FREQ;

    const pulse      = Math.sin(this.lowHpPulseTime * Math.PI * 2) * 0.5 + 0.5;
    const alpha      = LOW_HP_MIN_ALPHA + pulse * (LOW_HP_MAX_ALPHA - LOW_HP_MIN_ALPHA);
    const intensityMult = 1.0 - (hpRatio / LOW_HP_THRESHOLD) * 0.4;
    const finalAlpha    = alpha * intensityMult;

    const cx = w / 2;
    const cy = h / 2;

    const grad = ctx.createRadialGradient(cx, cy, h * 0.25, cx, cy, h * 0.85);
    grad.addColorStop(0.0, "rgba(0, 0, 0, 0)");
    grad.addColorStop(0.5, `rgba(160, 0, 0, ${finalAlpha * 0.4})`);
    grad.addColorStop(1.0, `rgba(180, 0, 0, ${finalAlpha})`);

    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // ============================================================
  // [🧱 BLOCK: Draw Damage Numbers]
  // ============================================================
  drawDamageNumbers(
    ctx:            CanvasRenderingContext2D,
    camera:         Camera,
    damageNumbers:  DamageNumber[]
  ): void {
    for (let i = damageNumbers.length - 1; i >= 0; i--) {
      const dn = damageNumbers[i];
      dn.update();
      if (dn.isDone) {
        damageNumbers.splice(i, 1);
      } else {
        dn.draw(ctx, camera);
      }
    }
  }

  // ============================================================
  // [🧱 BLOCK: Draw World Boundary]
  // ============================================================
  private drawBounds(
    ctx:    CanvasRenderingContext2D,
    camera: Camera,
    isBoss: boolean
  ) {
    const worldW = isBoss ? BOSS_WORLD_W : WORLD_W;
    const worldH = isBoss ? BOSS_WORLD_H : WORLD_H;

    ctx.strokeStyle = isBoss ? "#f97316" : "#ef4444";
    ctx.lineWidth   = 6;
    ctx.strokeRect(
      camera.toScreenX(0),
      camera.toScreenY(0),
      worldW,
      worldH
    );
  }
}