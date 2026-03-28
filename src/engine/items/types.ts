// src/engine/items/types.ts

export type WeaponType = 'sword' | 'axe' | 'spear';

export type HitboxShape =
  | { kind: 'arc';    range: number; arcAngle: number }
  | { kind: 'circle'; radius: number }
  | { kind: 'rect';   length: number; width: number }

export interface AttackDef {
  damage:      number;
  duration:    number;
  staminaCost: number;
  cooldown:    number;
  haltsPlayer: boolean;
  color:       string;
  hitbox:      HitboxShape;
}

export interface WeaponDef {
  type:  WeaponType;
  name:  string;
  icon:  string;
  light: AttackDef;
  heavy: AttackDef;
}