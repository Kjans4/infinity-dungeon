// src/engine/items/ArmorRegistry.ts
import {
  ArmorItem, ArmorSlot, ArmorSetId, ArmorStatScale,
  ARMOR_STAT_SCALE, ARMOR_SLOT_STAT,
} from "./types";
import { Player } from "../Player";
import { GameState } from "../GameState";
import { BaseEnemy } from "../enemy/BaseEnemy";
import { spawnBurst } from "../Particle";

// ============================================================
// [🧱 BLOCK: Stat Value Computation]
// Computed once at drop/purchase time, stored on the item.
// value = clamp(base + floor(floor * rate), 0, max)
// ============================================================
export function computeArmorStat(slot: ArmorSlot, floor: number): number {
  const scale: ArmorStatScale = ARMOR_STAT_SCALE[slot];
  const raw   = scale.base + Math.floor(floor * scale.rate);
  return Math.min(scale.max, raw);
}

// ============================================================
// [🧱 BLOCK: Armor Piece Templates]
// One template per set per slot.
// statValue is filled in at runtime via computeArmorStat().
// ============================================================
interface ArmorTemplate {
  id:      string;
  name:    string;
  icon:    string;
  slot:    ArmorSlot;
  setId:   ArmorSetId;
  setName: string;
  cost:    number;
}

const ARMOR_TEMPLATES: ArmorTemplate[] = [

  // ── Iron Warden ─────────────────────────────────────────────
  { id: 'iron_warden_helmet', name: 'Iron Warden Helmet', icon: '🪖', slot: 'helmet', setId: 'iron_warden', setName: 'Iron Warden', cost: 90  },
  { id: 'iron_warden_armor',  name: 'Iron Warden Armor',  icon: '🛡', slot: 'armor',  setId: 'iron_warden', setName: 'Iron Warden', cost: 110 },
  { id: 'iron_warden_boots',  name: 'Iron Warden Boots',  icon: '👢', slot: 'boots',  setId: 'iron_warden', setName: 'Iron Warden', cost: 80  },
  { id: 'iron_warden_gloves', name: 'Iron Warden Gloves', icon: '🧤', slot: 'gloves', setId: 'iron_warden', setName: 'Iron Warden', cost: 85  },
  { id: 'iron_warden_sword',  name: 'Iron Warden Sword',  icon: '⚔️', slot: 'weapon', setId: 'iron_warden', setName: 'Iron Warden', cost: 120 },

  // ── Shadow Walker ────────────────────────────────────────────
  { id: 'shadow_walker_helmet', name: 'Shadow Walker Helmet', icon: '🪖', slot: 'helmet', setId: 'shadow_walker', setName: 'Shadow Walker', cost: 90  },
  { id: 'shadow_walker_armor',  name: 'Shadow Walker Armor',  icon: '🥷', slot: 'armor',  setId: 'shadow_walker', setName: 'Shadow Walker', cost: 110 },
  { id: 'shadow_walker_boots',  name: 'Shadow Walker Boots',  icon: '👢', slot: 'boots',  setId: 'shadow_walker', setName: 'Shadow Walker', cost: 80  },
  { id: 'shadow_walker_gloves', name: 'Shadow Walker Gloves', icon: '🧤', slot: 'gloves', setId: 'shadow_walker', setName: 'Shadow Walker', cost: 85  },
  { id: 'shadow_walker_weapon', name: 'Shadow Walker Blade',  icon: '🗡️', slot: 'weapon', setId: 'shadow_walker', setName: 'Shadow Walker', cost: 120 },

  // ── Blood Reaper ─────────────────────────────────────────────
  { id: 'blood_reaper_helmet', name: 'Blood Reaper Helmet', icon: '💀', slot: 'helmet', setId: 'blood_reaper', setName: 'Blood Reaper', cost: 90  },
  { id: 'blood_reaper_armor',  name: 'Blood Reaper Armor',  icon: '🩸', slot: 'armor',  setId: 'blood_reaper', setName: 'Blood Reaper', cost: 110 },
  { id: 'blood_reaper_boots',  name: 'Blood Reaper Boots',  icon: '👢', slot: 'boots',  setId: 'blood_reaper', setName: 'Blood Reaper', cost: 80  },
  { id: 'blood_reaper_gloves', name: 'Blood Reaper Gloves', icon: '🧤', slot: 'gloves', setId: 'blood_reaper', setName: 'Blood Reaper', cost: 85  },
  { id: 'blood_reaper_weapon', name: 'Blood Reaper Scythe', icon: '⚔️', slot: 'weapon', setId: 'blood_reaper', setName: 'Blood Reaper', cost: 120 },
];

// ============================================================
// [🧱 BLOCK: Build Armor Item]
// Instantiates a template into a full ArmorItem at a given floor.
// ============================================================
export function buildArmorItem(templateId: string, floor: number): ArmorItem | null {
  const t = ARMOR_TEMPLATES.find((a) => a.id === templateId);
  if (!t) return null;

  const statType  = ARMOR_SLOT_STAT[t.slot];
  const statValue = computeArmorStat(t.slot, floor);

  // Human-readable description
  let description = '';
  switch (statType) {
    case 'maxHp':          description = `+${statValue} Max HP`;                              break;
    case 'damageReduction':description = `+${Math.round(statValue * 100)}% Damage Reduction`; break;
    case 'moveSpeed':      description = `+${statValue.toFixed(1)} Move Speed`;               break;
    case 'atk':            description = `+${statValue} Attack Damage`;                       break;
  }

  return {
    kind:        'armor',
    id:          t.id,
    name:        t.name,
    icon:        t.icon,
    slot:        t.slot,
    setId:       t.setId,
    setName:     t.setName,
    statType,
    statValue,
    description,
    cost:        t.cost,
  };
}

// ============================================================
// [🧱 BLOCK: Random Armor Item]
// Returns a random ArmorItem for a given floor.
// Excludes any IDs already owned/pending.
// ============================================================
export function getRandomArmorItem(
  floor:      number,
  excludeIds: string[] = []
): ArmorItem | null {
  const available = ARMOR_TEMPLATES.filter((t) => !excludeIds.includes(t.id));
  if (available.length === 0) return null;
  const t = available[Math.floor(Math.random() * available.length)];
  return buildArmorItem(t.id, floor);
}

// ============================================================
// [🧱 BLOCK: All Templates Export]
// Used by ItemPool to build the shop pool.
// ============================================================
export { ARMOR_TEMPLATES };

// ============================================================
// [🧱 BLOCK: Set Bonus Definitions]
// Each set has bonuses at 2, 4, and 5 pieces equipped.
// Applied/removed by PlayerStats when armor changes.
// Combat hooks (reflect, invisibility, shockwave) are called
// by HordeSystem/BossSystem via ArmorSetBonus helpers below.
// ============================================================
export interface SetBonusTier {
  pieces:      2 | 4 | 5;
  description: string;
}

export interface ArmorSetDef {
  id:          ArmorSetId;
  name:        string;
  icon:        string;
  color:       string;   // accent color for UI
  tiers:       SetBonusTier[];
}

export const ARMOR_SET_DEFS: ArmorSetDef[] = [
  {
    id:    'iron_warden',
    name:  'Iron Warden',
    icon:  '🛡',
    color: '#94a3b8',
    tiers: [
      { pieces: 2, description: '+15 Max HP'                                 },
      { pieces: 4, description: '+20% Damage Reduction'                      },
      { pieces: 5, description: 'On hit: 30% chance to reflect 10 damage'    },
    ],
  },
  {
    id:    'shadow_walker',
    name:  'Shadow Walker',
    icon:  '🥷',
    color: '#7dd3fc',
    tiers: [
      { pieces: 2, description: 'Dash costs -10 stamina'                     },
      { pieces: 4, description: '+1.5 Move Speed'                            },
      { pieces: 5, description: 'Dash grants 1s invisibility — enemies freeze' },
    ],
  },
  {
    id:    'blood_reaper',
    name:  'Blood Reaper',
    icon:  '🩸',
    color: '#f87171',
    tiers: [
      { pieces: 2, description: '+8 Attack Damage'                           },
      { pieces: 4, description: 'Kills heal 8 HP'                            },
      { pieces: 5, description: 'Every 5th kill triggers a 120px shockwave'  },
    ],
  },
];

// ============================================================
// [🧱 BLOCK: Set Bonus Stat Modifiers]
// Called by PlayerStats via the cached _getSetBonuses() path.
// Returns additive/multiplicative values layered on base stats.
//
// bonusStaminaRegenMult — multiplicative (1.0 = no change).
// No set currently grants a stamina regen bonus, but the field
// is here so future sets or tiers can add one without touching
// PlayerStats.staminaRegenRate.
// ============================================================
export interface SetBonusModifiers {
  bonusMaxHp:            number;
  bonusDamageReduction:  number;  // fraction e.g. 0.20
  bonusMoveSpeed:        number;
  bonusAtk:              number;
  dashCostReduction:     number;
  bonusStaminaRegenMult: number;  // multiplier — 1.0 = unchanged
}

export function computeSetBonusModifiers(
  equippedCounts: Record<ArmorSetId, number>
): SetBonusModifiers {
  const out: SetBonusModifiers = {
    bonusMaxHp:            0,
    bonusDamageReduction:  0,
    bonusMoveSpeed:        0,
    bonusAtk:              0,
    dashCostReduction:     0,
    bonusStaminaRegenMult: 1.0,
  };

  const iw = equippedCounts['iron_warden']   ?? 0;
  const sw = equippedCounts['shadow_walker'] ?? 0;
  const br = equippedCounts['blood_reaper']  ?? 0;

  // ── Iron Warden ──────────────────────────────────────────────
  if (iw >= 2) out.bonusMaxHp           += 15;
  if (iw >= 4) out.bonusDamageReduction += 0.20;

  // ── Shadow Walker ────────────────────────────────────────────
  if (sw >= 2) out.dashCostReduction    += 10;
  if (sw >= 4) out.bonusMoveSpeed       += 1.5;

  // ── Blood Reaper ─────────────────────────────────────────────
  if (br >= 2) out.bonusAtk             += 8;

  return out;
}

// ============================================================
// [🧱 BLOCK: Combat Hook Helpers]
// Called from HordeSystem / BossSystem each frame / event.
// These handle the 5pc legendary bonuses that require
// runtime combat logic, not just stat tweaks.
// ============================================================

// Iron Warden 5pc — 30% chance reflect 10 dmg on any hit taken
export function tryIronWardenReflect(
  equippedCount: number,
  attacker: BaseEnemy
): void {
  if (equippedCount < 5) return;
  if (Math.random() < 0.30) {
    attacker.takeDamage(10);
  }
}

// Shadow Walker 5pc — freeze all enemies for 1000ms on dash
export function applyShadowWalkerFreeze(
  equippedCount: number,
  enemies: BaseEnemy[]
): void {
  if (equippedCount < 5) return;
  enemies.forEach((e) => {
    if (!e.isDead) e.applyStun(1000);
  });
}

// Blood Reaper 5pc — shockwave every 5th kill, 120px radius, 25 dmg
const BLOOD_REAPER_INTERVAL  = 5;
const BLOOD_REAPER_RADIUS    = 120;
const BLOOD_REAPER_DAMAGE    = 25;

// Module-level kill counter — reset on equip/unequip via resetBloodReaperCounter()
let bloodReaperKillCount = 0;

export function resetBloodReaperCounter(): void {
  bloodReaperKillCount = 0;
}

export function onBloodReaperKill(
  equippedCount: number,
  killedEnemy:   BaseEnemy,
  allEnemies:    BaseEnemy[],
  state:         GameState
): void {
  if (equippedCount < 5) return;
  bloodReaperKillCount++;
  if (bloodReaperKillCount % BLOOD_REAPER_INTERVAL !== 0) return;

  // Shockwave — damages all enemies within 120px of the killed enemy
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

  // Visual burst at kill point
  state.particles.push(...spawnBurst(cx, cy, '#f87171', 14, 1.6));
}