// src/engine/WeaponPassiveRegistry.ts
// ============================================================
// [🧱 BLOCK: Overview]
// Self-contained passive system for weapons.
// Each passive is an event-driven object — it hooks into
// combat actions (hit, kill, parry, equip, remove) rather than
// tweaking flat stat modifiers the way charms do.
//
// Passives are keyed by weaponType so ItemPool can reference
// them by string: getWeaponPassive('sword').
// ============================================================

import { Player }    from "./Player";
import { GameState } from "./GameState";
import { BaseEnemy } from "./enemy/BaseEnemy";
import { spawnBurst } from "./Particle";

// ============================================================
// [🧱 BLOCK: WeaponPassive Interface]
// All hooks are optional. Systems call only what is defined.
// `state` is passed so hooks can spawn particles/drops/gold.
// ============================================================
export interface WeaponPassive {
  id:          string;
  name:        string;
  description: string;
  tradeOff?:   string;

  // Called once when weapon is equipped / unequipped
  onEquip?:  (player: Player) => void;
  onRemove?: (player: Player) => void;

  // Called after a successful weapon hit lands on an enemy or boss
  // `damage` is the final amount already dealt.
  onHit?: (
    player: Player,
    enemy:  BaseEnemy,
    damage: number,
    state:  GameState
  ) => void;

  // Called when a weapon hit kills a horde enemy (not boss)
  onKill?: (
    player: Player,
    enemy:  BaseEnemy,
    state:  GameState
  ) => void;

  // Called when the player successfully parries while this weapon is equipped
  onParry?: (player: Player, state: GameState) => void;
}

// ============================================================
// [🧱 BLOCK: Per-passive runtime state]
// Passives that need to track chain counts or cooldowns store
// state here so it resets cleanly on equip/unequip without
// polluting Player or PlayerStats.
// ============================================================
interface FlurryState  { count: number; lastHitTime: number; }
interface RiposteState { windowOpen: boolean; windowTimer: number; }
interface RendState    { markedEnemies: Set<BaseEnemy>; }

// Module-level instances — one per passive, reset on onEquip.
const flurry:  FlurryState  = { count: 0, lastHitTime: 0 };
const riposte: RiposteState = { windowOpen: false, windowTimer: 0 };
const rend:    RendState    = { markedEnemies: new Set() };

const FLURRY_WINDOW_MS   = 1800;  // reset chain if no hit within this
const RIPOSTE_WINDOW_MS  = 2000;  // ms after parry to use the bonus
const RIPOSTE_MULT       = 3.0;
const REND_BONUS_DAMAGE  = 8;
const SOUL_DRAIN_STAMINA = 15;
const GLAIVE_EXTRA_COST  = 8;     // applied via onEquip stamina cost mod

// ============================================================
// [🧱 BLOCK: Sword — Riposte]
// Parrying opens a 2s window where next attack deals 3× damage.
// Requires the player to consciously parry → attack.
// ============================================================
const ripostePassive: WeaponPassive = {
  id:          'riposte',
  name:        'Riposte',
  description: 'Parrying opens a 2s window — next attack deals 3× damage.',
  tradeOff:    'Miss the window and the bonus is wasted.',

  onEquip() {
    riposte.windowOpen  = false;
    riposte.windowTimer = 0;
  },
  onRemove() {
    riposte.windowOpen  = false;
    riposte.windowTimer = 0;
  },

  onParry(player, state) {
    riposte.windowOpen  = true;
    riposte.windowTimer = RIPOSTE_WINDOW_MS;
    // Cyan burst to signal window opened
    state.particles.push(...spawnBurst(
      player.x + player.width  / 2,
      player.y + player.height / 2,
      '#38bdf8', 8, 1.2
    ));
  },

  onHit(player, _enemy, _damage, state) {
    // Tick the window timer
    if (riposte.windowOpen) {
      riposte.windowTimer -= 16;
      if (riposte.windowTimer <= 0) {
        riposte.windowOpen  = false;
        riposte.windowTimer = 0;
      }
    }
    // Reset after consuming — the 3× is applied as a damage multiplier
    // inside HordeSystem/BossSystem before calling onHit, so we just close.
    if (riposte.windowOpen) {
      riposte.windowOpen  = false;
      riposte.windowTimer = 0;
    }
  },
};

// ============================================================
// [🧱 BLOCK: Axe — Rend]
// Each hit marks the enemy. Their next hit received deals +8
// bonus damage. Stacks once per enemy.
// Rewards sustained aggression — keep attacking the same target.
// ============================================================
const rendPassive: WeaponPassive = {
  id:          'rend',
  name:        'Rend',
  description: 'Each hit marks the enemy — their next hit taken deals +8 bonus damage.',

  onEquip()  { rend.markedEnemies.clear(); },
  onRemove() { rend.markedEnemies.clear(); },

  onHit(_player, enemy, _damage, _state) {
    rend.markedEnemies.add(enemy);
  },

  onKill(_player, enemy) {
    rend.markedEnemies.delete(enemy);
  },
};

// ============================================================
// [🧱 BLOCK: Spear — Momentum]
// Attacking within 200ms of finishing a dash doubles damage.
// Requires intentional dash → attack combos.
// ============================================================
const momentumPassive: WeaponPassive = {
  id:          'momentum',
  name:        'Momentum',
  description: 'Attacking within 200ms after a dash deals double damage.',
  tradeOff:    'Stationary attacks gain nothing.',

  onEquip()  {},
  onRemove() {},
  // Timing check is done in systems via player.dashTimer reading.
  // No onHit state needed here — systems read player.dashTimer directly.
};

// ============================================================
// [🧱 BLOCK: Hammer — Stun Break]
// Heavy attacks root the enemy for 300ms on hit.
// No iFrames are consumed — the stun is purely on the enemy.
// Trade-off: heavy cooldown is longer (+20% in Weapon.ts).
// ============================================================
const stunBreakPassive: WeaponPassive = {
  id:          'stun_break',
  name:        'Stun Break',
  description: 'Heavy attacks root enemies for 300ms on hit.',
  tradeOff:    'Heavy attack cooldown is 20% longer.',

  onEquip()  {},
  onRemove() {},

  onHit(player, enemy, _damage, _state) {
    const isHeavy = player.attackType === 'heavy' || player.attackType === 'charged_heavy';
    if (isHeavy) {
      enemy.applyStun(300);
    }
  },
};

// ============================================================
// [🧱 BLOCK: Dagger — Flurry]
// Every 3rd consecutive light hit fires automatically at full
// damage with no stamina cost. Chain breaks if >1800ms between hits.
// ============================================================
const flurryPassive: WeaponPassive = {
  id:          'flurry',
  name:        'Flurry',
  description: 'Every 3rd consecutive light hit is free and automatic.',
  tradeOff:    'Chain breaks if you pause for more than 1.8s.',

  onEquip()  { flurry.count = 0; flurry.lastHitTime = 0; },
  onRemove() { flurry.count = 0; flurry.lastHitTime = 0; },

  onHit(player, enemy, damage, state) {
    const isLight = player.attackType === 'light' || player.attackType === 'charged_light';
    if (!isLight) { flurry.count = 0; return; }

    const now = Date.now();
    if (now - flurry.lastHitTime > FLURRY_WINDOW_MS) flurry.count = 0;
    flurry.lastHitTime = now;
    flurry.count++;

    if (flurry.count >= 3) {
      flurry.count = 0;
      // Bonus hit — deal damage directly, no stamina charge
      if (!enemy.isDead) {
        enemy.takeDamage(damage);
        state.particles.push(...spawnBurst(
          enemy.x + enemy.width  / 2,
          enemy.y + enemy.height / 2,
          '#f0c040', 5, 0.9
        ));
      }
    }
  },
};

// ============================================================
// [🧱 BLOCK: Scythe — Soul Drain]
// Killing blow instantly restores 15 stamina.
// Rewards finishing enemies fast; useless against lone tanks.
// ============================================================
const soulDrainPassive: WeaponPassive = {
  id:          'soul_drain',
  name:        'Soul Drain',
  description: 'Killing blow instantly restores 15 stamina.',
  tradeOff:    'No effect on non-killing hits.',

  onEquip()  {},
  onRemove() {},

  onKill(player, _enemy, state) {
    player.stamina = Math.min(player.maxStamina, player.stamina + SOUL_DRAIN_STAMINA);
    state.particles.push(...spawnBurst(
      player.x + player.width  / 2,
      player.y + player.height / 2,
      '#a78bfa', 6, 1.0
    ));
  },
};

// ============================================================
// [🧱 BLOCK: Glaive — Wide Arc]
// Hitbox is 40% wider than normal but every attack costs +8
// extra stamina. Rewards builds that invest in END.
// ============================================================
const wideArcPassive: WeaponPassive = {
  id:          'wide_arc',
  name:        'Wide Arc',
  description: 'Attack range extended 40% in both modes.',
  tradeOff:    'Each attack costs +8 extra stamina.',

  onEquip()  {},
  onRemove() {},
  // Range scaling handled in WeaponSystem via GLAIVE_RANGE_MULT.
  // Extra stamina cost handled in systems by reading weaponPassive.id.
};

// ============================================================
// [🧱 BLOCK: Rapier — Precision]
// Light attacks ignore 50% of Tank and Colossus shield
// damage reduction. No effect on unshielded enemies.
// ============================================================
const precisionPassive: WeaponPassive = {
  id:          'precision',
  name:        'Precision',
  description: 'Light attacks ignore 50% of armoured enemies\' damage reduction.',
  tradeOff:    'No bonus against unshielded enemies.',

  onEquip()  {},
  onRemove() {},
  // Applied in HordeSystem/BossSystem during hit resolution.
};

// ============================================================
// [🧱 BLOCK: Mace — Shockwave]
// Heavy attack kills deal 20 damage to all enemies within 80px.
// Different from Executioner charm: smaller radius, tied to mace
// heavy kills only — not all heavy kills.
// ============================================================
const shockwavePassive: WeaponPassive = {
  id:          'shockwave',
  name:        'Shockwave',
  description: 'Heavy kill sends a shockwave dealing 20 damage within 80px.',
  tradeOff:    'Zero effect on isolated enemies.',

  onEquip()  {},
  onRemove() {},

  onKill(player, enemy, state) {
    const isHeavy = player.attackType === 'heavy' || player.attackType === 'charged_heavy';
    if (!isHeavy) return;
    const cx = enemy.x + enemy.width  / 2;
    const cy = enemy.y + enemy.height / 2;
    state.enemies.forEach((e) => {
      if (e.isDead || e === enemy) return;
      const dx = (e.x + e.width  / 2) - cx;
      const dy = (e.y + e.height / 2) - cy;
      if (dx * dx + dy * dy < 80 * 80) e.takeDamage(20);
    });
    state.particles.push(...spawnBurst(cx, cy, '#fb923c', 10, 1.4));
  },
};

// ============================================================
// [🧱 BLOCK: Katana — Iaijutsu]
// Charged light attacks deal an extra +40% damage.
// Trade-off: holding the charge slows movement to 30% speed —
// enforced in Player.ts by the existing CHARGE_LIGHT_SPEED_MULT
// which is already 0.60; Iaijutsu drops it further to 0.30.
// ============================================================
const iaijutsuPassive: WeaponPassive = {
  id:          'iaijutsu',
  name:        'Iaijutsu',
  description: 'Charged light attacks deal +40% bonus damage.',
  tradeOff:    'Holding the charge halves your movement speed.',

  onEquip(player)  { (player as any)._iaijutsuEquipped = true; },
  onRemove(player) { (player as any)._iaijutsuEquipped = false; },
  // +40% applied in systems when attackType === 'charged_light'
  // and weaponPassive.id === 'iaijutsu'.
  // Speed penalty is applied in HordeSystem/BossSystem per frame.
};

// ============================================================
// [🧱 BLOCK: Registry Map]
// weaponType → WeaponPassive.
// ItemPool uses this to embed the passive object in each WeaponItem.
// ============================================================
const PASSIVE_MAP: Record<string, WeaponPassive> = {
  sword:  ripostePassive,
  axe:    rendPassive,
  spear:  momentumPassive,
  hammer: stunBreakPassive,
  dagger: flurryPassive,
  scythe: soulDrainPassive,
  glaive: wideArcPassive,
  rapier: precisionPassive,
  mace:   shockwavePassive,
  katana: iaijutsuPassive,
};

export function getWeaponPassive(weaponType: string): WeaponPassive | null {
  return PASSIVE_MAP[weaponType] ?? null;
}

// ============================================================
// [🧱 BLOCK: Rend Helpers]
// Exposed so HordeSystem/BossSystem can read and clear marks
// without importing the full passive object.
// ============================================================
export function isRendMarked(enemy: BaseEnemy): boolean {
  return rend.markedEnemies.has(enemy);
}

export function clearRendMark(enemy: BaseEnemy): void {
  rend.markedEnemies.delete(enemy);
}

// ============================================================
// [🧱 BLOCK: Riposte Helpers]
// Exposed so systems can read the active window and apply mult.
// ============================================================
export function isRiposteActive(): boolean {
  return riposte.windowOpen;
}

export function tickRiposte(deltaMs: number): void {
  if (!riposte.windowOpen) return;
  riposte.windowTimer -= deltaMs;
  if (riposte.windowTimer <= 0) {
    riposte.windowOpen  = false;
    riposte.windowTimer = 0;
  }
}

export { RIPOSTE_MULT, REND_BONUS_DAMAGE, GLAIVE_EXTRA_COST };