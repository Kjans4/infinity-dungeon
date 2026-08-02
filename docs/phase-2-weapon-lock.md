# Phase 2 — Weapon Shop-Lock

Status: **Planned** (spec complete, not implemented). Depends on Phase 1
(boons) being implemented first — confirmed done. See `ROADMAP.md` /
`rework-plan.md` for where this fits among the other phases.

## Goal

Two changes, bundled together because the second makes the first coherent:

1. **All weapon acquisition moves to the Shop.** No ground drops of any
   kind — not from horde enemies, not from elite enemies, not from bosses.
   The economy itself (`PlayerStats.equipWeapon()` / `unequipWeapon()`,
   full-price buy, 50%-refund sell) is **unchanged** from today — Phase 2
   only removes the alternate ground-pickup acquisition path, it does not
   change the pricing model. This is "Option B" in the Decisions Log below.
2. **The player picks a starting weapon before Room 1.** A one-time,
   three-choice picker modal appears immediately after clicking RAID (or
   Raid Again on retry) — the run does not begin until a weapon is chosen.
   No more starting the run bare-fisted.

## Why bundle these

Phase 1 already made boons Shop/Chest-only. Once weapons also go
Shop-only, `ItemDrop` (the ground-pickup entity) has **no payload left to
carry** — it was already narrowed to weapon-only in Phase 1 specifically
because boons stopped dropping. Phase 2 finishes that trajectory: the
entire ground-loot subsystem is now dead weight and gets deleted rather
than kept around unused.

## Non-Goals (explicitly out of scope for this phase)

- Boon system changes — Phase 1 is done and untouched here.
- Weapon *balance* changes (damage, stamina cost, passives) — out of scope.
- Multiple owned weapons / free swapping between owned weapons (that would
  be "Option A" — explicitly rejected; see Decisions Log).
- Consumable/potion/scroll changes — Phase 3 territory, untouched.
- Any change to how boons are acquired (Shop combined pool, Boss Chest) —
  Phase 1 behavior carries forward unchanged.

---

## Decisions Log

- **Option B, not Option A.** Weapons are NOT a permanent unlockable
  roster (that was "Option A" — Hades Aspect-style, own many, swap freely).
  The player owns exactly one weapon at a time, exactly as today. Phase 2
  only relocates *where* the buy/sell transaction can happen — it does not
  change the transaction itself.
- **No ground drops, period.** Not reduced, not floor-gated — zero. This
  applies to horde enemies, elite enemies, and bosses alike.
- **Starting weapon is chosen, not bare fists.** A 3-choice picker modal
  blocks the start of Room 1 until resolved. No skip/cancel option — a
  choice is mandatory, mirroring the Boss Chest boon picker's forced-choice
  pattern from Phase 1.
- **Picker triggers on every full run reset** — both `handleStart` (Menu →
  RAID) and `handleRaidAgain` (Game Over → Raid Again). It does NOT trigger
  on "next floor" or any other transition — only a fresh run.
- **Picker offers are fully random**, drawn the same way the Shop already
  rolls weapon offers (`getRandomWeaponItems`, no exclusions needed since
  the player owns nothing yet). No reroll option on this picker.
- **Shop remains the combined boon+weapon pool**, 5 offers, exactly as
  Phase 1 built it. Phase 2 does not add a weapon-only guarantee or change
  the offer count — the existing pool already includes weapons.
- **Inventory's weapon card becomes read-only.** No Sell button, no swap
  interaction — informational display only (icon, name, weapon type,
  passive), matching how Pause/Victory/GameOver overlays already present
  it. All weapon economy interactions (buy, sell) live in the Shop only.

---

## Data Model Changes

Good news: because Option B keeps the existing weapon economy verbatim,
this phase is almost entirely **subtractive**. The only new code is the
picker modal and its trigger wiring.

### Removed entirely

- `src/engine/ItemDrop.ts` — deleted. No payload left to carry.
- `GameState.itemDrops: ItemDrop[]` — removed.
- `GameState.pendingLoot: ShopItem[]` and `PENDING_LOOT_CAP` — removed.
  These existed solely to dedupe in-flight ground-drop rolls against
  already-equipped/pending items; with no ground drops, there's nothing
  left to dedupe.
- `getRandomWeaponDrop()` in `items/ItemPool.ts` — removed (was the
  ground-drop roll helper introduced in Phase 1; never used past that).
- All horde/boss drop-roll logic: `DROP_CHANCE`, `rollItemDrop()`,
  `spawnBossWeaponDrops()`, `MIN_WEAPON_DROPS`, `FLOOR_BONUS_FLOOR`,
  `BONUS_DROP_CHANCE`, `BOSS_DROP_SPREAD` — all removed from
  `HordeSystem.ts` / `BossSystem.ts`.
- The Phase-1-only "Nearby Weapon" UI bolted onto `Shop.tsx` and
  `Inventory.tsx` (the `nearbyWeaponDrop` prop, `nearbyDrops` prop,
  `.shop-nearby-weapon` / `.inv-nearby-weapon` blocks) — removed along
  with `handleEquipDrop` in `GameCanvas.tsx`.

### Added

**`WeaponPicker.tsx`** (new component, mirrors `BoonPicker.tsx`'s shape):

```ts
interface WeaponPickerProps {
  choices:     WeaponItem[];   // 3 random weapons, free grant
  playerStats: PlayerStats;
  player:      Player;
  onResolved:  () => void;     // called once a weapon has been claimed
}
```

No slot-replacement step is needed here (unlike `BoonPicker`) since there
is only ever one weapon slot — picking a choice just calls
`playerStats.claimWeapon(item, player)` (already exists, free grant, used
today for ground-drop equip — now repurposed for this) and resolves
immediately.

**`GameCanvas.tsx` trigger flow** — both `handleStart` and
`handleRaidAgain` change shape: instead of immediately calling
`hordeRef.current.setup(...)` and announcing "PREPARE!", they now:

1. Reset run state as before (`stateRef.current!.reset()`, etc.)
2. Roll 3 weapon choices (`getRandomWeaponItems([], 3)`)
3. Set `showWeaponPicker = true` and stash the deferred setup+announce
   logic in a ref (same `pendingContinueRef` pattern already used for
   floor transitions)
4. `WeaponPicker.onResolved` fires the deferred setup, hides the picker,
   and the run begins armed

`showWeaponPicker` joins `uiActiveRef` and the game-loop early-return
condition alongside `showBoonPicker`, `showShop`, etc.

### Unchanged

- `PlayerStats.equipWeapon()`, `unequipWeapon()`, `claimWeapon()` — used
  as-is. No signature or behavior changes.
- `WeaponItemRegistry.ts` and `getRandomWeaponItems()` — already exist and
  already do exactly what the picker needs (`getRandomWeaponItems([], 3)`).
- `Shop.tsx`'s weapon-offer path (`ShopItemCard`, `EquippedWeaponPill`,
  buy/sell handlers) — untouched.
- Everything Phase 1 built for boons (Boon Slots, Boss Chest, Boon
  Picker) — completely unaffected by this phase.

---

## File-by-File Change List

| File | Action |
|---|---|
| `src/engine/ItemDrop.ts` | **Delete.** |
| `src/engine/items/ItemPool.ts` | Remove `getRandomWeaponDrop()`. `getRandomShopItems()`, `getRandomChestBoons()`, consumable helpers untouched. |
| `src/engine/GameState.ts` | Remove `itemDrops`, `pendingLoot`, `PENDING_LOOT_CAP`. `bossChest`/`pendingBoonChoices` (Phase 1) untouched. |
| `src/engine/systems/HordeSystem.ts` | Remove `DROP_CHANCE`, `rollItemDrop()`, `ItemDrop` import, `state.itemDrops` push/tick, `ELITE_DROP_MULT`. |
| `src/engine/systems/BossSystem.ts` | Remove `spawnBossWeaponDrops()` and its constants, `ItemDrop` import, `state.itemDrops` tick in `tickDoorAndShop()`/`draw()`. |
| `src/components/WeaponPicker.tsx` | **New.** 3-choice run-start weapon picker, no reroll, no cancel. |
| `src/styles/weapon-picker.css` | **New.** Visually consistent with `boon-picker.css`. |
| `src/components/GameCanvas.tsx` | `handleStart`/`handleRaidAgain` defer setup behind the picker; add `showWeaponPicker` state + `uiActiveRef` flag; remove `handleEquipDrop`, `nearbyDrops`, `ItemDrop` import. |
| `src/components/Shop.tsx` | Remove `nearbyWeaponDrop` prop and its render block. Everything else untouched. |
| `src/styles/shop.css` | Remove `.shop-nearby-weapon*` rules. |
| `src/components/Inventory.tsx` | `WeaponSlotCard` becomes read-only (no Sell button, no `nearbyDrop`/`onEquipDrop` props). Remove `nearbyDrops` prop from `InventoryProps`. |
| `src/styles/inventory.css` | Remove `.inv-nearby-weapon*` rules. |

No changes needed to: `PlayerStats.ts`, `WeaponRegistry.ts`,
`WeaponItemRegistry.ts`, `WeaponPassiveRegistry.ts`, `BoonRegistry.ts`,
`PlayerBoons.ts`, `BossChest.ts`, `BoonPicker.tsx`, the three status
overlays (Pause/Victory/GameOver already display weapon read-only).

---

## Open Items to Confirm Before Implementation

- **Picker visual style** — reuse `BoonPicker`'s exact card layout (icon,
  name, description, tradeoff, single "Choose" button, no back-step since
  there's no slot-replace case) with weapon-appropriate copy, or should it
  look different enough to signal "this is the run-start ritual" vs. "this
  is a chest reward"? Default assumption: same visual language as
  `BoonPicker`/`boon-picker.css` for consistency, just swap weapon data in.
- **Passive preview on the picker** — Shop's `ShopItemCard` shows the
  weapon's passive name+description inline. Should `WeaponPicker` do the
  same (helps an informed pick) or keep it minimal (name + weapon type
  only, discover the passive in play)? Default assumption: show it, same
  as Shop, since this is the player's only chance to compare before
  committing for the whole run.
- **What happens on Escape while the picker is open?** Boon Chest picker
  in Phase 1 blocks Escape entirely (`if (uiActiveRef.current.boonPicker)
  return;`). Recommend the same here — Escape does nothing until a weapon
  is chosen, since skipping isn't allowed anyway.
