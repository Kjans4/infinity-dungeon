// src/engine/PlayerStats.ts
import { Player }        from "./Player";
import { Charm, PlayerStatModifiers, defaultModifiers } from "./CharmRegistry";
import { WeaponItem, ArmorItem, ArmorSlot, ArmorSetId } from "./items/types";
import { Weapon }        from "./items/Weapon";
import { ShopItem, getRandomShopItems } from "./items/ItemPool";
import { WeaponPassive, getWeaponPassive } from "./WeaponPassiveRegistry";
import {
  computeSetBonusModifiers,
  resetBloodReaperCounter,
  SetBonusModifiers,
} from "./items/ArmorRegistry";

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
// Each reroll within a single shop visit costs more than the
// last. Resets to base when the shop is opened fresh.
// 20 → 40 → 60 → 80 → 100 (cap).
// ============================================================
const REROLL_BASE      = 20;
const REROLL_INCREMENT = 20;
const REROLL_CAP       = 100;

// ============================================================
// [🧱 BLOCK: Armor Slots]
// All 5 equipment slots. The weapon slot holds an ArmorItem
// that counts toward a set bonus (separate from equippedWeaponItem
// which holds the actual WeaponItem used for combat).
// ============================================================
export type ArmorSlots = {
  helmet: ArmorItem | null;
  armor:  ArmorItem | null;
  boots:  ArmorItem | null;
  gloves: ArmorItem | null;
  weapon: ArmorItem | null;
};

function emptyArmorSlots(): ArmorSlots {
  return { helmet: null, armor: null, boots: null, gloves: null, weapon: null };
}

// ============================================================
// [🧱 BLOCK: PlayerStats Class]
// Single source of truth for all player progression.
//
// Set count caching: getEquippedSetCounts() was previously called
// 6+ times per frame across atkBonus, dashCost, damageReduction,
// healOnKill, applyToPlayer, and the has*5pc getters — each one
// iterating all 5 slots and recomputing set bonus modifiers.
// Now _cachedSetCounts and _cachedSetBonuses are computed once
// and invalidated via _markDirty() on any equip/sell/reset.
// ============================================================
export class PlayerStats {
  // ── Stat levels ────────────────────────────────────────────
  str: number = 0;
  vit: number = 0;
  agi: number = 0;
  end: number = 0;

  // ── Charms ─────────────────────────────────────────────────
  charms:    Charm[]             = [];
  maxCharms: number              = 5;
  modifiers: PlayerStatModifiers = defaultModifiers();

  // ── Weapon ─────────────────────────────────────────────────
  equippedWeaponItem: WeaponItem | null = null;

  // ── Armor ──────────────────────────────────────────────────
  armorSlots: ArmorSlots = emptyArmorSlots();

  // ── Shop state ─────────────────────────────────────────────
  shopOptions:      ShopItem[] = [];
  rerollsThisVisit: number     = 0;

  // ── Set count cache ─────────────────────────────────────────
  // Invalidated by _markDirty() after any armor equip/sell/reset.
  // All getters that need set counts read from these instead of
  // recomputing independently.
  private _setCounts:  Record<ArmorSetId, number> | null = null;
  private _setBonuses: SetBonusModifiers | null          = null;

  private _markDirty(): void {
    this._setCounts  = null;
    this._setBonuses = null;
  }

  // ============================================================
  // [🧱 BLOCK: Set Count Cache Accessors]
  // All internal code uses these instead of calling
  // getEquippedSetCounts() / computeSetBonusModifiers() directly.
  // ============================================================
  private _getSetCounts(): Record<ArmorSetId, number> {
    if (this._setCounts) return this._setCounts;
    const counts: Record<ArmorSetId, number> = {
      iron_warden:   0,
      shadow_walker: 0,
      blood_reaper:  0,
    };
    const slots: ArmorSlot[] = ['helmet', 'armor', 'boots', 'gloves', 'weapon'];
    slots.forEach((slot) => {
      const piece = this.armorSlots[slot];
      if (piece) counts[piece.setId]++;
    });
    this._setCounts = counts;
    return counts;
  }

  private _getSetBonuses(): SetBonusModifiers {
    if (this._setBonuses) return this._setBonuses;
    this._setBonuses = computeSetBonusModifiers(this._getSetCounts());
    return this._setBonuses;
  }

  // ============================================================
  // [🧱 BLOCK: Reroll Cost]
  // ============================================================
  get rerollCost(): number {
    return Math.min(REROLL_CAP, REROLL_BASE + this.rerollsThisVisit * REROLL_INCREMENT);
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
  // [🧱 BLOCK: Charm Management]
  // ============================================================
  canBuyCharm(charm: Charm, gold: number): boolean {
    if (this.charms.length >= this.maxCharms) return false;
    if (this.charms.some((c) => c.id === charm.id)) return false;
    return gold >= charm.cost;
  }

  buyCharm(charm: Charm, gold: number, player: Player): number {
    if (!this.canBuyCharm(charm, gold)) return gold;
    charm.onEquip(player, this.modifiers);
    this.charms.push(charm);
    this.applyToPlayer(player);
    return gold - charm.cost;
  }

  claimCharm(charm: Charm, player: Player): boolean {
    if (this.charms.length >= this.maxCharms) return false;
    if (this.charms.some((c) => c.id === charm.id)) return false;
    charm.onEquip(player, this.modifiers);
    this.charms.push(charm);
    this.applyToPlayer(player);
    return true;
  }

  sellCharm(charmId: string, gold: number, player: Player): number {
    const idx = this.charms.findIndex((c) => c.id === charmId);
    if (idx === -1) return gold;
    const charm = this.charms[idx];
    charm.onRemove(player, this.modifiers);
    this.charms.splice(idx, 1);
    this.applyToPlayer(player);
    return gold + Math.ceil(charm.cost * 0.5);
  }

  hasCharm(id: string): boolean {
    return this.charms.some((c) => c.id === id);
  }

  // ============================================================
  // [🧱 BLOCK: Weapon Equip / Unequip]
  // ============================================================
  canBuyWeapon(item: WeaponItem, gold: number): boolean {
    return gold >= item.cost;
  }

  equipWeapon(item: WeaponItem, gold: number, player: Player): number {
    if (!this.canBuyWeapon(item, gold)) return gold;
    if (this.equippedWeaponItem) {
      this.removeWeaponPassive(this.equippedWeaponItem, player);
    }
    this.equippedWeaponItem = item;
    this.applyWeaponPassive(item, player);
    player.equippedWeapon = new Weapon(item.weaponType);
    this.applyToPlayer(player);
    return gold - item.cost;
  }

  claimWeapon(item: WeaponItem, player: Player): void {
    if (this.equippedWeaponItem) {
      this.removeWeaponPassive(this.equippedWeaponItem, player);
    }
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
  // [🧱 BLOCK: Armor Equip / Sell / Claim]
  // One piece per slot. Selling refunds 50%.
  // _markDirty() invalidates the set count cache after any change.
  // applyToPlayer() is called after every change so stats update.
  // ============================================================
  canBuyArmor(item: ArmorItem, gold: number): boolean {
    return gold >= item.cost;
  }

  equipArmor(item: ArmorItem, gold: number, player: Player): number {
    if (!this.canBuyArmor(item, gold)) return gold;
    // Auto-sell the existing piece in this slot if present
    const existing = this.armorSlots[item.slot];
    let remaining  = gold - item.cost;
    if (existing) remaining += Math.ceil(existing.cost * 0.5);
    this.armorSlots[item.slot] = item;
    this._markDirty();
    this.applyToPlayer(player);
    return remaining;
  }

  claimArmor(item: ArmorItem, player: Player): boolean {
    // Free claim — auto-replace existing piece with no refund
    this.armorSlots[item.slot] = item;
    this._markDirty();
    this.applyToPlayer(player);
    return true;
  }

  sellArmor(slot: ArmorSlot, gold: number, player: Player): number {
    const item = this.armorSlots[slot];
    if (!item) return gold;
    this.armorSlots[slot] = null;
    this._markDirty();
    this.applyToPlayer(player);
    return gold + Math.ceil(item.cost * 0.5);
  }

  hasArmorInSlot(slot: ArmorSlot): boolean {
    return this.armorSlots[slot] !== null;
  }

  // ============================================================
  // [🧱 BLOCK: Set Bonus Count — public API]
  // External callers (Inventory UI) use this.
  // Internally all code uses _getSetCounts() for the cached path.
  // ============================================================
  getEquippedSetCounts(): Record<ArmorSetId, number> {
    return this._getSetCounts();
  }

  // ============================================================
  // [🧱 BLOCK: Active Set Bonuses]
  // Returns which sets have active bonuses and at what tier.
  // Used by Inventory UI to display active bonuses.
  // ============================================================
  getActiveBonusTiers(): { setId: ArmorSetId; tier: 2 | 4 | 5 }[] {
    const counts = this._getSetCounts();
    const result: { setId: ArmorSetId; tier: 2 | 4 | 5 }[] = [];
    (Object.keys(counts) as ArmorSetId[]).forEach((setId) => {
      const n = counts[setId];
      if (n >= 5)      result.push({ setId, tier: 5 });
      else if (n >= 4) result.push({ setId, tier: 4 });
      else if (n >= 2) result.push({ setId, tier: 2 });
    });
    return result;
  }

  // ============================================================
  // [🧱 BLOCK: Set Bonus Convenience Getters]
  // Read by HordeSystem/BossSystem for 5pc combat effects.
  // ============================================================
  get hasShadowWalker5pc(): boolean {
    return (this._getSetCounts()['shadow_walker'] ?? 0) >= 5;
  }

  get hasIronWarden5pc(): boolean {
    return (this._getSetCounts()['iron_warden'] ?? 0) >= 5;
  }

  get hasBloodReaper5pc(): boolean {
    return (this._getSetCounts()['blood_reaper'] ?? 0) >= 5;
  }

  // ============================================================
  // [🧱 BLOCK: Shop Options]
  // Passes owned armor IDs so the pool excludes already-owned
  // pieces. rerollsThisVisit resets on each fresh generation.
  // ============================================================
  generateShopOptions() {
    const ownedCharmIds = this.charms.map((c) => c.id);
    const ownedWeaponId = this.equippedWeaponItem?.id ?? null;
    const ownedArmorIds = Object.values(this.armorSlots)
      .filter(Boolean).map((a) => a!.id);
    this.shopOptions      = getRandomShopItems(ownedCharmIds, ownedWeaponId, ownedArmorIds, 3);
    this.rerollsThisVisit = 0;
  }

  reroll(gold: number): number {
    if (gold < this.rerollCost) return gold;
    const cost          = this.rerollCost;
    const ownedCharmIds = this.charms.map((c) => c.id);
    const ownedWeaponId = this.equippedWeaponItem?.id ?? null;
    const ownedArmorIds = Object.values(this.armorSlots)
      .filter(Boolean).map((a) => a!.id);
    this.shopOptions     = getRandomShopItems(ownedCharmIds, ownedWeaponId, ownedArmorIds, 3);
    this.rerollsThisVisit++;
    return gold - cost;
  }

  // ============================================================
  // [🧱 BLOCK: Apply Stats to Player]
  // Layers: base + stat levels + charm modifiers + armor pieces
  // + set bonus modifiers. Called after any equipment change.
  // Uses cached set counts/bonuses — no redundant recomputation.
  // ============================================================
  applyToPlayer(player: Player) {
    // ── Armor piece flat stats ──────────────────────────────
    let armorHp    = 0;
    let armorSpeed = 0;

    const slots: ArmorSlot[] = ['helmet', 'armor', 'boots', 'gloves', 'weapon'];
    slots.forEach((slot) => {
      const piece = this.armorSlots[slot];
      if (!piece) return;
      switch (piece.statType) {
        case 'maxHp':    armorHp    += piece.statValue; break;
        case 'moveSpeed':armorSpeed += piece.statValue; break;
        // damageReduction and atk are read via their own getters
      }
    });

    // ── Set bonus modifiers — single computation via cache ───
    const sb = this._getSetBonuses();

    // ── Blood Reaper kill counter — reset if < 5pc ──────────
    if ((this._getSetCounts()['blood_reaper'] ?? 0) < 5) resetBloodReaperCounter();

    // ── Apply all layers ─────────────────────────────────────
    player.maxHp = Math.max(1,
      100
      + (this.vit * 10)
      + this.modifiers.bonusMaxHp
      + armorHp
      + sb.bonusMaxHp
    );
    player.hp         = Math.min(player.hp, player.maxHp);
    player.maxStamina = 100 + (this.end * 5) + this.modifiers.bonusMaxStamina;
    player.maxSpeed   = 5 + (this.agi * 0.3) + this.modifiers.bonusSpeed + armorSpeed + sb.bonusMoveSpeed;
    player.dashCost   = this.dashCost;
  }

  // ============================================================
  // [🧱 BLOCK: Computed Getters]
  // All use _getSetCounts() / _getSetBonuses() — single cached
  // computation shared across the entire frame.
  // ============================================================
  get atkBonus(): number {
    let armorAtk = 0;
    const atkSlots: ArmorSlot[] = ['gloves', 'weapon'];
    atkSlots.forEach((slot) => {
      const piece = this.armorSlots[slot];
      if (piece?.statType === 'atk') armorAtk += piece.statValue;
    });
    const sb = this._getSetBonuses();
    return (this.str * 3) + this.modifiers.bonusAtk + armorAtk + sb.bonusAtk;
  }

  lastStandBonus(player: Player): number {
    if (!this.hasCharm('last_stand')) return 0;
    return player.hp / player.maxHp <= 0.25 ? 15 : 0;
  }

  get weaponPassive(): WeaponPassive | null {
    if (!this.equippedWeaponItem) return null;
    return getWeaponPassive(this.equippedWeaponItem.weaponType);
  }

  get dashCost(): number {
    const sb = this._getSetBonuses();
    return Math.max(5, 30 - this.modifiers.dashCostReduction - sb.dashCostReduction);
  }

  get staminaRegenRate(): number {
    // modifiers.staminaRegenMult — charm multiplier (Overclock, Berserker)
    // sb.bonusStaminaRegenMult   — set bonus multiplier (future-proofed)
    const sb = this._getSetBonuses();
    return 0.4 * this.modifiers.staminaRegenMult * sb.bonusStaminaRegenMult;
  }

  get damageReduction(): number {
    // Charm DR + armor chest piece DR + Iron Warden 4pc DR, capped at 75%
    let armorDR = 0;
    const piece = this.armorSlots['armor'];
    if (piece?.statType === 'damageReduction') armorDR = piece.statValue;
    const sb = this._getSetBonuses();
    return Math.min(0.75, this.modifiers.damageReduction + armorDR + sb.bonusDamageReduction);
  }

  get healOnKill(): number {
    // Charm heal + Blood Reaper 4pc heal
    const br4pc = (this._getSetCounts()['blood_reaper'] ?? 0) >= 4 ? 8 : 0;
    return this.modifiers.healOnKill + br4pc;
  }

  // ============================================================
  // [🧱 BLOCK: Reset]
  // Full wipe — called on new game / retry.
  // ============================================================
  reset(player: Player) {
    if (this.equippedWeaponItem) {
      this.removeWeaponPassive(this.equippedWeaponItem, player);
    }
    this.charms.forEach((c) => c.onRemove(player, this.modifiers));

    this.str = 0; this.vit = 0; this.agi = 0; this.end = 0;
    this.charms             = [];
    this.modifiers          = defaultModifiers();
    this.shopOptions        = [];
    this.rerollsThisVisit   = 0;
    this.equippedWeaponItem = null;
    this.armorSlots         = emptyArmorSlots();

    this._markDirty();
    resetBloodReaperCounter();
    player.equippedWeapon = new Weapon('fists');
    this.applyToPlayer(player);
  }
}