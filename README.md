# Infinity Dungeon

A fast-paced top-down arena rogue-like built with **Next.js**, **TypeScript**, and **HTML5 Canvas**. Fight through horde rooms, survive a boss, collect gold, and build your character with stat upgrades, weapons, and charms — then do it all again, harder.

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

# Install the only extra package needed
npm install lucide-react

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## How to Play

**Goal:** Clear each room by killing enough enemies, reach the boss, defeat it, and push as deep as you can.

### Controls

| Key | Action |
|-----|--------|
| `W A S D` | Move |
| `J` | Light Attack |
| `K` | Heavy Attack (costs more stamina, halts movement) |
| `C` | Dash (30 stamina) |
| `ESC` | Pause / Resume |
| `I` (hold 500ms) | Open Inventory |
| `F1` | Dev Tools Panel (development only) |

### Game Loop

```
Room 1 (Horde) → Room 2 (Horde + Shooters + Tanks) → Shop → Boss Room → Victory → repeat, harder
```

- Kill the required number of enemies to open the **green gate** at the top of the arena
- Each floor increases the kill threshold: **Floor 1 = 20 kills, Floor 2 = 25, Floor 3 = 30...**
- After the threshold is met the gate opens — you can leave or **stay and farm** for more gold
- Extra kills beyond the threshold give **diminishing gold returns** (−20% every 10 bonus kills, floor 20%)
- Enemies keep spawning at a slower rate after the threshold so farming is possible but risky
- After Room 2 the **Shop** opens — the only place to restore HP in the entire run
- Room 3 is the **Boss** — defeat it to advance to the next floor

### HP & Survival

- HP **does not restore** between rooms or floors — it carries over from damage taken
- The only way to heal is in the **Shop before the boss**, at a gold cost that scales with floor:

| Tier | HP Restored | Floor 1 Cost | Floor 2 Cost |
|------|-------------|-------------|-------------|
| Small | +25 HP | 40g | 80g |
| Medium | +50 HP | 75g | 150g |
| Full | 100% HP | 120g | 240g |

### Combat Tips

- **Orange ring** on a Grunt = melee windup — dash sideways to dodge
- **Yellow ring** on a Shooter = ranged windup — move sideways before it fires
- **Purple trail** on a Grunt = dash lunge (Floor 3+) — it's closing distance fast
- **×3 badge** on a Shooter = spread shot incoming (Floor 2+) — three projectiles at once
- **Slate shield arc** on a Tank = front damage is reduced 70% — attack from behind or use heavy attacks
- **No warning ring** on a Tank (Floor 4+) = instant strike — don't stand in melee range
- **Yellow ring** on the Boss = charge incoming — get out of its path
- **Red ring** on the Boss = slam AoE — run outside the circle before it hits

### Enemies

| Enemy | Behavior | Threat |
|-------|----------|--------|
| **Grunt** (purple) | Chases and melees. Floor 3+: dashes before striking | Medium |
| **Shooter** (amber) | Keeps distance, fires projectiles. Floor 2+: 3-way spread | Ranged |
| **Tank** (slate/red) | Slow, massive HP, knockback hit. Shield above 50% HP | High |
| **Boss** (red) | Charge + slam attack patterns with visual warnings | Extreme |

### Shop

Spend gold dropped by enemies on:
- **Stat Points** — STR (+3 dmg/level), VIT (+10 HP/level), AGI (+0.3 speed/level), END (+5 stamina/level)
- **Weapons** — 10 named weapons each with a baked-in passive (sword, axe, spear types)
- **Charms** — passive effects that stack and combine (max 5 slots)
- **Healing** — restore HP before the boss fight (cost scales per floor)
- Sell weapons or charms for **50% refund**
- Reroll the 3 shop item slots for **20g**

### Weapons

| Weapon | Light DMG | Heavy DMG | Heavy Stamina |
|--------|-----------|-----------|---------------|
| Fists (default) | 6 | 15 | 38 |
| Sword | 12 | 28 | 35 |
| Axe | 15 | 40 | 42 |
| Spear | 10 | 35 | 32 |

### Floor Scaling

Each floor enemies get meaningfully harder — not just numbers, but behavior changes too:

| Stat | Formula |
|------|---------|
| Enemy HP | Base × floor (doubles each floor) |
| Enemy Speed | Base × (1 + (floor−1) × 0.25) |
| Boss HP | Base × (1 + (floor−1) × 0.50) |

---

## Tech Stack

- **Next.js 16 (App Router)**
- **TypeScript**
- **HTML5 Canvas API** — all game rendering
- **Tailwind CSS** — UI overlays only
- **lucide-react** — icons (optional UI use)

---

## Project Structure

```
src/
├── app/                        # Next.js app entry
├── components/
│   ├── GameCanvas.tsx          # Main game shell + dev panel
│   ├── HUD.tsx                 # In-game heads-up display
│   ├── Menu.tsx                # Main menu with animated background
│   ├── Shop.tsx                # Shop UI (stats, items, healing)
│   ├── Minimap.tsx             # Top-right minimap canvas
│   ├── Inventory.tsx           # Inventory overlay (hold I)
│   └── overlays/
│       ├── GameOverOverlay.tsx
│       ├── VictoryOverlay.tsx
│       ├── PauseOverlay.tsx
│       └── WaveClearAnnouncement.tsx
├── engine/
│   ├── enemy/
│   │   ├── BaseEnemy.ts        # Shared HP, flash, draw helpers
│   │   ├── Grunt.ts            # Melee — dash lunge on Floor 3+
│   │   ├── Shooter.ts          # Ranged — spread shot on Floor 2+
│   │   ├── Tank.ts             # Shield, knockback, instant strike Floor 4+
│   │   ├── Boss.ts             # Charge + slam state machine
│   │   ├── Projectile.ts       # Bullet entity
│   │   ├── spawn.ts            # Wave composition logic
│   │   └── index.ts            # Barrel export
│   ├── items/
│   │   ├── Weapon.ts           # Weapon class + bare fists fallback
│   │   ├── WeaponRegistry.ts   # Attack shapes for sword/axe/spear
│   │   ├── WeaponItemRegistry.ts # 10 named weapons with passives
│   │   └── ItemPool.ts         # Mixed weapon+charm shop pool
│   ├── systems/
│   │   ├── HordeSystem.ts      # Wave logic, infinite farming, gold multiplier
│   │   ├── BossSystem.ts       # Boss fight loop
│   │   ├── RenderSystem.ts     # World draw + screen shake
│   │   ├── GoldSystem.ts       # Drop spawn, collection, diminishing returns
│   │   └── WeaponSystem.ts     # Attack input, hitbox, Tank-aware damage
│   ├── Camera.ts               # Scrolling + centering for boss arena
│   ├── Door.ts                 # Gate entity — activates at kill threshold
│   ├── GameState.ts            # Central engine state
│   ├── Player.ts               # Physics, attacks, i-frames
│   ├── PlayerStats.ts          # Stat allocation, charm/weapon management
│   ├── CharmRegistry.ts        # 10 charm definitions + modifier system
│   ├── GoldDrop.ts             # Collectible coin entity
│   ├── Particle.ts             # Kill burst particles
│   └── RoomManager.ts          # Room state machine + floor scaling formulas
├── hooks/
│   └── useGameLoop.ts          # requestAnimationFrame loop (stable ref pattern)
└── styles/
    ├── globals.css
    ├── hud.css
    ├── menu.css
    ├── inventory.css
    ├── shop.css
    ├── minimap.css
    └── dev-panel.css
```

---

## Development

### Dev Tools Panel (F1)

Press `F1` in the browser to toggle the dev panel. Only available in development builds (`NODE_ENV === 'development'`) — stripped from production automatically.

| Button | Action |
|--------|--------|
| ☠ Kill All Enemies | Clears the room and opens the gate instantly |
| ⏭ Skip Room | Advances to the next room without walking to the door |
| 🛒 Skip to Shop | Jumps directly to the shop |
| 💀 Skip to Boss | Skips the shop and enters the boss fight |
| 💰 +200 Gold | Adds 200 gold to your current balance |

---