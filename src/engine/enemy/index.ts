// src/engine/enemy/index.ts
// ============================================================
// Single import point for all enemy-related code.
// GameCanvas.tsx only needs:
//   import { Grunt, Shooter, Boss, Tank, Projectile, spawnWave } from "@/engine/enemy";
// ============================================================

export type { EnemyType, AttackState, EnemyStats } from "./types";
export { BaseEnemy }   from "./BaseEnemy";
export { Projectile }  from "./Projectile";
export { Grunt }       from "./Grunt";
export { Shooter }     from "./Shooter";
export { Tank }        from "./Tank";
export { Boss }        from "./Boss";
export { spawnWave }   from "./spawn";