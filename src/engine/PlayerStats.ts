// src/engine/PlayerStats.ts

import { Player } from "./Player";
import {
  Charm, PlayerStatModifiers,
  defaultModifiers, getRandomCharms,
} from "./CharmRegistry";

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
  { key: 'str', label: 'STR', icon: '⚔️',  description: '+3 attack damage per level'      },
  { key: 'vit', label: 'VIT', icon: '❤️',  description: '+10 max HP per level'            },
  { key: 'agi', label: 'AGI', icon: '💨',  description: '+0.3 move speed per level'       },
  { key: 'end', label: 'END', icon: '⚡',  description: '+5 max stamina per level'        },
];

// Cost tiers based on current level
export function statCost(currentLevel: number): number {
  if (currentLevel < 3)  return 30;
  if (currentLevel < 6)  return 60;
  return 100;
}

// Max level allowed per floor
export function statCap(floor: number): number {
  return Math.min(10, floor * 3);
}

// ============================================================
// [🧱 BLOCK: PlayerStats Class]
// Owns stat levels, charm slots, and computes final player
// values by combining base stats + stat points + charm mods.
// ============================================================
export class PlayerStats {
  // Stat levels (0–10)
  str: number = 0;
  vit: number = 0;
  agi: number = 0;
  end: number = 0;

  // Charm slots (max 5)
  charms:     Charm[]              = [];
  maxCharms:  number               = 5;
  modifiers:  PlayerStatModifiers  = defaultModifiers();

  // Shop state
  shopOptions:  Charm[]  = [];   // 3 random charms shown
  rerollCost:   number   = 20;

  // ============================================================
  // [🧱 BLOCK: Stat Allocation]
  // ============================================================
  canUpgrade(key: StatKey, gold: number, floor: number): boolean {
    const cap  = statCap(floor);
    const level = this[key];
    if (level >= cap) return false;
    return gold >= statCost(level);
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

  sellCharm(charmId: string, gold: number, player: Player): number {
    const idx   = this.charms.findIndex((c) => c.id === charmId);
    if (idx === -1) return gold;
    const charm = this.charms[idx];
    charm.onRemove(player, this.modifiers);
    this.charms.splice(idx, 1);
    this.applyToPlayer(player);
    const refund = Math.ceil(charm.cost * 0.5);
    return gold + refund;
  }

  hasCharm(id: string): boolean {
    return this.charms.some((c) => c.id === id);
  }

  // ============================================================
  // [🧱 BLOCK: Shop Options]
  // ============================================================
  generateShopOptions() {
    const ownedIds  = this.charms.map((c) => c.id);
    this.shopOptions = getRandomCharms(ownedIds, 3);
  }

  reroll(gold: number): number {
    if (gold < this.rerollCost) return gold;
    const ownedIds   = this.charms.map((c) => c.id);
    this.shopOptions = getRandomCharms(ownedIds, 3);
    return gold - this.rerollCost;
  }

  // ============================================================
  // [🧱 BLOCK: Apply Stats to Player]
  // Call after any stat or charm change to sync Player values.
  // ============================================================
  applyToPlayer(player: Player) {
    // Max HP
    const newMaxHp    = 100 + (this.vit * 10) + this.modifiers.bonusMaxHp;
    player.maxHp      = Math.max(1, newMaxHp);
    player.hp         = Math.min(player.hp, player.maxHp);

    // Max Stamina
    player.maxStamina = 100 + (this.end * 5) + this.modifiers.bonusMaxStamina;

    // Move Speed
    player.maxSpeed   = 5 + (this.agi * 0.3) + this.modifiers.bonusSpeed;
  }

  // ============================================================
  // [🧱 BLOCK: Computed Stat Getters]
  // Used by HordeSystem/BossSystem for attack calculations.
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
    return Math.min(0.75, this.modifiers.damageReduction); // Cap at 75%
  }

  get healOnKill(): number {
    return this.modifiers.healOnKill;
  }

  // ============================================================
  // [🧱 BLOCK: Reset]
  // Called on full game restart — wipes everything.
  // ============================================================
  reset(player: Player) {
    this.str      = 0;
    this.vit      = 0;
    this.agi      = 0;
    this.end      = 0;
    this.charms   = [];
    this.modifiers = defaultModifiers();
    this.shopOptions = [];
    this.applyToPlayer(player);
  }
}