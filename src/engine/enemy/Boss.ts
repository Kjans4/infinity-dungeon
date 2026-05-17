// src/engine/enemy/Boss.ts
// ============================================================
// [🧱 BLOCK: Legacy Alias]
// Boss.ts is no longer a standalone implementation.
// All boss logic lives in boss/Brute.ts.
// This file exists only to prevent compile errors on any
// stale `import { Boss } from "./Boss"` paths.
// Prefer importing from "./boss/index" or "../enemy" directly.
// ============================================================
export { Brute as Boss } from "./boss/Brute";