// src/engine/systems/WeaponSystem.ts
import { Player }  from "../Player";
import { Camera }  from "../Camera";
import { Grunt }   from "../enemy/Grunt";
import { Shooter } from "../enemy/Shooter";
import { Boss }    from "../enemy/Boss";

// ============================================================
// [🧱 BLOCK: WeaponSystem Class]
// Centralizes all weapon attack logic:
//   - processInput()    → reads J/K, fires attack if valid
//   - resolveHits()     → hitTest against horde enemies
//   - resolveHitBoss()  → hitTest against boss
//   - draw()            → draws attack visual on canvas
// ============================================================
export class WeaponSystem {

  // ============================================================
  // [🧱 BLOCK: Process Attack Input]
  // Called every frame from HordeSystem/BossSystem update().
  // Reads J/K from player.lastInput and starts the attack
  // if stamina + cooldown conditions are met.
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

    // Heavy attack — K (requires cooldown elapsed)
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
  // [🧱 BLOCK: Get Effective Facing]
  // If the player never moved, facing is { x:0, y:1 } (down).
  // Instead, aim toward the nearest enemy so stationary
  // attacks don't always miss.
  // Falls back to lockedFacing → facing → nearest enemy.
  // ============================================================
  private getEffectiveFacing(
    player:  Player,
    targets: { x: number; y: number; width: number; height: number; isDead: boolean }[]
  ): { x: number; y: number } {
    // Heavy always uses locked facing
    if (player.lockedFacing) return player.lockedFacing;

    // If player has moved (facing isn't exactly default down) use it
    const f = player.facing;
    const isDefault = f.x === 0 && f.y === 1;
    if (!isDefault) return f;

    // Stationary player — aim toward nearest living enemy
    const px = player.x + player.width  / 2;
    const py = player.y + player.height / 2;

    let nearestDist = Infinity;
    let nearestDir  = f;

    targets.forEach((t) => {
      if (t.isDead) return;
      const dx   = (t.x + t.width  / 2) - px;
      const dy   = (t.y + t.height / 2) - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        const len   = dist || 1;
        nearestDir  = { x: dx / len, y: dy / len };
      }
    });

    return nearestDir;
  }
// ============================================================
  // [🧱 BLOCK: Resolve Hits vs Enemies]
  // ============================================================
  resolveHits(
    player:   Player,
    enemies:  (Grunt | Shooter)[],
    atkBonus: number
  ): (Grunt | Shooter)[] {
    if (!player.isAttacking || !player.equippedWeapon || !player.attackMode) {
      return [];
    }

    const weapon  = player.equippedWeapon;
    const mode    = player.attackMode;
    const atk     = weapon.getAttack(mode);
    const damage  = atk.damage + atkBonus;
    
    // 🧱 CRITICAL FIX: Use lockedFacing for Heavy, otherwise regular facing
    const facing  = player.lockedFacing ?? player.facing;

    // 🧱 CRITICAL FIX: hitTest expects the CENTER of the player
    const px = player.x + player.width  / 2;
    const py = player.y + player.height / 2;

    const hit: (Grunt | Shooter)[] = [];

    enemies.forEach((enemy) => {
      if (enemy.isDead) return;

      // 🧱 CRITICAL FIX: hitTest expects the CENTER of the enemy
      const ex = enemy.x + enemy.width  / 2;
      const ey = enemy.y + enemy.height / 2;

      // We pass World Coordinates (px, py) and (ex, ey)
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

    const weapon = player.equippedWeapon;
    const mode   = player.attackMode;
    const atk    = weapon.getAttack(mode);
    const damage = atk.damage + atkBonus;
    const facing = this.getEffectiveFacing(player, [boss]);

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
  // [🧱 BLOCK: Draw Attack Visual]
  // ============================================================
  draw(
    ctx:    CanvasRenderingContext2D,
    player: Player,
    camera: Camera
  ) {
    if (!player.isAttacking || !player.equippedWeapon || !player.attackMode) return;

    const sx     = camera.toScreenX(player.x + player.width  / 2);
    const sy     = camera.toScreenY(player.y + player.height / 2);
    const facing = player.lockedFacing ?? player.facing;

    player.equippedWeapon.drawAttack(ctx, sx, sy, facing, player.attackMode);
  }
}