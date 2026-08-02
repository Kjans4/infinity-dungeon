// src/engine/PlayerBoons.ts
import { Player } from "./Player";
import {
  BoonId, BoonDef, PlayerStatModifiers,
  MAX_BOON_LEVEL, getBoonById,
} from "./BoonRegistry";

// ============================================================
// [🧱 BLOCK: Constants]
// Slot leveling cost curve — same escalating-tier shape as
// stat costs, scaled up per the Phase 1 spec. No floor/cap gate.
// ============================================================
const SLOT_UPGRADE_COSTS: [number, number, number, number] = [50, 90, 150, 220];

// ============================================================
// [🧱 BLOCK: BoonSlot]
// level is always 1–5, independent of which boon (if any)
// currently occupies the slot. Swapping boons between slots
// carries no cost — the boon simply takes on the destination
// slot's level.
// ============================================================
export interface BoonSlot {
  boonId: BoonId | null;
  level:  number;
}

function makeSlot(): BoonSlot {
  return { boonId: null, level: 1 };
}

export const BOON_SLOT_COUNT = 5;

// ============================================================
// [🧱 BLOCK: PlayerBoons Class]
// Holds a reference to the shared PlayerStatModifiers instance
// (owned by PlayerStats) so onEquip/onRemove hooks can mutate it
// directly, exactly like the old charm-equip flow.
// ============================================================
export class PlayerBoons {
  slots: BoonSlot[];
  private modifiers: PlayerStatModifiers;

  constructor(modifiers: PlayerStatModifiers) {
    this.modifiers = modifiers;
    this.slots = Array.from({ length: BOON_SLOT_COUNT }, () => makeSlot());
  }

  // ============================================================
  // [🧱 BLOCK: Slot Upgrade Cost]
  // ============================================================
  getSlotUpgradeCost(slotIndex: number): number {
    const slot = this.slots[slotIndex];
    if (!slot || slot.level >= MAX_BOON_LEVEL) return Infinity;
    return SLOT_UPGRADE_COSTS[slot.level - 1];
  }

  canUpgradeSlot(slotIndex: number, gold: number): boolean {
    const cost = this.getSlotUpgradeCost(slotIndex);
    return cost !== Infinity && gold >= cost;
  }

  /** Levels up a slot. If a boon occupies it, remove-then-reapply at the new level. */
  upgradeSlot(slotIndex: number, gold: number, player: Player): number {
    if (!this.canUpgradeSlot(slotIndex, gold)) return gold;
    const cost = this.getSlotUpgradeCost(slotIndex);
    const slot = this.slots[slotIndex];

    if (slot.boonId) {
      const def = getBoonById(slot.boonId);
      def?.onRemove(player, this.modifiers, slot.level);
      slot.level++;
      def?.onEquip(player, this.modifiers, slot.level);
    } else {
      slot.level++;
    }

    return gold - cost;
  }

  // ============================================================
  // [🧱 BLOCK: Assign Boon]
  // Replaces whatever occupied the slot (if anything) with the
  // new boon at the slot's current level. Pass null to clear.
  // ============================================================
  assignBoon(slotIndex: number, boonId: BoonId | null, player: Player): void {
    const slot = this.slots[slotIndex];
    if (!slot) return;

    if (slot.boonId) {
      const oldDef = getBoonById(slot.boonId);
      oldDef?.onRemove(player, this.modifiers, slot.level);
    }

    slot.boonId = boonId;

    if (boonId) {
      const newDef = getBoonById(boonId);
      newDef?.onEquip(player, this.modifiers, slot.level);
    }
  }

  // ============================================================
  // [🧱 BLOCK: Swap Slots]
  // Boons trade places; each boon's effective level changes to
  // match its new slot, so hooks must be reapplied at the new level.
  // ============================================================
  swapSlots(a: number, b: number, player: Player): void {
    const slotA = this.slots[a];
    const slotB = this.slots[b];
    if (!slotA || !slotB) return;

    const idA = slotA.boonId;
    const idB = slotB.boonId;
    const lvlA = slotA.level;
    const lvlB = slotB.level;

    if (idA) getBoonById(idA)?.onRemove(player, this.modifiers, lvlA);
    if (idB) getBoonById(idB)?.onRemove(player, this.modifiers, lvlB);

    slotA.boonId = idB;
    slotB.boonId = idA;

    if (idB) getBoonById(idB)?.onEquip(player, this.modifiers, lvlA); // idB now runs at slot A's level
    if (idA) getBoonById(idA)?.onEquip(player, this.modifiers, lvlB); // idA now runs at slot B's level
  }

  // ============================================================
  // [🧱 BLOCK: Sell Boon]
  // Returns 50% refund of the boon's base cost, same convention
  // as weapon/armor sell.
  // ============================================================
  sellBoon(slotIndex: number, gold: number, player: Player): number {
    const slot = this.slots[slotIndex];
    if (!slot || !slot.boonId) return gold;

    const def = getBoonById(slot.boonId);
    def?.onRemove(player, this.modifiers, slot.level);
    const refund = def ? Math.ceil(def.cost * 0.5) : 0;
    slot.boonId = null;

    return gold + refund;
  }

  // ============================================================
  // [🧱 BLOCK: Queries]
  // ============================================================
  hasBoon(id: BoonId | string): boolean {
    return this.slots.some((s) => s.boonId === id);
  }

  /** Returns the boon's current slot level, or 0 if not equipped. */
  getLevel(id: BoonId | string): number {
    const slot = this.slots.find((s) => s.boonId === id);
    return slot ? slot.level : 0;
  }

  getBoonAt(slotIndex: number): { def: BoonDef; level: number } | null {
    const slot = this.slots[slotIndex];
    if (!slot || !slot.boonId) return null;
    const def = getBoonById(slot.boonId);
    return def ? { def, level: slot.level } : null;
  }

  get equippedIds(): string[] {
    return this.slots.filter((s) => s.boonId).map((s) => s.boonId as string);
  }

  get filledCount(): number {
    return this.slots.filter((s) => s.boonId).length;
  }

  // ============================================================
  // [🧱 BLOCK: Reset]
  // ============================================================
  reset(player: Player): void {
    this.slots.forEach((slot) => {
      if (slot.boonId) {
        getBoonById(slot.boonId)?.onRemove(player, this.modifiers, slot.level);
      }
    });
    this.slots = Array.from({ length: BOON_SLOT_COUNT }, () => makeSlot());
  }
}
