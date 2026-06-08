// src/engine/Input.ts

// ============================================================
// [🧱 BLOCK: InputHandler]
// Handles both keyboard (desktop) and virtual touch (mobile).
// Mobile joystick feeds analog joyX/joyY (-1..1).
// Mobile buttons set/clear virtual keys in the same Set so
// Player.update() and all systems need zero changes for
// digital actions (attack, dash, block, interact).
// ============================================================
export class InputHandler {
  keys: Set<string>;

  // ── Analog joystick state ─────────────────────────────────
  // Set by MobileControls component each touch-move frame.
  // Range: -1.0 .. 1.0 on each axis. (0,0) = no input.
  joyX: number = 0;
  joyY: number = 0;

  // ── Virtual key set for mobile buttons ────────────────────
  // MobileControls calls pressVirtualKey / releaseVirtualKey
  // on touch-start / touch-end for attack/dash/block buttons.
  private virtualKeys: Set<string> = new Set();

  constructor() {
    this.keys = new Set();

    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
    });

    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
    });
  }

  // ============================================================
  // [🧱 BLOCK: isPressed]
  // Checks both hardware keyboard and virtual touch keys.
  // ============================================================
  isPressed(code: string): boolean {
    return this.keys.has(code) || this.virtualKeys.has(code);
  }

  // ============================================================
  // [🧱 BLOCK: Virtual Key API — called by MobileControls]
  // ============================================================
  pressVirtualKey(code: string): void {
    this.virtualKeys.add(code);
  }

  releaseVirtualKey(code: string): void {
    this.virtualKeys.delete(code);
  }

  releaseAllVirtualKeys(): void {
    this.virtualKeys.clear();
  }

  // ============================================================
  // [🧱 BLOCK: Joystick API — called by MobileControls]
  // ============================================================
  setJoystick(x: number, y: number): void {
    this.joyX = x;
    this.joyY = y;
  }

  clearJoystick(): void {
    this.joyX = 0;
    this.joyY = 0;
  }

  // ============================================================
  // [🧱 BLOCK: hasJoystickInput]
  // True when analog stick is being used (even slightly).
  // Used by Player.update() to choose between WASD vs analog.
  // ============================================================
  get hasJoystickInput(): boolean {
    return this.joyX !== 0 || this.joyY !== 0;
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