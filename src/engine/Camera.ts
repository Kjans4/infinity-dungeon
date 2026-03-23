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
  // worldW and worldH are passed in so the same camera works
  // for both the horde world and the smaller boss world.
  // ============================================================
  update(player: Player, worldW: number = WORLD_W, worldH: number = WORLD_H) {
    const targetX = player.x + player.width  / 2 - this.screenW / 2;
    const targetY = player.y + player.height / 2 - this.screenH / 2;

    this.x = Math.max(0, Math.min(worldW - this.screenW, targetX));
    this.y = Math.max(0, Math.min(worldH - this.screenH, targetY));
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