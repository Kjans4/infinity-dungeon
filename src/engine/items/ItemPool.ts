// src/engine/items/ItemPool.ts
import { Charm, CHARM_POOL }             from "../CharmRegistry";
import { WeaponItem, ArmorItem }         from "./types";
import { WEAPON_ITEM_POOL }              from "./WeaponItemRegistry";
import { ARMOR_TEMPLATES, buildArmorItem } from "./ArmorRegistry";

// ============================================================
// [🧱 BLOCK: Shop Item Union]
// A shop slot holds a Charm, WeaponItem, or ArmorItem.
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
// count          — how many items to return (default 3)
// floor          — current floor, used to scale armor stat values
//
// Pool weights: each category contributes equally to the shuffle,
// so the distribution is ~1/3 charm, ~1/3 weapon, ~1/3 armor.
// ============================================================
export function getRandomShopItems(
  ownedCharmIds:  string[],
  ownedWeaponId:  string | null,
  ownedArmorIds:  string[] = [],
  count:          number   = 3,
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
  // Build floor-scaled ArmorItems from templates, excluding any
  // piece the player already owns or has as pending loot.
  // Filter nulls before adding kind so TypeScript can narrow cleanly.
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