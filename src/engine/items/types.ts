// src/engine/items/types.ts

// ============================================================
// [🧱 BLOCK: Weapon Types]
// ============================================================
export type WeaponType = 'sword' | 'axe' | 'spear';
export type AttackMode = 'light' | 'heavy';

// ============================================================
// [🧱 BLOCK: Hitbox Shapes]
// Each weapon uses a different collision shape.
// ============================================================
export type HitboxShape =
  | { kind: 'arc';    range: number; arcAngle: number }  // Sword — fan sweep
  | { kind: 'circle'; radius: number }                   // Axe   — full circle
  | { kind: 'rect';   length: number; width: number }    // Spear — thin rectangle

// ============================================================
// [🧱 BLOCK: Attack Definition]
// One entry per attack mode (light/heavy) per weapon.
// ============================================================
export interface AttackDef {
  damage:       number;
  duration:     number;   // ms — how long the hitbox is active
  staminaCost:  number;
  cooldown:     number;   // ms — only enforced on heavy
  haltsPlayer:  boolean;
  color:        string;   // Canvas fill color for the visual
  hitbox:       HitboxShape;
}

// ============================================================
// [🧱 BLOCK: Weapon Definition]
// ============================================================
export interface WeaponDef {
  type:  WeaponType;
  name:  string;
  icon:  string;
  light: AttackDef;
  heavy: AttackDef;
}