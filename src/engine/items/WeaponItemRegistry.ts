// src/engine/items/WeaponItemRegistry.ts
import { WeaponItem } from "./types";

// ============================================================
// [🧱 BLOCK: Named Weapon Pool]
// Each weapon has a type (attack shape) + one charm passive.
// passiveId maps to a charm ID in CharmRegistry.ts.
// ============================================================
export const WEAPON_ITEM_POOL: WeaponItem[] = [

  // ── Swords ─────────────────────────────────────────────────
  {
    kind:        'weapon',
    id:          'bloodfang_sword',
    name:        'Bloodfang Sword',
    icon:        '🗡️',
    weaponType:  'sword',
    passiveId:   'blood_pact',
    description: 'Kills heal 3 HP.',
    cost:        80,
  },
  {
    kind:        'weapon',
    id:          'ironclad_sword',
    name:        'Ironclad Sword',
    icon:        '🗡️',
    weaponType:  'sword',
    passiveId:   'iron_skin',
    description: 'Take 15% less damage.',
    cost:        100,
  },
  {
    kind:        'weapon',
    id:          'berserker_blade',
    name:        'Berserker Blade',
    icon:        '🗡️',
    weaponType:  'sword',
    passiveId:   'berserker',
    description: '+10 attack damage.',
    tradeOff:    'Stamina regen -30%',
    cost:        80,
  },
  {
    kind:        'weapon',
    id:          'overclock_sword',
    name:        'Overclock Sword',
    icon:        '🗡️',
    weaponType:  'sword',
    passiveId:   'overclock',
    description: 'Stamina regen +50%.',
    cost:        80,
  },

  // ── Axes ────────────────────────────────────────────────────
  {
    kind:        'weapon',
    id:          'titans_axe',
    name:        "Titan's Axe",
    icon:        '🪓',
    weaponType:  'axe',
    passiveId:   'juggernaut',
    description: '+30 max HP.',
    tradeOff:    'Move speed -0.5',
    cost:        100,
  },
  {
    kind:        'weapon',
    id:          'reapers_axe',
    name:        "Reaper's Axe",
    icon:        '🪓',
    weaponType:  'axe',
    passiveId:   'glass_cannon',
    description: '+20 attack damage.',
    tradeOff:    '-30 max HP',
    cost:        60,
  },
  {
    kind:        'weapon',
    id:          'vampire_axe',
    name:        'Vampire Axe',
    icon:        '🪓',
    weaponType:  'axe',
    passiveId:   'vampire',
    description: 'Kills heal 5 HP.',
    tradeOff:    '-10 max HP',
    cost:        90,
  },

  // ── Spears ─────────────────────────────────────────────────
  {
    kind:        'weapon',
    id:          'swift_spear',
    name:        'Swift Spear',
    icon:        '🔱',
    weaponType:  'spear',
    passiveId:   'momentum',
    description: 'Dash costs 20 stamina instead of 30.',
    cost:        70,
  },
  {
    kind:        'weapon',
    id:          'thunder_spear',
    name:        'Thunder Spear',
    icon:        '🔱',
    weaponType:  'spear',
    passiveId:   'executioner',
    description: 'Heavy kills release a shockwave.',
    cost:        120,
  },
  {
    kind:        'weapon',
    id:          'last_rite_spear',
    name:        'Last Rite Spear',
    icon:        '🔱',
    weaponType:  'spear',
    passiveId:   'last_stand',
    description: 'Below 25% HP: +15 attack damage.',
    cost:        110,
  },
];

// ============================================================
// [🧱 BLOCK: Helper]
// ============================================================
export function getRandomWeaponItems(
  excludeIds: string[],
  count:      number = 3
): WeaponItem[] {
  const available = WEAPON_ITEM_POOL.filter(
    (w: WeaponItem) => !excludeIds.includes(w.id)
  );
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}