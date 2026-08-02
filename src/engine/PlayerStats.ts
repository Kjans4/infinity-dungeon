// src/engine/PlayerStats.ts
import { Player }        from "./Player";
import {
  PlayerStatModifiers, defaultModifiers,
  BoonId, getBoonById, getBoonEffectsAtLevel,
  MAX_BOON_LEVEL, resetBloodReaperCounter,
} from "./BoonRegistry";
import { PlayerBoons }   from "./PlayerBoons";
import { WeaponItem }    from "./items/types";
import { Weapon }        from "./items/Weapon";
import { ShopItem, getRandomShopItems } from "./items/ItemPool";
import { WeaponPassive, getWeaponPassive } from "./WeaponPassiveRegistry";

// ============================================================
// [🧱 BLOCK: Stat Definitions]
// ============================================================
export type StatKey = 'str' | 'vit' | 'agi' | 'end';

export interface StatDef {
  key:         StatKey;
  label:       string;
  icon:        string;
  description: string;
}

export const STAT_DEFS: StatDef[] = [
  { key: 'str', label: 'STR', icon: '⚔️',  description: '+3 attack damage per level'   },
  { key: 'vit', label: 'VIT', icon: '❤️',  description: '+10 max HP per level'          },
  { key: 'agi', label: 'AGI', icon: '💨',  description: '+0.3 move speed per level'     },
  { key: 'end', label: 'END', icon: '⚡',  description: '+5 max stamina per level'      },
];

export function statCost(currentLevel: number): number {
  if (currentLevel < 3) return 30;
  if (currentLevel < 6) return 60;
  return 100;
}

export function statCap(floor: number): number {
  return Math.min(10, floor * 3);
}

// ============================================================
// [🧱 BLOCK: Reroll Cost Constants]
// Reroll cost DOUBLES on each reroll within the same shop visit,
// resets to base on next visit. Per Phase 1 Decisions Log.
// ============================================================
const REROLL_BASE = 20;

// ============================================================
// [🧱 BLOCK: Shop Offer Count]
// ============================================================
const SHOP_OFFER_COUNT = 5;

// ============================================================
// [🧱 BLOCK: PlayerStats Class]
// ============================================================
export class PlayerStats {
  // ── Stat levels ────────────────────────────────────────────
  str: number = 0;
  vit: number = 0;
  agi: number = 0;
  end: number = 0;

  // ── Boons ──────────────────────────────────────────────────
  // modifiers is the shared struct boons write into via
  // onEquip/onRemove — PlayerBoons holds a reference to this
  // same instance so hooks mutate it directly.
  modifiers: PlayerStatModifiers = defaultModifiers();
  boons:     PlayerBoons         = new PlayerBoons(this.modifiers);

  // ── Weapon ─────────────────────────────────────────────────
  equippedWeaponItem: WeaponItem | null = null;

  // ── Shop state ─────────────────────────────────────────────
  shopOptions:      ShopItem[] = [];
  rerollsThisVisit: number     = 0;

  // ============================================================
  // [🧱 BLOCK: Reroll Cost — doubles per reroll this visit]
  // ============================================================
  get rerollCost(): number {
    return REROLL_BASE * Math.pow(2, this.rerollsThisVisit);
  }

  // ============================================================
  // [🧱 BLOCK: Stat Allocation]
  // ============================================================
  canUpgrade(key: StatKey, gold: number, floor: number): boolean {
    const cap = statCap(floor);
    if (this[key] >= cap) return false;
    return gold >= statCost(this[key]);
  }

  upgradeStat(key: StatKey, gold: number, floor: number): number {
    if (!this.canUpgrade(key, gold, floor)) return gold;
    const cost = statCost(this[key]);
    this[key]++;
    return gold - cost;
  }

  // ============================================================
  // [🧱 BLOCK: Boon Management]
  // ============================================================

  /** True if any slot holds this boon. */
  hasBoon(id: BoonId | string): boolean {
    return this.boons.hasBoon(id);
  }

  /** Returns the boon's current slot level, or 0 if not equipped. */
  getBoonLevel(id: BoonId | string): number {
    return this.boons.getLevel(id);
  }

  /**
   * Shop purchase — assigns a boon into a slot for gold.
   * If the slot is already occupied, the previous boon is
   * refunded at 50% (same convention as armor-equip previously).
   */
  equipBoon(boonId: BoonId | string, slotIndex: number, gold: number, player: Player): number {
    const def = getBoonById(boonId);
    if (!def || gold < def.cost) return gold;

    const existing = this.boons.getBoonAt(slotIndex);
    let remaining  = gold - def.cost;
    if (existing) remaining += Math.ceil(existing.def.cost * 0.5);

    this.boons.assignBoon(slotIndex, boonId as BoonId, player);
    this.applyToPlayer(player);
    return remaining;
  }

  /** Free grant (Boss Chest) — discards any existing boon in the slot, no refund. */
  claimBoon(boonId: BoonId | string, slotIndex: number, player: Player): void {
    const def = getBoonById(boonId);
    if (!def) return;
    this.boons.assignBoon(slotIndex, boonId as BoonId, player);
    this.applyToPlayer(player);
  }

  sellBoon(slotIndex: number, gold: number, player: Player): number {
    const newGold = this.boons.sellBoon(slotIndex, gold, player);
    this.applyToPlayer(player);
    return newGold;
  }

  upgradeBoonSlot(slotIndex: number, gold: number, player: Player): number {
    const newGold = this.boons.upgradeSlot(slotIndex, gold, player);
    this.applyToPlayer(player);
    return newGold;
  }

  swapBoonSlots(a: number, b: number, player: Player): void {
    this.boons.swapSlots(a, b, player);
    this.applyToPlayer(player);
  }

  // ============================================================
  // [🧱 BLOCK: Weapon Equip / Unequip]
  // ============================================================
  canBuyWeapon(item: WeaponItem, gold: number): boolean {
    return gold >= item.cost;
  }

  equipWeapon(item: WeaponItem, gold: number, player: Player): number {
    if (!this.canBuyWeapon(item, gold)) return gold;
    if (this.equippedWeaponItem) this.removeWeaponPassive(this.equippedWeaponItem, player);
    this.equippedWeaponItem = item;
    this.applyWeaponPassive(item, player);
    player.equippedWeapon = new Weapon(item.weaponType);
    this.applyToPlayer(player);
    return gold - item.cost;
  }

  claimWeapon(item: WeaponItem, player: Player): void {
    if (this.equippedWeaponItem) this.removeWeaponPassive(this.equippedWeaponItem, player);
    this.equippedWeaponItem = item;
    this.applyWeaponPassive(item, player);
    player.equippedWeapon = new Weapon(item.weaponType);
    this.applyToPlayer(player);
  }

  unequipWeapon(gold: number, player: Player): number {
    if (!this.equippedWeaponItem) return gold;
    const refund = Math.ceil(this.equippedWeaponItem.cost * 0.5);
    this.removeWeaponPassive(this.equippedWeaponItem, player);
    this.equippedWeaponItem = null;
    player.equippedWeapon = new Weapon('fists');
    this.applyToPlayer(player);
    return gold + refund;
  }

  private applyWeaponPassive(item: WeaponItem, player: Player) {
    const passive = getWeaponPassive(item.weaponType);
    if (passive) passive.onEquip?.(player);
  }

  private removeWeaponPassive(item: WeaponItem, player: Player) {
    const passive = getWeaponPassive(item.weaponType);
    if (passive) passive.onRemove?.(player);
  }

  // ============================================================
  // [🧱 BLOCK: Shop Options]
  // ============================================================
  generateShopOptions(_floor: number = 1) {
    const ownedBoonIds  = this.boons.equippedIds;
    const ownedWeaponId = this.equippedWeaponItem?.id ?? null;
    this.shopOptions      = getRandomShopItems(ownedBoonIds, ownedWeaponId, SHOP_OFFER_COUNT);
    this.rerollsThisVisit = 0;
  }

  reroll(gold: number, _floor: number = 1): number {
    if (gold < this.rerollCost) return gold;
    const cost          = this.rerollCost;
    const ownedBoonIds  = this.boons.equippedIds;
    const ownedWeaponId = this.equippedWeaponItem?.id ?? null;
    this.shopOptions     = getRandomShopItems(ownedBoonIds, ownedWeaponId, SHOP_OFFER_COUNT);
    this.rerollsThisVisit++;
    return gold - cost;
  }

  // ============================================================
  // [🧱 BLOCK: Apply Stats to Player]
  // All boon contributions funnel through `this.modifiers`
  // (written by boon onEquip/onRemove hooks), so this is a
  // straightforward base + stat levels + modifiers composition —
  // no armor-piece or set-bonus lookups needed anymore.
  //
  // Also resets the Blood Reaper kill counter whenever that boon
  // isn't at max level — mirrors the old set-bonus safety reset,
  // so re-equipping/leveling into 5pc doesn't instantly proc off
  // a stale counter from a previous equip.
  // ============================================================
  applyToPlayer(player: Player) {
    if (this.boons.getLevel('blood_reaper') < MAX_BOON_LEVEL) resetBloodReaperCounter();

    player.maxHp = Math.max(1, 100 + (this.vit * 10) + this.modifiers.bonusMaxHp);
    player.hp         = Math.min(player.hp, player.maxHp);
    player.maxStamina = 100 + (this.end * 5) + this.modifiers.bonusMaxStamina;
    player.maxSpeed   = 5 + (this.agi * 0.3) + this.modifiers.bonusSpeed;
    player.dashCost   = this.dashCost;
  }

  // ============================================================
  // [🧱 BLOCK: applySpeedOnly]
  // Returns the base maxSpeed value derived from stats and boons
  // WITHOUT writing to player or including consumable buffs.
  // Used by ConsumableSystem each frame to compute the Wrath
  // Potion speed bonus on top of the correct base.
  // ============================================================
  applySpeedOnly(_player: Player): number {
    return 5 + (this.agi * 0.3) + this.modifiers.bonusSpeed;
  }

  // ============================================================
  // [🧱 BLOCK: Computed Getters]
  // ============================================================
  get atkBonus(): number {
    return (this.str * 3) + this.modifiers.bonusAtk;
  }

  lastStandBonus(player: Player): number {
    const level = this.boons.getLevel('last_stand');
    if (level === 0) return 0;
    if (player.hp / player.maxHp > 0.25) return 0;
    const def = getBoonById('last_stand');
    if (!def) return 0;
    return getBoonEffectsAtLevel(def, level).bonusAtk ?? 0;
  }

  get weaponPassive(): WeaponPassive | null {
    if (!this.equippedWeaponItem) return null;
    return getWeaponPassive(this.equippedWeaponItem.weaponType);
  }

  get dashCost(): number {
    return Math.max(5, 30 - this.modifiers.dashCostReduction);
  }

  get staminaRegenRate(): number {
    return 0.4 * this.modifiers.staminaRegenMult;
  }

  get damageReduction(): number {
    return Math.min(0.75, this.modifiers.damageReduction);
  }

  get healOnKill(): number {
    return this.modifiers.healOnKill;
  }

  // ============================================================
  // [🧱 BLOCK: Reset]
  // ============================================================
  reset(player: Player) {
    if (this.equippedWeaponItem) this.removeWeaponPassive(this.equippedWeaponItem, player);
    this.boons.reset(player);
    resetBloodReaperCounter();

    this.str = 0; this.vit = 0; this.agi = 0; this.end = 0;
    this.modifiers           = defaultModifiers();
    this.boons               = new PlayerBoons(this.modifiers);
    this.shopOptions         = [];
    this.rerollsThisVisit    = 0;
    this.equippedWeaponItem  = null;

    player.equippedWeapon = new Weapon('fists');
    this.applyToPlayer(player);
  }
}
