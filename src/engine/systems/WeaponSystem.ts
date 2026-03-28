// src/engine/systems/WeaponSystem.ts
import { Player }  from "../Player";
import { Camera }  from "../Camera";
import { Grunt }   from "../enemy/Grunt";
import { Shooter } from "../enemy/Shooter";
import { Boss }    from "../enemy/Boss";

export class WeaponSystem {

  // ============================================================
  // [🧱 BLOCK: Process Input]
  // Reads player.lastInput. Calls player.startWeaponAttack()
  // if conditions are met.
  // ============================================================
  processInput(player: Player): void {
    if (player.isAttacking || player.isDashing) return;
    const input  = player.lastInput;
    const weapon = player.equippedWeapon;
    if (!input || !weapon) return;

    const mov = input.movement;

    if (mov.light) {
      const atk = weapon.getAttack('light');
      if (player.stamina >= atk.staminaCost) {
        player.startWeaponAttack('light', atk);
      }
      return;
    }

    if (mov.heavy && player.heavyCooldown <= 0) {
      const atk = weapon.getAttack('heavy');
      if (player.stamina >= atk.staminaCost) {
        player.startWeaponAttack('heavy', atk);
      }
    }
  }

  // ============================================================
  // [🧱 BLOCK: Resolve Hits vs Enemies]
  // ============================================================
  resolveHits(
    player:   Player,
    enemies:  (Grunt | Shooter)[],
    atkBonus: number
  ): (Grunt | Shooter)[] {
    if (!player.isAttacking || !player.equippedWeapon || !player.attackType) {
      return [];
    }

    const weapon  = player.equippedWeapon;
    const mode    = player.attackType;
    const atk     = weapon.getAttack(mode);
    const damage  = atk.damage + atkBonus;
    const facing  = (mode === 'heavy' && player.lockedFacing)
      ? player.lockedFacing
      : player.facing;

    const px  = player.x + player.width  / 2;
    const py  = player.y + player.height / 2;
    const hit: (Grunt | Shooter)[] = [];

    enemies.forEach((enemy) => {
      if (enemy.isDead) return;
      const ex = enemy.x + enemy.width  / 2;
      const ey = enemy.y + enemy.height / 2;
      if (weapon.hitTest(px, py, facing, mode, ex, ey, enemy.width, enemy.height)) {
        enemy.takeDamage(damage);
        hit.push(enemy);
      }
    });

    return hit;
  }

  // ============================================================
  // [🧱 BLOCK: Resolve Hit vs Boss]
  // ============================================================
  resolveHitBoss(
    player:   Player,
    boss:     Boss,
    atkBonus: number
  ): boolean {
    if (!player.isAttacking || !player.equippedWeapon || !player.attackType) {
      return false;
    }

    const weapon  = player.equippedWeapon;
    const mode    = player.attackType;
    const atk     = weapon.getAttack(mode);
    const damage  = atk.damage + atkBonus;
    const facing  = (mode === 'heavy' && player.lockedFacing)
      ? player.lockedFacing
      : player.facing;

    const px = player.x + player.width  / 2;
    const py = player.y + player.height / 2;
    const bx = boss.x   + boss.width    / 2;
    const by = boss.y   + boss.height   / 2;

    if (weapon.hitTest(px, py, facing, mode, bx, by, boss.width, boss.height)) {
      boss.takeDamage(damage);
      return true;
    }
    return false;
  }

  // ============================================================
  // [🧱 BLOCK: Draw]
  // ============================================================
  draw(
    ctx:    CanvasRenderingContext2D,
    player: Player,
    camera: Camera
  ): void {
    if (!player.isAttacking || !player.equippedWeapon || !player.attackType) return;

    const mode   = player.attackType;
    const facing = (mode === 'heavy' && player.lockedFacing)
      ? player.lockedFacing
      : player.facing;

    const sx = camera.toScreenX(player.x + player.width  / 2);
    const sy = camera.toScreenY(player.y + player.height / 2);

    player.equippedWeapon.drawAttack(ctx, sx, sy, facing, mode);
  }
}