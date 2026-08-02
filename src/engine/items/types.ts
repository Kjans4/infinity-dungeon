// src/engine/items/types.ts

// ============================================================
// [🧱 BLOCK: Weapon Types]
// WeaponType — equippable weapons that appear in the registry
//              and can be purchased from the shop.
// AnyWeaponType — includes 'fists' for the bare-fists fallback
//                 used internally by the Weapon class only.
// ============================================================
export type WeaponType    = 'sword' | 'axe' | 'spear';
export type AnyWeaponType = WeaponType | 'fists';

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
  type:  AnyWeaponType;
  name:  string;
  icon:  string;
  light: AttackDef;
  heavy: AttackDef;
}

// ============================================================
// [🧱 BLOCK: Item System Types]
// 'armor' removed — Phase 1 replaces armor sets + charms with
// the unified boon system. See BoonRegistry.ts.
// ============================================================
export type ItemKind = 'boon' | 'weapon';

export interface WeaponItem {
  kind:        'weapon';
  id:          string;
  name:        string;
  icon:        string;
  weaponType:  WeaponType;
  passiveId:   string;
  description: string;
  tradeOff?:   string;
  cost:        number;
}

// ============================================================
// [🧱 BLOCK: BoonItem]
// Flattened shop-offer wrapper for a BoonDef. Description is
// resolved at generation time (level-1 preview text) since shop
// offers represent "acquire this boon", not a specific level —
// the boon takes on whatever level the destination slot has.
// ============================================================
export interface BoonItem {
  kind:        'boon';
  id:          string;   // BoonId
  name:        string;
  icon:        string;
  description: string;
  tradeOff?:   string;
  cost:        number;
}
