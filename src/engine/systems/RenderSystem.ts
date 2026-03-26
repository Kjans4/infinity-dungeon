// src/engine/systems/RenderSystem.ts
import { Camera, WORLD_W, WORLD_H, BOSS_WORLD_W, BOSS_WORLD_H } from "../Camera";

// ============================================================
// [🧱 BLOCK: RenderSystem]
// Handles all canvas drawing that isn't tied to a specific
// entity — world background, grid, boundary walls.
// Also owns screen shake state.
// ============================================================
export class RenderSystem {

  // ============================================================
  // [🧱 BLOCK: Screen Shake State]
  // ============================================================
  private shakeDuration:  number = 0;  // ms remaining
  private shakeMagnitude: number = 0;  // max pixel offset
  private shakeX:         number = 0;  // current frame offset
  private shakeY:         number = 0;

  // ============================================================
  // [🧱 BLOCK: Trigger Shake]
  // Call this from GameCanvas when something impactful happens.
  // If a shake is already running, the stronger one wins.
  //
  // Presets:
  //   light  → player takes normal hit
  //   medium → boss contact / slam
  //   heavy  → boss charge impact
  // ============================================================
  shake(type: 'light' | 'medium' | 'heavy' = 'light') {
    const presets = {
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
  // Resets canvas each frame. Applies shake offset via
  // ctx.translate so every subsequent draw is displaced.
  // ctx.save/restore brackets the entire frame so the offset
  // doesn't accumulate.
  // ============================================================
  clear(ctx: CanvasRenderingContext2D, w: number, h: number) {
    // Restore last frame's transform first
    ctx.restore();
    ctx.clearRect(0, 0, w, h);
    ctx.save();

    // Tick shake
    if (this.shakeDuration > 0) {
      this.shakeDuration  -= 16;
      const progress       = this.shakeDuration / 200; // 0 → 1
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