// src/engine/enemy/boss/index.ts
// ============================================================
// [🧱 BLOCK: Boss Registry]
// To add a new boss:
//   1. Create src/engine/enemy/boss/YourBoss.ts
//   2. Export it here
//   3. Add it to selectBoss() or the rare pool
// ============================================================

export { Brute }    from "./Brute";
export { Phantom }  from "./Phantom";
export { Colossus } from "./Colossus";
export { Mage }     from "./Mage";
export { Shade }    from "./Shade";

import { Brute }    from "./Brute";
import { Phantom }  from "./Phantom";
import { Colossus } from "./Colossus";
import { Mage }     from "./Mage";
import { Shade }    from "./Shade";

export type AnyBoss = Brute | Phantom | Colossus | Mage | Shade;

// ============================================================
// [🧱 BLOCK: selectBoss]
// Floors 1-3: locked rotation - Brute, Phantom, Colossus.
// Floor 4+:   weighted random:
//   85% - random from [Brute, Phantom, Colossus]
//   10% - Mage  (rare)
//    5% - Shade (very rare)
// ============================================================
export function selectBoss(x: number, y: number, floor: number): AnyBoss {

  // Locked floors 1-3
  if (floor <= 3) {
    switch (floor) {
      case 1: return new Brute(x, y, floor);
      case 2: return new Phantom(x, y, floor);
      case 3: return new Colossus(x, y, floor);
    }
  }

  // Floor 4+ weighted random
  const roll = Math.random();

  if (roll < 0.05) return new Shade(x, y, floor);
  if (roll < 0.15) return new Mage(x, y, floor);

  // 85% - random core three
  const coreRoll = Math.floor(Math.random() * 3);
  switch (coreRoll) {
    case 0:  return new Brute(x, y, floor);
    case 1:  return new Phantom(x, y, floor);
    default: return new Colossus(x, y, floor);
  }
}