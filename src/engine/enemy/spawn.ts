// src/engine/enemy/spawn.ts
import { Grunt } from "./Grunt";
import { Shooter } from "./Shooter";

// ============================================================
// [🧱 BLOCK: Spawn Wave]
// roomInCycle controls the enemy mix:
//   1 → grunts only  (player learns melee dodge)
//   2 → grunts + ~40% shooters  (ranged threat introduced)
//   3 → boss room, don't use this function
// ============================================================
export function spawnWave(
  count:       number,
  worldW:      number,
  worldH:      number,
  roomInCycle: 1 | 2 | 3 = 1,
  floor:       number    = 1
): (Grunt | Shooter)[] {
  const enemies: (Grunt | Shooter)[] = [];
  const margin = 60;

  for (let i = 0; i < count; i++) {
    // Room 2: last 40% of each batch are shooters
    const isShooter =
      roomInCycle === 2 && i >= count - Math.floor(count * 0.4);

    const edge = Math.floor(Math.random() * 4);
    let x = 0, y = 0;

    switch (edge) {
      case 0: x = Math.random() * worldW; y = margin;              break; // Top
      case 1: x = Math.random() * worldW; y = worldH - margin;     break; // Bottom
      case 2: x = margin;                  y = Math.random() * worldH; break; // Left
      case 3: x = worldW - margin;        y = Math.random() * worldH; break; // Right
    }

    enemies.push(
      isShooter
        ? new Shooter(x, y, floor)
        : new Grunt(x, y, floor)
    );
  }

  return enemies;
}