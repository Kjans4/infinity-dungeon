// src/engine/enemy/boss/index.ts

export * from "./Brute";
export * from "./Phantom";
export * from "./Colossus";
export * from "./Mage";
export * from "./Shade";

import { Brute } from "./Brute";
import { Phantom } from "./Phantom";
import { Colossus } from "./Colossus";
import { Mage } from "./Mage";
import { Shade } from "./Shade";

export type AnyBoss = Brute | Phantom | Colossus | Mage | Shade;

/**
 * Helper to spawn bosses based on floor level
 */
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

  const coreRoll = Math.floor(Math.random() * 3);
  switch (coreRoll) {
    case 0:  return new Brute(x, y, floor);
    case 1:  return new Phantom(x, y, floor);
    default: return new Colossus(x, y, floor);
  }
}