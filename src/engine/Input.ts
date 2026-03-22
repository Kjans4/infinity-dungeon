// src/engine/Input.ts

export class InputHandler {
  keys: Set<string>;

  constructor() {
    this.keys = new Set();

    // Listen for key presses
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code); // e.g., 'KeyW', 'KeyA', 'KeyJ'
    });

    // Listen for key releases
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
    });
  }

  isPressed(code: string): boolean {
    return this.keys.has(code);
  }

  // Helper to check for specific actions
  get movement() {
    return {
      up: this.isPressed("KeyW"),
      down: this.isPressed("KeyS"),
      left: this.isPressed("KeyA"),
      right: this.isPressed("KeyD"),
      dash: this.isPressed("KeyC"),
      jump: this.isPressed("Space"),
      light: this.isPressed("KeyJ"),
      heavy: this.isPressed("KeyK"),
    };
  }
}