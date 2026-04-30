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
// [🧱 BLOCK: Consumable Definition]
// durationMs  — 0 for instant effects (Health Potion)
// effectValue — interpreted by the effect system in Phase 2
// ============================================================
export interface ConsumableDef {
  id:          ConsumableId;
  name:        string;
  icon:        string;
  kind:        ConsumableKind;
  description: string;
  durationMs:  number;   // 0 = instant
  effectValue: number;   // primary numeric effect (hp, atk bonus, etc.)
  cost:        number;   // shop cost
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
    description: 'Instantly restores 30 HP.',
    durationMs:  0,
    effectValue: 30,
    cost:        40,
  },

  wrath_potion: {
    id:          'wrath_potion',
    name:        'Wrath Potion',
    icon:        '🔥',
    kind:        'potion',
    description: '+20 ATK and +1.5 move speed for 15s. Re-use extends duration +5s.',
    durationMs:  15000,
    effectValue: 20,
    cost:        80,
  },

  iron_potion: {
    id:          'iron_potion',
    name:        'Iron Potion',
    icon:        '🛡️',
    kind:        'potion',
    description: '-40% damage taken for 10s. Re-use extends duration +5s.',
    durationMs:  10000,
    effectValue: 0.4,
    cost:        70,
  },

  phantom_potion: {
    id:          'phantom_potion',
    name:        'Phantom Potion',
    icon:        '👻',
    kind:        'potion',
    description: 'Invisible for 12s — enemies lose aggro. Re-use extends duration +5s.',
    durationMs:  12000,
    effectValue: 12000,
    cost:        90,
  },

  // ── Scrolls ───────────────────────────────────────────────

  fireball_scroll: {
    id:          'fireball_scroll',
    name:        'Fireball Scroll',
    icon:        '📜',
    kind:        'scroll',
    description: 'Launches a fireball in facing direction. Explodes on impact.',
    durationMs:  0,
    effectValue: 35,
    cost:        60,
  },

  frost_scroll: {
    id:          'frost_scroll',
    name:        'Frost Scroll',
    icon:        '❄️',
    kind:        'scroll',
    description: 'Short-range cone blast. Freezes enemies in area for 2s.',
    durationMs:  2000,
    effectValue: 20,
    cost:        65,
  },

  lightning_scroll: {
    id:          'lightning_scroll',
    name:        'Lightning Scroll',
    icon:        '⚡',
    kind:        'scroll',
    description: 'Fires a bolt that chains between nearby enemies.',
    durationMs:  0,
    effectValue: 25,
    cost:        70,
  },

  blink_scroll: {
    id:          'blink_scroll',
    name:        'Blink Scroll',
    icon:        '💨',
    kind:        'scroll',
    description: 'Teleport ~300px in facing direction instantly.',
    durationMs:  0,
    effectValue: 300,
    cost:        75,
  },

  ward_scroll: {
    id:          'ward_scroll',
    name:        'Ward Scroll',
    icon:        '🔮',
    kind:        'scroll',
    description: 'Absorbs the next 3 hits within 5s.',
    durationMs:  5000,
    effectValue: 3,
    cost:        80,
  },

  void_scroll: {
    id:          'void_scroll',
    name:        'Void Scroll',
    icon:        '🌀',
    kind:        'scroll',
    description: 'Pulls all nearby enemies toward a point in facing direction.',
    durationMs:  0,
    effectValue: 150,
    cost:        85,
  },
};

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