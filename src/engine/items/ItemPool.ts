// src/engine/items/ItemPool.ts
import { Charm, CHARM_POOL } from "../CharmRegistry";
import { WeaponItem }        from "./types";
import { WEAPON_ITEM_POOL }  from "./WeaponItemRegistry";

// ============================================================
// [🧱 BLOCK: Shop Item Union]
// A shop slot holds either a Charm or a WeaponItem.
// ============================================================
export type ShopItem =
  | (Charm      & { kind: 'charm'  })
  | (WeaponItem & { kind: 'weapon' });

// ============================================================
// [🧱 BLOCK: Get Random Shop Items]
// Returns `count` random items from the combined pool,
// excluding IDs the player already owns.
//
// ownedCharmIds   — charm IDs already in charm slots
// ownedWeaponId   — current equipped weapon ID (or null)
// ============================================================
export function getRandomShopItems(
  ownedCharmIds:  string[],
  ownedWeaponId:  string | null,
  count:          number = 3
): ShopItem[] {
  // Build available charms
  const availableCharms: ShopItem[] = CHARM_POOL
  .filter((c: Charm) => !ownedCharmIds.includes(c.id))
  .map((c: Charm) => ({ ...c, kind: 'charm' as const }));

  // Build available weapons
  const availableWeapons: ShopItem[] = WEAPON_ITEM_POOL
  .filter((w: WeaponItem) => w.id !== ownedWeaponId)
  .map((w: WeaponItem) => ({ ...w, kind: 'weapon' as const }));

  // Combine and shuffle
  const combined = [...availableCharms, ...availableWeapons]
    .sort(() => Math.random() - 0.5);

  return combined.slice(0, count);
}