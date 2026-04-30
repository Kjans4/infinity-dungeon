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
// ============================================================
const REROLL_BASE      = 20;
const REROLL_INCREMENT = 20;
const REROLL_CAP       = 100;

// ============================================================
// [🧱 BLOCK: Armor Slots]
// ============================================================
export type ArmorSlots = {
  helmet:   ArmorItem | null;
  armor:    ArmorItem | null;
  leggings: ArmorItem | null;
  gloves:   ArmorItem | null;
  boots:    ArmorItem | null;
};

function emptyArmorSlots(): ArmorSlots {
  return { helmet: null, armor: null, leggings: null, gloves: null, boots: null };
}

// ============================================================
// [🧱 BLOCK: PlayerStats Class]
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
  private _setCounts:  Record<ArmorSetId, number> | null = null;
  private _setBonuses: SetBonusModifiers | null          = null;

  private _markDirty(): void {
    this._setCounts  = null;
    this._setBonuses = null;
  }

  // ============================================================
  // [🧱 BLOCK: Set Count Cache Accessors]
  // ============================================================
  private _getSetCounts(): Record<ArmorSetId, number> {
    if (this._setCounts) return this._setCounts;
    const counts: Record<ArmorSetId, number> = {
      iron_warden:   0,
      shadow_walker: 0,
      blood_reaper:  0,
    };
    const slots: ArmorSlot[] = ['helmet', 'armor', 'leggings', 'gloves', 'boots'];
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
  // [🧱 BLOCK: Armor Equip / Sell / Claim]
  // ============================================================
  canBuyArmor(item: ArmorItem, gold: number): boolean {
    return gold >= item.cost;
  }

  equipArmor(item: ArmorItem, gold: number, player: Player): number {
    if (!this.canBuyArmor(item, gold)) return gold;
    const existing = this.armorSlots[item.slot];
    let remaining  = gold - item.cost;
    if (existing) remaining += Math.ceil(existing.cost * 0.5);
    this.armorSlots[item.slot] = item;
    this._markDirty();
    this.applyToPlayer(player);
    return remaining;
  }

  claimArmor(item: ArmorItem, player: Player): boolean {
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
  // ============================================================
  getEquippedSetCounts(): Record<ArmorSetId, number> {
    return this._getSetCounts();
  }

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
  // ============================================================
  generateShopOptions(floor: number = 1) {
    const ownedCharmIds = this.charms.map((c) => c.id);
    const ownedWeaponId = this.equippedWeaponItem?.id ?? null;
    const ownedArmorIds = Object.values(this.armorSlots).filter(Boolean).map((a) => a!.id);
    this.shopOptions      = getRandomShopItems(ownedCharmIds, ownedWeaponId, ownedArmorIds, 3, floor);
    this.rerollsThisVisit = 0;
  }

  reroll(gold: number, floor: number = 1): number {
    if (gold < this.rerollCost) return gold;
    const cost          = this.rerollCost;
    const ownedCharmIds = this.charms.map((c) => c.id);
    const ownedWeaponId = this.equippedWeaponItem?.id ?? null;
    const ownedArmorIds = Object.values(this.armorSlots).filter(Boolean).map((a) => a!.id);
    this.shopOptions     = getRandomShopItems(ownedCharmIds, ownedWeaponId, ownedArmorIds, 3, floor);
    this.rerollsThisVisit++;
    return gold - cost;
  }

  // ============================================================
  // [🧱 BLOCK: Apply Stats to Player]
  // Layers: base + stat levels + charm modifiers + armor pieces
  // + set bonus modifiers.
  // ============================================================
  applyToPlayer(player: Player) {
    let armorHp    = 0;
    let armorSpeed = 0;

    const slots: ArmorSlot[] = ['helmet', 'armor', 'leggings', 'gloves', 'boots'];
    slots.forEach((slot) => {
      const piece = this.armorSlots[slot];
      if (!piece) return;
      switch (piece.statType) {
        case 'maxHp':    armorHp    += piece.statValue; break;
        case 'moveSpeed':armorSpeed += piece.statValue; break;
      }
    });

    const sb = this._getSetBonuses();
    if ((this._getSetCounts()['blood_reaper'] ?? 0) < 5) resetBloodReaperCounter();

    player.maxHp = Math.max(1,
      100 + (this.vit * 10) + this.modifiers.bonusMaxHp + armorHp + sb.bonusMaxHp
    );
    player.hp         = Math.min(player.hp, player.maxHp);
    player.maxStamina = 100 + (this.end * 5) + this.modifiers.bonusMaxStamina;
    player.maxSpeed   = 5 + (this.agi * 0.3) + this.modifiers.bonusSpeed + armorSpeed + sb.bonusMoveSpeed;
    player.dashCost   = this.dashCost;
  }

  // ============================================================
  // [🧱 BLOCK: applySpeedOnly]
  // Returns the base maxSpeed value derived from stats, charms,
  // and armor WITHOUT writing to player or including consumable
  // buffs. Used by ConsumableSystem each frame to compute the
  // Wrath Potion speed bonus on top of the correct base.
  // ============================================================
  applySpeedOnly(player: Player): number {
    let armorSpeed = 0;
    const slots: ArmorSlot[] = ['helmet', 'armor', 'leggings', 'gloves', 'boots'];
    slots.forEach((slot) => {
      const piece = this.armorSlots[slot];
      if (piece?.statType === 'moveSpeed') armorSpeed += piece.statValue;
    });
    const sb = this._getSetBonuses();
    return 5 + (this.agi * 0.3) + this.modifiers.bonusSpeed + armorSpeed + sb.bonusMoveSpeed;
  }

  // ============================================================
  // [🧱 BLOCK: Computed Getters]
  // ============================================================
  get atkBonus(): number {
    let armorAtk = 0;
    const atkSlots: ArmorSlot[] = ['gloves', 'leggings'];
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
    return 0.4 * this.modifiers.staminaRegenMult;
  }

  get damageReduction(): number {
    let armorDR = 0;
    const piece = this.armorSlots['armor'];
    if (piece?.statType === 'damageReduction') armorDR = piece.statValue;
    const sb = this._getSetBonuses();
    return Math.min(0.75, this.modifiers.damageReduction + armorDR + sb.bonusDamageReduction);
  }

  get healOnKill(): number {
    const br4pc = (this._getSetCounts()['blood_reaper'] ?? 0) >= 4 ? 8 : 0;
    return this.modifiers.healOnKill + br4pc;
  }

  // ============================================================
  // [🧱 BLOCK: Reset]
  // ============================================================
  reset(player: Player) {
    if (this.equippedWeaponItem) this.removeWeaponPassive(this.equippedWeaponItem, player);
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