// src/engine/systems/RenderSystem.ts
import { Camera, WORLD_W, WORLD_H, BOSS_WORLD_W, BOSS_WORLD_H } from "../Camera";

// ============================================================
// [🧱 BLOCK: RenderSystem]
// Handles all canvas drawing that isn't tied to a specific
// entity — world background, grid, boundary walls.
// ============================================================
export class RenderSystem {
  // ============================================================
  // [🧱 BLOCK: Clear]
  // ============================================================
  clear(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.clearRect(0, 0, w, h);
  }

  // ============================================================
  // [🧱 BLOCK: Draw World]
  // Draws grid + boundary in one call.
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
  // Dots scroll with the camera giving a sense of movement.
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
  // Red border for horde rooms, orange for boss room.
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