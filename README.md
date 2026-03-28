# Infinity Dungeon

A fast-paced top-down arena rogue-like built with **Next.js**, **TypeScript**, and **HTML5 Canvas**. Fight through horde rooms, survive a boss, collect gold, and build your character with stat upgrades and Charms — then do it all again, harder.

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
| `J` | Light Attack (fast, 10 stamina) |
| `K` | Heavy Attack (slow, 25 stamina) |
| `C` | Dash (30 stamina) |

### Game Loop

```
Room 1 (Horde) → Room 2 (Horde + Shooters) → Shop → Room 3 (Boss) → repeat, harder
```

- Kill **20 enemies** to open the gate at the top of the arena
- Walk into the **green door** to advance
- After Room 2 the **Shop** opens — spend gold on stat upgrades and Charms
- Room 3 is the **Boss** — a large enemy with charge and slam attacks (watch for the warning rings)
- Dying sends you back to the main menu

### Combat Tips

- **Orange ring** on an enemy = melee windup — dash away to dodge
- **Yellow ring** on a Shooter = it's about to fire — move sideways
- **Yellow ring** on the Boss = charge incoming — get out of its path
- **Red ring** on the Boss = slam AoE — run outside the circle

### Shop

Spend gold dropped by enemies on:
- **Stat Points** — STR (damage), VIT (HP), AGI (speed), END (stamina)
- **Charms** — passive effects that stack and combine (max 5)
- Sell a Charm for 50% of its cost back
- Reroll the 3 charm options for 20g

---

## Tech Stack

- **Next.js 15+ (App Router)**
- **TypeScript**
- **HTML5 Canvas API** — all game rendering
- **Tailwind CSS** — UI overlays only
- **lucide-react** — icons (optional UI use)

---

## Project Structure

```
src/
├── app/                  # Next.js app entry
├── components/
│   ├── GameCanvas.tsx    # Main game shell
│   ├── HUD.tsx           # In-game heads-up display
│   ├── Menu.tsx          # Main menu
│   ├── Shop.tsx          # Shop UI
│   └── overlays/         # Game Over, Victory screens
├── engine/
│   ├── enemy/            # Grunt, Shooter, Boss, Projectile
│   ├── systems/          # HordeSystem, BossSystem, RenderSystem, GoldSystem
│   ├── Camera.ts         # Scrolling camera
│   ├── GameState.ts      # Central engine state
│   ├── Player.ts         # Player physics and attacks
│   ├── CharmRegistry.ts  # All charm definitions
│   ├── PlayerStats.ts    # Stat allocation and charm slots
│   └── GoldDrop.ts       # Collectible gold coins
└── hooks/
    └── useGameLoop.ts    # requestAnimationFrame loop
```

Testing