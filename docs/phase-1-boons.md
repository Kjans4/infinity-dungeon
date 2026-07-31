# Phase 1 — Boon System

Status: **Planned** (spec complete, not implemented). See `ROADMAP.md` for
where this fits among the other phases.

## Goal

Replace the current armor-set system (`ArmorRegistry.ts`, 5 equipment slots,
2/4/5-piece set bonuses) and the current charm system (`CharmRegistry.ts`,
5 slots, flat passives) with a single unified **boon** system:

- 5 slots, always.
- Each slot has its own **level (1–5)**, upgraded with gold in the Shop,
  independent of which boon occupies it.
- Boons can be freely swapped between slots (drag-and-drop, no cost) — the
  boon takes on whatever level the slot it's dropped into currently has.
- 13 boons total at launch: the 3 former armor sets + all 10 former charms,
  converted into individually-leveled boons (no more piece-count set
  bonuses — each boon is a complete effect on its own, like a charm always
  was).
- Boons are bought from the Shop only. No ground drops.

## Non-Goals (explicitly out of scope for this phase)

- Weapon system changes (fixed passives, ground drops, swap timing) — all
  untouched. See Phase 2.
- Potion/scroll/hotbar changes — all untouched. See Phase 3.
- Any new boon *concepts* beyond the 13 migrated ones. Balance numbers below
  are a first draft, not final.
- Rarity/tier visual system (Common/Rare/etc.) — not part of this phase.
- Stat allocation (STR/VIT/AGI/END) — untouched.

---

## Data Model

### `BoonId`

```ts
export type BoonId =
  | 'iron_warden'      // was armor set
  | 'shadow_walker'     // was armor set
  | 'blood_reaper'       // was armor set
  | 'blood_pact'
  | 'iron_skin'
  | 'glass_cannon'
  | 'berserker'
  | 'momentum'
  | 'executioner'
  | 'vampire'
  | 'overclock'
  | 'juggernaut'
  | 'last_stand';
```

### `BoonDef`

Modeled after `ConsumableDef` — each boon defines its per-level stat array
and how to apply it to `PlayerStatModifiers`/`Player`.

```ts
export interface BoonLevelEffect {
  // Free-form per-boon fields, applied by a boon-specific apply() fn.
  // e.g. iron_skin: { damageReduction: 0.12 }
  //      glass_cannon: { bonusAtk: 15, bonusMaxHp: -30 }
  [key: string]: number;
}

export interface BoonDef {
  id:             BoonId;
  name:           string;
  icon:           string;
  description:    (level: number) => string;  // dynamic desc for current level
  tradeOff?:      string;                       // static flavor text, if any
  cost:           number;                        // shop purchase cost
  effectsByLevel: BoonLevelEffect[];              // index 0 = level 1 … index 4 = level 5
  onEquip:  (player: Player, mods: PlayerStatModifiers, level: number) => void;
  onRemove: (player: Player, mods: PlayerStatModifiers, level: number) => void;
  onKill?:  (player: Player, mods: PlayerStatModifiers, level: number) => void;
  onHit?:   (player: Player, mods: PlayerStatModifiers, level: number) => void;
}
```

### `BoonSlot` / `PlayerBoons`

New class, analogous to `PlayerConsumables`, owns the 5 slots.

```ts
export interface BoonSlot {
  boonId: BoonId | null;
  level:  number;   // 1–5, independent of boonId
}

export class PlayerBoons {
  slots: [BoonSlot, BoonSlot, BoonSlot, BoonSlot, BoonSlot];

  // Gold cost to level up a given slot by one level (slot-based, not boon-based)
  getSlotUpgradeCost(slotIndex: number): number;
  upgradeSlot(slotIndex: number, gold: number): number; // returns new gold

  // Assign a boon into a slot (from Shop purchase or reordering)
  assignBoon(slotIndex: number, boonId: BoonId | null, player: Player): void;
  swapSlots(a: number, b: number, player: Player): void; // reorder, re-fires onEquip/onRemove deltas as needed

  sellBoon(slotIndex: number, gold: number, player: Player): number;

  reset(player: Player): void;
}
```

`PlayerStats.ts` drops `armorSlots`, `charms`, `maxCharms`, and the armor/
charm-specific getters (`getEquippedSetCounts`, `hasShadowWalker5pc`, etc.).
It gains a `boons: PlayerBoons` instance and reads boon-driven modifiers the
same way it currently reads `this.modifiers` from charms — boon `onEquip`
hooks write into the same `PlayerStatModifiers` struct that already exists
in `CharmRegistry.ts` (that struct itself is reused, not replaced).

### Slot Leveling Cost Curve

Reuses the shape of the existing `statCost()` tiering, scaled up since boons
matter more per-level than a single stat point:

| Slot Level → | 1→2 | 2→3 | 3→4 | 4→5 |
|---|---|---|---|---|
| Gold cost | 50 | 90 | 150 | 220 |

(Draft numbers — tune during playtesting. No floor/cap gate, per Decisions
Log.)

---

## The 13 Boons — Draft Effect Tables

All values are a first draft ported from current charm/armor-set numbers,
scaled linearly across 5 levels. **Not final balance** — meant to give the
implementation something concrete to build against; expect a tuning pass
after first playtest.

### 1. Iron Warden *(was armor set)*
Bulwark-style flat damage reduction, gains a reflect chance at max level.

| Level | Effect |
|---|---|
| 1 | +8% damage reduction |
| 2 | +12% DR |
| 3 | +16% DR |
| 4 | +20% DR |
| 5 | +25% DR, 20% chance to reflect 10 dmg on hit taken |

### 2. Shadow Walker *(was armor set)*
Mobility — dash cost + move speed, invisibility burst at max.

| Level | Effect |
|---|---|
| 1 | Dash cost −8 |
| 2 | Dash cost −12, +0.5 move speed |
| 3 | Dash cost −15, +1.0 move speed |
| 4 | Dash cost −18, +1.5 move speed |
| 5 | Dash cost −20, +2.0 move speed, dash grants 0.6s invisibility (enemies freeze, per current 5pc behavior) |

### 3. Blood Reaper *(was armor set)*
Aggressive — attack + lifesteal, shockwave at max.

| Level | Effect |
|---|---|
| 1 | +5 attack |
| 2 | +7 attack, heal 3 HP/kill |
| 3 | +9 attack, heal 5 HP/kill |
| 4 | +11 attack, heal 7 HP/kill |
| 5 | +14 attack, heal 10 HP/kill, every 5th kill triggers 120px/25dmg shockwave |

### 4. Blood Pact
Simple heal-on-kill.

| Level | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Heal/kill | 3 | 5 | 7 | 9 | 12 |

### 5. Iron Skin
Flat damage reduction.

| Level | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| DR% | 12% | 16% | 20% | 26% | 32% |

### 6. Glass Cannon
Attack up, tradeoff fixed regardless of level.

| Level | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Bonus atk | +15 | +20 | +26 | +33 | +42 |
| Tradeoff | −30 max HP (fixed at all levels) |

### 7. Berserker
Attack up, stamina regen penalty **lessens** at higher levels (per earlier
discussion — tradeoff isn't fixed here, unlike Glass Cannon/Vampire).

| Level | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Bonus atk | +8 | +11 | +14 | +18 | +23 |
| Stamina regen penalty | −30% | −29% | −28% | −27% | −25% |

### 8. Momentum
Dash cost reduction.

| Level | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Dash cost reduction | −8 | −11 | −14 | −17 | −20 |

### 9. Executioner
Heavy-kill shockwave, radius + damage scale together.

| Level | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Radius / Damage | 80px / 20 | 90px / 25 | 100px / 32 | 115px / 40 | 130px / 50 |

### 10. Vampire
Heal-on-kill, tradeoff fixed.

| Level | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Heal/kill | 5 | 7 | 9 | 12 | 16 |
| Tradeoff | −10 max HP (fixed at all levels) |

### 11. Overclock
Stamina regen multiplier.

| Level | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Regen bonus | +30% | +40% | +50% | +65% | +85% |

### 12. Juggernaut
Max HP up, speed penalty fixed.

| Level | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Bonus HP | +20 | +28 | +36 | +46 | +60 |
| Tradeoff | −0.5 move speed (fixed at all levels) |

### 13. Last Stand
Conditional attack bonus below 25% HP.

| Level | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Bonus atk (<25% HP) | +10 | +13 | +17 | +22 | +28 |

---

## Shop Changes

- Wares section shows **5 random offers per visit**, drawn from a **combined
  pool of boons + weapons** (previously boons/weapons/armor were rolled
  together as `ShopItem` — now it's just boons + weapons, armor concept
  gone entirely).
- Reroll cost **doubles each reroll** within the same shop visit (e.g. base
  20g → 40g → 80g → …), resets to base on next shop visit. Replaces the
  current flat-increment reroll curve (`REROLL_INCREMENT`).
- Buying a boon when all 5 slots are full prompts the player to choose which
  slot to replace (reuse the existing "Owned Weapon/Armor Pill" swap-warning
  pattern from `Shop.tsx` for the interaction).
- Slot leveling (gold → increase a slot's level) is a **separate Shop
  action** from buying/swapping boons — likely its own row/section in the
  boon area of the Shop, similar to how `StatRow` works today for
  STR/VIT/AGI/END.

## Inventory.tsx — Full Rewrite (same file, new content)

Hades-inspired layout, 3 columns instead of the current 4:

| Column | Content |
|---|---|
| **Left — Boons** | 5 slot cards, stacked vertically. Each shows: icon, boon name, slot level (pip/number badge), current-level description, drag handle to reorder into another slot, Sell button (50% refund, same confirm-row pattern as today). Empty slots show a placeholder with a level indicator only (no boon assigned). |
| **Middle — Attributes + Weapon** | Existing Attributes table (STR/VIT/AGI/END) unchanged. Equipped Weapon card unchanged (still sellable here in Phase 1 — Phase 2 revisits whether swap moves to Shop-only). |
| **Right — Provisions** | Unchanged from today: hotbar assignment panel + bag list for potions/scrolls. |

Removed entirely: "Nearby Drops" column, "Set Bonuses" panel (folded into
each boon's own description — no separate piece-count UI needed since every
boon is a complete effect now).

---

## File-by-File Change List

| File | Action |
|---|---|
| `src/engine/BoonRegistry.ts` | **New.** Defines `BoonDef`, `BOON_POOL` (13 boons), effect tables above. |
| `src/engine/PlayerBoons.ts` | **New.** 5-slot owner class, leveling, swap/reorder, sell. |
| `src/engine/PlayerStats.ts` | **Rewrite.** Remove `armorSlots`, `charms`, `maxCharms`, set-bonus getters. Add `boons: PlayerBoons`. Keep stat allocation, weapon equip/unequip, all getters not tied to armor/charms. |
| `src/engine/CharmRegistry.ts` | **Removed** — content migrated into `BoonRegistry.ts`. `PlayerStatModifiers`/`defaultModifiers()` may stay here or move into `BoonRegistry.ts` (implementation choice at build time). |
| `src/engine/items/ArmorRegistry.ts` | **Removed** — set-bonus logic (`computeSetBonusModifiers`, reflect/freeze/shockwave helpers) migrated into boon `onEquip`/`onHit`/`onKill` hooks in `BoonRegistry.ts`. |
| `src/engine/items/types.ts` | Remove `ArmorItem`, `ArmorSlot`, `ArmorSetId`, `ArmorStatType`, `ARMOR_SLOT_STAT`, `ARMOR_STAT_SCALE`. Add `BoonItem` (shop-offer wrapper) if needed alongside `WeaponItem`. |
| `src/engine/items/ItemPool.ts` | `getRandomShopItems` → combine boons + weapons only (drop armor generation). |
| `src/components/Shop.tsx` / `src/styles/shop.css` | Wares section reworked for combined boon+weapon offers; reroll-doubling cost; add slot-leveling UI. |
| `src/components/Inventory.tsx` / `src/styles/inventory.css` | Full rewrite per layout above. |
| `src/engine/systems/HordeSystem.ts` | Remove armor/charm drop-roll logic (`DROP_CHANCE`/`rollItemDrop` stays for weapons only, per Phase 1 keeping weapon drops as-is). |
| `src/engine/systems/BossSystem.ts` | Same — `spawnBossItemDrops` stops generating armor/charm items; boss item drops become weapon-only (or the min-drop count is revisited — flag during implementation). |
| `src/engine/ItemDrop.ts` | Unchanged structurally — now only ever carries `WeaponItem` payloads. |

## Open Items to Confirm Before/During Implementation

- Exact wording/UX for "slot full, pick one to replace" flow in Shop.
- Whether boss guaranteed-item-drop count (`MIN_ITEM_DROPS = 3`) still makes
  sense when only weapons can drop — likely needs reducing since the pool
  shrank from 3 categories to 1.
- Confirm `BoonLevelEffect` free-form key approach vs. a stricter typed
  union per boon — free-form is faster to ship, stricter is safer against
  typos. Recommend starting free-form, tightening later if it causes bugs.
