// src/engine/MobileInput.ts

// ============================================================
// [🧱 BLOCK: MobileInput]
// Bridges touch events from MobileControls into the keyboard
// key set that InputHandler already reads. All game systems
// remain unchanged — they only ever see InputHandler.keys.
//
// Usage:
//   const mobileInput = new MobileInput(inputHandler);
//   // Pass mobileInput to MobileControls as a prop.
//   // Call mobileInput.setJoystick(dx, dy) each frame.
//   // Call mobileInput.setButton(key, pressed) on touch events.
// ============================================================

import { InputHandler } from "./Input";

// ============================================================
// [🧱 BLOCK: Joystick Dead Zone]
// Below this normalised magnitude the joystick is ignored.
// ============================================================
const DEAD_ZONE = 0.20;

// ============================================================
// [🧱 BLOCK: Key Code Constants]
// Matches the codes InputHandler watches.
// ============================================================
export const MOBILE_KEY_MAP = {
  up:    "KeyW",
  down:  "KeyS",
  left:  "KeyA",
  right: "KeyD",
  light: "KeyJ",   // Attack (West button)
  heavy: "KeyK",   // Heavy Attack (North button)
  block: "KeyL",   // Parry (East button)
  dash:  "KeyC",   // Dash (South button)
} as const;

export type MobileAction = keyof typeof MOBILE_KEY_MAP;

// ============================================================
// [🧱 BLOCK: MobileInput Class]
// ============================================================
export class MobileInput {
  private input: InputHandler;

  // Joystick normalised direction (-1 … 1)
  private joyX: number = 0;
  private joyY: number = 0;

  constructor(input: InputHandler) {
    this.input = input;
  }

  // ============================================================
  // [🧱 BLOCK: Set Joystick]
  // Called by MobileControls each touch-move frame.
  // dx / dy are normalised (-1 … 1) relative to stick radius.
  // ============================================================
  setJoystick(dx: number, dy: number): void {
    this.joyX = dx;
    this.joyY = dy;
    this.syncJoystickKeys();
  }

  resetJoystick(): void {
    this.joyX = 0;
    this.joyY = 0;
    this.syncJoystickKeys();
  }

  // ============================================================
  // [🧱 BLOCK: Sync Joystick → Keys]
  // Maps the normalised vector to WASD keys with dead-zone.
  // ============================================================
  private syncJoystickKeys(): void {
    const mag = Math.sqrt(this.joyX * this.joyX + this.joyY * this.joyY);
    const active = mag > DEAD_ZONE;

    this.setKey("KeyW", active && this.joyY < -DEAD_ZONE);
    this.setKey("KeyS", active && this.joyY >  DEAD_ZONE);
    this.setKey("KeyA", active && this.joyX < -DEAD_ZONE);
    this.setKey("KeyD", active && this.joyX >  DEAD_ZONE);
  }

  // ============================================================
  // [🧱 BLOCK: Set Action Button]
  // Called on touchstart / touchend for the 4 action buttons.
  // ============================================================
  setButton(action: MobileAction, pressed: boolean): void {
    const code = MOBILE_KEY_MAP[action];
    this.setKey(code, pressed);
  }

  // ============================================================
  // [🧱 BLOCK: Set Key]
  // Directly mutates InputHandler.keys.
  // ============================================================
  private setKey(code: string, pressed: boolean): void {
    if (pressed) {
      this.input.keys.add(code);
    } else {
      this.input.keys.delete(code);
    }
  }

  // ============================================================
  // [🧱 BLOCK: Reset All]
  // Called when controls unmount or game pauses.
  // ============================================================
  resetAll(): void {
    Object.values(MOBILE_KEY_MAP).forEach((code) => {
      this.input.keys.delete(code);
    });
    this.joyX = 0;
    this.joyY = 0;
  }
}