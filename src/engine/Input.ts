// src/engine/Input.ts

export class InputHandler {
  keys: Set<string>;

  constructor() {
    this.keys = new Set();

    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
    });

    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
    });
  }

  isPressed(code: string): boolean {
    return this.keys.has(code);
  }

  // ============================================================
  // [🧱 BLOCK: Movement Snapshot]
  // Called every frame by Player.update().
  // block (L) — held for blocking / tapped for parry
  // ============================================================
  get movement() {
    return {
      up:    this.isPressed("KeyW"),
      down:  this.isPressed("KeyS"),
      left:  this.isPressed("KeyA"),
      right: this.isPressed("KeyD"),
      dash:  this.isPressed("KeyC"),
      jump:  this.isPressed("Space"),
      light: this.isPressed("KeyJ"),
      heavy: this.isPressed("KeyK"),
      block: this.isPressed("KeyL"),
    };
  }
}