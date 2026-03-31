// src/engine/items/WeaponRegistry.ts
import { WeaponDef, WeaponType } from "./types";

// ============================================================
// [🧱 BLOCK: Weapon Registry]
// Heavy attack stamina costs raised across the board.
// Heavy attacks are now a meaningful resource decision.
//   Sword  heavy: 25 → 35
//   Axe    heavy: 30 → 42
//   Spear  heavy: 22 → 32
// Light costs unchanged — light is bread-and-butter.
// ============================================================
export const WEAPON_REGISTRY: Record<WeaponType, WeaponDef> = {
  sword: {
    type: 'sword', name: 'Sword', icon: '⚔️',
    light: {
      damage:      12,
      duration:    150,
      staminaCost: 10,   // unchanged
      cooldown:    0,
      haltsPlayer: false,
      color:       "rgba(255,255,255,0.65)",
      hitbox:      { kind: 'arc', range: 55, arcAngle: Math.PI * 0.5 },
    },
    heavy: {
      damage:      28,
      duration:    450,
      staminaCost: 35,   // ↑ was 25
      cooldown:    1200,
      haltsPlayer: true,
      color:       "rgba(251,191,36,0.75)",
      hitbox:      { kind: 'arc', range: 65, arcAngle: Math.PI },
    },
  },

  axe: {
    type: 'axe', name: 'Axe', icon: '🪓',
    light: {
      damage:      15,
      duration:    150,
      staminaCost: 12,   // unchanged
      cooldown:    0,
      haltsPlayer: false,
      color:       "rgba(251,146,60,0.65)",
      hitbox:      { kind: 'circle', radius: 40 },
    },
    heavy: {
      damage:      40,
      duration:    500,
      staminaCost: 42,   // ↑ was 30
      cooldown:    1400,
      haltsPlayer: true,
      color:       "rgba(239,68,68,0.7)",
      hitbox:      { kind: 'circle', radius: 70 },
    },
  },

  spear: {
    type: 'spear', name: 'Spear', icon: '🔱',
    light: {
      damage:      10,
      duration:    100,
      staminaCost: 8,    // unchanged
      cooldown:    0,
      haltsPlayer: false,
      color:       "rgba(56,189,248,0.65)",
      hitbox:      { kind: 'rect', length: 120, width: 20 },
    },
    heavy: {
      damage:      35,
      duration:    400,
      staminaCost: 32,   // ↑ was 22
      cooldown:    1200,
      haltsPlayer: true,
      color:       "rgba(14,165,233,0.75)",
      hitbox:      { kind: 'rect', length: 200, width: 20 },
    },
  },
};

export function getWeaponDef(type: WeaponType): WeaponDef {
  return WEAPON_REGISTRY[type];
}