// src/engine/TileMap.ts

import { Camera } from "./Camera";

// ============================================================
// [🧱 BLOCK: Constants]
// ============================================================
export const TILE_DRAW_SIZE = 32;
export const TOTAL_TILES    = 4;

// ============================================================
// [🧱 BLOCK: Tile Definitions]
// Each tile is a simple canvas-drawn stone variant.
// No image files needed — pure 2D API placeholder.
// ============================================================
const TILE_DEFS = [
  { base: "#1a1614", border: "#221c18", accent: "#251f1b" }, // dark stone
  { base: "#1c1814", border: "#241e19", accent: "#17120f" }, // darker patch
  { base: "#191614", border: "#201b16", accent: "#222019" }, // worn stone
  { base: "#1b1815", border: "#231d18", accent: "#141210" }, // cracked stone
];

// ============================================================
// [🧱 BLOCK: Draw Single Tile]
// Draws a stone tile at screen position using canvas primitives.
// ============================================================
function drawTile(
  ctx:     CanvasRenderingContext2D,
  x:       number,
  y:       number,
  tileId:  number
): void {
  const def = TILE_DEFS[tileId] ?? TILE_DEFS[0];
  const s   = TILE_DRAW_SIZE;

  // Base fill
  ctx.fillStyle = def.base;
  ctx.fillRect(x, y, s, s);

  // Subtle inner border (stone slab edge)
  ctx.strokeStyle = def.border;
  ctx.lineWidth   = 0.5;
  ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);

  // Accent crack/variation — different per tile type
  ctx.fillStyle = def.accent;
  switch (tileId) {
    case 0:
      // Small center dot
      ctx.fillRect(x + 14, y + 14, 3, 3);
      break;
    case 1:
      // Diagonal crack
      ctx.beginPath();
      ctx.moveTo(x + 8,  y + 6);
      ctx.lineTo(x + 14, y + 16);
      ctx.strokeStyle = def.accent;
      ctx.lineWidth   = 0.5;
      ctx.stroke();
      break;
    case 2:
      // Two horizontal lines
      ctx.fillRect(x + 4,  y + 10, 12, 1);
      ctx.fillRect(x + 6,  y + 20, 8,  1);
      break;
    case 3:
      // Corner chips
      ctx.fillRect(x + 2,  y + 2,  4, 1);
      ctx.fillRect(x + 26, y + 28, 4, 1);
      break;
  }
}

// ============================================================
// [🧱 BLOCK: TileMap Class]
// ============================================================
export class TileMap {
  private grid: Uint8Array;
  private cols: number;
  private rows: number;

  constructor(worldW: number, worldH: number) {
    this.cols = Math.ceil(worldW / TILE_DRAW_SIZE) + 1;
    this.rows = Math.ceil(worldH / TILE_DRAW_SIZE) + 1;
    this.grid = new Uint8Array(this.cols * this.rows);
    this._fill();
  }

  // ============================================================
  // [🧱 BLOCK: Fill Grid]
  // ============================================================
  private _fill(): void {
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i] = Math.floor(Math.random() * TOTAL_TILES);
    }
  }

  // ============================================================
  // [🧱 BLOCK: Regenerate]
  // ============================================================
  regenerate(worldW: number, worldH: number): void {
    this.cols = Math.ceil(worldW / TILE_DRAW_SIZE) + 1;
    this.rows = Math.ceil(worldH / TILE_DRAW_SIZE) + 1;
    this.grid = new Uint8Array(this.cols * this.rows);
    this._fill();
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // Only draws tiles visible within the camera viewport.
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const startCol = Math.max(0, Math.floor(camera.x / TILE_DRAW_SIZE));
    const startRow = Math.max(0, Math.floor(camera.y / TILE_DRAW_SIZE));
    const endCol   = Math.min(this.cols - 1, Math.ceil((camera.x + camera.screenW) / TILE_DRAW_SIZE));
    const endRow   = Math.min(this.rows - 1, Math.ceil((camera.y + camera.screenH) / TILE_DRAW_SIZE));

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const idx     = row * this.cols + col;
        const tileId  = this.grid[idx] ?? 0;
        const screenX = col * TILE_DRAW_SIZE - camera.x;
        const screenY = row * TILE_DRAW_SIZE - camera.y;
        drawTile(ctx, screenX, screenY, tileId);
      }
    }
  }
}