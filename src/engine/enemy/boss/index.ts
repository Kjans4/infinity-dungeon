// src/engine/enemy/boss/index.ts
// ============================================================
// [🧱 BLOCK: Boss Registry]
// Add new boss classes here and extend selectBoss() —
// no other files need to change.
//
// Rotation by floor (1-indexed):
//   Floor 1 → Brute
//   Floor 2 → Phantom
//   Floor 3 → Colossus
//   Floor 4 → Brute (harder — floor scaling handles HP/speed)
//   Floor 5 → Phantom
//   ...
// ============================================================

export { Brute }    from "./Brute";
export { Phantom }  from "./Phantom";
export { Colossus } from "./Colossus";

import { Brute }    from "./Brute";
import { Phantom }  from "./Phantom";
import { Colossus } from "./Colossus";

export type AnyBoss = Brute | Phantom | Colossus;

// ============================================================
// [🧱 BLOCK: selectBoss]
// Factory — picks the correct boss class for the given floor.
// x, y are spawn world-coordinates.
// ============================================================
export function selectBoss(x: number, y: number, floor: number): AnyBoss {
  const slot = ((floor - 1) % 3) + 1; // 1 | 2 | 3
  switch (slot) {
    case 1: return new Brute(x, y, floor);
    case 2: return new Phantom(x, y, floor);
    case 3: return new Colossus(x, y, floor);
    default: return new Brute(x, y, floor);
  }
}