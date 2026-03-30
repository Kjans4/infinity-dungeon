// src/engine/systems/GoldSystem.ts
import { GoldDrop }  from "../GoldDrop";
import { Player }    from "../Player";
import { Camera }    from "../Camera";
import { GameState } from "../GameState";

// ============================================================
// [🧱 BLOCK: Gold Drop Ranges per enemy type]
// ============================================================
export const GOLD_DROPS = {
  grunt:   { min: 5,   max: 10  },
  shooter: { min: 8,   max: 15  },
  tank:    { min: 15,  max: 25  },
  boss:    { min: 80,  max: 120 },
};

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ============================================================
// [🧱 BLOCK: GoldSystem Class]
// Spawns, updates, collects and draws all gold drops.
// ============================================================
export class GoldSystem {

  // ============================================================
  // [🧱 BLOCK: Spawn]
  // Call when an enemy dies — pass its world position and type.
  // ============================================================
  spawnFromEnemy(
    state:  GameState,
    x:      number,
    y:      number,
    type:   "grunt" | "shooter" | "tank" | "boss"
  ) {
    const range  = GOLD_DROPS[type];
    const amount = randInt(range.min, range.max);

    const offsetX = (Math.random() - 0.5) * 20;
    const offsetY = (Math.random() - 0.5) * 20;

    state.goldDrops.push(new GoldDrop(x + offsetX, y + offsetY, amount));
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // Ticks all drops, collects gold if player walks over.
  // Returns total gold collected this frame.
  // ============================================================
  update(state: GameState, player: Player): number {
    let collected = 0;

    state.goldDrops.forEach((drop) => {
      const wasCollected = drop.collected;
      drop.update(player);
      if (!wasCollected && drop.collected) {
        collected += drop.amount;
      }
    });

    state.goldDrops = state.goldDrops.filter((d) => !d.collected);
    return collected;
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // ============================================================
  draw(state: GameState, ctx: CanvasRenderingContext2D, camera: Camera) {
    state.goldDrops.forEach((drop) => drop.draw(ctx, camera));
  }

  // ============================================================
  // [🧱 BLOCK: Reset]
  // ============================================================
  reset(state: GameState) {
    state.goldDrops = [];
  }
}