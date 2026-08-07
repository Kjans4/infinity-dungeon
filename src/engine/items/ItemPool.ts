// src/engine/items/ItemPool.ts
import { WeaponItem }                          from "./types";
import { WEAPON_ITEM_POOL }                    from "./WeaponItemRegistry";
import { BoonDef, BOON_POOL, getRandomBoons }  from "../BoonRegistry";

// ============================================================
// [🧱 BLOCK: Shop Item Union]
// A shop slot holds a boon offer or a weapon offer. Potions/
// scrolls are no longer purchasable individually as of Phase 3 —
// they come from the weapon's random Q/E skill roll instead.
// ============================================================
export type ShopItem =
  | (WeaponItem & { kind: 'weapon' })
  | { kind: 'boon'; id: string; name: string; icon: string; description: string; tradeOff?: string; cost: number };

// ============================================================
// [🧱 BLOCK: Boon Def → Shop Offer]
// Resolves the dynamic description() at level 1 for shop-card
// display — the boon itself is level-agnostic; it inherits
// whatever level the destination slot currently has.
// ============================================================
function boonToShopItem(def: BoonDef): ShopItem {
  return {
    kind:        'boon',
    id:          def.id,
    name:        def.name,
    icon:        def.icon,
    description: def.description(1),
    tradeOff:    def.tradeOff,
    cost:        def.cost,
  };
}

// ============================================================
// [🧱 BLOCK: Get Random Shop Items]
// Returns `count` random items from the combined boon+weapon
// pool, excluding IDs the player already owns or has pending.
//
// ownedBoonIds   — boon IDs already equipped in any slot
// ownedWeaponId  — current equipped weapon ID (or null)
// count          — how many items to return (default 5 per
//                  the Phase 1 Decisions Log)
// ============================================================
export function getRandomShopItems(
  ownedBoonIds:  string[],
  ownedWeaponId: string | null,
  count:         number = 5
): ShopItem[] {
  // ── Available boons ─────────────────────────────────────────
  const availableBoons: ShopItem[] = BOON_POOL
    .filter((b) => !ownedBoonIds.includes(b.id))
    .map(boonToShopItem);

  // ── Available weapons ────────────────────────────────────────
  const availableWeapons: ShopItem[] = WEAPON_ITEM_POOL
    .filter((w: WeaponItem) => w.id !== ownedWeaponId)
    .map((w: WeaponItem) => ({ ...w, kind: 'weapon' as const }));

  // ── Combine and shuffle ────────────────────────────────────
  const combined = [...availableBoons, ...availableWeapons]
    .sort(() => Math.random() - 0.5);

  return combined.slice(0, count);
}

// ============================================================
// [🧱 BLOCK: Get Random Boons — Chest Rewards]
// Used by the Boss Chest to offer 3 free boon choices. Returns
// full BoonDef objects (not flattened ShopItem) since the chest
// picker needs the level-aware description() function.
// ============================================================
export function getRandomChestBoons(ownedBoonIds: string[], count: number = 3): BoonDef[] {
  return getRandomBoons(ownedBoonIds, count);
}