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
import { GameState }                   from "../GameState";
import { BOSS_WORLD_W, BOSS_WORLD_H }  from "../Camera";
import { GoldDrop }                    from "../GoldDrop";
import { ItemDrop }                    from "../ItemDrop";
import { Door }                        from "../Door";
import { ShopNPC }                     from "../ShopNPC";
import { spawnBurst }                  from "../Particle";
import { WeaponSystem }                from "./WeaponSystem";
import { getRandomShopItems }          from "../items/ItemPool";
import {
  isRiposteActive, tickRiposte, RIPOSTE_MULT, GLAIVE_EXTRA_COST,
} from "../WeaponPassiveRegistry";
import { tryIronWardenReflect }        from "../items/ArmorRegistry";

// ============================================================
// [🧱 BLOCK: Parry / Stagger Constants]
// ============================================================
const BOSS_STAGGER_MS      = 600;
const BOSS_PARRY_VULN_MULT = 1.5;

const BOSS_GOLD = { min: 80, max: 120 };

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function spawnBossGold(state: GameState, x: number, y: number) {
  const amount = randInt(BOSS_GOLD.min, BOSS_GOLD.max);
  for (let i = 0; i < 5; i++) {
    const ox = (Math.random() - 0.5) * 60;
    const oy = (Math.random() - 0.5) * 60;
    state.goldDrops.push(new GoldDrop(x + ox, y + oy, Math.floor(amount / 5)));
  }
}

// ============================================================
// [🧱 BLOCK: Spawn Boss Item Drop]
// No pendingLoot cap. Excludes items already on the ground
// so duplicates don't accumulate. floor scales armor stats.
// ============================================================
function spawnBossItemDrop(state: GameState, x: number, y: number, floor: number) {
  const ownedCharmIds  = state.playerStats.charms.map((c) => c.id);
  const ownedWeaponId  = state.playerStats.equippedWeaponItem?.id ?? null;
  const ownedArmorIds  = Object.values(state.playerStats.armorSlots)
    .filter(Boolean).map((a) => a!.id);

  const groundCharmIds = state.itemDrops
    .filter((d) => !d.collected && d.item.kind === "charm").map((d) => d.item.id);
  const groundWeaponId = state.itemDrops
    .find((d) => !d.collected && d.item.kind === "weapon")?.item.id ?? null;
  const groundArmorIds = state.itemDrops
    .filter((d) => !d.collected && d.item.kind === "armor").map((d) => d.item.id);

  const pool = getRandomShopItems(
    [...ownedCharmIds, ...groundCharmIds],
    ownedWeaponId ?? groundWeaponId,
    [...ownedArmorIds, ...groundArmorIds],
    1,
    floor
  );
  if (pool[0]) state.itemDrops.push(new ItemDrop(x, y, pool[0]));
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
  private weaponSystem    = new WeaponSystem();
  private stagger: BossStagger = { timer: 0 };
  // Stored in setup() so spawnBossItemDrop can use it at boss death
  // without needing to thread RoomState through update().
  private _currentFloor: number = 1;

  get isBossStaggered(): boolean { return this.stagger.timer > 0; }

  // ============================================================
  // [🧱 BLOCK: Setup]
  // ============================================================
  setup(state: GameState, rs: RoomState) {
    state.player.x  = BOSS_WORLD_W / 2;
    state.player.y  = BOSS_WORLD_H - 100;
    state.player.vx = 0;
    state.player.vy = 0;

    state.enemies     = [];
    state.projectiles = [];
    state.goldDrops   = [];
    state.itemDrops   = [];
    state.particles   = [];
    state.kills       = 0;
    state.door        = null;
    state.shopNpc     = null;

    state.boss = selectBoss(BOSS_WORLD_W / 2 - 50, 80, rs.floor);
    this._currentFloor = rs.floor;
    this.stagger = { timer: 0 };
    state.camera.update(state.player, BOSS_WORLD_W, BOSS_WORLD_H);
    state.playerStats.applyToPlayer(state.player);
  }

  // ============================================================
  // [🧱 BLOCK: Reset]
  // ============================================================
  reset(state: GameState) {
    state.boss        = null;
    state.door        = null;
    state.shopNpc     = null;
    state.goldDrops   = [];
    state.itemDrops   = [];
    state.particles   = [];
    state.projectiles = [];
    this.stagger      = { timer: 0 };
  }

  // ============================================================
  // [🧱 BLOCK: Spawn Victory Door and Shop]
  // Called once on boss death. Door is immediately active.
  // ShopNPC positioned beside the door as in horde rooms.
  // ============================================================
  private spawnVictoryDoorAndShop(state: GameState) {
    state.door          = new Door(BOSS_WORLD_W);
    state.door.isActive = true;
    state.shopNpc       = new ShopNPC(BOSS_WORLD_W);
    state.shopNpc.activate();
  }

  // ============================================================
  // [🧱 BLOCK: Tick Door and Shop Post-Victory]
  // Runs every frame after boss is dead so the door/shop keep
  // animating and responding to player proximity.
  // Returns goldCollected so the caller can credit state.gold
  // and floorGoldRef — previously this was silently discarded.
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

    // Stamina regen while roaming post-victory
    const ps = state.playerStats;
    if (player.stamina < player.maxStamina) {
      player.stamina = Math.min(player.maxStamina, player.stamina + ps.staminaRegenRate);
    }

    // Remaining gold drops — accumulate before filtering
    let goldCollected = 0;
    state.goldDrops.forEach((drop) => {
      const was = drop.collected;
      drop.update(player);
      if (!was && drop.collected) goldCollected += drop.amount;
    });
    state.goldDrops = state.goldDrops.filter((d) => !d.collected);

    // Item drops — tick proximity only, filter collected
    state.itemDrops.forEach((drop) => drop.update(player));
    state.itemDrops = state.itemDrops.filter((drop) => !drop.collected);

    return goldCollected;
  }

  // ============================================================
  // [🧱 BLOCK: Update]
  // ============================================================
  update(
    state:  GameState,
    player: Player,
    worldW: number,
    worldH: number
  ): { event: "victory" | "enraged" | null; goldCollected: number } {
    const boss = state.boss as AnyBoss | null;

    // ── Post-victory roam phase — boss already gone ───────────
    // tickDoorAndShop now returns gold collected so it reaches
    // GameCanvas and gets credited to state.gold / floorGoldRef.
    if (!boss) {
      const goldCollected = this.tickDoorAndShop(state, player);
      if (goldCollected > 0) state.totalGoldEarned += goldCollected;
      return { event: null, goldCollected };
    }

    const ps       = state.playerStats;
    const iw5Count = ps.getEquippedSetCounts()['iron_warden'] ?? 0;

    // ── Tick stagger ──────────────────────────────────────────
    if (this.stagger.timer > 0) {
      this.stagger.timer -= 16;
      if (this.stagger.timer < 0) this.stagger.timer = 0;
    } else {
      boss.update(player, worldW, worldH);
    }

    // ── Drain boss projectiles ─────────────────────────────────
    if (boss.pendingProjectiles.length > 0) {
      state.projectiles.push(...boss.pendingProjectiles);
      boss.pendingProjectiles = [];
    }

    // ── Mage fakes ────────────────────────────────────────────
    if (boss instanceof Mage) {
      this.resolveWeaponHitMageFakes(
        player, boss,
        ps.atkBonus + ps.lastStandBonus(player),
        ps.weaponPassive?.id ?? null
      );
    }

    // ── Projectile hits on player ─────────────────────────────
    state.projectiles.forEach((proj) => {
      proj.update();
      if (!proj.isHittingPlayer(player)) return;

      if (player.isParrying) {
        const parried = player.tryParry();
        if (parried) {
          proj.isDone = true;
          state.particles.push(...spawnBurst(proj.x, proj.y, "#38bdf8", 6, 1.0));
          ps.weaponPassive?.onParry?.(player, state);
          return;
        }
      }

      if (player.iFrames > 0) { proj.isDone = true; return; }

      let rawDmg = Math.round(proj.damage * (1 - ps.damageReduction));
      if (player.isBlocking) rawDmg = player.applyBlockedHit(rawDmg);
      if (rawDmg > 0) {
        player.takeHit(rawDmg);
        tryIronWardenReflect(iw5Count, boss);
      }
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
        let rawDmg = Math.round(boss.contactDamage * (1 - ps.damageReduction));
        if (player.isBlocking) rawDmg = player.applyBlockedHit(rawDmg);
        if (rawDmg > 0) {
          player.takeHit(rawDmg);
          tryIronWardenReflect(iw5Count, boss);
        }
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
          let rawDmg = Math.round(boss.lungeDamage * (1 - ps.damageReduction));
          if (player.isBlocking) rawDmg = player.applyBlockedHit(rawDmg);
          if (rawDmg > 0) {
            player.takeHit(rawDmg);
            tryIronWardenReflect(iw5Count, boss);
          }
        }
      }
    }

    // ── Slam / stomp AoE ──────────────────────────────────────
    if (boss.isSlamHittingPlayer(player) && player.iFrames <= 0 && !this.isBossStaggered) {
      let rawDmg = Math.round(boss.slamDamage * (1 - ps.damageReduction));
      if (player.isBlocking) rawDmg = player.applyBlockedHit(rawDmg);
      if (rawDmg > 0) {
        player.takeHit(rawDmg);
        tryIronWardenReflect(iw5Count, boss);
      }
    }

    // ── Weapon input + hit vs boss ─────────────────────────────
    this.weaponSystem.processInput(player);

    if (ps.weaponPassive?.id === 'glaive' && player.isAttacking) {
      player.stamina = Math.max(0, player.stamina - GLAIVE_EXTRA_COST);
    }

    tickRiposte(16);

    this.resolveWeaponHit(
      player, boss,
      ps.atkBonus + ps.lastStandBonus(player),
      ps.weaponPassive?.id ?? null
    );

    // ── Stamina regen ─────────────────────────────────────────
    if (player.stamina < player.maxStamina) {
      player.stamina = Math.min(player.maxStamina, player.stamina + ps.staminaRegenRate);
    }

    // ── Gold + item drop collection ───────────────────────────
    let goldCollected = 0;
    state.goldDrops.forEach((drop) => {
      const was = drop.collected;
      drop.update(player);
      if (!was && drop.collected) goldCollected += drop.amount;
    });
    state.goldDrops = state.goldDrops.filter((d) => !d.collected);
    state.totalGoldEarned += goldCollected;

    // ── Item drops — tick proximity only, filter collected ────
    state.itemDrops.forEach((drop) => drop.update(player));
    state.itemDrops = state.itemDrops.filter((drop) => !drop.collected);

    // ── Enrage event ──────────────────────────────────────────
    if (boss.justEnragedThisFrame) {
      return { event: "enraged", goldCollected };
    }

    // ── Boss death ────────────────────────────────────────────
    if (boss.isDead) {
      state.totalKills += 1;
      const bx = boss.x + boss.width  / 2;
      const by = boss.y + boss.height / 2;
      spawnBossGold(state, bx, by);
      spawnBossItemDrop(state, bx, by, this._currentFloor);
      state.particles.push(...spawnBurst(bx, by, boss.color, 12, 1.8));

      if (ps.hasCharm('executioner')) {
        state.particles.push(...spawnBurst(bx, by, '#facc15', 20, 2.2));
      }

      // Spawn door + shop immediately so player can act freely
      this.spawnVictoryDoorAndShop(state);

      // Null out boss so the death block never fires again next frame.
      // The !boss early-return path will handle all post-victory ticking.
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
    passiveId: string | null
  ): void {
    if (!player.isAttacking || !player.equippedWeapon || !player.attackType) return;

    const weapon  = player.equippedWeapon;
    const mode    = player.attackType === 'charged_light' ? 'light' : 'heavy';
    const atk     = weapon.getAttack(mode);
    let   damage  = atk.damage + atkBonus;

    if (player.attackType === 'charged_light') damage = Math.round(damage * 2.5);
    if (player.attackType === 'charged_heavy') damage = Math.round(damage * 2.0);

    if (this.isBossStaggered) damage = Math.round(damage * BOSS_PARRY_VULN_MULT);

    if (isRiposteActive()) damage = Math.round(damage * RIPOSTE_MULT);
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
    }
  }

  // ============================================================
  // [🧱 BLOCK: Resolve Weapon Hit vs Mage Fakes]
  // ============================================================
  private resolveWeaponHitMageFakes(
    player:    Player,
    mage:      Mage,
    atkBonus:  number,
    passiveId: string | null
  ): void {
    if (!player.isAttacking || !player.equippedWeapon || !player.attackType) return;
    if (mage.fakes.length === 0) return;

    const weapon  = player.equippedWeapon;
    const mode    = player.attackType === 'charged_light' ? 'light' : 'heavy';
    const atk     = weapon.getAttack(mode);
    let   damage  = atk.damage + atkBonus;
    if (player.attackType === 'charged_light') damage = Math.round(damage * 2.5);
    if (player.attackType === 'charged_heavy') damage = Math.round(damage * 2.0);

    if (isRiposteActive())                                                 damage = Math.round(damage * RIPOSTE_MULT);
    if (passiveId === 'momentum' && player.dashTimer > 0)                  damage = Math.round(damage * 2.0);
    if (passiveId === 'iaijutsu' && player.attackType === 'charged_light') damage = Math.round(damage * 1.4);

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
      }
    });
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // ============================================================
  draw(state: GameState, ctx: CanvasRenderingContext2D, camera: Camera, player: Player) {
    // Boss stagger visual
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

    // Door + ShopNPC appear after boss dies
    state.door?.draw(ctx, camera);
    state.shopNpc?.draw(ctx, camera, BOSS_WORLD_W);

    state.projectiles.forEach((p)  => p.draw(ctx, camera));
    state.itemDrops.forEach((d)    => d.draw(ctx, camera));
    state.goldDrops.forEach((drop) => drop.draw(ctx, camera));
    state.particles.forEach((p)    => p.update());
    state.particles = state.particles.filter((p) => !p.isDone);
    state.particles.forEach((p)    => p.draw(ctx, camera));
    this.weaponSystem.draw(ctx, player, camera);
  }
}