// src/engine/enemy/types.ts

// ============================================================
// [🧱 BLOCK: Enemy Type Union]
// Add new enemy types here as the game grows.
// ============================================================
export type EnemyType = 'grunt' | 'shooter';

// ============================================================
// [🧱 BLOCK: Attack State Machine States]
// Shared by all enemy types.
// ============================================================
export type AttackState = 'chase' | 'windup' | 'strike' | 'cooldown';

// ============================================================
// [🧱 BLOCK: Base Stats Interface]
// Every enemy config entry must satisfy this shape.
// ============================================================
export interface EnemyStats {
  speed:          number;
  hp:             number;
  size:           number;
  color:          string;
  xpValue:        number;
  // Melee
  meleeRange:     number;
  meleeWindup:    number;   // ms
  meleeDamage:    number;
  meleeCooldown:  number;   // ms
  // Ranged (0 = no ranged attack)
  rangedRange:    number;
  rangedWindup:   number;
  rangedDamage:   number;
  rangedCooldown: number;
  preferredDist:  number;   // distance shooter tries to maintain
}