// src/engine/ConsumableRegistry.ts

// ============================================================
// [🧱 BLOCK: Consumable Types]
// ============================================================
export type ConsumableKind = 'potion' | 'scroll';

export type ConsumableId =
  | 'health_potion'
  | 'wrath_potion'
  | 'iron_potion'
  | 'phantom_potion'
  | 'fireball_scroll'
  | 'frost_scroll'
  | 'lightning_scroll'
  | 'blink_scroll'
  | 'ward_scroll'
  | 'void_scroll';

// ============================================================
// [🧱 BLOCK: Slot Cooldown Tiers]
// Each hotbar slot has a fixed cooldown regardless of what
// item is placed in it. Player assigns items to slots manually.
// ============================================================
export const SLOT_COOLDOWNS: [number, number, number, number] = [
  3000,   // Slot 1 — 3s
  4500,   // Slot 2 — 4.5s
  6000,   // Slot 3 — 6s
  7000,   // Slot 4 — 7s
];

// ============================================================
// [🧱 BLOCK: Level Effects]
// Per-level stat arrays. Index 0 = Level 1 (base), index 4 = Level 5.
// Each entry is [primaryEffect, secondaryEffect?].
// The meaning of primary/secondary is item-specific:
//
//   health_potion:   [healAmount]
//   wrath_potion:    [atkBonus, durationMs]
//   iron_potion:     [damageReduction, durationMs]   (DR as 0.0–1.0)
//   phantom_potion:  [durationMs]
//   fireball_scroll: [damage, aoeRadius]
//   frost_scroll:    [damage, freezeMs]
//   lightning_scroll:[damage, chainCount]
//   blink_scroll:    [distance]
//   ward_scroll:     [hitCount, durationMs]
//   void_scroll:     [pullRange, pullStrength]
// ============================================================
export type LevelEffects = [number, number?];

// ============================================================
// [🧱 BLOCK: Upgrade Cost Per Tier]
// Cost to go from level N to level N+1.
// Computed as Math.round(item.cost * multiplier / 5) * 5
// so costs always end in 0 or 5.
// Multipliers: 1→2: ×0.8 | 2→3: ×1.0 | 3→4: ×1.4 | 4→5: ×1.8
// ============================================================
export const UPGRADE_COST_MULTS: [number, number, number, number] = [
  0.8,   // 1 → 2
  1.0,   // 2 → 3
  1.4,   // 3 → 4
  1.8,   // 4 → 5
];

export const MAX_CONSUMABLE_LEVEL = 5;

// ============================================================
// [🧱 BLOCK: Consumable Definition]
// durationMs  — base duration at level 1 (overridden by effectsByLevel
//               for items where duration scales)
// effectValue — level-1 primary effect (kept for backward compat)
// effectsByLevel — full per-level stat array [primary, secondary?]
// ============================================================
export interface ConsumableDef {
  id:             ConsumableId;
  name:           string;
  icon:           string;
  kind:           ConsumableKind;
  description:    string;
  durationMs:     number;    // level-1 base (or 0 for instant)
  effectValue:    number;    // level-1 primary (kept for compat)
  cost:           number;    // shop purchase cost
  effectsByLevel: LevelEffects[];   // index 0 = level 1 … index 4 = level 5
  upgradeDesc:    string;           // short label e.g. "+HP" shown in upgrade pill
}

// ============================================================
// [🧱 BLOCK: Registry]
// ============================================================
export const CONSUMABLE_REGISTRY: Record<ConsumableId, ConsumableDef> = {

  // ── Potions ───────────────────────────────────────────────

  health_potion: {
    id:          'health_potion',
    name:        'Health Potion',
    icon:        '🧪',
    kind:        'potion',
    description: 'Instantly restores HP. Upgrades increase the amount.',
    durationMs:  0,
    effectValue: 40,
    cost:        40,
    upgradeDesc: '+HP',
    // [healAmount]
    effectsByLevel: [
      [40],
      [55],
      [75],
      [100],
      [130],
    ],
  },

  wrath_potion: {
    id:          'wrath_potion',
    name:        'Wrath Potion',
    icon:        '🔥',
    kind:        'potion',
    description: '+ATK and +speed for a duration. Re-use extends +5s.',
    durationMs:  15000,
    effectValue: 25,
    cost:        80,
    upgradeDesc: '+ATK',
    // [atkBonus, durationMs]
    effectsByLevel: [
      [25,  15000],
      [32,  17000],
      [40,  20000],
      [50,  23000],
      [65,  27000],
    ],
  },

  iron_potion: {
    id:          'iron_potion',
    name:        'Iron Potion',
    icon:        '🛡️',
    kind:        'potion',
    description: 'Reduces damage taken for a duration. Re-use extends +5s.',
    durationMs:  10000,
    effectValue: 0.4,
    cost:        70,
    upgradeDesc: '+DR',
    // [damageReduction (0–1), durationMs]
    effectsByLevel: [
      [0.40, 10000],
      [0.48, 12000],
      [0.55, 14000],
      [0.62, 17000],
      [0.70, 20000],
    ],
  },

  phantom_potion: {
    id:          'phantom_potion',
    name:        'Phantom Potion',
    icon:        '👻',
    kind:        'potion',
    description: 'Invisible for a duration — enemies lose aggro. Re-use extends +5s.',
    durationMs:  12000,
    effectValue: 12000,
    cost:        90,
    upgradeDesc: '+Duration',
    // [durationMs]
    effectsByLevel: [
      [12000],
      [16000],
      [20000],
      [25000],
      [32000],
    ],
  },

  // ── Scrolls ───────────────────────────────────────────────

  fireball_scroll: {
    id:          'fireball_scroll',
    name:        'Fireball Scroll',
    icon:        '📜',
    kind:        'scroll',
    description: 'Launches a fireball in facing direction. Explodes on impact.',
    durationMs:  0,
    effectValue: 45,
    cost:        60,
    upgradeDesc: '+Dmg',
    // [damage, aoeRadius]
    effectsByLevel: [
      [45,   90],
      [65,  105],
      [90,  125],
      [120, 148],
      [160, 175],
    ],
  },

  frost_scroll: {
    id:          'frost_scroll',
    name:        'Frost Scroll',
    icon:        '❄️',
    kind:        'scroll',
    description: 'Short-range cone blast. Freezes enemies in area.',
    durationMs:  2000,
    effectValue: 28,
    cost:        65,
    upgradeDesc: '+Dmg',
    // [damage, freezeMs]
    effectsByLevel: [
      [28,  2000],
      [42,  2500],
      [60,  3000],
      [82,  3500],
      [110, 4000],
    ],
  },

  lightning_scroll: {
    id:          'lightning_scroll',
    name:        'Lightning Scroll',
    icon:        '⚡',
    kind:        'scroll',
    description: 'Fires a bolt that chains between nearby enemies.',
    durationMs:  0,
    effectValue: 32,
    cost:        70,
    upgradeDesc: '+Dmg',
    // [damage, chainCount]
    effectsByLevel: [
      [32,  3],
      [48,  4],
      [68,  4],
      [92,  5],
      [125, 5],
    ],
  },

  blink_scroll: {
    id:          'blink_scroll',
    name:        'Blink Scroll',
    icon:        '💨',
    kind:        'scroll',
    description: 'Teleport in facing direction instantly.',
    durationMs:  0,
    effectValue: 300,
    cost:        75,
    upgradeDesc: '+Range',
    // [distance]
    effectsByLevel: [
      [300],
      [380],
      [470],
      [570],
      [680],
    ],
  },

  ward_scroll: {
    id:          'ward_scroll',
    name:        'Ward Scroll',
    icon:        '🔮',
    kind:        'scroll',
    description: 'Absorbs incoming hits for a duration.',
    durationMs:  5000,
    effectValue: 3,
    cost:        80,
    upgradeDesc: '+Hits',
    // [hitCount, durationMs]
    effectsByLevel: [
      [3, 5000],
      [4, 6000],
      [5, 7000],
      [6, 9000],
      [8, 11000],
    ],
  },

  void_scroll: {
    id:          'void_scroll',
    name:        'Void Scroll',
    icon:        '🌀',
    kind:        'scroll',
    description: 'Pulls nearby enemies toward a point in facing direction.',
    durationMs:  0,
    effectValue: 160,
    cost:        85,
    upgradeDesc: '+Pull',
    // [pullRange, pullStrength]
    effectsByLevel: [
      [160, 20],
      [200, 25],
      [250, 32],
      [310, 40],
      [380, 50],
    ],
  },
};

// ============================================================
// [🧱 BLOCK: Level Effect Helpers]
// Convenience getters used by ConsumableSystem.
// ============================================================

/** Returns the LevelEffects tuple for a given consumable at a given level (1–5). */
export function getEffectsAtLevel(def: ConsumableDef, level: number): LevelEffects {
  const idx = Math.max(0, Math.min(MAX_CONSUMABLE_LEVEL - 1, level - 1));
  return def.effectsByLevel[idx];
}

/** Returns the gold cost to upgrade from currentLevel to currentLevel+1. */
export function getUpgradeCost(def: ConsumableDef, currentLevel: number): number {
  if (currentLevel >= MAX_CONSUMABLE_LEVEL) return Infinity;
  const mult = UPGRADE_COST_MULTS[currentLevel - 1];
  return Math.round((def.cost * mult) / 5) * 5;
}

// ============================================================
// [🧱 BLOCK: Pool Arrays]
// ============================================================
export const POTION_POOL: ConsumableDef[] = [
  CONSUMABLE_REGISTRY.health_potion,
  CONSUMABLE_REGISTRY.wrath_potion,
  CONSUMABLE_REGISTRY.iron_potion,
  CONSUMABLE_REGISTRY.phantom_potion,
];

export const SCROLL_POOL: ConsumableDef[] = [
  CONSUMABLE_REGISTRY.fireball_scroll,
  CONSUMABLE_REGISTRY.frost_scroll,
  CONSUMABLE_REGISTRY.lightning_scroll,
  CONSUMABLE_REGISTRY.blink_scroll,
  CONSUMABLE_REGISTRY.ward_scroll,
  CONSUMABLE_REGISTRY.void_scroll,
];

export const ALL_CONSUMABLES: ConsumableDef[] = [
  ...POTION_POOL,
  ...SCROLL_POOL,
];

// ============================================================
// [🧱 BLOCK: Helpers]
// ============================================================
export function getConsumable(id: ConsumableId): ConsumableDef {
  return CONSUMABLE_REGISTRY[id];
}