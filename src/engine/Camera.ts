// src/engine/Camera.ts
import { Player } from "./Player";

// ============================================================
// [🧱 BLOCK: World Size Constants]
// ============================================================
export const WORLD_W      = 2400;
export const WORLD_H      = 1800;
export const BOSS_WORLD_W = 1200;
export const BOSS_WORLD_H = 900;

// ============================================================
// [🧱 BLOCK: Camera Class]
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
  // When the world is larger than the screen: clamp so the
  // camera never shows outside the world boundary.
  //
  // When the world is SMALLER than the screen (e.g. boss arena
  // on a wide monitor): center the world instead. Without this,
  // Math.max(0, worldW - screenW) = Math.max(0, negative) = 0,
  // which locks the camera to the top-left corner and makes
  // the arena appear off-center to the left.
  // ============================================================
  update(player: Player, worldW: number = WORLD_W, worldH: number = WORLD_H) {
    // X axis
    if (worldW <= this.screenW) {
      this.x = -(this.screenW - worldW) / 2;
    } else {
      const targetX = player.x + player.width  / 2 - this.screenW / 2;
      this.x = Math.max(0, Math.min(worldW - this.screenW, targetX));
    }

    // Y axis
    if (worldH <= this.screenH) {
      this.y = -(this.screenH - worldH) / 2;
    } else {
      const targetY = player.y + player.height / 2 - this.screenH / 2;
      this.y = Math.max(0, Math.min(worldH - this.screenH, targetY));
    }
  }

  toScreenX(worldX: number): number { return worldX - this.x; }
  toScreenY(worldY: number): number { return worldY - this.y; }

  isVisible(worldX: number, worldY: number, w: number, h: number): boolean {
    return (
      worldX + w > this.x &&
      worldX     < this.x + this.screenW &&
      worldY + h > this.y &&
      worldY     < this.y + this.screenH
    );
  }
}