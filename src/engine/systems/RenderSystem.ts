// src/engine/systems/RenderSystem.ts
import { Camera, WORLD_W, WORLD_H, BOSS_WORLD_W, BOSS_WORLD_H } from "../Camera";
import { DamageNumber } from "../Particle";
import { TileMap } from "../TileMap";

// ============================================================
// [🧱 BLOCK: Fog Constants]
// ============================================================
const FOG_RADIUS_BASE   = 250;   // px — bright zone radius
const FOG_FLICKER_AMP   = 8;     // px — max radius noise for torch flicker
const FOG_FLICKER_SPEED = 0.004; // how fast the flicker oscillates
const FOG_OUTER_COLOR   = "rgba(5, 8, 20, 0.92)";   // near-black dark blue

// ============================================================
// [🧱 BLOCK: RenderSystem]
// Handles all canvas drawing that isn't tied to a specific
// entity — world background, tiles, boundary walls, fog.
// Also owns screen shake state and damage number rendering.
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
  // [🧱 BLOCK: Fog State]
  // flickerTime accumulates each frame for smooth sine noise.
  // ============================================================
  private flickerTime: number = 0;

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
    // 1. Background fill
    ctx.fillStyle = "#090806";
    ctx.fillRect(0, 0, w, h);

    // 2. Tile floor — only if tileMap provided
    if (tileMap) {
      tileMap.draw(ctx, camera);
    }

    // 3. World boundary on top
    this.drawBounds(ctx, camera, isBoss);
  }

  // ============================================================
  // [🧱 BLOCK: Draw Fog]
  // Full-screen radial gradient overlay centered on the player's
  // screen position. Transparent at center → dark blue at edges.
  // Subtle sine-wave flicker simulates a torch or lantern.
  //
  // Call this AFTER all entities and the player are drawn,
  // BEFORE damage numbers (so numbers stay readable on top).
  //
  // Parameters:
  //   ctx      — canvas context
  //   px, py   — player CENTER in screen coords
  //   w, h     — canvas dimensions
  //   isBoss   — slightly tighter, redder fog in boss rooms
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

    // Two overlapping sine waves for organic flicker
    const flicker =
      Math.sin(this.flickerTime * 1.0) * FOG_FLICKER_AMP * 0.6 +
      Math.sin(this.flickerTime * 2.7) * FOG_FLICKER_AMP * 0.4;

    const radius     = FOG_RADIUS_BASE + flicker;
    const outerColor = isBoss
      ? "rgba(20, 5, 5, 0.94)"   // red-tinted darkness for boss rooms
      : FOG_OUTER_COLOR;

    // Radial gradient: clear → mid-dark → full dark
    const grad = ctx.createRadialGradient(px, py, 0, px, py, radius * 2.2);
    grad.addColorStop(0.00, "rgba(0, 0, 0, 0)");       // fully transparent center
    grad.addColorStop(0.35, "rgba(5, 8, 20, 0)");       // still clear
    grad.addColorStop(0.65, "rgba(5, 8, 20, 0.55)");    // mid falloff
    grad.addColorStop(1.00, outerColor);                // near-black edge

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