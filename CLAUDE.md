# INFINITY DUNGEON — CLAUDE.md
<!-- This file is the authoritative reference for AI-assisted development. -->
<!-- Keep it up to date whenever systems change. -->

## What This Project Is

A top-down arena rogue-like built with **Next.js 16 (App Router) + TypeScript + HTML5 Canvas + Tailwind CSS**.
The game runs entirely in a fullscreen HTML5 Canvas. React handles UI overlays only.
**Alpha v0.1** — actively in development.

---

## Coding Rules (Non-Negotiable)

- **Always drop complete files** — never partial edits or snippets
- **TypeScript only** — no JavaScript anywhere
- **`[🧱 BLOCK: Name]` comments** in every file to mark logical sections
- **Never use `useState` for gameplay logic** — only for UI overlay visibility and HUD sync values
- **CSS per component** — every component gets its own `src/styles/<name>.css`; BEM-style class names with component prefix (e.g. `.shop-header__title`)
- **`playerStats.applyToPlayer(player)`** must be called after any stat / charm / weapon change
- **Tank damage** always uses `takeDamageFrom(amount, playerX, playerY, isHeavy)` — never `takeDamage()` — for shield-arc checks
- **Boss projectiles** are drained from `boss.pendingProjectiles[]` by `BossSystem` each frame
- Commit format: `feat: description` / `fix: description`

---

## Response Style Rules

- Be concise — skip unnecessary preamble
- Before writing any code, confirm the exact plan with a summary table or bullet list
- Ask for the relevant files before writing code if you don't have them
- When multiple files change, present them all at once at the end
- Use the `present_files` tool for all file outputs

---

## Architecture

### Rendering Model
```
GameCanvas (React shell)
  ├── HTML5 Canvas  ← all game rendering (60fps via useGameLoop)
  └── React overlays ← HUD, Shop, Minimap, Inventory, Pause, GameOver, Victory
```

### State Model
- **Gameplay state** lives in `GameState` accessed via `useRef` — never React state
- **HUD values** synced to React state at 10fps via `setInterval`
- **UI overlay visibility** is the only thing that lives in React `useState`

### Key Patterns
```typescript
// Engine refs — gameplay never touches React state
const stateRef  = useRef<GameState>();
const hordeRef  = useRef(new HordeSystem());
const bossRef   = useRef(new BossSystem());

// Draw call signature — player is always the 4th arg
system.draw(state, ctx, camera, player);

// Stat changes always apply to player immediately
playerStats.upgradeStat(key, gold, floor);
playerStats.applyToPlayer(player);  // ← always required after
```

---

## File Structure

```
src/
├── app/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── GameCanvas.tsx              ← main shell, game loop, dev panel
│   ├── HUD.tsx
│   ├── Menu.tsx
│   ├── Shop.tsx
│   ├── Minimap.tsx
│   ├── Inventory.tsx
│   └── overlays/
│       ├── GameOverOverlay.tsx
│       ├── VictoryOverlay.tsx
│       ├── PauseOverlay.tsx
│       └── WaveClearAnnouncement.tsx
├── engine/
│   ├── enemy/
│   │   ├── BaseEnemy.ts            ← shared HP, stun, drawBody, drawHpBar
│   │   ├── Grunt.ts
│   │   ├── Shooter.ts
│   │   ├── Tank.ts                 ← directional shield, takeDamageFrom()
│   │   ├── Boss.ts                 ← legacy (aliased to Brute)
│   │   ├── Projectile.ts
│   │   ├── spawn.ts                ← spawnWave(), spawnEliteWave()
│   │   ├── types.ts
│   │   └── boss/
│   │       ├── index.ts            ← AnyBoss union, selectBoss()
│   │       ├── Brute.ts            ← charge, slam, spread shot
│   │       ├── Phantom.ts          ← blink, ring burst, aimed volley
│   │       ├── Colossus.ts         ← armored, stomp, quake projectiles
│   │       ├── Mage.ts             ← teleport, homing, illusion fakes
│   │       └── Shade.ts            ← dash, spear lunge, evade
│   ├── items/
│   │   ├── types.ts                ← WeaponItem, AttackDef, HitboxDef
│   │   ├── Weapon.ts               ← hitbox shapes: arc, circle, rect
│   │   └── ItemPool.ts             ← getRandomShopItems(), ShopItem union
│   ├── systems/
│   │   ├── HordeSystem.ts          ← waves, parry, separation, farming
│   │   ├── BossSystem.ts           ← boss AI, stagger, weapon passive hooks
│   │   ├── RenderSystem.ts         ← clear, grid, bounds, screen shake
│   │   ├── GoldSystem.ts           ← drop spawning, collection, multiplier
│   │   └── WeaponSystem.ts         ← hit testing, charge multipliers
│   ├── Camera.ts
│   ├── CharmRegistry.ts            ← CHARM_POOL, PlayerStatModifiers
│   ├── Collision.ts                ← rectOverlap, circleCircle, arcHitsRect, etc.
│   ├── Door.ts
│   ├── GameState.ts
│   ├── GoldDrop.ts
│   ├── Input.ts
│   ├── ItemDrop.ts
│   ├── Particle.ts
│   ├── Player.ts
│   ├── PlayerStats.ts
│   ├── RoomManager.ts
│   ├── ShopNPC.ts
│   └── WeaponPassiveRegistry.ts    ← 10 weapon passives, event-driven hooks
├── hooks/
│   └── useGameLoop.ts
└── styles/
    ├── globals.css
    ├── hud.css
    ├── menu.css
    ├── inventory.css
    ├── shop.css
    ├── minimap.css
    ├── dev-panel.css
    ├── pause.css
    ├── gameover.css
    └── victory.css
```

---

## Controls

| Key | Action |
|-----|--------|
| W A S D | Move |
| J (tap) | Light attack |
| J (hold 400ms) | Charged light — 2.5× damage, wider arc, forward lunge |
| K (tap) | Heavy attack — locks movement |
| K (hold 600ms) | Charged heavy — 2× damage, wider range |
| L (tap < 220ms) | Parry — 500ms window, deflects melee + projectiles, staggers bosses |
| L (hold) | Block — absorbs all damage, drains stamina, breaks if stamina hits 0 |
| C | Dash — 30 stamina, grants i-frames |
| F | Interact — enter door / talk to Shop NPC |
| Hold I (500ms) | Open Inventory |
| ESC | Pause / Resume |
| F1 | Dev Panel (dev builds only) |

---

## Game Loop — Room Cycle

```
Floor N:
  Room 1 (horde)  →  Room 2 (horde)  →  Room 3 (elite)  →  Boss  →  Victory  →  Floor N+1
```

- **Kill threshold** to open gate: `20 + (floor − 1) × 5`
- After threshold: enemies trickle every 3s, gold yield drops 20% per 10 bonus kills (floor 0.20)
- **Elite room**: no Grunts — only Shooters and Tanks, +50% enemy count
- **Shop NPC** appears alongside the door after threshold — accessible any time before leaving
- HP is persistent — never restored between rooms; only healed via Shop

---

## Enemy Roster

### Grunt (purple · 65 HP base)
- Floor 1–2: chase → windup → strike → cooldown
- Floor 3+: approach dash with purple afterimage trail before windup
- Melee-only, 15 damage

### Shooter (amber · 45 HP base)
- Maintains preferred distance, retreats if too close
- Floor 1: single projectile
- Floor 2–3: 3-way spread ±15°
- Floor 4+: spread + reduced cooldown (1400ms)

### Tank (slate/red · 120 HP base)
- **Directional shield** above 50% HP: 70% front-arc damage reduction; heavy attacks pierce 40%
- Always applies knockback on hit
- Floor 1–2: 1000ms windup telegraph
- Floor 3: 600ms windup
- Floor 4+: instant strike, no windup, red danger ring
- **Requires `takeDamageFrom(amount, px, py, isHeavy)`** for shield-arc check

### Projectile
- Speed 4px/frame, max range 400px
- Can be parried (deflected) or blocked (absorbed)

---

## Boss Roster

All bosses: HP scales `1 + (floor − 1) × 0.5`. Rage triggers at ≤50% HP.

| Boss | Floor | Unique mechanic | Rage name |
|------|-------|-----------------|-----------|
| **Brute** | 1 (+ random 4+) | Charge, slam AoE, double-slam (F3+), spread shot (F2+) | ⚡ ENRAGED |
| **Phantom** | 2 (+ random 4+) | Blink-teleport, intangible during blink, ring burst + aimed volley | ⚡ UNBOUND |
| **Colossus** | 3 (+ random 4+) | 65% armor above 50% HP, stomp AoE, stomp chain + quake projectiles (enraged) | ⚡ UNSHACKLED |
| **Mage** | random 4+ | Teleport, homing bolt, fast burst, illusion fakes that also fire | ⚡ ARCANE |
| **Shade** | random 4+ | Approach dash, spear-lunge hitbox, evade dash after attack | ⚡ PHANTOM STEP |

**Boss parry system**: successful parry staggers boss for 600ms and makes it take 1.5× damage.

---

## Player Combat System

### Attack Modes
| Mode | Trigger | Effect |
|------|---------|--------|
| Light | J tap | Forward lunge, arc hitbox, normal damage |
| Heavy | K tap | Movement locked, larger hitbox, higher damage + stamina cost |
| Charged light | J hold 400ms | 2.5× damage, 1.6× wider arc, forward lunge on release |
| Charged heavy | K hold 600ms | 2.0× damage, 1.5× wider hitbox, movement locked throughout |

### Block / Parry
- **Parry**: tap L under 220ms → 500ms active window → deflects melee hits + projectiles, staggers bosses
- **Block**: hold L past 220ms → absorbs all damage → costs 20 stamina upfront + 0.3/frame drain + 12 per hit absorbed; breaks if stamina = 0
- Both slow movement to 30% while active

### Stamina Regen
Controlled exclusively by `ps.staminaRegenRate` in HordeSystem/BossSystem.
`staminaRegenRate = 0.4 × modifiers.staminaRegenMult` — affected by Overclock/Berserker charms.

---

## Charm System (10 charms)

Charms affect **who you are** — flat stat modifiers via `PlayerStatModifiers`.

| ID | Name | Effect | Trade-off |
|----|------|--------|-----------|
| `blood_pact` | Blood Pact | +3 HP per kill | — |
| `iron_skin` | Iron Skin | −15% damage taken | — |
| `glass_cannon` | Glass Cannon | +20 ATK | −30 max HP |
| `berserker` | Berserker | +10 ATK | Stamina regen −30% |
| `momentum` | Momentum | Dash costs 20 stamina (−10) | — |
| `executioner` | Executioner | Heavy kill → shockwave 25 dmg (horde) / VFX (boss) | — |
| `vampire` | Vampire | +5 HP per kill | −10 max HP |
| `overclock` | Overclock | Stamina regen +50% | — |
| `juggernaut` | Juggernaut | +30 max HP | Move speed −0.5 |
| `last_stand` | Last Stand | +15 ATK below 25% HP (checked live each hit) | — |

Max 5 charms. Sell for 50% refund.

---

## Weapon Passive System (10 passives)

Weapon passives affect **how you fight** — event-driven, not stat modifiers.
Defined in `WeaponPassiveRegistry.ts`. Completely separate from charms.

| Weapon | Passive | Trigger | Effect | Trade-off |
|--------|---------|---------|--------|-----------|
| Sword | Riposte | Parry | Opens 2s window: next attack 3× damage | Miss the window, bonus wasted |
| Axe | Rend | Any hit | Marks enemy: next hit on them +8 damage | — |
| Spear | Momentum | Attack within 200ms of dash | 2× damage | Stationary attacks gain nothing |
| Hammer | Stun Break | Heavy hit | Roots enemy 300ms | Heavy cooldown +20% |
| Dagger | Flurry | 3rd consecutive light hit | Bonus free hit, no stamina cost | Chain breaks after 1.8s pause |
| Scythe | Soul Drain | Killing blow | +15 stamina instantly | No effect on non-kills |
| Glaive | Wide Arc | Every attack | Range +40% | +8 stamina cost per attack |
| Rapier | Precision | Light attack on Tank/Colossus | Ignores 50% of armor/shield reduction | No bonus vs unarmored |
| Mace | Shockwave | Heavy kill | 20 damage to all within 80px | Zero effect on isolated targets |
| Katana | Iaijutsu | Charged light attack | +40% damage | Movement halved while charging |

Passive hooks: `onEquip`, `onRemove`, `onHit(player, enemy, damage, state)`, `onKill(player, enemy, state)`, `onParry(player, state)`.

---

## Stat System

| Stat | Key | Effect per level |
|------|-----|-----------------|
| Strength | `str` | +3 ATK |
| Vitality | `vit` | +10 max HP |
| Agility | `agi` | +0.3 move speed |
| Endurance | `end` | +5 max stamina |

Stat cap: `min(10, floor × 3)`. Cost: levels 0–2 = 30g, 3–5 = 60g, 6+ = 100g.

---

## Economy

| Source | Gold range |
|--------|-----------|
| Grunt kill | 5–10g |
| Shooter kill | 8–15g |
| Tank kill | 15–25g |
| Boss kill | 80–120g (5 drops) |
| Over-threshold kills | −20% per 10 extra kills, min 20% |

**Shop heal costs** scale with floor: Tincture `40×floor`g (+25 HP), Draught `75×floor`g (+50 HP), Elixir `120×floor`g (full heal).
Reroll cost escalates per visit: 20 → 40 → 60 → 80 → 100g (cap).

---

## Collision Helpers (`Collision.ts`)

| Function | Use |
|----------|-----|
| `rectOverlap(a, b)` | AABB overlap |
| `circleRect(cx, cy, r, rect)` | Circle vs rectangle |
| `circleCircle(ax, ay, ar, bx, by, br)` | Circle vs circle |
| `withinRadius(a, b, radius)` | Center-to-center proximity |
| `rectCenter(r)` | Returns center Vec2 of a Rect |
| `knockbackDir(from, to)` | Normalized push direction |
| `arcHitsRect(ox, oy, facing, range, halfAngle, target)` | Arc melee hitbox |
| `pickupOverlap(x, y, r, player)` | Gold/item pickup check |
| `distSq / dist` | Squared/raw distance between points |

---

## Known Remaining Issues

None critical. Items to address in future sessions:

- **Inventory weapon stats are hardcoded** — should read from `Weapon.getAttack()` instead of type-name switch
- **`Door.tsx` file extension** — should be `Door.ts` (no JSX), requires repo rename
- **`enemy/index.ts` legacy `Brute as Boss` alias** — safe to remove once confirmed no callers remain
- **Sound** — game is completely silent; Web Audio API integration is the highest-impact remaining feature

---

## What To Add Next (Priority Order)

### 🔴 High
1. **Sound effects** — hit, dash, enemy death, gold pickup, boss roar, slam, UI click, victory fanfare. Web Audio API, zero dependencies.
2. **Floor transition animation** — brief black fade with "FLOOR X" text between victory and new floor.

### 🟡 Medium
3. **More enemy types** — Dasher (fast/retreating), Bomber (explodes on death)
4. **Victory screen run summary** — same stats as death screen (kills, gold, time, weapon, charms)
5. **Tank shield hit feedback** — particle flash or color change when shield absorbs damage

### 🟢 Lower Priority
6. **High score / run history** — `localStorage`, display best floor/kills/time on main menu
7. **Boss HP phase marker** — color shift on HP bar at 50% rage threshold