// src/engine/systems/RenderSystem.ts
import { Camera, WORLD_W, WORLD_H, BOSS_WORLD_W, BOSS_WORLD_H } from "../Camera";
import { DamageNumber } from "../Particle";

// ============================================================
// [🧱 BLOCK: RenderSystem]
// Handles all canvas drawing that isn't tied to a specific
// entity — world background, grid, boundary walls.
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
  // [🧱 BLOCK: Trigger Shake]
  // Presets:
  //   micro  → single hit feedback (1–2px, 80ms)
  //   light  → player takes normal hit
  //   medium → boss contact / slam
  //   heavy  → boss charge impact
  // ============================================================
  shake(type: 'micro' | 'light' | 'medium' | 'heavy' = 'light') {
    const presets = {
      micro:  { duration: 80,  magnitude: 2  },
      light:  { duration: 150, magnitude: 4  },
      medium: { duration: 250, magnitude: 8  },
      heavy:  { duration: 400, magnitude: 14 },
    };

    const p = presets[type];

    // Only upgrade — don't downgrade an active shake
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
  // ============================================================
  drawWorld(
    ctx:    CanvasRenderingContext2D,
    camera: Camera,
    w:      number,
    h:      number,
    isBoss: boolean
  ) {
    this.drawGrid(ctx, camera, w, h);
    this.drawBounds(ctx, camera, isBoss);
  }

  // ============================================================
  // [🧱 BLOCK: Draw Damage Numbers]
  // Called once per frame after all entities are drawn.
  // Updates and draws all active damage numbers, then removes done ones.
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
  // [🧱 BRICK: Scrolling Dot Grid]
  // ============================================================
  private drawGrid(
    ctx:    CanvasRenderingContext2D,
    camera: Camera,
    w:      number,
    h:      number
  ) {
    const gridSize = 80;
    ctx.fillStyle  = "rgba(148, 163, 184, 0.08)";

    const startX = -(camera.x % gridSize);
    const startY = -(camera.y % gridSize);

    for (let x = startX; x < w; x += gridSize) {
      for (let y = startY; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ============================================================
  // [🧱 BRICK: World Boundary]
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