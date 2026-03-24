// src/engine/CharmRegistry.ts

import { Player } from "./Player";

// ============================================================
// [🧱 BLOCK: Charm Interface]
// ============================================================
export interface Charm {
  id:          string;
  name:        string;
  icon:        string;       // Emoji placeholder
  description: string;
  cost:        number;
  tradeOff?:   string;       // Shown in red if present

  // Called once when charm is equipped
  onEquip:   (player: Player, stats: PlayerStatModifiers) => void;
  // Called once when charm is sold/removed
  onRemove:  (player: Player, stats: PlayerStatModifiers) => void;
  // Called every kill (optional)
  onKill?:   (player: Player, stats: PlayerStatModifiers) => void;
  // Called when player takes damage (optional)
  onHit?:    (player: Player, stats: PlayerStatModifiers) => void;
}

// ============================================================
// [🧱 BLOCK: Stat Modifiers]
// Additive modifiers applied on top of base stats.
// PlayerStats reads these to compute final values.
// ============================================================
export interface PlayerStatModifiers {
  bonusAtk:        number;  // Flat ATK bonus
  bonusMaxHp:      number;  // Flat max HP bonus
  bonusMaxStamina: number;  // Flat max stamina bonus
  bonusSpeed:      number;  // Flat speed bonus
  damageReduction: number;  // 0.0 → 1.0 (percentage)
  staminaRegenMult:number;  // Multiplier (1.0 = normal)
  dashCostReduction:number; // Flat reduction to dash cost
  healOnKill:      number;  // HP healed per kill
}

export function defaultModifiers(): PlayerStatModifiers {
  return {
    bonusAtk:         0,
    bonusMaxHp:       0,
    bonusMaxStamina:  0,
    bonusSpeed:       0,
    damageReduction:  0,
    staminaRegenMult: 1.0,
    dashCostReduction:0,
    healOnKill:       0,
  };
}

// ============================================================
// [🧱 BLOCK: Charm Pool]
// Add new charms here — everything else picks from this list.
// ============================================================
export const CHARM_POOL: Charm[] = [
  // ── Blood Pact ──────────────────────────────────────────
  {
    id:          'blood_pact',
    name:        'Blood Pact',
    icon:        '🩸',
    description: 'Each kill heals 3 HP.',
    cost:        80,
    onEquip:  (_, m) => { m.healOnKill += 3; },
    onRemove: (_, m) => { m.healOnKill -= 3; },
    onKill:   (p)    => { p.hp = Math.min(p.maxHp ?? 100, p.hp + 3); },
  },

  // ── Iron Skin ───────────────────────────────────────────
  {
    id:          'iron_skin',
    name:        'Iron Skin',
    icon:        '🛡️',
    description: 'Take 15% less damage.',
    cost:        100,
    onEquip:  (_, m) => { m.damageReduction += 0.15; },
    onRemove: (_, m) => { m.damageReduction -= 0.15; },
  },

  // ── Glass Cannon ────────────────────────────────────────
  {
    id:          'glass_cannon',
    name:        'Glass Cannon',
    icon:        '💥',
    description: '+20 attack damage.',
    cost:        60,
    tradeOff:    '-30 max HP',
    onEquip:  (p, m) => { m.bonusAtk += 20; m.bonusMaxHp -= 30; p.hp = Math.min(p.hp, (p.maxHp ?? 100) - 30); },
    onRemove: (_, m) => { m.bonusAtk -= 20; m.bonusMaxHp += 30; },
  },

  // ── Berserker ───────────────────────────────────────────
  {
    id:          'berserker',
    name:        'Berserker',
    icon:        '⚔️',
    description: '+10 attack damage.',
    cost:        80,
    tradeOff:    'Stamina regen -30%',
    onEquip:  (_, m) => { m.bonusAtk += 10; m.staminaRegenMult *= 0.7; },
    onRemove: (_, m) => { m.bonusAtk -= 10; m.staminaRegenMult /= 0.7; },
  },

  // ── Momentum ────────────────────────────────────────────
  {
    id:          'momentum',
    name:        'Momentum',
    icon:        '💨',
    description: 'Dash costs 20 stamina instead of 30.',
    cost:        70,
    onEquip:  (_, m) => { m.dashCostReduction += 10; },
    onRemove: (_, m) => { m.dashCostReduction -= 10; },
  },

  // ── Executioner ─────────────────────────────────────────
  {
    id:          'executioner',
    name:        'Executioner',
    icon:        '🪓',
    description: 'Heavy attack kills release a shockwave dealing 25 damage nearby.',
    cost:        120,
    onEquip:  () => {},
    onRemove: () => {},
    // Shockwave logic handled in HordeSystem when charm is active
  },

  // ── Vampire ─────────────────────────────────────────────
  {
    id:          'vampire',
    name:        'Vampire',
    icon:        '🧛',
    description: 'Each kill heals 5 HP.',
    cost:        90,
    tradeOff:    '-10 max HP',
    onEquip:  (p, m) => { m.healOnKill += 5; m.bonusMaxHp -= 10; p.hp = Math.min(p.hp, (p.maxHp ?? 100) - 10); },
    onRemove: (_, m) => { m.healOnKill -= 5; m.bonusMaxHp += 10; },
    onKill:   (p)    => { p.hp = Math.min(p.maxHp ?? 100, p.hp + 5); },
  },

  // ── Overclock ───────────────────────────────────────────
  {
    id:          'overclock',
    name:        'Overclock',
    icon:        '⚡',
    description: 'Stamina regenerates 50% faster.',
    cost:        80,
    onEquip:  (_, m) => { m.staminaRegenMult *= 1.5; },
    onRemove: (_, m) => { m.staminaRegenMult /= 1.5; },
  },

  // ── Juggernaut ──────────────────────────────────────────
  {
    id:          'juggernaut',
    name:        'Juggernaut',
    icon:        '🪨',
    description: '+30 max HP.',
    cost:        100,
    tradeOff:    'Move speed -0.5',
    onEquip:  (_, m) => { m.bonusMaxHp += 30; m.bonusSpeed -= 0.5; },
    onRemove: (_, m) => { m.bonusMaxHp -= 30; m.bonusSpeed += 0.5; },
  },

  // ── Last Stand ──────────────────────────────────────────
  {
    id:          'last_stand',
    name:        'Last Stand',
    icon:        '🔥',
    description: 'Below 25% HP: +15 attack damage.',
    cost:        110,
    onEquip:  () => {},
    onRemove: () => {},
    // Conditional ATK bonus applied dynamically in HordeSystem/BossSystem
  },
];

// ============================================================
// [🧱 BLOCK: Registry Helpers]
// ============================================================

// Get 3 random charms excluding ones already owned
export function getRandomCharms(
  owned: string[],
  count: number = 3
): Charm[] {
  const available = CHARM_POOL.filter((c) => !owned.includes(c.id));
  const shuffled  = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function getCharmById(id: string): Charm | undefined {
  return CHARM_POOL.find((c) => c.id === id);
}