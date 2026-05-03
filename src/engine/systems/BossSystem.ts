// src/engine/systems/BossSystem.ts
import { Player }                      from "../Player";
import { Camera }                      from "../Camera";
import { AnyBoss, selectBoss }         from "../enemy/boss/index";
import { Brute }                       from "../enemy/boss/Brute";
import { Phantom }                     from "../enemy/boss/Phantom";
import { Colossus }                    from "../enemy/boss/Colossus";
import { Mage }                        from "../enemy/boss/Mage";
import { Shade }                       from "../enemy/boss/Shade";
import { RoomState }                   from "../RoomManager";
import { GameState, PENDING_LOOT_CAP } from "../GameState";
import { BOSS_WORLD_W, BOSS_WORLD_H }  from "../Camera";
import { GoldDrop }                    from "../GoldDrop";
import { ItemDrop }                    from "../ItemDrop";
import { ConsumableDrop }              from "../ConsumableDrop";
import { Door }                        from "../Door";
import { ShopNPC }                     from "../ShopNPC";
import { RenderSystem }                from "./RenderSystem";
import { ConsumableSystem }            from "../ConsumableSystem";
import { spawnBurst, spawnHitSpark, spawnDamageNumber } from "../Particle";
import { WeaponSystem }                from "./WeaponSystem";
import { getRandomShopItems, getRandomConsumableDrop } from "../items/ItemPool";
import {
  isRiposteActive, tickRiposte, RIPOSTE_MULT, GLAIVE_EXTRA_COST,
} from "../WeaponPassiveRegistry";

// ============================================================
// [🧱 BLOCK: Parry / Stagger Constants]
// ============================================================
const BOSS_STAGGER_MS      = 600;
const BOSS_PARRY_VULN_MULT = 1.5;

const BOSS_GOLD = { min: 80, max: 120 };

// ============================================================
// [🧱 BLOCK: Boss Drop Constants]
// MIN_ITEM_DROPS    — guaranteed items every boss kill
// FLOOR_BONUS_FLOOR — floor threshold to add a 4th item
// BONUS_DROP_CHANCE — probability of a 5th bonus item
//
// Boss items spawn as ItemDrop objects on the ground, spread
// around the boss's death position. Player walks near them to
// see them in Inventory (hold I) — consistent with horde drops.
// No proximity auto-collect; player must explicitly equip.
// ============================================================
const MIN_ITEM_DROPS      = 3;
const FLOOR_BONUS_FLOOR   = 3;
const BONUS_DROP_CHANCE   = 0.40;

// Spread radius for boss drop placement around death point
const BOSS_DROP_SPREAD    = 80;

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ============================================================
// [🧱 BLOCK: Spawn Boss Item Drops]
// Spawns ItemDrop objects scattered around the boss death point.
// They sit on the ground — player walks near them to see them in
// Inventory, then equips explicitly. No pendingLoot bypass.
// Duplicate prevention checks both owned and already-on-ground.
// ============================================================
function spawnBossItemDrops(state: GameState, cx: number, cy: number) {
  const floor      = state.boss ? (state.boss as any).floor ?? 1 : 1;
  const floorBonus = floor >= FLOOR_BONUS_FLOOR ? 1 : 0;
  const bonusRoll  = Math.random() < BONUS_DROP_CHANCE ? 1 : 0;
  const totalDrops = MIN_ITEM_DROPS + floorBonus + bonusRoll;

  for (let i = 0; i < totalDrops; i++) {
    // Collect what's already owned + already on the ground to avoid dupes
    const ownedCharmIds   = state.playerStats.charms.map((c) => c.id);
    const ownedWeaponId   = state.playerStats.equippedWeaponItem?.id ?? null;
    const ownedArmorIds   = Object.values(state.playerStats.armorSlots)
      .filter(Boolean).map((a) => a!.id);
    // Also exclude items already sitting as ground drops
    const groundCharmIds  = state.itemDrops.filter((d) => d.item.kind === 'charm').map((d) => d.item.id);
    const groundWeaponId  = state.itemDrops.find((d)  => d.item.kind === 'weapon')?.item.id ?? null;
    const groundArmorIds  = state.itemDrops.filter((d) => d.item.kind === 'armor').map((d) => d.item.id);

    const pool = getRandomShopItems(
      [...ownedCharmIds, ...groundCharmIds],
      ownedWeaponId ?? groundWeaponId,
      [...ownedArmorIds, ...groundArmorIds],
      1,
      floor
    );

    if (!pool[0]) continue;

    // Scatter drops in a circle around the boss death point
    const angle  = (i / totalDrops) * Math.PI * 2;
    const radius = BOSS_DROP_SPREAD * (0.5 + Math.random() * 0.5);
    state.itemDrops.push(new ItemDrop(
      cx + Math.cos(angle) * radius,
      cy + Math.sin(angle) * radius,
      pool[0]
    ));
  }
}

// ============================================================
// [🧱 BLOCK: Spawn Boss Consumable Drop]
// Always spawns exactly 1 consumable drop on boss death,
// placed slightly offset from the boss center.
// ============================================================
function spawnBossConsumableDrop(state: GameState, cx: number, cy: number) {
  const def = getRandomConsumableDrop();
  state.consumableDrops.push(new ConsumableDrop(
    cx + (Math.random() - 0.5) * 60,
    cy + (Math.random() - 0.5) * 60,
    def
  ));
}

// ============================================================
// [🧱 BLOCK: getBossName]
// ============================================================
export function getBossName(boss: AnyBoss): string {
  if (boss instanceof Brute)    return 'BRUTE';
  if (boss instanceof Phantom)  return 'PHANTOM';
  if (boss instanceof Colossus) return 'COLOSSUS';
  if (boss instanceof Mage)     return 'MAGE';
  if (boss instanceof Shade)    return 'SHADE';
  return 'BOSS';
}

// ============================================================
// [🧱 BLOCK: Boss Stagger State]
// ============================================================
interface BossStagger {
  timer: number;
}

// ============================================================
// [🧱 BLOCK: BossSystem]
// ============================================================
export class BossSystem {
  private weaponSystem = new WeaponSystem();
  private stagger: BossStagger = { timer: 0 };

  get isBossStaggered(): boolean { return this.stagger.timer > 0; }

  // ============================================================
  // [🧱 BLOCK: Setup]
  // Clears consumableDrops and itemDrops so horde-room drops
  // don't bleed into the boss arena.
  // ============================================================
  setup(state: GameState, rs: RoomState) {
    state.player.x  = BOSS_WORLD_W / 2;
    state.player.y  = BOSS_WORLD_H - 100;
    state.player.vx = 0;
    state.player.vy = 0;

    state.enemies         = [];
    state.projectiles     = [];
    state.goldDrops       = [];
    state.itemDrops       = [];           // ← clear horde drops on boss entry
    state.consumableDrops = [];           // ← clear horde consumable drops
    state.particles       = [];
    state.hitSparks       = [];
    state.damageNumbers   = [];
    state.kills           = 0;
    state.door            = null;
    state.shopNpc         = null;

    state.boss = selectBoss(BOSS_WORLD_W / 2 - 50, 80, rs.floor);
    this.stagger = { timer: 0 };
    state.camera.update(state.player, BOSS_WORLD_W, BOSS_WORLD_H);
    state.playerStats.applyToPlayer(state.player);
  }

  // ============================================================
  // [🧱 BLOCK: Reset]
  // ============================================================
  reset(state: GameState) {
    state.boss            = null;
    state.door            = null;
    state.shopNpc         = null;
    state.goldDrops       = [];
    state.itemDrops       = [];
    state.consumableDrops = [];
    state.particles       = [];
    state.hitSparks       = [];
    state.damageNumbers   = [];
    state.projectiles     = [];
    this.stagger          = { timer: 0 };
  }

  // ============================================================
  // [🧱 BLOCK: Spawn Victory Door and Shop]
  // ============================================================
  private spawnVictoryDoorAndShop(state: GameState) {
    state.door          = new Door(BOSS_WORLD_W);
    state.door.isActive = true;
    state.shopNpc       = new ShopNPC(BOSS_WORLD_W);
    state.shopNpc.activate();
  }

  // ============================================================
  // [🧱 BLOCK: Tick Consumable Drops]
  // Shared helper — updates all consumable drops on the ground,
  // auto-collects them into the bag when player walks over them,
  // and spawns a pickup particle burst.
  // Called both during the fight and in the post-victory phase.
  // ============================================================
  private tickConsumableDrops(state: GameState, player: Player): void {
    state.consumableDrops = state.consumableDrops.filter((drop) => {
      if (drop.collected) return false;
      drop.update(player);
      if (drop.collected) {
        state.playerConsumables.addToBag(drop.def, 1);
        state.particles.push(...spawnBurst(
          drop.x, drop.y,
          drop.def.kind === 'potion' ? '#a78bfa' : '#38bdf8',
          5, 0.8
        ));
        return false;
      }
      return true;
    });
  }

  // ============================================================
  // [🧱 BLOCK: Tick Door and Shop Post-Victory]
  // Item drops (including boss drops) sit on the ground and tick
  // for proximity detection only — no auto-collect, no removal.
  // The only removal path is GameCanvas.handleEquipDrop setting
  // collected = true when the player explicitly equips the item.
  // ============================================================
  private tickDoorAndShop(state: GameState, player: Player): number {
    if (state.door) {
      state.door.update();
      state.door.checkPlayerProximity(player);
    }
    if (state.shopNpc) {
      state.shopNpc.update();
      state.shopNpc.checkPlayerProximity(player);
    }

    const ps = state.playerStats;
    if (player.stamina < player.maxStamina) {
      player.stamina = Math.min(player.maxStamina, player.stamina + ps.staminaRegenRate);
    }

    let goldCollected = 0;
    state.goldDrops.forEach((drop) => {
      const was = drop.collected;
      drop.update(player);
      if (!was && drop.collected) goldCollected += drop.amount;
    });
    state.goldDrops = state.goldDrops.filter((d) => !d.collected);

    // ── Item drops — proximity tick only, NO auto-collect ─────
    // Boss drops (spawned as ItemDrop objects) and any remaining
    // ground drops all follow the same rule: they stay on the
    // ground until the player explicitly equips them via Inventory.
    // playerIsNear is updated each frame so Inventory can show
    // the nearby drop card.
    state.itemDrops = state.itemDrops.filter((drop) => {
      if (drop.collected) return false;
      drop.update(player);   // ticks animation + playerIsNear flag
      return true;           // always keep — never auto-remove
    });

    // ── Consumable drops still on ground post-victory ─────────
    this.tickConsumableDrops(state, player);

    return goldCollected;
  }

  // ============================================================
  // [🧱 BLOCK: Emit Hit Feedback]
  // ============================================================
  private emitHitFeedback(
    state:      GameState,
    boss:       AnyBoss,
    damage:     number,
    attackType: string | null,
    render:     RenderSystem
  ): void {
    const cx = boss.x + boss.width  / 2;
    const cy = boss.y + boss.height / 2;

    const sparkColor =
      attackType === 'charged_heavy' ? '#ef4444' :
      attackType === 'heavy'         ? '#fb923c' :
      attackType === 'charged_light' ? '#facc15' :
                                       '#f1f5f9';

    state.hitSparks.push(...spawnHitSpark(cx, cy, sparkColor, 5));
    state.damageNumbers.push(spawnDamageNumber(cx, cy - boss.height / 2, damage, attackType));
    render.shake('micro');
  }

  // ============================================================
  // [🧱 BLOCK: Apply Incoming Damage]
  // Centralises Ward absorb + Iron Potion reduction + block for
  // all boss damage sources (projectiles, contact, slam, lunge).
  // Returns true if the hit was fully absorbed.
  // ============================================================
  private applyIncomingDamage(
    state:     GameState,
    player:    Player,
    rawDamage: number
  ): boolean {
    if (player.iFrames > 0) return true;

    // Ward Scroll — absorb hit entirely
    if (ConsumableSystem.wardCanAbsorb(state)) {
      ConsumableSystem.consumeWardHit(state);
      state.particles.push(...spawnBurst(
        player.x + player.width  / 2,
        player.y + player.height / 2,
        '#a78bfa', 6, 1.0
      ));
      return true;
    }

    // Block — absorbs hit and costs stamina
    if (player.isBlocking) {
      const afterBlock = player.applyBlockedHit(rawDamage);
      if (afterBlock === 0) return false; // absorbed by block
      rawDamage = afterBlock;
    }

    // Iron Potion damage reduction (multiplicative)
    const ironMult = ConsumableSystem.ironDamageReductionMult(state);
    const dmg      = Math.round(rawDamage * ironMult);

    if (dmg > 0) player.takeHit(dmg);
    return false;
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // ============================================================
  update(
    state:  GameState,
    player: Player,
    worldW: number,
    worldH: number,
    render: RenderSystem
  ): { event: "victory" | "enraged" | null; goldCollected: number } {
    const boss = state.boss as AnyBoss | null;

    // ── Post-victory roam phase ───────────────────────────────
    if (!boss) {
      const goldCollected = this.tickDoorAndShop(state, player);
      if (goldCollected > 0) state.totalGoldEarned += goldCollected;
      return { event: null, goldCollected };
    }

    const ps = state.playerStats;

    // ── Tick stagger ──────────────────────────────────────────
    if (this.stagger.timer > 0) {
      this.stagger.timer -= 16;
      if (this.stagger.timer < 0) this.stagger.timer = 0;
    } else {
      boss.update(player, worldW, worldH);
    }

    // ── Drain boss projectiles ────────────────────────────────
    if (boss.pendingProjectiles.length > 0) {
      state.projectiles.push(...boss.pendingProjectiles);
      boss.pendingProjectiles = [];
    }

    // ── Mage fakes ────────────────────────────────────────────
    if (boss instanceof Mage) {
      this.resolveWeaponHitMageFakes(
        player, boss,
        ps.atkBonus + ps.lastStandBonus(player) + ConsumableSystem.wrathAtkBonus(state),
        ps.weaponPassive?.id ?? null,
        state,
        render
      );
    }

    // ── Projectile hits on player ─────────────────────────────
    state.projectiles.forEach((proj) => {
      proj.update();
      if (!proj.isHittingPlayer(player)) return;

      // Parry check first — parry window deflects the projectile
      if (player.isParrying) {
        const parried = player.tryParry();
        if (parried) {
          proj.isDone = true;
          state.particles.push(...spawnBurst(proj.x, proj.y, "#38bdf8", 6, 1.0));
          ps.weaponPassive?.onParry?.(player, state);
          return;
        }
      }

      // applyIncomingDamage handles iFrames, Ward, Block, Iron internally
      const rawDmg = Math.round(proj.damage * (1 - ps.damageReduction));
      this.applyIncomingDamage(state, player, rawDmg);
      proj.isDone = true;
    });
    state.projectiles = state.projectiles.filter((p) => !p.isDone);

    // ── Boss contact damage ───────────────────────────────────
    if (boss.isCollidingWithPlayer(player) && player.iFrames <= 0 && !this.isBossStaggered) {
      if (player.isParrying) {
        const parried = player.tryParry();
        if (parried) {
          this.stagger.timer = BOSS_STAGGER_MS;
          state.particles.push(...spawnBurst(
            player.x + player.width  / 2,
            player.y + player.height / 2,
            "#38bdf8", 10, 1.4
          ));
          ps.weaponPassive?.onParry?.(player, state);
        }
      } else {
        const rawDmg = Math.round(boss.contactDamage * (1 - ps.damageReduction));
        this.applyIncomingDamage(state, player, rawDmg);
        if (boss instanceof Brute || boss instanceof Colossus || boss instanceof Shade) {
          boss.damageCooldown = 800;
        }
      }
    }

    // ── Shade lunge ───────────────────────────────────────────
    if (boss instanceof Shade && !this.isBossStaggered) {
      if (boss.isLungeHittingPlayer(player) && player.iFrames <= 0) {
        if (player.isParrying) {
          const parried = player.tryParry();
          if (parried) {
            this.stagger.timer = BOSS_STAGGER_MS;
            state.particles.push(...spawnBurst(
              player.x + player.width  / 2,
              player.y + player.height / 2,
              "#38bdf8", 10, 1.4
            ));
            ps.weaponPassive?.onParry?.(player, state);
          }
        } else {
          const rawDmg = Math.round(boss.lungeDamage * (1 - ps.damageReduction));
          this.applyIncomingDamage(state, player, rawDmg);
        }
      }
    }

    // ── Slam / stomp AoE ──────────────────────────────────────
    if (boss.isSlamHittingPlayer(player) && player.iFrames <= 0 && !this.isBossStaggered) {
      const rawDmg = Math.round(boss.slamDamage * (1 - ps.damageReduction));
      this.applyIncomingDamage(state, player, rawDmg);
    }

    // ── Weapon input + hit vs boss ─────────────────────────────
    this.weaponSystem.processInput(player);

    if (ps.weaponPassive?.id === 'glaive' && player.isAttacking) {
      player.stamina = Math.max(0, player.stamina - GLAIVE_EXTRA_COST);
    }

    tickRiposte(16);

    // ── Wrath Potion ATK bonus stacks additively ───────────────
    const atkBonus = ps.atkBonus + ps.lastStandBonus(player) + ConsumableSystem.wrathAtkBonus(state);

    this.resolveWeaponHit(
      player, boss,
      atkBonus,
      ps.weaponPassive?.id ?? null,
      state,
      render
    );

    // ── Stamina regen ─────────────────────────────────────────
    if (player.stamina < player.maxStamina) {
      player.stamina = Math.min(player.maxStamina, player.stamina + ps.staminaRegenRate);
    }

    // ── Gold collection ───────────────────────────────────────
    let goldCollected = 0;
    state.goldDrops.forEach((drop) => {
      const was = drop.collected;
      drop.update(player);
      if (!was && drop.collected) goldCollected += drop.amount;
    });
    state.goldDrops = state.goldDrops.filter((d) => !d.collected);
    state.totalGoldEarned += goldCollected;

    // ── Item drop tick during boss fight ──────────────────────
    // Proximity tick only — no auto-collect, no removal.
    state.itemDrops = state.itemDrops.filter((drop) => {
      if (drop.collected) return false;
      drop.update(player);   // ticks animation + playerIsNear flag
      return true;           // always keep — never auto-remove
    });

    // ── Consumable drops on ground during boss fight ──────────
    this.tickConsumableDrops(state, player);

    // ── Enrage event ──────────────────────────────────────────
    if (boss.justEnragedThisFrame) {
      return { event: "enraged", goldCollected };
    }

    // ── Boss death ────────────────────────────────────────────
    if (boss.isDead) {
      state.totalKills += 1;
      const bx = boss.x + boss.width  / 2;
      const by = boss.y + boss.height / 2;

      // ── Gold drops ────────────────────────────────────────
      const variantMult = boss.goldMultiplier;
      const baseAmount  = randInt(BOSS_GOLD.min, BOSS_GOLD.max);
      const finalAmount = Math.round(baseAmount * variantMult);
      for (let i = 0; i < 5; i++) {
        const ox = (Math.random() - 0.5) * 60;
        const oy = (Math.random() - 0.5) * 60;
        state.goldDrops.push(new GoldDrop(bx + ox, by + oy, Math.floor(finalAmount / 5)));
      }

      // ── Item drops — spawned as ground drops, NOT pendingLoot ─
      // Player walks near them to see them in Inventory (hold I),
      // then equips explicitly. Consistent with horde room drops.
      spawnBossItemDrops(state, bx, by);

      // ── Guaranteed consumable drop ────────────────────────
      spawnBossConsumableDrop(state, bx, by);

      // ── Death VFX ─────────────────────────────────────────
      state.particles.push(...spawnBurst(bx, by, boss.color, 12, 1.8));

      if (ps.hasCharm('executioner')) {
        state.particles.push(...spawnBurst(bx, by, '#facc15', 20, 2.2));
      }

      if (boss.isVolatile) {
        state.particles.push(...spawnBurst(bx, by, '#f97316', 16, 2.0));
        render.shake('heavy');
      }

      this.spawnVictoryDoorAndShop(state);
      state.boss = null;

      return { event: "victory", goldCollected };
    }

    return { event: null, goldCollected };
  }

  // ============================================================
  // [🧱 BLOCK: Resolve Weapon Hit vs Boss]
  // ============================================================
  private resolveWeaponHit(
    player:    Player,
    boss:      AnyBoss,
    atkBonus:  number,
    passiveId: string | null,
    state:     GameState,
    render:    RenderSystem
  ): void {
    if (!player.isAttacking || !player.equippedWeapon || !player.attackType) return;

    const weapon  = player.equippedWeapon;
    const mode    = player.attackType === 'charged_light' ? 'light' : 'heavy';
    const atk     = weapon.getAttack(mode);
    let   damage  = atk.damage + atkBonus;

    if (player.attackType === 'charged_light') damage = Math.round(damage * 2.5);
    if (player.attackType === 'charged_heavy') damage = Math.round(damage * 2.0);

    if (this.isBossStaggered)                 damage = Math.round(damage * BOSS_PARRY_VULN_MULT);
    if (isRiposteActive())                    damage = Math.round(damage * RIPOSTE_MULT);
    if (passiveId === 'momentum' && player.dashTimer > 0) damage = Math.round(damage * 2.0);
    if (passiveId === 'iaijutsu' && player.attackType === 'charged_light') damage = Math.round(damage * 1.4);

    const isHeavy = mode === 'heavy';
    const facing  = (isHeavy && player.lockedFacing) ? player.lockedFacing : player.facing;

    const px = player.x + player.width  / 2;
    const py = player.y + player.height / 2;
    const bx = boss.x   + boss.width    / 2;
    const by = boss.y   + boss.height   / 2;

    if (weapon.hitTest(px, py, facing, mode, bx, by, boss.width, boss.height)) {
      if (boss instanceof Colossus) {
        boss.takeDamage(damage, isHeavy);
      } else {
        boss.takeDamage(damage);
      }
      this.emitHitFeedback(state, boss, damage, player.attackType, render);
    }
  }

  // ============================================================
  // [🧱 BLOCK: Resolve Weapon Hit vs Mage Fakes]
  // ============================================================
  private resolveWeaponHitMageFakes(
    player:    Player,
    mage:      Mage,
    atkBonus:  number,
    passiveId: string | null,
    state:     GameState,
    render:    RenderSystem
  ): void {
    if (!player.isAttacking || !player.equippedWeapon || !player.attackType) return;
    if (mage.fakes.length === 0) return;

    const weapon  = player.equippedWeapon;
    const mode    = player.attackType === 'charged_light' ? 'light' : 'heavy';
    const atk     = weapon.getAttack(mode);
    let   damage  = atk.damage + atkBonus;
    if (player.attackType === 'charged_light') damage = Math.round(damage * 2.5);
    if (player.attackType === 'charged_heavy') damage = Math.round(damage * 2.0);

    if (isRiposteActive())                                                   damage = Math.round(damage * RIPOSTE_MULT);
    if (passiveId === 'momentum' && player.dashTimer > 0)                    damage = Math.round(damage * 2.0);
    if (passiveId === 'iaijutsu' && player.attackType === 'charged_light')   damage = Math.round(damage * 1.4);

    const isHeavy = mode === 'heavy';
    const facing  = (isHeavy && player.lockedFacing) ? player.lockedFacing : player.facing;
    const px = player.x + player.width  / 2;
    const py = player.y + player.height / 2;

    mage.fakes.forEach((fake) => {
      if (fake.isDead) return;
      const fx = fake.x + fake.width  / 2;
      const fy = fake.y + fake.height / 2;
      if (weapon.hitTest(px, py, facing, mode, fx, fy, fake.width, fake.height)) {
        fake.takeDamage(damage);
        state.hitSparks.push(...spawnHitSpark(fx, fy, '#99f6e4', 3));
        render.shake('micro');
      }
    });
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // consumableDrops drawn after item drops, before particles.
  // ============================================================
  draw(state: GameState, ctx: CanvasRenderingContext2D, camera: Camera, player: Player) {
    if (state.boss && this.isBossStaggered) {
      const progress = this.stagger.timer / BOSS_STAGGER_MS;
      const sx = camera.toScreenX(state.boss.x);
      const sy = camera.toScreenY(state.boss.y);
      ctx.globalAlpha = 0.3 * progress * (Math.floor(Date.now() / 80) % 2 === 0 ? 1 : 0.3);
      ctx.fillStyle   = "#38bdf8";
      ctx.fillRect(sx, sy, state.boss.width, state.boss.height);
      ctx.globalAlpha = 1;
    }

    state.boss?.draw(ctx, camera);
    state.door?.draw(ctx, camera);
    state.shopNpc?.draw(ctx, camera, BOSS_WORLD_W);
    state.projectiles.forEach((p)        => p.draw(ctx, camera));
    state.itemDrops.forEach((d)          => d.draw(ctx, camera));
    state.consumableDrops.forEach((d)    => d.draw(ctx, camera));
    state.goldDrops.forEach((drop)       => drop.draw(ctx, camera));

    state.particles.forEach((p)    => p.update());
    state.particles = state.particles.filter((p) => !p.isDone);
    state.particles.forEach((p)    => p.draw(ctx, camera));

    state.hitSparks.forEach((s)    => s.update());
    state.hitSparks = state.hitSparks.filter((s) => !s.isDone);
    state.hitSparks.forEach((s)    => s.draw(ctx, camera));

    this.weaponSystem.draw(ctx, player, camera);
  }
}