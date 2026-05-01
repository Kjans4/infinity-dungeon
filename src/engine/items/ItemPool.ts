// src/engine/items/ItemPool.ts
import { Charm, CHARM_POOL }             from "../CharmRegistry";
import { WeaponItem, ArmorItem }         from "./types";
import { WEAPON_ITEM_POOL }              from "./WeaponItemRegistry";
import { ARMOR_TEMPLATES, buildArmorItem } from "./ArmorRegistry";
import { ConsumableDef, POTION_POOL, SCROLL_POOL } from "../ConsumableRegistry";

// ============================================================
// [🧱 BLOCK: Shop Item Union]
// A shop slot holds a Charm, WeaponItem, or ArmorItem.
// Consumables are sold separately via the Provisions section.
// ============================================================
export type ShopItem =
  | (Charm      & { kind: 'charm'  })
  | (WeaponItem & { kind: 'weapon' })
  | (ArmorItem  & { kind: 'armor'  });

// ============================================================
// [🧱 BLOCK: Get Random Shop Items]
// Returns `count` random items from the combined pool,
// excluding IDs the player already owns or has pending.
//
// ownedCharmIds  — charm IDs already equipped
// ownedWeaponId  — current equipped weapon ID (or null)
// ownedArmorIds  — armor piece IDs already in slots or pending
// count          — how many items to return (default 5)
// floor          — current floor, used to scale armor stat values
//
// Pool weights: each category contributes equally to the shuffle.
// ============================================================
export function getRandomShopItems(
  ownedCharmIds:  string[],
  ownedWeaponId:  string | null,
  ownedArmorIds:  string[] = [],
  count:          number   = 5,
  floor:          number   = 1
): ShopItem[] {
  // ── Available charms ───────────────────────────────────────
  const availableCharms: ShopItem[] = CHARM_POOL
    .filter((c: Charm) => !ownedCharmIds.includes(c.id))
    .map((c: Charm) => ({ ...c, kind: 'charm' as const }));

  // ── Available weapons ──────────────────────────────────────
  const availableWeapons: ShopItem[] = WEAPON_ITEM_POOL
    .filter((w: WeaponItem) => w.id !== ownedWeaponId)
    .map((w: WeaponItem) => ({ ...w, kind: 'weapon' as const }));

  // ── Available armor ────────────────────────────────────────
  const availableArmor: ShopItem[] = ARMOR_TEMPLATES
    .filter((t) => !ownedArmorIds.includes(t.id))
    .map((t)    => buildArmorItem(t.id, floor))
    .filter((item): item is ArmorItem => item !== null)
    .map((item) => ({ ...item, kind: 'armor' as const }));

  // ── Combine and shuffle ────────────────────────────────────
  const combined = [...availableCharms, ...availableWeapons, ...availableArmor]
    .sort(() => Math.random() - 0.5);

  return combined.slice(0, count);
}

// ============================================================
// [🧱 BLOCK: Get Random Consumable Drop]
// Used by HordeSystem to spawn consumable ground drops.
// Weighted: potions slightly more common than scrolls.
// ============================================================
export function getRandomConsumableDrop(): ConsumableDef {
  const usePotion = Math.random() < 0.55;
  const pool      = usePotion ? POTION_POOL : SCROLL_POOL;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ============================================================
// [🧱 BLOCK: Get Shop Consumable Options]
// Returns a fixed set of consumables for the shop provisions
// section — one of each potion + a selection of scrolls.
// Shuffled so the merchant feels different each visit.
// ============================================================
export function getShopConsumableOptions(): ConsumableDef[] {
  const potions  = [...POTION_POOL].sort(() => Math.random() - 0.5);
  const scrolls  = [...SCROLL_POOL].sort(() => Math.random() - 0.5);
  // Show all 4 potions + 3 random scrolls = 7 items
  return [...potions, ...scrolls.slice(0, 3)];
}