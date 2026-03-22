// src/engine/Camera.ts

import { Player } from "./Player";

// ============================================================
// [🧱 BLOCK: Camera Constants]
// ============================================================
export const WORLD_W = 2400;
export const WORLD_H = 1800;

// ============================================================
// [🧱 BLOCK: Camera Class]
// Keeps the player centered on screen by tracking an offset.
// Every draw call subtracts (camera.x, camera.y) from world
// coordinates to get screen coordinates.
// ============================================================
export class Camera {
  x: number = 0;
  y: number = 0;

  screenW: number;
  screenH: number;

  constructor(screenW: number, screenH: number) {
    this.screenW = screenW;
    this.screenH = screenH;
  }

  // ============================================================
  // [🧱 BLOCK: Update — Follow Player]
  // Centers camera on the player, clamped so it never shows
  // outside the world boundary.
  // ============================================================
  update(player: Player) {
    // Target: player center on screen
    const targetX = player.x + player.width  / 2 - this.screenW / 2;
    const targetY = player.y + player.height / 2 - this.screenH / 2;

    // Clamp so we don't scroll past world edges
    this.x = Math.max(0, Math.min(WORLD_W - this.screenW, targetX));
    this.y = Math.max(0, Math.min(WORLD_H - this.screenH, targetY));
  }

  // ============================================================
  // [🧱 BLOCK: World → Screen helpers]
  // Use these when drawing anything on the canvas.
  // ============================================================
  toScreenX(worldX: number): number {
    return worldX - this.x;
  }

  toScreenY(worldY: number): number {
    return worldY - this.y;
  }

  // ============================================================
  // [🧱 BLOCK: Frustum Cull Check]
  // Returns false if a world-space rect is off screen.
  // Lets us skip drawing enemies the player can't see.
  // ============================================================
  isVisible(worldX: number, worldY: number, w: number, h: number): boolean {
    return (
      worldX + w > this.x &&
      worldX     < this.x + this.screenW &&
      worldY + h > this.y &&
      worldY     < this.y + this.screenH
    );
  }
}