// src/engine/items/ItemPool.ts
import { Charm, CHARM_POOL }               from "../CharmRegistry";
import { WeaponItem, ArmorItem }           from "./types";
import { WEAPON_ITEM_POOL }                from "./WeaponItemRegistry";
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
// excluding IDs the player already owns.
//
// ownedCharmIds  — charm IDs already in charm slots
// ownedWeaponId  — current equipped weapon ID (or null)
// ownedArmorIds  — armor piece IDs already equipped
// count          — number of items to return (default 3)
// floor          — scales armor stat values at generation time
// ============================================================
export function getRandomShopItems(
  ownedCharmIds:  string[],
  ownedWeaponId:  string | null,
  ownedArmorIds:  string[] = [],
  count:          number   = 3,
  floor:          number   = 1
): ShopItem[] {
  // ── Charms ────────────────────────────────────────────────
  const availableCharms: ShopItem[] = CHARM_POOL
    .filter((c: Charm) => !ownedCharmIds.includes(c.id))
    .map((c: Charm) => ({ ...c, kind: 'charm' as const }));

  // ── Weapons ───────────────────────────────────────────────
  const availableWeapons: ShopItem[] = WEAPON_ITEM_POOL
    .filter((w: WeaponItem) => w.id !== ownedWeaponId)
    .map((w: WeaponItem) => ({ ...w, kind: 'weapon' as const }));

  // ── Armor ─────────────────────────────────────────────────
  // Build each template at the current floor level so stats scale correctly.
  // Exclude pieces already owned/equipped.
  const availableArmor: ShopItem[] = ARMOR_TEMPLATES
    .filter((t) => !ownedArmorIds.includes(t.id))
    .reduce<ShopItem[]>((acc, t) => {
      const item = buildArmorItem(t.id, floor);
      if (item) acc.push({ ...item, kind: 'armor' as const });
      return acc;
    }, []);

  // ── Combine, shuffle, slice ───────────────────────────────
  const combined = [...availableCharms, ...availableWeapons, ...availableArmor]
    .sort(() => Math.random() - 0.5);

  return combined.slice(0, count);
}