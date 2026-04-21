// src/engine/enemy/index.ts
// ============================================================
// [🧱 BLOCK: Enemy Exports]
// Single import point for all enemy-related code.
// NOTE: imports use "./boss/index" explicitly to avoid the
// Windows case-insensitive conflict with the old Boss.ts file.
// ============================================================

export type { EnemyType, AttackState, EnemyStats } from "./types";
export { BaseEnemy }   from "./BaseEnemy";
export { Projectile }  from "./Projectile";
export { Grunt }       from "./Grunt";
export { Shooter }     from "./Shooter";
export { Tank }        from "./Tank";
export { Dasher }      from "./Dasher";
export { Bomber }      from "./Bomber";
export { spawnWave }   from "./spawn";

// ── Boss system ──────────────────────────────────────────────
export type { AnyBoss }                          from "./boss/index";
export { Brute, Phantom, Colossus, selectBoss }  from "./boss/index";

// Legacy alias — any remaining "Boss" imports still compile.
export { Brute as Boss } from "./boss/index";