# Infinity Dungeon — Progression Overhaul Roadmap

## Vision

Move the game's progression away from discrete gear (armor sets, ground-dropped
items) toward a Hades/Vampire-Survivors-style **boon** system: a small set of
build-defining passive powers chosen and leveled through the Shop, paired with
a weapon system that stays build-relevant across a run. This roadmap is split
into independent, shippable phases so each can be designed, implemented, and
playtested without the others being finished first.

This file is the map. Each phase has its own detailed spec in
`docs/phase-N-*.md` — implementation should reference those, not re-derive
decisions from chat history.

---

## Phases

| # | Name | Goal | Status | Primary files touched |
|---|------|------|--------|------------------------|
| 1 | [Boons](./phase-1-boons.md) | Replace armor sets + charms with a unified, levelable boon system (5 slots, slot-based leveling) | **Planned** — spec complete, not implemented | `BoonRegistry.ts` (new), `PlayerBoons.ts` (new), `PlayerStats.ts`, `Shop.tsx`, `Inventory.tsx`, `ItemPool.ts`, `items/types.ts`, `HordeSystem.ts`, `BossSystem.ts` |
| 2 | [Weapon Shop-Lock](./phase-2-weapon-lock.md) | Restrict weapon swapping to Shop-only, post-room-clear (Hades-style) | Stub — goals only | `Shop.tsx`, `Inventory.tsx`, `HordeSystem.ts`, `ItemDrop.ts` |
| 3 | [Skills on Weapons](./phase-3-skills.md) | Turn potions/scrolls into weapon-bound active skills; hotbar becomes the boon display | Stub — goals + open questions only | `PlayerConsumables.ts`, `ConsumableRegistry.ts`, `ConsumableSystem.ts`, `WeaponRegistry.ts`, `HUD.tsx` |

Phases are designed to be implemented **in order** — Phase 2 assumes Phase 1's
boon system exists, Phase 3 assumes Phase 2's weapon-lock exists. Do not start
implementing a phase whose spec still has open questions.

---

## Cross-Phase Invariants

These must hold true after every phase, no exceptions without an explicit
re-discussion:

- **Gold is the only currency.** No new currencies introduced.
- **5 boon slots**, always. Slot count does not change across phases.
- **Boon leveling is per-slot, not per-boon.** A slot's level persists when
  a different boon is swapped into it.
- **No ground-dropped boons.** Boons are Shop-only from Phase 1 onward.
- **Consumable/potion ground drops** (`ConsumableDrop`) stay untouched until
  Phase 3 explicitly changes them.
- **Gold drops** (`GoldDrop`, `GoldSystem`) are never touched by any phase.
- **Stat allocation** (STR/VIT/AGI/END via `PlayerStats` + Shop) is untouched
  by all three phases unless a future phase explicitly says otherwise.
- Every rewritten file still follows house rules: TypeScript only,
  `[🧱 BLOCK: Name]` section comments, BEM CSS class names, CSS in
  `src/styles/<name>.css`.

---

## Decisions Log

Chronological record of settled design calls. Treat these as locked —
re-open only via explicit discussion, not assumption.

- **5 boon slots**, one boon per slot, buying a new boon when slots are full
  replaces an existing one (player choice of which).
- **Slot-based leveling**: leveling up a *slot* (not a boon) increases the
  potency of whatever boon currently occupies it. Boons can be freely
  reordered/swapped between slots (drag-and-drop in Inventory) with no cost.
- **Slot leveling is gold-gated, no floor/cap gate** — a slot can be leveled
  to 5 any time the player has enough gold, regardless of floor.
- **Slot level gold cost** uses the same escalating-tier curve style as
  existing stat costs (see Phase 1 spec for exact numbers).
- **13 total boons at launch**: the 3 former armor sets (Iron Warden, Shadow
  Walker, Blood Reaper) converted to boons, plus all 10 former charms
  converted to boons. No new boon concepts added in Phase 1.
- **Boon effect scaling is simple**: stats scale by level (1–5), no
  rarity/tier system layered on top for now.
- **Shop offers**: 5 random offers per visit, **combined pool of boons +
  weapons** (no more separate "wares" vs "weapon" distinction in the roll).
- **Reroll cost doubles** on each reroll within a shop visit (resets next
  visit).
- **Boons and weapons are both sellable** from Inventory, same 50%-refund
  pattern as today.
- **Weapons keep their current fixed-passive design** in Phase 1 — no
  changes to `WeaponRegistry.ts`/`WeaponPassiveRegistry.ts` yet. Ground
  weapon drops (`ItemDrop`) also stay as-is in Phase 1; Phase 2 revisits
  whether weapons should also become Shop-only.
- **Inventory.tsx is fully rewritten in place** (same filename, no new
  component files). Layout inspired by Hades: boons displayed prominently
  on the left side of the panel.
- **HUD hotbar (bottom strip)** becomes a **read-only boon display** (5 icons
  + slot level) once Phase 3 lands — potions/scrolls move off the hotbar
  entirely and become weapon-bound skills. This is a Phase 3 change; Phase 1
  and 2 leave the hotbar exactly as it is today (potions/scrolls still
  bag-and-hotbar based).
- **Weapon skills (Phase 3)**: potions and scrolls become skills attached to
  weapons rather than bag items. Exact activation input, fixed-vs-choosable
  skill assignment, cooldown-vs-charge economy, and Health Potion's fate are
  all still open — see `phase-3-skills.md`.
