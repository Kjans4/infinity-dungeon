// src/engine/PlayerStats.ts
import { Player }        from "./Player";
import { Charm, CHARM_POOL, PlayerStatModifiers, defaultModifiers } from "./CharmRegistry";
import { WeaponItem }    from "./items/types";
import { Weapon }        from "./items/Weapon";
import { getCharmById }  from "./CharmRegistry";
import { ShopItem, getRandomShopItems } from "./items/ItemPool";

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
// [🧱 BLOCK: PlayerStats Class]
// ============================================================
export class PlayerStats {
  // Stat levels
  str: number = 0;
  vit: number = 0;
  agi: number = 0;
  end: number = 0;

  // Charms
  charms:    Charm[]             = [];
  maxCharms: number              = 5;
  modifiers: PlayerStatModifiers = defaultModifiers();

  // Equipped weapon item (null = bare fists)
  equippedWeaponItem: WeaponItem | null = null;

  // Shop state
  shopOptions:      ShopItem[] = [];
  rerollsThisVisit: number     = 0;  // resets each new shop visit

  // ============================================================
  // [🧱 BLOCK: Reroll Cost]
  // Computed from how many rerolls have been done this visit.
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

  // ── Claim charm from pending loot — free ─────────────────
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

  // ── Claim weapon from pending loot — free ────────────────
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
    const charm = getCharmById(item.passiveId);
    if (charm) charm.onEquip(player, this.modifiers);
  }

  private removeWeaponPassive(item: WeaponItem, player: Player) {
    const charm = getCharmById(item.passiveId);
    if (charm) charm.onRemove(player, this.modifiers);
  }

  // ============================================================
  // [🧱 BLOCK: Shop Options]
  // Resets reroll counter on each fresh generation.
  // ============================================================
  generateShopOptions() {
    const ownedCharmIds = this.charms.map((c) => c.id);
    const ownedWeaponId = this.equippedWeaponItem?.id ?? null;
    this.shopOptions      = getRandomShopItems(ownedCharmIds, ownedWeaponId, 3);
    this.rerollsThisVisit = 0;  // ← reset escalating cost
  }

  reroll(gold: number): number {
    if (gold < this.rerollCost) return gold;
    const cost          = this.rerollCost;
    const ownedCharmIds = this.charms.map((c) => c.id);
    const ownedWeaponId = this.equippedWeaponItem?.id ?? null;
    this.shopOptions    = getRandomShopItems(ownedCharmIds, ownedWeaponId, 3);
    this.rerollsThisVisit++;
    return gold - cost;
  }

  // ============================================================
  // [🧱 BLOCK: Apply Stats to Player]
  // ============================================================
  applyToPlayer(player: Player) {
    player.maxHp      = Math.max(1, 100 + (this.vit * 10) + this.modifiers.bonusMaxHp);
    player.hp         = Math.min(player.hp, player.maxHp);
    player.maxStamina = 100 + (this.end * 5) + this.modifiers.bonusMaxStamina;
    player.maxSpeed   = 5 + (this.agi * 0.3) + this.modifiers.bonusSpeed;
  }

  // ============================================================
  // [🧱 BLOCK: Computed Getters]
  // ============================================================
  get atkBonus(): number {
    return (this.str * 3) + this.modifiers.bonusAtk;
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
    if (this.equippedWeaponItem) {
      this.removeWeaponPassive(this.equippedWeaponItem, player);
    }
    this.charms.forEach((c) => c.onRemove(player, this.modifiers));

    this.str = 0; this.vit = 0; this.agi = 0; this.end = 0;
    this.charms              = [];
    this.modifiers           = defaultModifiers();
    this.shopOptions         = [];
    this.rerollsThisVisit    = 0;
    this.equippedWeaponItem  = null;

    player.equippedWeapon = new Weapon('fists');
    this.applyToPlayer(player);
  }
}