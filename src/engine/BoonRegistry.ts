// src/engine/BoonRegistry.ts
import { Player }     from "./Player";
import { GameState }  from "./GameState";
import { BaseEnemy }  from "./enemy/BaseEnemy";
import { spawnBurst } from "./Particle";

// ============================================================
// [🧱 BLOCK: Boon Types]
// ============================================================
export type BoonId =
  | 'iron_warden'      // was armor set
  | 'shadow_walker'    // was armor set
  | 'blood_reaper'     // was armor set
  | 'blood_pact'
  | 'iron_skin'
  | 'glass_cannon'
  | 'berserker'
  | 'momentum'
  | 'executioner'
  | 'vampire'
  | 'overclock'
  | 'juggernaut'
  | 'last_stand';

export const MAX_BOON_LEVEL = 5;

// ============================================================
// [🧱 BLOCK: Stat Modifiers]
// Moved from CharmRegistry.ts — additive modifiers applied on
// top of base stats. PlayerStats reads these to compute final
// values. Boons write into this shared struct via onEquip/onRemove.
// ============================================================
export interface PlayerStatModifiers {
  bonusAtk:          number;  // Flat ATK bonus
  bonusMaxHp:        number;  // Flat max HP bonus
  bonusMaxStamina:   number;  // Flat max stamina bonus
  bonusSpeed:        number;  // Flat speed bonus
  damageReduction:   number;  // 0.0 → 1.0 (percentage)
  staminaRegenMult:  number;  // Multiplier (1.0 = normal)
  dashCostReduction: number;  // Flat reduction to dash cost
  healOnKill:        number;  // HP healed per kill
}

export function defaultModifiers(): PlayerStatModifiers {
  return {
    bonusAtk:          0,
    bonusMaxHp:        0,
    bonusMaxStamina:   0,
    bonusSpeed:        0,
    damageReduction:   0,
    staminaRegenMult:  1.0,
    dashCostReduction: 0,
    healOnKill:        0,
  };
}

// ============================================================
// [🧱 BLOCK: Boon Level Effect]
// Free-form per-boon stat table. Index 0 = level 1 … index 4 = level 5.
// ============================================================
export type BoonLevelEffect = Record<string, number>;

// ============================================================
// [🧱 BLOCK: Boon Definition]
// onEquip/onRemove must be exact inverses of each other at any
// given level — PlayerBoons calls onRemove(oldLevel) then
// onEquip(newLevel) whenever a slot is leveled up or a boon is
// swapped into a differently-leveled slot.
// ============================================================
export interface BoonDef {
  id:             BoonId;
  name:           string;
  icon:           string;
  description:    (level: number) => string;
  tradeOff?:      string;
  cost:           number;
  effectsByLevel: BoonLevelEffect[];   // index 0 = level 1 … index 4 = level 5

  onEquip:  (player: Player, mods: PlayerStatModifiers, level: number) => void;
  onRemove: (player: Player, mods: PlayerStatModifiers, level: number) => void;
}

// ============================================================
// [🧱 BLOCK: Level Effect Helper]
// ============================================================
export function getBoonEffectsAtLevel(def: BoonDef, level: number): BoonLevelEffect {
  const idx = Math.max(0, Math.min(MAX_BOON_LEVEL - 1, level - 1));
  return def.effectsByLevel[idx];
}

// ============================================================
// [🧱 BLOCK: Boon Pool]
// 13 boons — 3 former armor sets + 10 former charms, converted
// to individually-leveled boons. Values ported from the Phase 1
// spec's draft tables.
// ============================================================
export const BOON_POOL: BoonDef[] = [

  // ── Iron Warden (was armor set) ────────────────────────────
  {
    id: 'iron_warden', name: 'Iron Warden', icon: '🛡',
    description: (lvl) => {
      const dr = [8, 12, 16, 20, 25][lvl - 1];
      return lvl >= 5
        ? `+${dr}% damage reduction. 20% chance to reflect 10 dmg on hit taken.`
        : `+${dr}% damage reduction.`;
    },
    cost: 90,
    effectsByLevel: [
      { damageReduction: 0.08 },
      { damageReduction: 0.12 },
      { damageReduction: 0.16 },
      { damageReduction: 0.20 },
      { damageReduction: 0.25 },
    ],
    onEquip:  (_p, m, lvl) => { m.damageReduction += getBoonEffectsAtLevel(BOON_POOL_REF.iron_warden, lvl).damageReduction; },
    onRemove: (_p, m, lvl) => { m.damageReduction -= getBoonEffectsAtLevel(BOON_POOL_REF.iron_warden, lvl).damageReduction; },
  },

  // ── Shadow Walker (was armor set) ──────────────────────────
  {
    id: 'shadow_walker', name: 'Shadow Walker', icon: '🥷',
    description: (lvl) => {
      const dc = [8, 12, 15, 18, 20][lvl - 1];
      const sp = [0, 0.5, 1.0, 1.5, 2.0][lvl - 1];
      const spTxt = sp > 0 ? `, +${sp} move speed` : '';
      return lvl >= 5
        ? `Dash cost −${dc}${spTxt}. Dash grants 0.6s invisibility — enemies freeze.`
        : `Dash cost −${dc}${spTxt}.`;
    },
    cost: 90,
    effectsByLevel: [
      { dashCostReduction: 8,  bonusSpeed: 0   },
      { dashCostReduction: 12, bonusSpeed: 0.5 },
      { dashCostReduction: 15, bonusSpeed: 1.0 },
      { dashCostReduction: 18, bonusSpeed: 1.5 },
      { dashCostReduction: 20, bonusSpeed: 2.0 },
    ],
    onEquip:  (_p, m, lvl) => {
      const fx = getBoonEffectsAtLevel(BOON_POOL_REF.shadow_walker, lvl);
      m.dashCostReduction += fx.dashCostReduction;
      m.bonusSpeed        += fx.bonusSpeed;
    },
    onRemove: (_p, m, lvl) => {
      const fx = getBoonEffectsAtLevel(BOON_POOL_REF.shadow_walker, lvl);
      m.dashCostReduction -= fx.dashCostReduction;
      m.bonusSpeed        -= fx.bonusSpeed;
    },
  },

  // ── Blood Reaper (was armor set) ───────────────────────────
  {
    id: 'blood_reaper', name: 'Blood Reaper', icon: '🩸',
    description: (lvl) => {
      const atk  = [5, 7, 9, 11, 14][lvl - 1];
      const heal = [0, 3, 5, 7, 10][lvl - 1];
      const healTxt = heal > 0 ? `, heal ${heal} HP/kill` : '';
      return lvl >= 5
        ? `+${atk} attack${healTxt}. Every 5th kill triggers a 120px shockwave.`
        : `+${atk} attack${healTxt}.`;
    },
    cost: 100,
    effectsByLevel: [
      { bonusAtk: 5,  healOnKill: 0  },
      { bonusAtk: 7,  healOnKill: 3  },
      { bonusAtk: 9,  healOnKill: 5  },
      { bonusAtk: 11, healOnKill: 7  },
      { bonusAtk: 14, healOnKill: 10 },
    ],
    onEquip:  (_p, m, lvl) => {
      const fx = getBoonEffectsAtLevel(BOON_POOL_REF.blood_reaper, lvl);
      m.bonusAtk   += fx.bonusAtk;
      m.healOnKill += fx.healOnKill;
    },
    onRemove: (_p, m, lvl) => {
      const fx = getBoonEffectsAtLevel(BOON_POOL_REF.blood_reaper, lvl);
      m.bonusAtk   -= fx.bonusAtk;
      m.healOnKill -= fx.healOnKill;
    },
  },

  // ── Blood Pact ──────────────────────────────────────────────
  {
    id: 'blood_pact', name: 'Blood Pact', icon: '🩸',
    description: (lvl) => `Each kill heals ${[3, 5, 7, 9, 12][lvl - 1]} HP.`,
    cost: 80,
    effectsByLevel: [
      { healOnKill: 3 }, { healOnKill: 5 }, { healOnKill: 7 }, { healOnKill: 9 }, { healOnKill: 12 },
    ],
    onEquip:  (_p, m, lvl) => { m.healOnKill += getBoonEffectsAtLevel(BOON_POOL_REF.blood_pact, lvl).healOnKill; },
    onRemove: (_p, m, lvl) => { m.healOnKill -= getBoonEffectsAtLevel(BOON_POOL_REF.blood_pact, lvl).healOnKill; },
  },

  // ── Iron Skin ───────────────────────────────────────────────
  {
    id: 'iron_skin', name: 'Iron Skin', icon: '🛡️',
    description: (lvl) => `Take ${Math.round([0.12, 0.16, 0.20, 0.26, 0.32][lvl - 1] * 100)}% less damage.`,
    cost: 100,
    effectsByLevel: [
      { damageReduction: 0.12 }, { damageReduction: 0.16 }, { damageReduction: 0.20 },
      { damageReduction: 0.26 }, { damageReduction: 0.32 },
    ],
    onEquip:  (_p, m, lvl) => { m.damageReduction += getBoonEffectsAtLevel(BOON_POOL_REF.iron_skin, lvl).damageReduction; },
    onRemove: (_p, m, lvl) => { m.damageReduction -= getBoonEffectsAtLevel(BOON_POOL_REF.iron_skin, lvl).damageReduction; },
  },

  // ── Glass Cannon ────────────────────────────────────────────
  {
    id: 'glass_cannon', name: 'Glass Cannon', icon: '💥',
    description: (lvl) => `+${[15, 20, 26, 33, 42][lvl - 1]} attack damage.`,
    tradeOff: '-30 max HP',
    cost: 60,
    effectsByLevel: [
      { bonusAtk: 15 }, { bonusAtk: 20 }, { bonusAtk: 26 }, { bonusAtk: 33 }, { bonusAtk: 42 },
    ],
    onEquip:  (p, m, lvl) => {
      m.bonusAtk   += getBoonEffectsAtLevel(BOON_POOL_REF.glass_cannon, lvl).bonusAtk;
      m.bonusMaxHp -= 30;
    },
    onRemove: (_p, m, lvl) => {
      m.bonusAtk   -= getBoonEffectsAtLevel(BOON_POOL_REF.glass_cannon, lvl).bonusAtk;
      m.bonusMaxHp += 30;
    },
  },

  // ── Berserker ───────────────────────────────────────────────
  {
    id: 'berserker', name: 'Berserker', icon: '⚔️',
    description: (lvl) => {
      const atk = [8, 11, 14, 18, 23][lvl - 1];
      const pen = Math.round([0.30, 0.29, 0.28, 0.27, 0.25][lvl - 1] * 100);
      return `+${atk} attack damage. Stamina regen −${pen}%.`;
    },
    cost: 80,
    effectsByLevel: [
      { bonusAtk: 8,  staminaRegenPenalty: 0.30 },
      { bonusAtk: 11, staminaRegenPenalty: 0.29 },
      { bonusAtk: 14, staminaRegenPenalty: 0.28 },
      { bonusAtk: 18, staminaRegenPenalty: 0.27 },
      { bonusAtk: 23, staminaRegenPenalty: 0.25 },
    ],
    onEquip:  (_p, m, lvl) => {
      const fx = getBoonEffectsAtLevel(BOON_POOL_REF.berserker, lvl);
      m.bonusAtk         += fx.bonusAtk;
      m.staminaRegenMult *= (1 - fx.staminaRegenPenalty);
    },
    onRemove: (_p, m, lvl) => {
      const fx = getBoonEffectsAtLevel(BOON_POOL_REF.berserker, lvl);
      m.bonusAtk         -= fx.bonusAtk;
      m.staminaRegenMult /= (1 - fx.staminaRegenPenalty);
    },
  },

  // ── Momentum ────────────────────────────────────────────────
  {
    id: 'momentum', name: 'Momentum', icon: '💨',
    description: (lvl) => `Dash costs ${[8, 11, 14, 17, 20][lvl - 1]} less stamina.`,
    cost: 70,
    effectsByLevel: [
      { dashCostReduction: 8 }, { dashCostReduction: 11 }, { dashCostReduction: 14 },
      { dashCostReduction: 17 }, { dashCostReduction: 20 },
    ],
    onEquip:  (_p, m, lvl) => { m.dashCostReduction += getBoonEffectsAtLevel(BOON_POOL_REF.momentum, lvl).dashCostReduction; },
    onRemove: (_p, m, lvl) => { m.dashCostReduction -= getBoonEffectsAtLevel(BOON_POOL_REF.momentum, lvl).dashCostReduction; },
  },

  // ── Executioner ─────────────────────────────────────────────
  // No passive stat — trigger logic lives in HordeSystem/BossSystem
  // (Batch 2), reading radius/damage via getBoonEffectsAtLevel.
  {
    id: 'executioner', name: 'Executioner', icon: '🪓',
    description: (lvl) => {
      const [r, d] = [[80, 20], [90, 25], [100, 32], [115, 40], [130, 50]][lvl - 1];
      return `Heavy kills release a ${r}px shockwave dealing ${d} damage.`;
    },
    cost: 120,
    effectsByLevel: [
      { radius: 80,  damage: 20 },
      { radius: 90,  damage: 25 },
      { radius: 100, damage: 32 },
      { radius: 115, damage: 40 },
      { radius: 130, damage: 50 },
    ],
    onEquip:  () => {},
    onRemove: () => {},
  },

  // ── Vampire ─────────────────────────────────────────────────
  {
    id: 'vampire', name: 'Vampire', icon: '🧛',
    description: (lvl) => `Each kill heals ${[5, 7, 9, 12, 16][lvl - 1]} HP.`,
    tradeOff: '-10 max HP',
    cost: 90,
    effectsByLevel: [
      { healOnKill: 5 }, { healOnKill: 7 }, { healOnKill: 9 }, { healOnKill: 12 }, { healOnKill: 16 },
    ],
    onEquip:  (_p, m, lvl) => {
      m.healOnKill += getBoonEffectsAtLevel(BOON_POOL_REF.vampire, lvl).healOnKill;
      m.bonusMaxHp -= 10;
    },
    onRemove: (_p, m, lvl) => {
      m.healOnKill -= getBoonEffectsAtLevel(BOON_POOL_REF.vampire, lvl).healOnKill;
      m.bonusMaxHp += 10;
    },
  },

  // ── Overclock ───────────────────────────────────────────────
  {
    id: 'overclock', name: 'Overclock', icon: '⚡',
    description: (lvl) => `Stamina regenerates ${Math.round([0.30, 0.40, 0.50, 0.65, 0.85][lvl - 1] * 100)}% faster.`,
    cost: 80,
    effectsByLevel: [
      { staminaRegenBonus: 0.30 }, { staminaRegenBonus: 0.40 }, { staminaRegenBonus: 0.50 },
      { staminaRegenBonus: 0.65 }, { staminaRegenBonus: 0.85 },
    ],
    onEquip:  (_p, m, lvl) => { m.staminaRegenMult *= (1 + getBoonEffectsAtLevel(BOON_POOL_REF.overclock, lvl).staminaRegenBonus); },
    onRemove: (_p, m, lvl) => { m.staminaRegenMult /= (1 + getBoonEffectsAtLevel(BOON_POOL_REF.overclock, lvl).staminaRegenBonus); },
  },

  // ── Juggernaut ──────────────────────────────────────────────
  {
    id: 'juggernaut', name: 'Juggernaut', icon: '🪨',
    description: (lvl) => `+${[20, 28, 36, 46, 60][lvl - 1]} max HP.`,
    tradeOff: '-0.5 move speed',
    cost: 100,
    effectsByLevel: [
      { bonusMaxHp: 20 }, { bonusMaxHp: 28 }, { bonusMaxHp: 36 }, { bonusMaxHp: 46 }, { bonusMaxHp: 60 },
    ],
    onEquip:  (_p, m, lvl) => {
      m.bonusMaxHp += getBoonEffectsAtLevel(BOON_POOL_REF.juggernaut, lvl).bonusMaxHp;
      m.bonusSpeed -= 0.5;
    },
    onRemove: (_p, m, lvl) => {
      m.bonusMaxHp -= getBoonEffectsAtLevel(BOON_POOL_REF.juggernaut, lvl).bonusMaxHp;
      m.bonusSpeed += 0.5;
    },
  },

  // ── Last Stand ──────────────────────────────────────────────
  // No passive stat — PlayerStats.lastStandBonus() reads this
  // boon's level directly and applies it conditionally on HP.
  {
    id: 'last_stand', name: 'Last Stand', icon: '🔥',
    description: (lvl) => `Below 25% HP: +${[10, 13, 17, 22, 28][lvl - 1]} attack damage.`,
    cost: 110,
    effectsByLevel: [
      { bonusAtk: 10 }, { bonusAtk: 13 }, { bonusAtk: 17 }, { bonusAtk: 22 }, { bonusAtk: 28 },
    ],
    onEquip:  () => {},
    onRemove: () => {},
  },
];

// Self-reference used inside onEquip/onRemove closures above so each
// boon can look up its own effectsByLevel without a forward-reference
// problem during array literal construction.
const BOON_POOL_REF: Record<BoonId, BoonDef> = BOON_POOL.reduce((acc, b) => {
  acc[b.id] = b;
  return acc;
}, {} as Record<BoonId, BoonDef>);

// ============================================================
// [🧱 BLOCK: Registry Helpers]
// ============================================================
export function getBoonById(id: BoonId | string): BoonDef | undefined {
  return BOON_POOL.find((b) => b.id === id);
}

/** Get `count` random boons excluding ones already owned/pending. */
export function getRandomBoons(excludeIds: string[], count: number = 3): BoonDef[] {
  const available = BOON_POOL.filter((b) => !excludeIds.includes(b.id));
  const shuffled   = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ============================================================
// [🧱 BLOCK: Ultimate Effects — Level 5 Only]
// Ported from the old ArmorRegistry.ts 5-piece bonuses. Called
// externally by HordeSystem/BossSystem (Batch 2) — not wired
// through onHit/onKill hooks, matching the original design where
// these were free functions gated on an "equipped count" check
// (now a boon-level check instead).
// ============================================================

export function tryIronWardenReflect(level: number, attacker: BaseEnemy): void {
  if (level < MAX_BOON_LEVEL) return;
  if (Math.random() < 0.20) {
    attacker.takeDamage(10);
  }
}

export function applyShadowWalkerFreeze(level: number, enemies: BaseEnemy[]): void {
  if (level < MAX_BOON_LEVEL) return;
  enemies.forEach((e) => {
    if (!e.isDead) e.applyStun(600);
  });
}

const BLOOD_REAPER_INTERVAL = 5;
const BLOOD_REAPER_RADIUS   = 120;
const BLOOD_REAPER_DAMAGE   = 25;

let bloodReaperKillCount = 0;

export function resetBloodReaperCounter(): void {
  bloodReaperKillCount = 0;
}

export function onBloodReaperKill(
  level:       number,
  killedEnemy: BaseEnemy,
  allEnemies:  BaseEnemy[],
  state:       GameState
): void {
  if (level < MAX_BOON_LEVEL) return;
  bloodReaperKillCount++;
  if (bloodReaperKillCount % BLOOD_REAPER_INTERVAL !== 0) return;

  const cx = killedEnemy.x + killedEnemy.width  / 2;
  const cy = killedEnemy.y + killedEnemy.height / 2;

  allEnemies.forEach((e) => {
    if (e.isDead || e === killedEnemy) return;
    const dx = (e.x + e.width  / 2) - cx;
    const dy = (e.y + e.height / 2) - cy;
    if (dx * dx + dy * dy < BLOOD_REAPER_RADIUS * BLOOD_REAPER_RADIUS) {
      e.takeDamage(BLOOD_REAPER_DAMAGE);
    }
  });

  state.particles.push(...spawnBurst(cx, cy, '#f87171', 14, 1.6));
}

/** Executioner heavy-kill shockwave — called externally when player has this boon equipped and lands a heavy kill. */
export function triggerExecutionerShockwave(
  level: number,
  state: GameState,
  cx: number, cy: number
): void {
  const def = getBoonById('executioner');
  if (!def) return;
  const fx = getBoonEffectsAtLevel(def, level);
  state.enemies.forEach((enemy) => {
    if (enemy.isDead) return;
    const ex   = enemy.x + enemy.width  / 2;
    const ey   = enemy.y + enemy.height / 2;
    const dist = Math.sqrt((cx - ex) ** 2 + (cy - ey) ** 2);
    if (dist < fx.radius) enemy.takeDamage(fx.damage);
  });
  state.particles.push(...spawnBurst(cx, cy, '#facc15', 12, 1.4));
}
