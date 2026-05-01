// src/engine/PlayerConsumables.ts

import {
  ConsumableDef, ConsumableId,
  SLOT_COOLDOWNS, MAX_CONSUMABLE_LEVEL,
  getUpgradeCost,
} from "./ConsumableRegistry";

// ============================================================
// [🧱 BLOCK: Constants]
// ============================================================
export const MAX_STACK       = 8;    // max charges per item in bag
export const STACK_BONUS_MS  = 5000; // +5s added to duration on re-use
export const HOTBAR_SLOTS    = 4;

// ============================================================
// [🧱 BLOCK: BagEntry]
// Tracks how many of a given consumable the player carries.
// ============================================================
export interface BagEntry {
  def:    ConsumableDef;
  count:  number;        // 1–MAX_STACK
}

// ============================================================
// [🧱 BLOCK: HotbarSlot]
// One of four assignable quickslot slots.
//
// assignedId   — which consumable is slotted (null = empty)
// cooldownMs   — ms remaining on this slot's cooldown
// durationMs   — ms remaining on the active buff (0 if none / instant)
// wardHits     — Ward Scroll hit absorption counter
// ============================================================
export interface HotbarSlot {
  assignedId:  ConsumableId | null;
  cooldownMs:  number;
  durationMs:  number;
  wardHits:    number;
}

function makeSlot(): HotbarSlot {
  return { assignedId: null, cooldownMs: 0, durationMs: 0, wardHits: 0 };
}

// ============================================================
// [🧱 BLOCK: PlayerConsumables Class]
// Owns the bag (inventory of consumable stacks), the 4 hotbar
// slots, and the upgrade level map for each consumable.
// Upgrade levels persist across rooms — reset only on full run.
// ============================================================
export class PlayerConsumables {
  // Bag: consumableId → BagEntry
  bag: Map<ConsumableId, BagEntry> = new Map();

  // Four hotbar slots
  slots: [HotbarSlot, HotbarSlot, HotbarSlot, HotbarSlot] = [
    makeSlot(), makeSlot(), makeSlot(), makeSlot(),
  ];

  // ============================================================
  // [🧱 BLOCK: Upgrade Levels]
  // consumableId → current level (1–MAX_CONSUMABLE_LEVEL).
  // Defaults to 1 if not present (no entry = base level).
  // ============================================================
  private upgradeLevels: Map<ConsumableId, number> = new Map();

  // ============================================================
  // [🧱 BLOCK: Level Getters]
  // ============================================================

  /** Returns the current upgrade level for a consumable (1–5). */
  getLevel(id: ConsumableId): number {
    return this.upgradeLevels.get(id) ?? 1;
  }

  /** Returns true if the consumable can still be upgraded. */
  canUpgrade(id: ConsumableId): boolean {
    return this.getLevel(id) < MAX_CONSUMABLE_LEVEL;
  }

  /**
   * Returns the gold cost to upgrade this consumable by one level.
   * Returns Infinity if already at max level.
   */
  getUpgradeCost(def: ConsumableDef): number {
    const currentLevel = this.getLevel(def.id);
    return getUpgradeCost(def, currentLevel);
  }

  /**
   * Attempts to upgrade the consumable. Deducts gold and returns
   * the new gold total. Returns unchanged gold if upgrade not possible.
   */
  upgrade(def: ConsumableDef, gold: number): number {
    const cost = this.getUpgradeCost(def);
    if (!this.canUpgrade(def.id) || gold < cost) return gold;
    const currentLevel = this.getLevel(def.id);
    this.upgradeLevels.set(def.id, currentLevel + 1);
    return gold - cost;
  }

  // ============================================================
  // [🧱 BLOCK: Bag Management]
  // ============================================================

  /** Add `count` charges of a consumable to the bag. Capped at MAX_STACK. */
  addToBag(def: ConsumableDef, count: number = 1): void {
    const existing = this.bag.get(def.id);
    if (existing) {
      existing.count = Math.min(MAX_STACK, existing.count + count);
    } else {
      this.bag.set(def.id, { def, count: Math.min(MAX_STACK, count) });
    }
  }

  /** Remove one charge from the bag. Returns false if none left. */
  removeFromBag(id: ConsumableId): boolean {
    const entry = this.bag.get(id);
    if (!entry || entry.count <= 0) return false;
    entry.count--;
    if (entry.count === 0) this.bag.delete(id);
    return true;
  }

  /** Current count of a consumable in the bag (0 if absent). */
  bagCount(id: ConsumableId): number {
    return this.bag.get(id)?.count ?? 0;
  }

  /** All bag entries as a sorted array — potions first, then scrolls. */
  bagEntries(): BagEntry[] {
    return Array.from(this.bag.values()).sort((a, b) => {
      if (a.def.kind === b.def.kind) return a.def.name.localeCompare(b.def.name);
      return a.def.kind === 'potion' ? -1 : 1;
    });
  }

  // ============================================================
  // [🧱 BLOCK: Hotbar Assignment]
  // Player drags a consumable from bag onto a slot index (0–3).
  // The previous assignment is simply replaced — no cost.
  // ============================================================
  assignSlot(slotIndex: number, id: ConsumableId | null): void {
    if (slotIndex < 0 || slotIndex >= HOTBAR_SLOTS) return;
    this.slots[slotIndex].assignedId = id;
    // Clear active timers when reassigning
    this.slots[slotIndex].cooldownMs = 0;
    this.slots[slotIndex].durationMs = 0;
    this.slots[slotIndex].wardHits   = 0;
  }

  // ============================================================
  // [🧱 BLOCK: Activate Slot]
  // Called when player presses keys 1–4 (slotIndex 0–3).
  //
  // Rules:
  //  • Slot must have an assigned consumable
  //  • Bag must have at least 1 charge
  //  • Slot cooldown must be 0
  //
  // Duration stacking:
  //  • Instant items (durationMs === 0) — just consume + cooldown
  //  • Buff items — if buff is already active, extend remaining
  //    duration by def.durationMs + STACK_BONUS_MS instead of
  //    resetting, to reward chaining
  //
  // Returns the ConsumableDef that was activated, or null if
  // activation was blocked.
  // ============================================================
  activateSlot(slotIndex: number): ConsumableDef | null {
    if (slotIndex < 0 || slotIndex >= HOTBAR_SLOTS) return null;

    const slot = this.slots[slotIndex];
    if (!slot.assignedId)           return null;
    if (slot.cooldownMs > 0)        return null;

    const entry = this.bag.get(slot.assignedId);
    if (!entry || entry.count <= 0) return null;

    const def = entry.def;

    // Consume one charge
    this.removeFromBag(def.id);

    // Start cooldown for this slot
    slot.cooldownMs = SLOT_COOLDOWNS[slotIndex];

    // Duration stacking — use level-aware duration for buff items
    if (def.durationMs > 0) {
      const leveledDuration = this.getLeveledDuration(def);
      if (slot.durationMs > 0) {
        // Buff already running — extend it
        slot.durationMs += leveledDuration + STACK_BONUS_MS;
      } else {
        // Fresh activation
        slot.durationMs = leveledDuration;
      }
    }

    return def;
  }

  // ============================================================
  // [🧱 BLOCK: Level-Aware Duration Helper]
  // Returns the correct durationMs for the current upgrade level.
  // Used by activateSlot so buff extensions also scale with level.
  // ============================================================
  getLeveledDuration(def: ConsumableDef): number {
    const level = this.getLevel(def.id);
    const fx    = def.effectsByLevel[Math.min(level - 1, MAX_CONSUMABLE_LEVEL - 1)];
    // Duration is stored as secondary effect for wrath/iron/ward
    // and as primary for phantom
    switch (def.id) {
      case 'wrath_potion':    return fx[1] ?? def.durationMs;
      case 'iron_potion':     return fx[1] ?? def.durationMs;
      case 'phantom_potion':  return fx[0] ?? def.durationMs;
      case 'ward_scroll':     return fx[1] ?? def.durationMs;
      default:                return def.durationMs;
    }
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // Called every frame from the game loop with delta ms.
  // Ticks cooldown and duration timers.
  // ============================================================
  update(deltaMs: number): void {
    for (const slot of this.slots) {
      if (slot.cooldownMs > 0) {
        slot.cooldownMs = Math.max(0, slot.cooldownMs - deltaMs);
      }
      if (slot.durationMs > 0) {
        slot.durationMs = Math.max(0, slot.durationMs - deltaMs);
      }
    }
  }

  // ============================================================
  // [🧱 BLOCK: Buff State Helpers]
  // Used by HordeSystem/BossSystem in each frame to check active
  // buffs without scanning all slots manually.
  // ============================================================

  /** Returns true if the given consumable has an active duration buff. */
  isActive(id: ConsumableId): boolean {
    for (const slot of this.slots) {
      if (slot.assignedId === id && slot.durationMs > 0) return true;
    }
    return false;
  }

  /** Returns remaining duration ms for a given consumable (max across slots). */
  remainingDuration(id: ConsumableId): number {
    let max = 0;
    for (const slot of this.slots) {
      if (slot.assignedId === id && slot.durationMs > max) {
        max = slot.durationMs;
      }
    }
    return max;
  }

  // ============================================================
  // [🧱 BLOCK: Reset]
  // Called on full run reset — clears bag, all slot state,
  // AND upgrade levels (fresh run, fresh progression).
  // ============================================================
  reset(): void {
    this.bag.clear();
    this.slots = [makeSlot(), makeSlot(), makeSlot(), makeSlot()];
    this.upgradeLevels.clear();
  }
}