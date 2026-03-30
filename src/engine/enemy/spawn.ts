// src/engine/enemy/spawn.ts
import { Grunt }   from "./Grunt";
import { Shooter } from "./Shooter";
import { Tank }    from "./Tank";

// ============================================================
// [🧱 BLOCK: Spawn Wave]
// roomInCycle controls the enemy mix:
//   1 → grunts + ~15% tanks  (player learns tank early)
//   2 → grunts + ~35% shooters + ~15% tanks
//   3 → boss room, don't use this function
//
// Tank spawn rate is intentionally low — one or two per wave
// is enough to force target prioritisation without overwhelming.
// ============================================================
export function spawnWave(
  count:       number,
  worldW:      number,
  worldH:      number,
  roomInCycle: 1 | 2 | 3 = 1,
  floor:       number    = 1
): (Grunt | Shooter | Tank)[] {
  const enemies: (Grunt | Shooter | Tank)[] = [];
  const margin = 60;

  // Pre-determine how many tanks and shooters in this batch
  const tankCount    = Math.max(1, Math.floor(count * 0.15));
  const shooterCount = roomInCycle === 2
    ? Math.floor(count * 0.35)
    : 0;

  // Build a slot list so distribution is exact, not random per-enemy
  // e.g. for count=8: ['tank','tank','shooter','shooter','shooter','grunt','grunt','grunt']
  const slots: ("grunt" | "shooter" | "tank")[] = [];
  for (let i = 0; i < tankCount;    i++) slots.push("tank");
  for (let i = 0; i < shooterCount; i++) slots.push("shooter");
  while (slots.length < count)            slots.push("grunt");

  // Shuffle slots so tanks/shooters aren't always spawned together
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  for (let i = 0; i < count; i++) {
    const edge = Math.floor(Math.random() * 4);
    let x = 0, y = 0;

    switch (edge) {
      case 0: x = Math.random() * worldW; y = margin;               break; // Top
      case 1: x = Math.random() * worldW; y = worldH - margin;      break; // Bottom
      case 2: x = margin;                 y = Math.random() * worldH; break; // Left
      case 3: x = worldW - margin;        y = Math.random() * worldH; break; // Right
    }

    switch (slots[i]) {
      case "tank":    enemies.push(new Tank(x, y, floor));    break;
      case "shooter": enemies.push(new Shooter(x, y, floor)); break;
      default:        enemies.push(new Grunt(x, y, floor));   break;
    }
  }

  return enemies;
}