// src/engine/enemy/spawn.ts
import { Grunt }   from "./Grunt";
import { Shooter } from "./Shooter";
import { Tank }    from "./Tank";

// ============================================================
// [🧱 BLOCK: Spawn Wave]
// roomInCycle controls the enemy mix:
//   1 → grunts + ~15% tanks  (player learns tank early)
//   2 → grunts + ~35% shooters + ~15% tanks
//   3 → use spawnEliteWave() instead — this function is only
//       called for roomInCycle 1 and 2.
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
    const { x, y } = randomEdgePosition(worldW, worldH, margin);

    switch (slots[i]) {
      case "tank":    enemies.push(new Tank(x, y, floor));    break;
      case "shooter": enemies.push(new Shooter(x, y, floor)); break;
      default:        enemies.push(new Grunt(x, y, floor));   break;
    }
  }

  return enemies;
}

// ============================================================
// [🧱 BLOCK: Spawn Elite Wave]
// Called exclusively for roomInCycle === 3 (elite room).
// Rules:
//   - No Grunts — only Shooters and Tanks
//   - ~55% Shooters, ~45% Tanks
//   - count is already inflated by HordeSystem (+50% vs normal)
// The tougher composition forces the player to prioritise
// targets rather than just swinging into a crowd.
// ============================================================
export function spawnEliteWave(
  count:  number,
  worldW: number,
  worldH: number,
  floor:  number = 1
): (Shooter | Tank)[] {
  const enemies: (Shooter | Tank)[] = [];
  const margin = 60;

  const tankCount    = Math.max(1, Math.round(count * 0.45));
  const shooterCount = count - tankCount;

  const slots: ("shooter" | "tank")[] = [];
  for (let i = 0; i < tankCount;    i++) slots.push("tank");
  for (let i = 0; i < shooterCount; i++) slots.push("shooter");

  // Shuffle
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  for (let i = 0; i < count; i++) {
    const { x, y } = randomEdgePosition(worldW, worldH, margin);
    if (slots[i] === "tank") {
      enemies.push(new Tank(x, y, floor));
    } else {
      enemies.push(new Shooter(x, y, floor));
    }
  }

  return enemies;
}

// ============================================================
// [🧱 BLOCK: Random Edge Position]
// Spawns an enemy at a random point on one of the four world
// edges. Extracted so both spawn functions share the logic.
// ============================================================
function randomEdgePosition(
  worldW:  number,
  worldH:  number,
  margin:  number
): { x: number; y: number } {
  const edge = Math.floor(Math.random() * 4);
  switch (edge) {
    case 0: return { x: Math.random() * worldW, y: margin               }; // Top
    case 1: return { x: Math.random() * worldW, y: worldH - margin      }; // Bottom
    case 2: return { x: margin,                 y: Math.random() * worldH }; // Left
    default: return { x: worldW - margin,       y: Math.random() * worldH }; // Right
  }
}