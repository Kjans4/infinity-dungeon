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
  | { kind: 'arc';  range: number; arcAngle: number }   // Sword
  | { kind: 'circle'; radius: number }                   // Axe
  | { kind: 'rect'; length: number; width: number }      // Spear

// ============================================================
// [🧱 BLOCK: Attack Definition]
// One entry per attack mode per weapon.
// ============================================================
export interface AttackDef {
  damage:    number;
  duration:  number;  // ms — how long hitbox is active
  hitbox:    HitboxShape;
  staminaCost: number;
  cooldown:  number;  // ms — only used for heavy
  color:     string;  // Visual color of the attack shape
  haltsPlayer: boolean;
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