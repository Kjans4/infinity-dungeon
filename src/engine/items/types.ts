// src/engine/items/types.ts

// ============================================================
// [🧱 BLOCK: Weapon Types]
// ============================================================
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

// ============================================================
// [🧱 BLOCK: Item System Types]
// ItemKind distinguishes what kind of item is in a shop slot.
// ============================================================
export type ItemKind = 'charm' | 'weapon';

// A named weapon item — combines a weapon type with a
// charm passive effect baked in.
export interface WeaponItem {
  kind:        'weapon';
  id:          string;       // Unique ID e.g. 'bloodfang_sword'
  name:        string;       // Display name
  icon:        string;       // Emoji placeholder
  weaponType:  WeaponType;   // Determines attack shape
  passiveId:   string;       // Which charm effect is baked in
  description: string;       // Passive description
  tradeOff?:   string;       // Red warning text if applicable
  cost:        number;       // Shop price
}