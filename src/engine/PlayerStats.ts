// src/engine/PlayerStats.ts
import { Player }        from "./Player";
import { Charm, CHARM_POOL, PlayerStatModifiers, defaultModifiers } from "./CharmRegistry";
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
// The 4 non-weapon armor slots tracked by PlayerStats.
// The weapon slot is handled by equippedWeaponItem + the
// armorSlots.weapon ArmorItem (if from a set).
// ============================================================
export type ArmorSlots = {
  helmet: ArmorItem | null;
  armor:  ArmorItem | null;
  boots:  ArmorItem | null;
  gloves: ArmorItem | null;
  weapon: ArmorItem | null;  // set-piece weapon counts toward set bonus
};

function emptyArmorSlots(): ArmorSlots {
  return { helmet: null, armor: null, boots: null, gloves: null, weapon: null };
}

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

  // ── Armor slots ────────────────────────────────────────────
  armorSlots: ArmorSlots = emptyArmorSlots();

  // Shop state
  shopOptions:      ShopItem[] = [];
  rerollsThisVisit: number     = 0;

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
  // [🧱 BLOCK: Armor Equip / Unequip]
  // One piece per slot. Selling refunds 50%.
  // applyToPlayer is called after any change so stats update.
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
    this.applyToPlayer(player);
    return remaining;
  }

  claimArmor(item: ArmorItem, player: Player): boolean {
    // Free claim — auto-replace existing piece with no refund
    this.armorSlots[item.slot] = item;
    this.applyToPlayer(player);
    return true;
  }

  sellArmor(slot: ArmorSlot, gold: number, player: Player): number {
    const item = this.armorSlots[slot];
    if (!item) return gold;
    this.armorSlots[slot] = null;
    this.applyToPlayer(player);
    return gold + Math.ceil(item.cost * 0.5);
  }

  hasArmorInSlot(slot: ArmorSlot): boolean {
    return this.armorSlots[slot] !== null;
  }

  // ============================================================
  // [🧱 BLOCK: Set Bonus Count]
  // Counts how many pieces per set are currently equipped
  // across all 5 slots (including weapon slot armor piece).
  // ============================================================
  getEquippedSetCounts(): Record<ArmorSetId, number> {
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
    return counts;
  }

  // ============================================================
  // [🧱 BLOCK: Active Set Bonuses]
  // Returns which sets have active bonuses and at what tier.
  // Used by Inventory UI to display active bonuses.
  // ============================================================
  getActiveBonusTiers(): { setId: ArmorSetId; tier: 2 | 4 | 5 }[] {
    const counts = this.getEquippedSetCounts();
    const result: { setId: ArmorSetId; tier: 2 | 4 | 5 }[] = [];
    (Object.keys(counts) as ArmorSetId[]).forEach((setId) => {
      const n = counts[setId];
      if (n >= 5) result.push({ setId, tier: 5 });
      else if (n >= 4) result.push({ setId, tier: 4 });
      else if (n >= 2) result.push({ setId, tier: 2 });
    });
    return result;
  }

  // ============================================================
  // [🧱 BLOCK: Shadow Walker Invisibility Check]
  // Returns true when Shadow Walker 5pc is active.
  // Read by HordeSystem/BossSystem on player dash.
  // ============================================================
  get hasShadowWalker5pc(): boolean {
    return (this.getEquippedSetCounts()['shadow_walker'] ?? 0) >= 5;
  }

  get hasIronWarden5pc(): boolean {
    return (this.getEquippedSetCounts()['iron_warden'] ?? 0) >= 5;
  }

  get hasBloodReaper5pc(): boolean {
    return (this.getEquippedSetCounts()['blood_reaper'] ?? 0) >= 5;
  }

  // ============================================================
  // [🧱 BLOCK: Shop Options]
  // ============================================================
  generateShopOptions() {
    const ownedCharmIds  = this.charms.map((c) => c.id);
    const ownedWeaponId  = this.equippedWeaponItem?.id ?? null;
    const ownedArmorIds  = Object.values(this.armorSlots)
      .filter(Boolean).map((a) => a!.id);
    this.shopOptions      = getRandomShopItems(
      ownedCharmIds, ownedWeaponId, ownedArmorIds, 3
    );
    this.rerollsThisVisit = 0;
  }

  reroll(gold: number): number {
    if (gold < this.rerollCost) return gold;
    const cost           = this.rerollCost;
    const ownedCharmIds  = this.charms.map((c) => c.id);
    const ownedWeaponId  = this.equippedWeaponItem?.id ?? null;
    const ownedArmorIds  = Object.values(this.armorSlots)
      .filter(Boolean).map((a) => a!.id);
    this.shopOptions     = getRandomShopItems(
      ownedCharmIds, ownedWeaponId, ownedArmorIds, 3
    );
    this.rerollsThisVisit++;
    return gold - cost;
  }

  // ============================================================
  // [🧱 BLOCK: Apply Stats to Player]
  // Layers: base + stat levels + charm modifiers + armor pieces
  // + set bonus modifiers. Called after any equipment change.
  // ============================================================
  applyToPlayer(player: Player) {
    // ── Armor piece flat stats ──────────────────────────────
    let armorHp        = 0;
    let armorDR        = 0;
    let armorSpeed     = 0;
    let armorAtk       = 0;

    const slots: ArmorSlot[] = ['helmet', 'armor', 'boots', 'gloves', 'weapon'];
    slots.forEach((slot) => {
      const piece = this.armorSlots[slot];
      if (!piece) return;
      switch (piece.statType) {
        case 'maxHp':          armorHp    += piece.statValue; break;
        case 'damageReduction':armorDR    += piece.statValue; break;
        case 'moveSpeed':      armorSpeed += piece.statValue; break;
        case 'atk':            armorAtk   += piece.statValue; break;
      }
    });

    // ── Set bonus modifiers ──────────────────────────────────
    const counts = this.getEquippedSetCounts();
    const sb: SetBonusModifiers = computeSetBonusModifiers(counts);

    // ── Blood Reaper kill counter — reset if < 5pc ──────────
    if ((counts['blood_reaper'] ?? 0) < 5) resetBloodReaperCounter();

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

    player.maxSpeed   = 5
      + (this.agi * 0.3)
      + this.modifiers.bonusSpeed
      + armorSpeed
      + sb.bonusMoveSpeed;

    player.dashCost   = this.dashCost;
  }

  // ============================================================
  // [🧱 BLOCK: Computed Getters]
  // ============================================================
  get atkBonus(): number {
    // Base stats + charm modifiers + armor gloves/weapon pieces + set bonus
    let armorAtk = 0;
    const slots: ArmorSlot[] = ['gloves', 'weapon'];
    slots.forEach((slot) => {
      const piece = this.armorSlots[slot];
      if (piece?.statType === 'atk') armorAtk += piece.statValue;
    });
    const counts = this.getEquippedSetCounts();
    const sb     = computeSetBonusModifiers(counts);
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
    const counts = this.getEquippedSetCounts();
    const sb     = computeSetBonusModifiers(counts);
    return Math.max(5, 30 - this.modifiers.dashCostReduction - sb.dashCostReduction);
  }

  get staminaRegenRate(): number {
    return 0.4 * this.modifiers.staminaRegenMult;
  }

  get damageReduction(): number {
    // Charm DR + armor DR + Iron Warden 4pc DR, capped at 75%
    let armorDR = 0;
    const piece = this.armorSlots['armor'];
    if (piece?.statType === 'damageReduction') armorDR = piece.statValue;
    const counts = this.getEquippedSetCounts();
    const sb     = computeSetBonusModifiers(counts);
    return Math.min(0.75,
      this.modifiers.damageReduction + armorDR + sb.bonusDamageReduction
    );
  }

  get healOnKill(): number {
    // Charm heal + Blood Reaper 4pc heal
    const counts = this.getEquippedSetCounts();
    const br4pc  = (counts['blood_reaper'] ?? 0) >= 4 ? 8 : 0;
    return this.modifiers.healOnKill + br4pc;
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
    this.armorSlots          = emptyArmorSlots();

    resetBloodReaperCounter();
    player.equippedWeapon = new Weapon('fists');
    this.applyToPlayer(player);
  }
}