// src/engine/systems/WeaponSystem.ts
import { Player }    from "../Player";
import { Camera }    from "../Camera";
import { GameState } from "../GameState";
import { Weapon }    from "../items/Weapon";
import { BaseEnemy } from "../enemy/BaseEnemy";
import { Boss }      from "../enemy/Boss";

// ============================================================
// [🧱 BLOCK: WeaponSystem Class]
// Centralizes all weapon attack logic:
//   - processAttackInput() → reads J/K, fires attack if valid
//   - resolveHits()        → runs hitTest against enemies/boss
//   - draw()               → draws attack visual on canvas
//
// Called from HordeSystem and BossSystem each frame.
// ============================================================
export class WeaponSystem {

  // ============================================================
  // [🧱 BLOCK: Process Attack Input]
  // Called every frame — reads J/K input and starts attack
  // if conditions are met. Returns the mode that fired or null.
  // ============================================================
  processInput(player: Player): 'light' | 'heavy' | null {
    if (player.isAttacking || player.isDashing) return null;

    const weapon = player.equippedWeapon;
    const input  = player.lastInput;
    if (!input || !weapon) return null;

    // Light attack — J
    if (input.movement.light) {
      const atk = weapon.getAttack('light');
      if (player.stamina >= atk.staminaCost) {
        player.startWeaponAttack('light', atk);
        return 'light';
      }
    }

    // Heavy attack — K
    if (input.movement.heavy && player.heavyCooldown <= 0) {
      const atk = weapon.getAttack('heavy');
      if (player.stamina >= atk.staminaCost) {
        player.startWeaponAttack('heavy', atk);
        return 'heavy';
      }
    }

    return null;
  }

  // ============================================================
  // [🧱 BLOCK: Resolve Hits vs Enemies]
  // Returns list of enemies that were hit this frame.
  // ============================================================
  resolveHits(
    player:   Player,
    enemies:  BaseEnemy[],
    atkBonus: number
  ): BaseEnemy[] {
    if (!player.isAttacking || !player.equippedWeapon || !player.attackMode) {
      return [];
    }

    const weapon  = player.equippedWeapon;
    const mode    = player.attackMode;
    const atk     = weapon.getAttack(mode);
    const damage  = atk.damage + atkBonus;
    const facing  = player.lockedFacing ?? player.facing;

    const px = player.x + player.width  / 2;
    const py = player.y + player.height / 2;

    const hit: BaseEnemy[] = [];

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
    if (!player.isAttacking || !player.equippedWeapon || !player.attackMode) {
      return false;
    }

    const weapon  = player.equippedWeapon;
    const mode    = player.attackMode;
    const atk     = weapon.getAttack(mode);
    const damage  = atk.damage + atkBonus;
    const facing  = player.lockedFacing ?? player.facing;

    const px = player.x + player.width  / 2;
    const py = player.y + player.height / 2;
    const bx = boss.x  + boss.width     / 2;
    const by = boss.y  + boss.height    / 2;

    if (weapon.hitTest(px, py, facing, mode, bx, by, boss.width, boss.height)) {
      boss.takeDamage(damage);
      return true;
    }

    return false;
  }

  // ============================================================
  // [🧱 BLOCK: Draw Attack Visual]
  // Called from Player.draw() — draws the weapon hitbox shape.
  // ============================================================
  draw(
    ctx:    CanvasRenderingContext2D,
    player: Player,
    camera: Camera
  ) {
    if (!player.isAttacking || !player.equippedWeapon || !player.attackMode) return;

    const sx      = camera.toScreenX(player.x + player.width  / 2);
    const sy      = camera.toScreenY(player.y + player.height / 2);
    const facing  = player.lockedFacing ?? player.facing;

    player.equippedWeapon.drawAttack(ctx, sx, sy, facing, player.attackMode);
  }
}