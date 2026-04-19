# Infinity Dungeon

A fast-paced top-down arena rogue-like built with **Next.js**, **TypeScript**, and **HTML5 Canvas**. Fight through horde rooms, survive elite and boss encounters, collect gold, and build your character with stat upgrades, weapons, and charms — then descend deeper, harder, forever.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Install & Run

```bash
# Clone the repo
git clone https://github.com/your-username/infinity-dungeon.git
cd infinity-dungeon

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## How to Play

**Goal:** Clear each room by killing enough enemies, survive the elite room, defeat the floor boss, and push as deep as you can. The dungeon is infinite — floors never end.

### Controls

| Key | Action |
|-----|--------|
| `W A S D` | Move |
| `J` (tap) | Light Attack |
| `J` (hold 400ms) | Charged Light Attack — 2.5× damage, 1.6× range |
| `K` (tap) | Heavy Attack — high damage, halts movement |
| `K` (hold 600ms) | Charged Heavy Attack — 2.0× damage, 1.5× range |
| `L` (tap < 220ms) | Parry — active window 500ms, stuns enemies / staggers bosses |
| `L` (hold) | Block — absorbs hits at stamina cost, drains continuously |
| `C` | Dash — 30 stamina, grants i-frames for 180ms |
| `F` | Interact — enter door / talk to Shop NPC |
| `I` (hold 500ms) | Open Inventory — pause + inspect/sell gear |
| `ESC` | Pause / Resume |
| `F1` | Dev Tools Panel (development only) |

### The Floor Loop

Each floor consists of three rooms:

```
Room 1 (Horde) → Room 2 (Horde + Shooters + Tanks) → Room 3 (Elite) → Boss → Floor Clear
```

- **Room 1 & 2** — kill the required number of enemies to open the green gate. A Shop NPC also appears once the gate opens.
- **Room 3 (Elite)** — no Grunts, only Shooters and Tanks. Higher kill threshold (+50%), higher item drop rates.
- **Boss Room** — each floor has a locked boss for floors 1–3, then random weighted selection from floor 4+.
- Defeating the boss triggers a **floor transition** and starts the next floor, harder.

### Kill Thresholds

The threshold to open the gate scales with floor and room type:

| Floor | Horde Threshold | Elite Threshold |
|-------|----------------|-----------------|
| 1 | 20 kills | 30 kills |
| 2 | 25 kills | 38 kills |
| 3 | 30 kills | 45 kills |
| N | 20 + (N−1)×5 | above × 1.5 |

Once the threshold is met the gate opens — you can leave immediately or **stay and farm**. Extra kills beyond the threshold give diminishing gold returns (−20% per 10 bonus kills, floored at 20%). Enemies keep spawning every 3 seconds while farming.

### HP & Survival

- HP **does not restore** between rooms or floors — damage carries over for the entire run.
- The only way to heal is at the **Shop NPC**, which appears after the kill threshold in Rooms 1 and 2. Healing costs scale with floor.
- You can also talk to the Shop NPC before entering the boss room (it appears next to the gate in Room 2).

| Tier | HP Restored | Floor 1 Cost | Floor 2 Cost | Floor N Cost |
|------|-------------|-------------|-------------|--------------|
| Tincture 🩹 | +25 HP | 40g | 80g | 40 × N |
| Draught 💊 | +50 HP | 75g | 150g | 75 × N |
| Elixir ❤️ | Full HP | 120g | 240g | 120 × N |

### Combat System

#### Charge Attacks
Hold `J` or `K` past the charge threshold to release an amplified attack. Charged light attacks slow your movement while charging. Releasing early fires a normal tap attack instead.

| Attack Type | Damage Mult | Range Mult | Stamina |
|-------------|------------|-----------|---------|
| Tap Light | 1× | 1× | normal |
| Charged Light | 2.5× | 1.6× | 1.5× cost |
| Tap Heavy | 1× | 1× | normal |
| Charged Heavy | 2.0× | 1.5× | 1.5× cost |

#### Parry & Block
- **Parry** (tap `L`): opens a 500ms active window. Any melee hit or projectile that lands during this window is deflected — stuns horde enemies for 1200ms and staggers bosses for 600ms. Stunned enemies take 50% bonus damage. After a parry, some weapon passives activate special effects (e.g. Riposte).
- **Block** (hold `L`): absorbs incoming hits entirely. Costs 20 stamina to enter, drains ~18 stamina/second while held, and 12 stamina per hit absorbed. Block shatters if stamina reaches 0. Does not work against slam AoEs.
- Both actions reduce movement speed to 30% while active.

#### Parry Timing
The parry window can also be triggered during an enemy's **windup animation** — you don't have to wait for the strike to land. If an enemy is winding up within 80px of you and you tap `L`, the parry fires immediately.

### Combat Tips

| Visual | Enemy | Meaning |
|--------|-------|---------|
| Orange expanding ring | Grunt | Melee windup — dash or parry |
| Purple dash ring + trail | Grunt (F3+) | Dash-lunge incoming — sidestep |
| Yellow expanding ring | Shooter | Ranged windup — move sideways |
| `×3` badge above Shooter | Shooter (F2+) | 3-way spread shot incoming |
| Slate shield arc | Tank | Front hits reduced 70% — hit from behind |
| No windup ring | Tank (F4+) | Instant strike — never stand still next to one |
| Yellow pulse ring | Boss (Brute) | Charge incoming — get out of the path |
| Red expanding ring | Boss (Brute/Colossus) | Slam AoE — run outside the circle |
| Cyan dashed ring | Boss | Intangible during blink (Phantom/Mage) — attacks pass through |
| ⚡ ENRAGED label | Any Boss | Below 50% HP — faster, harder attacks |

---

## Enemies

### Horde Enemies

| Enemy | Color | Behavior | Floor Unlocks |
|-------|-------|----------|---------------|
| **Grunt** | Purple | Chases and melees with a visible windup. Floor 3+: dashes to close distance before striking | Floor 1 |
| **Shooter** | Amber | Maintains preferred distance, fires aimed projectiles. Floor 2+: 3-way spread. Floor 4+: faster fire rate | Floor 1 |
| **Tank** | Slate/Red | Slow, massive HP, shield arc blocks 70% front damage (heavy pierces 35% more). Below 50% HP shield breaks. Floor 4+: no windup — instant strike. Knockback on hit | Floor 1 |

**Room Composition:**
- Room 1: mostly Grunts + ~15% Tanks
- Room 2: Grunts + ~35% Shooters + ~15% Tanks
- Room 3 (Elite): Shooters and Tanks only (~55% / ~45%)

**Gold Drops:**

| Enemy | Gold Range |
|-------|-----------|
| Grunt | 5–10g |
| Shooter | 8–15g |
| Tank | 15–25g |
| Boss | 80–120g |

### Bosses

Floors 1–3 are locked to a specific boss. Floor 4+ selects randomly with weighting.

| Boss | Floor | Base HP | Key Mechanic |
|------|-------|---------|--------------|
| **Brute** 🔴 | 1 (+ F4+) | 300 | Charge, slam AoE. F2+: spread shot. F3+: double slam. Enrages at 50% — faster charge speed |
| **Phantom** 🟣 | 2 (+ F4+) | 220 | Teleports before every attack, intangible during blink. Ring burst + aimed volley. F2+: 3-way spread. Enrages at 50% — more projectiles, faster blink cycle |
| **Colossus** ⬜ | 3 (+ F4+) | 500 | Armored above 50% HP (65% damage reduction, heavy pierces more). Stomp AoE. Enrages at 50% armor breaks — adds stomp chain + quake projectiles |
| **Mage** 🩵 | F4+ (rare) | 180 | Never makes contact. Teleports, spawns illusory fakes that also shoot. Homing bolt + fast burst. Kill fakes by attacking them |
| **Shade** ⬛ | F4+ (rare) | 180 | Tiny, extremely fast. Dash-lunge melee only, then immediately evades. Afterimage trail when enraged |

All bosses enrage at 50% HP — attack frequency increases and new patterns unlock. Parrying a boss contact hit staggers it for 600ms and increases damage taken by 50% during the window.

---

## Items & Build System

### Stat Allocation

Spend gold at the Shop to level stats. The cap per stat scales with floor.

| Stat | Effect per Level | Cost (L1–2) | Cost (L3–5) | Cost (L6+) |
|------|-----------------|-------------|-------------|------------|
| STR ⚔️ | +3 attack damage | 30g | 60g | 100g |
| VIT ❤️ | +10 max HP | 30g | 60g | 100g |
| AGI 💨 | +0.3 move speed | 30g | 60g | 100g |
| END ⚡ | +5 max stamina | 30g | 60g | 100g |

Stat cap = `min(10, floor × 3)` — you can't over-invest early.

### Weapons

Three weapon types with different hitbox shapes. Each named weapon also carries a baked-in passive effect from the charm pool.

| Type | Light Dmg | Light Shape | Heavy Dmg | Heavy Shape | Heavy Stamina |
|------|-----------|------------|-----------|------------|---------------|
| Fists (default) | 6 | Circle r15 | 15 | Circle r25 | 38 |
| Sword 🗡️ | 12 | Arc 55px / 90° | 28 | Arc 65px / 180° | 35 |
| Axe 🪓 | 15 | Circle r40 | 40 | Circle r70 | 42 |
| Spear 🔱 | 10 | Rect 120×20 | 35 | Rect 200×20 | 32 |

**Named Weapons (shop pool of 10):**

| Weapon | Type | Passive | Trade-off | Cost |
|--------|------|---------|-----------|------|
| Bloodfang Sword | Sword | Kills heal 3 HP | — | 80g |
| Ironclad Sword | Sword | −15% damage taken | — | 100g |
| Berserker Blade | Sword | +10 attack damage | Stamina regen −30% | 80g |
| Overclock Sword | Sword | Stamina regen +50% | — | 80g |
| Titan's Axe | Axe | +30 max HP | Move speed −0.5 | 100g |
| Reaper's Axe | Axe | +20 attack damage | −30 max HP | 60g |
| Vampire Axe | Axe | Kills heal 5 HP | −10 max HP | 90g |
| Swift Spear | Spear | Dash costs 20 stamina | — | 70g |
| Thunder Spear | Spear | Heavy kills release shockwave | — | 120g |
| Last Rite Spear | Spear | +15 dmg below 25% HP | — | 110g |

Weapons can be sold from the Shop or Inventory for 50% of their purchase price.

### Weapon Passives (built into weapon types)

Each weapon type has an intrinsic passive tied to its attack patterns:

| Weapon Type | Passive Name | Effect |
|-------------|-------------|--------|
| Sword | **Riposte** | Parrying opens a 2s window — next attack deals 3× damage |
| Axe | **Rend** | Each hit marks the enemy; their next hit taken deals +8 bonus damage |
| Spear | **Momentum** | Attacking within 200ms after a dash deals 2× damage |

### Charms

Up to 5 charm slots. Charms stack with each other and with weapon passives. Can be sold for 50% refund.

| Charm | Effect | Trade-off | Cost |
|-------|--------|-----------|------|
| 🩸 Blood Pact | Kills heal 3 HP | — | 80g |
| 🛡️ Iron Skin | −15% damage taken | — | 100g |
| 💥 Glass Cannon | +20 attack damage | −30 max HP | 60g |
| ⚔️ Berserker | +10 attack damage | Stamina regen −30% | 80g |
| 💨 Momentum | Dash costs 20 stamina | — | 70g |
| 🪓 Executioner | Heavy kills release shockwave (25 dmg, 100px radius) | — | 120g |
| 🧛 Vampire | Kills heal 5 HP | −10 max HP | 90g |
| ⚡ Overclock | Stamina regen +50% | — | 80g |
| 🪨 Juggernaut | +30 max HP | Move speed −0.5 | 100g |
| 🔥 Last Stand | +15 attack damage below 25% HP | — | 110g |

### Shop Rerolls

The three item slots can be rerolled within a single visit. Cost escalates each time and resets on your next shop visit:

`20g → 40g → 60g → 80g → 100g (cap)`

### Item Drops

Enemies and bosses have a chance to drop items as floor loot — picked up by walking over them. Up to 3 pending drops can be held and claimed for **free** at any Shop NPC. Drop rates:

| Enemy | Base Drop Chance | Elite Room Multiplier |
|-------|-----------------|----------------------|
| Grunt | 3% | 1.5× |
| Shooter | 6% | 1.5× |
| Tank | 12% | 1.5× |
| Boss | Guaranteed 1 drop | — |

---

## Floor Scaling

| Stat | Formula |
|------|---------|
| Enemy HP | Base × floor (doubles each floor) |
| Enemy Speed | Base × (1 + (floor−1) × 0.25) |
| Boss HP | Base × (1 + (floor−1) × 0.50) |
| Kill Threshold | 20 + (floor−1) × 5 |
| Healing Cost | Base × floor |

---

## Run Persistence

Run history is saved to `localStorage` automatically on death and on quit-to-menu. The **Main Menu** displays your personal best run (floor, kills, time, gold) and up to 5 recent runs. Best run is determined by floor reached, with kills as a tiebreak.

---

## Tech Stack

- **Next.js (App Router)**
- **TypeScript**
- **HTML5 Canvas API** — all game rendering
- **Tailwind CSS** — UI overlays only
- **localStorage** — run history persistence

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── GameCanvas.tsx          # Main game shell, input, dev panel
│   ├── HUD.tsx                 # Scroll-banner HUD: HP, stamina, kills, gold, floor
│   ├── Menu.tsx                # Main menu (two-panel, sigil, best run display)
│   ├── Shop.tsx                # Shop: stats, weapons, charms, healing, loot claims
│   ├── Minimap.tsx             # Top-right canvas minimap with legend
│   ├── Inventory.tsx           # Inventory overlay (hold I): sell gear mid-run
│   └── overlays/
│       ├── GameOverOverlay.tsx
│       ├── VictoryOverlay.tsx  # Floor clear screen
│       ├── PauseOverlay.tsx    # Pause with full stat sheet + controls reference
│       ├── WaveClearAnnouncement.tsx
│       └── FloorTransition.tsx # Full-screen "FLOOR X" fade between floors
├── engine/
│   ├── enemy/
│   │   ├── BaseEnemy.ts        # HP, hit flash, stun timer, draw helpers
│   │   ├── Grunt.ts            # Melee — dash lunge Floor 3+
│   │   ├── Shooter.ts          # Ranged — spread shot Floor 2+, faster rate Floor 4+
│   │   ├── Tank.ts             # Shield, knockback, instant strike Floor 4+
│   │   ├── Projectile.ts       # Standard bullet entity
│   │   ├── spawn.ts            # Wave composition (normal + elite)
│   │   ├── index.ts            # Barrel export
│   │   └── boss/
│   │       ├── Brute.ts        # Floor 1 boss — charge, slam, spread
│   │       ├── Phantom.ts      # Floor 2 boss — blink, ring burst, aimed volley
│   │       ├── Colossus.ts     # Floor 3 boss — armored, stomp chain, quake
│   │       ├── Mage.ts         # Rare boss — teleport, fakes, homing bolt
│   │       ├── Shade.ts        # Rare boss — tiny, dash-lunge, evade
│   │       └── index.ts        # selectBoss() + AnyBoss type
│   ├── items/
│   │   ├── Weapon.ts           # Weapon class + bare fists fallback
│   │   ├── WeaponRegistry.ts   # Attack shapes for sword/axe/spear
│   │   ├── WeaponItemRegistry.ts # 10 named weapons with baked-in passives
│   │   ├── ItemPool.ts         # Mixed weapon+charm shop pool
│   │   └── types.ts            # WeaponItem, WeaponType, AttackDef interfaces
│   ├── systems/
│   │   ├── HordeSystem.ts      # Wave spawning, parry, separation, farming
│   │   ├── BossSystem.ts       # Boss fight loop, stagger, Mage fakes
│   │   ├── RenderSystem.ts     # World draw, scrolling grid, screen shake
│   │   ├── GoldSystem.ts       # Drop spawn, collection, diminishing returns
│   │   └── WeaponSystem.ts     # Charge-aware hitbox, hit resolution
│   ├── Camera.ts               # Follow-cam + boss arena centering
│   ├── Collision.ts            # AABB, circle, arc, pickup helpers
│   ├── Door.ts                 # Gate entity — F to enter when active
│   ├── GameState.ts            # Central engine state, RunRecord, localStorage helpers
│   ├── Input.ts                # KeyboardEvent → movement snapshot
│   ├── ItemDrop.ts             # Loot drop entity (walk to pick up)
│   ├── GoldDrop.ts             # Coin entity with float animation
│   ├── Particle.ts             # Kill burst particles
│   ├── Player.ts               # Physics, charge/block/parry state machines
│   ├── PlayerStats.ts          # Stat allocation, charm/weapon management
│   ├── CharmRegistry.ts        # 10 charm definitions + modifier system
│   ├── WeaponPassiveRegistry.ts # Event-driven weapon passives (riposte, rend, momentum)
│   ├── ShopNPC.ts              # Merchant entity — safe zone, proximity prompt
│   └── RoomManager.ts          # Room state machine, floor scaling formulas
├── hooks/
│   └── useGameLoop.ts          # rAF loop with stable ref pattern
└── styles/
    ├── globals.css
    ├── hud.css
    ├── menu.css
    ├── inventory.css
    ├── shop.css
    ├── minimap.css
    ├── pause.css
    ├── victory.css
    ├── gameover.css
    ├── floor-transition.css
    └── dev-panel.css
```

---

## Development

### Dev Tools Panel (F1)

Press `F1` in the browser to toggle the dev panel. Only available in development builds — stripped from production automatically.

| Button | Action |
|--------|--------|
| ☠ Kill All Enemies | Sets kills to threshold, opens the gate instantly |
| ⏭ Skip Room | Advances to the next room (calls door enter logic) |
| ⚡ Skip to Elite | Jumps directly to Room 3 (elite composition) |
| 💀 Skip to Boss | Enters boss phase on the current floor |
| 💰 +200 Gold | Adds 200 gold to your balance |