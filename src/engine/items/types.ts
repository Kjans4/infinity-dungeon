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
// ============================================================
export type ItemKind = 'charm' | 'weapon' | 'armor';

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
// [🧱 BLOCK: Armor Types]
// ArmorSlot — 'weapon' replaced with 'leggings'
// Slot order: helmet, armor, leggings, gloves, boots
// ============================================================
export type ArmorSlot    = 'helmet' | 'armor' | 'leggings' | 'gloves' | 'boots';
export type ArmorStatType = 'maxHp' | 'damageReduction' | 'moveSpeed' | 'atk';
export type ArmorSetId   = 'iron_warden' | 'shadow_walker' | 'blood_reaper';

// ── Slot → stat type mapping ──────────────────────────────────
// leggings replaces weapon slot, gives moveSpeed (boots also moveSpeed — stacks)
export const ARMOR_SLOT_STAT: Record<ArmorSlot, ArmorStatType> = {
  helmet:   'maxHp',
  armor:    'damageReduction',
  leggings: 'moveSpeed',
  gloves:   'atk',
  boots:    'moveSpeed',
};

// ── Stat scaling per slot ─────────────────────────────────────
export interface ArmorStatScale {
  base:  number;
  rate:  number;
  max:   number;
}

export const ARMOR_STAT_SCALE: Record<ArmorSlot, ArmorStatScale> = {
  helmet:   { base: 10,   rate: 1.5,  max: 25   },  // +HP
  armor:    { base: 0.05, rate: 0.007,max: 0.12  },  // damage reduction (fraction)
  leggings: { base: 0.3,  rate: 0.05, max: 0.8   },  // move speed
  gloves:   { base: 5,    rate: 1.0,  max: 15    },  // atk
  boots:    { base: 0.3,  rate: 0.05, max: 0.8   },  // move speed
};

// ============================================================
// [🧱 BLOCK: ArmorItem Interface]
// ============================================================
export interface ArmorItem {
  kind:        'armor';
  id:          string;
  name:        string;
  icon:        string;
  slot:        ArmorSlot;
  setId:       ArmorSetId;
  setName:     string;
  statType:    ArmorStatType;
  statValue:   number;
  description: string;
  cost:        number;
}