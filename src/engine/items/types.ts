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
export type ItemKind = 'charm' | 'weapon' | 'armor';

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

// ============================================================
// [🧱 BLOCK: Armor Types]
// ArmorSlot — which of the 5 equipment slots this piece fills.
// ArmorStatType — what stat the piece affects (fixed per slot).
// ArmorSetId — which of the 3 sets this piece belongs to.
// ============================================================
export type ArmorSlot    = 'helmet' | 'armor' | 'boots' | 'gloves' | 'weapon';
export type ArmorStatType = 'maxHp' | 'damageReduction' | 'moveSpeed' | 'atk';
export type ArmorSetId   = 'iron_warden' | 'shadow_walker' | 'blood_reaper';

// ── Slot → stat type mapping (one-to-one, fixed) ─────────────
export const ARMOR_SLOT_STAT: Record<ArmorSlot, ArmorStatType> = {
  helmet: 'maxHp',
  armor:  'damageReduction',
  boots:  'moveSpeed',
  gloves: 'atk',
  weapon: 'atk',   // weapon slot contributes ATK for set purposes
};

// ── Stat scaling per slot ─────────────────────────────────────
// value = base + floor(floor * rate), capped at max
export interface ArmorStatScale {
  base:  number;
  rate:  number;   // added per floor
  max:   number;   // absolute cap
}

export const ARMOR_STAT_SCALE: Record<ArmorSlot, ArmorStatScale> = {
  helmet: { base: 10,   rate: 1.5,  max: 25   },  // +HP
  armor:  { base: 0.05, rate: 0.007,max: 0.12  },  // damage reduction (fraction)
  boots:  { base: 0.3,  rate: 0.05, max: 0.8   },  // move speed
  gloves: { base: 5,    rate: 1.0,  max: 15    },  // atk
  weapon: { base: 5,    rate: 1.0,  max: 15    },  // atk (weapon slot piece)
};

// ============================================================
// [🧱 BLOCK: ArmorItem Interface]
// A single armor piece that lives in a slot.
// stat value is computed at drop/purchase time based on floor.
// ============================================================
export interface ArmorItem {
  kind:        'armor';
  id:          string;        // e.g. 'iron_warden_helmet'
  name:        string;        // e.g. 'Iron Warden Helmet'
  icon:        string;        // Emoji
  slot:        ArmorSlot;
  setId:       ArmorSetId;
  setName:     string;        // e.g. 'Iron Warden'
  statType:    ArmorStatType;
  statValue:   number;        // computed at instantiation
  description: string;        // e.g. '+18 Max HP'
  cost:        number;        // shop price
}