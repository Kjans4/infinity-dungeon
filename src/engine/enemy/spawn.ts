// src/engine/enemy/spawn.ts
import { Grunt }   from "./Grunt";
import { Shooter } from "./Shooter";
import { Tank }    from "./Tank";
import { Dasher }  from "./Dasher";
import { Bomber }  from "./Bomber";

// ============================================================
// [🧱 BLOCK: Spawn Wave]
// roomInCycle controls the enemy mix:
//   1 → grunts + ~15% tanks  (player learns tank early)
//   2 → grunts + ~30% shooters + ~10% tanks + ~8% dashers + ~5% bombers
//   3 → use spawnEliteWave() instead — this function is only
//       called for roomInCycle 1 and 2.
//
// Dasher spawns from room 2 onward — fast enemy needs context.
// Bomber spawns from room 2 onward at low chance — menacing but rare.
// Tank spawn rate intentionally low — one or two per wave.
// ============================================================
export function spawnWave(
  count:       number,
  worldW:      number,
  worldH:      number,
  roomInCycle: 1 | 2 | 3 = 1,
  floor:       number    = 1
): (Grunt | Shooter | Tank | Dasher | Bomber)[] {
  const enemies: (Grunt | Shooter | Tank | Dasher | Bomber)[] = [];
  const margin = 60;

  // Slot composition — exact counts, not per-enemy rolls
  let tankCount    = Math.max(1, Math.floor(count * 0.12));
  let shooterCount = roomInCycle === 2 ? Math.floor(count * 0.28) : 0;
  let dasherCount  = roomInCycle === 2 ? Math.floor(count * 0.10) : 0;
  let bomberCount  = roomInCycle === 2 ? Math.max(0, Math.floor(count * 0.06)) : 0;

  // Cap so we always have grunt filler
  const specialTotal = tankCount + shooterCount + dasherCount + bomberCount;
  if (specialTotal >= count) {
    bomberCount  = 0;
    dasherCount  = Math.max(0, dasherCount  - 1);
    shooterCount = Math.max(0, shooterCount - 1);
  }

  const slots: ("grunt" | "shooter" | "tank" | "dasher" | "bomber")[] = [];
  for (let i = 0; i < tankCount;    i++) slots.push("tank");
  for (let i = 0; i < shooterCount; i++) slots.push("shooter");
  for (let i = 0; i < dasherCount;  i++) slots.push("dasher");
  for (let i = 0; i < bomberCount;  i++) slots.push("bomber");
  while (slots.length < count)           slots.push("grunt");

  // Shuffle
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  for (let i = 0; i < count; i++) {
    const { x, y } = randomEdgePosition(worldW, worldH, margin);
    switch (slots[i]) {
      case "tank":    enemies.push(new Tank(x, y, floor));    break;
      case "shooter": enemies.push(new Shooter(x, y, floor)); break;
      case "dasher":  enemies.push(new Dasher(x, y, floor));  break;
      case "bomber":  enemies.push(new Bomber(x, y, floor));  break;
      default:        enemies.push(new Grunt(x, y, floor));   break;
    }
  }

  return enemies;
}

// ============================================================
// [🧱 BLOCK: Spawn Elite Wave]
// Called exclusively for roomInCycle === 3 (elite room).
// Rules:
//   - No Grunts
//   - ~40% Tanks, ~30% Shooters, ~20% Dashers, ~10% Bombers
//   - count is already inflated by HordeSystem (+50% vs normal)
// ============================================================
export function spawnEliteWave(
  count:  number,
  worldW: number,
  worldH: number,
  floor:  number = 1
): (Shooter | Tank | Dasher | Bomber)[] {
  const enemies: (Shooter | Tank | Dasher | Bomber)[] = [];
  const margin = 60;

  const tankCount   = Math.max(1, Math.round(count * 0.40));
  const bomberCount = Math.max(1, Math.round(count * 0.10));
  const dasherCount = Math.max(1, Math.round(count * 0.20));
  const shooterCount = Math.max(0, count - tankCount - bomberCount - dasherCount);

  const slots: ("shooter" | "tank" | "dasher" | "bomber")[] = [];
  for (let i = 0; i < tankCount;    i++) slots.push("tank");
  for (let i = 0; i < shooterCount; i++) slots.push("shooter");
  for (let i = 0; i < dasherCount;  i++) slots.push("dasher");
  for (let i = 0; i < bomberCount;  i++) slots.push("bomber");

  // Shuffle
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  const finalCount = Math.min(count, slots.length);
  for (let i = 0; i < finalCount; i++) {
    const { x, y } = randomEdgePosition(worldW, worldH, margin);
    switch (slots[i]) {
      case "tank":    enemies.push(new Tank(x, y, floor));    break;
      case "dasher":  enemies.push(new Dasher(x, y, floor));  break;
      case "bomber":  enemies.push(new Bomber(x, y, floor));  break;
      default:        enemies.push(new Shooter(x, y, floor)); break;
    }
  }

  return enemies;
}

// ============================================================
// [🧱 BLOCK: Random Edge Position]
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