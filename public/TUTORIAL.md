# Infinity Dungeon — How to Play

## The Run

You descend an infinite dungeon, floor by floor. Each floor has **4 rooms**:

| Room | Type | Description |
|------|------|-------------|
| 1 | Horde | Kill enemies to open the gate |
| 2 | Horde | Harder wave, more enemy types |
| 3 | Elite | No Grunts — only dangerous enemies |
| 4 | Boss | One powerful boss guards the descent |

After clearing the boss, visit **The Merchant** (shop NPC) or collect **item drops**, then press **F** at the gate to descend to the next floor.

---

## Movement

| Key | Action |
|-----|--------|
| `W A S D` | Move |
| `C` | Dash (costs stamina) |

Dashing grants **invincibility frames** — use it to dodge through attacks.

---

## Combat

### Light Attack — `J`
- **Tap**: Quick strike, low stamina cost
- **Hold then release**: **Charged light** — 2.5× damage, wider arc, costs 1.5× stamina

### Heavy Attack — `K`
- **Tap**: Slow powerful strike, halts movement, high cooldown
- **Hold then release**: **Charged heavy** — 2× damage, larger area, costs 1.5× stamina

### Block & Parry — `L`
- **Tap**: **Parry** — opens a brief window. Parrying an attack stuns the enemy and opens a vulnerability window for bonus damage.
- **Hold**: **Block** — absorbs the hit, drains stamina each block. Breaks if stamina runs out.

> **Tip:** Parrying is high-risk high-reward. A successful parry stuns enemies and makes the boss stagger, taking 1.5× damage from your next hit.

---

## Stamina

Stamina is your combat resource. It regenerates automatically.

- **Dash** costs 30 stamina (reduced by some items)
- **Light attack** costs ~8–12 stamina
- **Heavy attack** costs 32–42 stamina
- **Blocking** drains stamina continuously; each blocked hit costs extra

Running out of stamina prevents dashing and heavy attacks — manage it carefully.

---

## Consumables — Potions & Scrolls

Press `1`, `2`, `3`, or `4` to use items assigned to your hotbar.

Open **Inventory** (`I`, hold) → drag items from the **Provisions** bag onto the **Hotbar** slots.

Each hotbar slot has its own cooldown:

| Slot | Cooldown |
|------|----------|
| 1 | 3 seconds |
| 2 | 4.5 seconds |
| 3 | 6 seconds |
| 4 | 7 seconds |

### Potions

| Potion | Effect |
|--------|--------|
| 🧪 Health Potion | Instantly restores HP. Re-use extends duration. |
| 🔥 Wrath Potion | Bonus attack damage + speed for a duration. |
| 🛡️ Iron Potion | Reduces all incoming damage for a duration. |
| 👻 Phantom Potion | Turns you invisible — enemies lose aggro. |

### Scrolls

| Scroll | Effect |
|--------|--------|
| 📜 Fireball | Fires a fireball that explodes on impact, dealing AoE damage. |
| ❄️ Frost | Cone blast that freezes enemies in front of you. |
| ⚡ Lightning | Bolt that chains between nearby enemies. |
| 💨 Blink | Teleports you forward in your facing direction. |
| 🔮 Ward | Absorbs a set number of incoming hits for a duration. |
| 🌀 Void | Pulls nearby enemies toward a point ahead of you. |

> **Tip:** Upgrade consumables at The Merchant shop to increase their power significantly.

---

## The Shop — The Merchant

Talk to the Merchant NPC by pressing `F` when nearby.

| Section | What it does |
|---------|-------------|
| **Attributes** | Spend gold to level up STR, VIT, AGI, END |
| **Wares** | Buy weapons, armor pieces, and charms. Reroll for new options. |
| **Healing Arts** | Restore HP for gold. Costs scale with floor. |
| **Equipped Gear** | View and sell your current weapon, armor, and charms. |
| **Provisions** | Buy potions/scrolls and **upgrade them** (up to Level 5). |

### Attributes

| Stat | Bonus per level |
|------|----------------|
| ⚔️ STR | +3 attack damage |
| ❤️ VIT | +10 max HP |
| 💨 AGI | +0.3 move speed |
| ⚡ END | +5 max stamina |

---

## Weapons

Three weapon types, each with different attack shapes:

| Weapon | Light Hitbox | Heavy Hitbox | Passive |
|--------|-------------|-------------|---------|
| ⚔️ Sword | Forward arc | Wide 180° arc | **Riposte** — parrying opens a 3× damage window |
| 🪓 Axe | Circle (close) | Large circle | **Rend** — marks enemies; next hit deals +8 bonus damage |
| 🔱 Spear | Forward rectangle | Long rectangle | **Momentum** — dashing then attacking deals 2× damage |

Each weapon item also comes with a **Charm passive** built in.

---

## Armor Sets

Armor drops from enemies and bosses. Each piece has a stat and belongs to a set.

| Slot | Stat |
|------|------|
| Helmet | Max HP |
| Armor | Damage Reduction |
| Leggings | Move Speed |
| Gloves | Attack Damage |
| Boots | Move Speed |

### Set Bonuses

Equipping multiple pieces of the same set unlocks bonuses:

**🛡 Iron Warden**
- 2 pieces: +15 Max HP
- 4 pieces: +20% Damage Reduction
- 5 pieces: On hit — 30% chance to reflect 10 damage

**🥷 Shadow Walker**
- 2 pieces: Dash costs -10 stamina
- 4 pieces: +1.5 Move Speed
- 5 pieces: Dash grants 1s invisibility; enemies freeze

**🩸 Blood Reaper**
- 2 pieces: +8 Attack Damage
- 4 pieces: Kills heal 8 HP
- 5 pieces: Every 5th kill triggers a 120px shockwave

---

## Enemies

| Enemy | Behaviour |
|-------|-----------|
| 🟣 Grunt | Charges and melees. Floor 3+ can dash-lunge. |
| 🟡 Shooter | Maintains distance, fires ranged projectiles. Floor 2+ fires 3-shot spread. |
| 🔷 Tank | Heavily shielded from the front. Heavy attacks pierce shield better. |
| 🔵 Dasher | Fast dash attacker. Floor 3+ dashes twice. |
| 🟠 Bomber | Chases, then arms and explodes. Kill it before the fuse runs out! |

### Enemy Variants

Elite enemies can roll special modifiers:

| Variant | Effect |
|---------|--------|
| 🔴 Tough | +40% HP |
| ⚡ Swift | +30% speed |
| 🔥 Berserker | +25% damage |
| 🛡 Armored | 30% damage reduction |
| 💥 Volatile | Explodes on death |
| 💚 Regenerating | Slowly regenerates HP |

---

## Bosses

| Boss | Floor | Behaviour |
|------|-------|-----------|
| BRUTE | 1 | Charges, slams, and shoots spread projectiles. Enrages at 60% HP. |
| PHANTOM | 2 | Teleports around the arena, fires bullet rings and aimed volleys. Intangible while blinking. |
| COLOSSUS | 3 | Armored until 60% HP. Stomps with chained AoE attacks. |
| MAGE | 4+ | Blinks, fires homing projectiles, and summons illusion clones. |
| SHADE | 4+ | Extreme speed, dash attacks, and lunge combos. |

> **Tip:** All bosses **enrage at 60% HP** — they become faster and deal more damage. Parrying the boss staggers it briefly, making it take 1.5× damage.

---

## Kill Threshold & Farming

Each room has a **kill threshold**. Once met, the gate opens.

After the threshold, **tank batches** spawn in waves of 5. Each batch is stronger than the last (up to 10 batches). The gold multiplier for kills beyond the threshold decreases over time — so push forward rather than farming indefinitely.

---

## Inventory — `I` (hold)

The inventory lets you manage gear without visiting the shop:

- **Nearby Drops** — equip items dropped by enemies on the ground
- **Attributes** — view your current stat levels and totals
- **Set Bonuses** — track your armor set progress
- **Weapon & Armor** — inspect and sell equipped gear
- **Charms** — view and sell charms
- **Hotbar** — drag consumables from your bag onto quickslot slots
- **Provisions** — see everything in your bag

---

## Tips for Survival

1. **Keep moving.** Standing still will get you killed by ranged enemies and bombers.
2. **Dash through attacks.** Invincibility frames during dash let you pass through enemy strikes safely.
3. **Parry for big damage.** A parried boss staggers — follow up immediately with a charged heavy for massive burst.
4. **Upgrade consumables.** A Level 5 Health Potion heals 130 HP vs 40 at Level 1. Upgrade early.
5. **Don't ignore armor.** Set bonuses are extremely powerful — try to complete at least a 2-piece early.
6. **Bombers are dangerous.** When you see the fuse ring appear, kill the Bomber immediately or dash away.
7. **Ward Scroll is a safety net.** Assign it to a slot before boss fights as emergency damage absorption.
8. **Iron Potion stacks.** Pair it with armor damage reduction and the Iron Warden set for near-immunity.