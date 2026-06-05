// src/engine/TileMap.ts

import { Camera } from "./Camera";

// ============================================================
// [🧱 BLOCK: Constants]
// ============================================================
export const TILE_DRAW_SIZE = 32;
export const TOTAL_TILES    = 4;

// ============================================================
// [🧱 BLOCK: Tile Definitions]
// Gray brick variants — each tile is one brick cell in a
// staggered masonry pattern. Mortar gaps drawn as slightly
// darker lines along top and left edges of each tile.
// Variants differ in slight color shifts and surface details
// to break up visual repetition.
// ============================================================
const TILE_DEFS = [
  { base: "#4a4a4a", mortar: "#2e2e2e", highlight: "#555555", detail: "#424242" }, // mid gray
  { base: "#464646", mortar: "#2b2b2b", highlight: "#515151", detail: "#3e3e3e" }, // slightly darker
  { base: "#4c4c4c", mortar: "#303030", highlight: "#575757", detail: "#444444" }, // slightly lighter
  { base: "#444444", mortar: "#2a2a2a", highlight: "#4f4f4f", detail: "#3c3c3c" }, // darkest variant
];

// ============================================================
// [🧱 BLOCK: Draw Single Tile]
// Renders a single brick cell with:
//   - filled base color
//   - mortar gaps (top and left edge lines)
//   - optional surface detail per variant (chips, streaks)
//   - subtle highlight on inner top edge for beveled look
// Stagger offset is handled at the TileMap level by passing
// an offsetX when the row is odd.
// ============================================================
function drawTile(
  ctx:    CanvasRenderingContext2D,
  x:      number,
  y:      number,
  tileId: number
): void {
  const def = TILE_DEFS[tileId] ?? TILE_DEFS[0];
  const s   = TILE_DRAW_SIZE;

  // ── Mortar gap — fill entire cell with mortar color first ──
  ctx.fillStyle = def.mortar;
  ctx.fillRect(x, y, s, s);

  // ── Brick face — inset 2px on top and left (mortar joints) ─
  const bx = x + 2;
  const by = y + 2;
  const bw = s - 2;
  const bh = s - 2;

  ctx.fillStyle = def.base;
  ctx.fillRect(bx, by, bw, bh);

  // ── Bevel highlight — top inner edge ──────────────────────
  ctx.fillStyle = def.highlight;
  ctx.fillRect(bx, by, bw, 2);

  // ── Bevel shadow — bottom inner edge ──────────────────────
  ctx.fillStyle = def.mortar;
  ctx.globalAlpha = 0.4;
  ctx.fillRect(bx, by + bh - 2, bw, 2);
  ctx.globalAlpha = 1;

  // ── Surface detail — per-variant ──────────────────────────
  ctx.fillStyle = def.detail;
  switch (tileId) {
    case 0:
      // Small horizontal streak near top-right
      ctx.fillRect(bx + bw - 10, by + 5, 6, 1);
      break;
    case 1:
      // Two short vertical chips
      ctx.fillRect(bx + 5,  by + 7, 1, 4);
      ctx.fillRect(bx + 14, by + 12, 1, 3);
      break;
    case 2:
      // Diagonal scratch
      ctx.globalAlpha = 0.5;
      ctx.fillRect(bx + 8,  by + 6,  1, 1);
      ctx.fillRect(bx + 9,  by + 7,  1, 1);
      ctx.fillRect(bx + 10, by + 8,  1, 1);
      ctx.fillRect(bx + 11, by + 9,  1, 1);
      ctx.globalAlpha = 1;
      break;
    case 3:
      // Corner chips (weathered brick)
      ctx.fillRect(bx + 2,  by + 3,  2, 1);
      ctx.fillRect(bx + bw - 5, by + bh - 5, 2, 1);
      break;
  }
}

// ============================================================
// [🧱 BLOCK: TileMap Class]
// Stores a flat Uint8Array grid of tileIds. Each row is drawn
// with a half-tile horizontal stagger on odd rows to produce a
// classic running-bond brick pattern.
// ============================================================
export class TileMap {
  private grid: Uint8Array;
  private cols: number;
  private rows: number;

  constructor(worldW: number, worldH: number) {
    this.cols = Math.ceil(worldW / TILE_DRAW_SIZE) + 2;
    this.rows = Math.ceil(worldH / TILE_DRAW_SIZE) + 2;
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
    this.cols = Math.ceil(worldW / TILE_DRAW_SIZE) + 2;
    this.rows = Math.ceil(worldH / TILE_DRAW_SIZE) + 2;
    this.grid = new Uint8Array(this.cols * this.rows);
    this._fill();
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // Only draws tiles visible within the camera viewport.
  // Odd rows are offset by half a tile width (TILE_DRAW_SIZE/2)
  // to create a staggered brick (running bond) layout.
  // ============================================================
  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const half     = TILE_DRAW_SIZE / 2;
    const startRow = Math.max(0, Math.floor(camera.y / TILE_DRAW_SIZE) - 1);
    const startCol = Math.max(0, Math.floor(camera.x / TILE_DRAW_SIZE) - 1);
    const endRow   = Math.min(this.rows - 1, Math.ceil((camera.y + camera.screenH) / TILE_DRAW_SIZE) + 1);
    const endCol   = Math.min(this.cols - 1, Math.ceil((camera.x + camera.screenW)  / TILE_DRAW_SIZE) + 2);

    for (let row = startRow; row <= endRow; row++) {
      // Odd rows get a half-brick stagger
      const stagger  = (row % 2 === 1) ? half : 0;

      for (let col = startCol; col <= endCol; col++) {
        const idx    = row * this.cols + col;
        const tileId = this.grid[idx] ?? 0;

        const screenX = col * TILE_DRAW_SIZE + stagger - camera.x;
        const screenY = row * TILE_DRAW_SIZE              - camera.y;

        drawTile(ctx, screenX, screenY, tileId);
      }
    }
  }
}