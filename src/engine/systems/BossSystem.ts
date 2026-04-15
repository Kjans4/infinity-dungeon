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
import { spawnBurst }                  from "../Particle";
import { WeaponSystem }                from "./WeaponSystem";
import { getRandomShopItems }          from "../items/ItemPool";

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
// ============================================================
function spawnBossItemDrop(state: GameState, x: number, y: number) {
  if (state.pendingLoot.length >= PENDING_LOOT_CAP) return;
  const ownedCharmIds   = state.playerStats.charms.map((c) => c.id);
  const ownedWeaponId   = state.playerStats.equippedWeaponItem?.id ?? null;
  const pendingCharmIds = state.pendingLoot.filter((i) => i.kind === "charm").map((i) => i.id);
  const pendingWeaponId = state.pendingLoot.find((i) => i.kind === "weapon")?.id ?? null;
  const pool = getRandomShopItems(
    [...ownedCharmIds, ...pendingCharmIds],
    ownedWeaponId ?? pendingWeaponId,
    1
  );
  if (pool[0]) state.itemDrops.push(new ItemDrop(x, y, pool[0]));
}

// ============================================================
// [🧱 BLOCK: getBossName]
// Returns display name for announcement strings.
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
// [🧱 BLOCK: BossSystem]
// ============================================================
export class BossSystem {
  private weaponSystem = new WeaponSystem();

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
    state.camera.update(state.player, BOSS_WORLD_W, BOSS_WORLD_H);
    state.playerStats.applyToPlayer(state.player);
  }

  // ============================================================
  // [🧱 BLOCK: Reset]
  // ============================================================
  reset(state: GameState) {
    state.boss        = null;
    state.goldDrops   = [];
    state.itemDrops   = [];
    state.particles   = [];
    state.projectiles = [];
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
    if (!boss) return { event: null, goldCollected: 0 };

    const ps = state.playerStats;
    boss.update(player, worldW, worldH);

    // ── Drain boss projectiles ────────────────────────────
    if (boss.pendingProjectiles.length > 0) {
      state.projectiles.push(...boss.pendingProjectiles);
      boss.pendingProjectiles = [];
    }

    // ── Mage: check fake projectile hits on player ────────
    // Fakes push projectiles into boss.pendingProjectiles
    // during boss.update() above, so they're already drained.
    // We also need to hit-test fakes against player weapon.
    if (boss instanceof Mage) {
      this.resolveWeaponHitMageFakes(player, boss, ps.atkBonus);
    }

    // ── Projectile hits on player ─────────────────────────
    state.projectiles.forEach((proj) => {
      proj.update();
      if (proj.isHittingPlayer(player) && player.iFrames <= 0) {
        const finalDmg = Math.round(proj.damage * (1 - ps.damageReduction));
        player.takeHit(finalDmg);
        proj.isDone = true;
      }
    });
    state.projectiles = state.projectiles.filter((p) => !p.isDone);

    // ── Boss contact damage ───────────────────────────────
    if (boss.isCollidingWithPlayer(player) && player.iFrames <= 0) {
      const final = Math.round(boss.contactDamage * (1 - ps.damageReduction));
      player.takeHit(final);
      if (boss instanceof Brute || boss instanceof Colossus || boss instanceof Shade) {
        boss.damageCooldown = 800;
      }
    }

    // ── Shade: lunge hit check ────────────────────────────
    if (boss instanceof Shade) {
      if (boss.isLungeHittingPlayer(player) && player.iFrames <= 0) {
        const final = Math.round(boss.lungeDamage * (1 - ps.damageReduction));
        player.takeHit(final);
      }
    }

    // ── Boss slam / stomp AoE ─────────────────────────────
    if (boss.isSlamHittingPlayer(player) && player.iFrames <= 0) {
      const final = Math.round(boss.slamDamage * (1 - ps.damageReduction));
      player.takeHit(final);
    }

    // ── Weapon input + hit vs boss ────────────────────────
    this.weaponSystem.processInput(player);
    this.resolveWeaponHit(player, boss, ps.atkBonus);

    // ── Stamina regen ─────────────────────────────────────
    if (player.stamina < player.maxStamina) {
      player.stamina = Math.min(player.maxStamina, player.stamina + ps.staminaRegenRate);
    }

    // ── Gold + item drop collection ───────────────────────
    let goldCollected = 0;
    state.goldDrops.forEach((drop) => {
      const was = drop.collected;
      drop.update(player);
      if (!was && drop.collected) goldCollected += drop.amount;
    });
    state.goldDrops = state.goldDrops.filter((d) => !d.collected);
    state.totalGoldEarned += goldCollected;

    state.itemDrops = state.itemDrops.filter((drop) => {
      if (drop.collected) return false;
      if (state.pendingLoot.length >= PENDING_LOOT_CAP) {
        drop.update(player); return !drop.collected;
      }
      const pickedUp = drop.update(player);
      if (pickedUp) { state.pendingLoot.push(drop.item); return false; }
      return !drop.collected;
    });

    // ── Enrage event ──────────────────────────────────────
    if (boss.justEnragedThisFrame) {
      return { event: "enraged", goldCollected };
    }

    // ── Boss death ────────────────────────────────────────
    if (boss.isDead) {
      state.totalKills += 1;
      const bx = boss.x + boss.width  / 2;
      const by = boss.y + boss.height / 2;
      spawnBossGold(state, bx, by);
      spawnBossItemDrop(state, bx, by);
      state.particles.push(...spawnBurst(bx, by, boss.color, 12, 1.8));
      return { event: "victory", goldCollected };
    }

    return { event: null, goldCollected };
  }

  // ============================================================
  // [🧱 BLOCK: Resolve Weapon Hit vs Boss]
  // Routes to boss-specific takeDamage when needed.
  // ============================================================
  private resolveWeaponHit(player: Player, boss: AnyBoss, atkBonus: number): void {
    if (!player.isAttacking || !player.equippedWeapon || !player.attackType) return;

    const weapon  = player.equippedWeapon;
    const mode    = player.attackType;
    const atk     = weapon.getAttack(mode);
    const damage  = atk.damage + atkBonus;
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
  // Checks player weapon against each live fake.
  // Fakes die in one hit regardless of damage amount.
  // ============================================================
  private resolveWeaponHitMageFakes(player: Player, mage: Mage, atkBonus: number): void {
    if (!player.isAttacking || !player.equippedWeapon || !player.attackType) return;
    if (mage.fakes.length === 0) return;

    const weapon  = player.equippedWeapon;
    const mode    = player.attackType;
    const atk     = weapon.getAttack(mode);
    const damage  = atk.damage + atkBonus;
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
    state.boss?.draw(ctx, camera);
    state.projectiles.forEach((p) => p.draw(ctx, camera));
    state.itemDrops.forEach((d)   => d.draw(ctx, camera));
    state.goldDrops.forEach((drop) => drop.draw(ctx, camera));
    state.particles.forEach((p)   => p.update());
    state.particles = state.particles.filter((p) => !p.isDone);
    state.particles.forEach((p)   => p.draw(ctx, camera));
    this.weaponSystem.draw(ctx, player, camera);
  }
}