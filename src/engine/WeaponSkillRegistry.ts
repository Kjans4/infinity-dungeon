// src/engine/WeaponSkillRegistry.ts

// ============================================================
// [🧱 BLOCK: Skill Slot / Id Types]
// Every weapon rolls ONE Q skill (drawn from the scroll pool)
// and ONE E skill (drawn from the potion pool) on equip —
// random reroll on every equip event, per Phase 3 design.
// ============================================================
export type SkillSlot = 'Q' | 'E';

export type QSkillId =
  | 'fireball'
  | 'frost'
  | 'lightning'
  | 'blink'
  | 'ward'
  | 'void'
  | 'leap';

export type ESkillId =
  | 'wrath'
  | 'iron'
  | 'phantom';

export type SkillId = QSkillId | ESkillId;

// ============================================================
// [🧱 BLOCK: Cooldown — flat placeholder]
// Same cooldown for Q and E, all skills, until real balance
// numbers are decided.
// ============================================================
export const SKILL_COOLDOWN_MS = 3000;

// ============================================================
// [🧱 BLOCK: Level Effects]
// Same [primary, secondary?] shape the old ConsumableRegistry
// used. Index 0 = level 1 … index 4 = level 5.
// ============================================================
export type LevelEffects = [number, number?];

export const MAX_SKILL_LEVEL = 5;

// ============================================================
// [🧱 BLOCK: Skill Definition]
// No `cost` field — skills are never bought individually, they
// come from the weapon's random roll. Leveling is handled by
// the Arcane Focus / Battle Focus boons acting on the slot,
// not on the individual skill.
// ============================================================
export interface SkillDef {
  id:             SkillId;
  name:           string;
  icon:           string;
  slot:           SkillSlot;
  description:    string;
  effectsByLevel: LevelEffects[];   // index 0 = level 1 … index 4 = level 5
}

// ============================================================
// [🧱 BLOCK: Registry — Q Skills (Scrolls)]
// Effect meanings mirror the old scroll definitions 1:1, plus
// the new Leap skill.
//   fireball  — [damage, aoeRadius]
//   frost     — [damage, freezeMs]
//   lightning — [damage, chainCount]
//   blink     — [distance]
//   ward      — [hitCount, durationMs]
//   void      — [pullRange, pullStrength]
//   leap      — [damage, distance]  (gap-closer + impact AoE)
// ============================================================
const Q_SKILLS: Record<QSkillId, SkillDef> = {
  fireball: {
    id: 'fireball', name: 'Fireball', icon: '📜', slot: 'Q',
    description: 'Launches a fireball in facing direction. Explodes on impact.',
    effectsByLevel: [
      [45,   90],
      [65,  105],
      [90,  125],
      [120, 148],
      [160, 175],
    ],
  },
  frost: {
    id: 'frost', name: 'Frost', icon: '❄️', slot: 'Q',
    description: 'Short-range cone blast. Freezes enemies in area.',
    effectsByLevel: [
      [28,  2000],
      [42,  2500],
      [60,  3000],
      [82,  3500],
      [110, 4000],
    ],
  },
  lightning: {
    id: 'lightning', name: 'Lightning', icon: '⚡', slot: 'Q',
    description: 'Fires a bolt that chains between nearby enemies.',
    effectsByLevel: [
      [32,  3],
      [48,  4],
      [68,  4],
      [92,  5],
      [125, 5],
    ],
  },
  blink: {
    id: 'blink', name: 'Blink', icon: '💨', slot: 'Q',
    description: 'Teleport in facing direction instantly.',
    effectsByLevel: [
      [300],
      [380],
      [470],
      [570],
      [680],
    ],
  },
  ward: {
    id: 'ward', name: 'Ward', icon: '🔮', slot: 'Q',
    description: 'Absorbs incoming hits for a duration.',
    effectsByLevel: [
      [3, 5000],
      [4, 6000],
      [5, 7000],
      [6, 9000],
      [8, 11000],
    ],
  },
  void: {
    id: 'void', name: 'Void', icon: '🌀', slot: 'Q',
    description: 'Pulls nearby enemies toward a point in facing direction.',
    effectsByLevel: [
      [160, 20],
      [200, 25],
      [250, 32],
      [310, 40],
      [380, 50],
    ],
  },
  leap: {
    id: 'leap', name: 'Leap', icon: '🦘', slot: 'Q',
    description: 'Leap forward and slam down, damaging enemies at landing.',
    // [damage, distance] — placeholder first-draft numbers
    effectsByLevel: [
      [20, 150],
      [30, 170],
      [42, 190],
      [58, 210],
      [80, 230],
    ],
  },
};

// ============================================================
// [🧱 BLOCK: Registry — E Skills (Potions)]
//   wrath   — [atkBonus, durationMs]
//   iron    — [damageReduction (0–1), durationMs]
//   phantom — [durationMs]
// Health Potion intentionally dropped from the pool — healing
// stays Shop-only via the Healing Arts section.
// ============================================================
const E_SKILLS: Record<ESkillId, SkillDef> = {
  wrath: {
    id: 'wrath', name: 'Wrath', icon: '🔥', slot: 'E',
    description: '+ATK and +speed for a duration. Re-use extends the buff.',
    effectsByLevel: [
      [25,  15000],
      [32,  17000],
      [40,  20000],
      [50,  23000],
      [65,  27000],
    ],
  },
  iron: {
    id: 'iron', name: 'Iron Skin', icon: '🛡️', slot: 'E',
    description: 'Reduces damage taken for a duration. Re-use extends the buff.',
    effectsByLevel: [
      [0.40, 10000],
      [0.48, 12000],
      [0.55, 14000],
      [0.62, 17000],
      [0.70, 20000],
    ],
  },
  phantom: {
    id: 'phantom', name: 'Phantom', icon: '👻', slot: 'E',
    description: 'Invisible for a duration — enemies lose aggro. Re-use extends the buff.',
    effectsByLevel: [
      [12000],
      [16000],
      [20000],
      [25000],
      [32000],
    ],
  },
};

// ============================================================
// [🧱 BLOCK: Pools]
// ============================================================
export const Q_SKILL_POOL: SkillDef[] = Object.values(Q_SKILLS);
export const E_SKILL_POOL: SkillDef[] = Object.values(E_SKILLS);
export const ALL_SKILLS:   SkillDef[] = [...Q_SKILL_POOL, ...E_SKILL_POOL];

// ============================================================
// [🧱 BLOCK: Helpers]
// ============================================================
export function getSkillDef(id: SkillId): SkillDef | undefined {
  return Q_SKILLS[id as QSkillId] ?? E_SKILLS[id as ESkillId];
}

/** Returns the LevelEffects tuple for a given skill at a given level (1–5). */
export function getEffectsAtLevel(def: SkillDef, level: number): LevelEffects {
  const idx = Math.max(0, Math.min(MAX_SKILL_LEVEL - 1, level - 1));
  return def.effectsByLevel[idx];
}

/** Rolls a random Q skill id — called on every weapon equip. */
export function rollQSkill(): QSkillId {
  const pool = Q_SKILL_POOL;
  return pool[Math.floor(Math.random() * pool.length)].id as QSkillId;
}

/** Rolls a random E skill id — called on every weapon equip. */
export function rollESkill(): ESkillId {
  const pool = E_SKILL_POOL;
  return pool[Math.floor(Math.random() * pool.length)].id as ESkillId;
}