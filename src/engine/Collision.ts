// src/engine/Collision.ts

// ============================================================
// [🧱 BLOCK: Rect Interface]
// Shared shape used by all AABB checks.
// Any object with x, y, width, height satisfies this.
// ============================================================
export interface Rect {
  x:      number;
  y:      number;
  width:  number;
  height: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

// ============================================================
// [🧱 BLOCK: AABB Overlap]
// Returns true if two axis-aligned rectangles intersect.
// Used by: enemy melee vs player, door collision (legacy),
//          boss body vs player.
// ============================================================
export function rectOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width  &&
    a.x + a.width  > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// ============================================================
// [🧱 BLOCK: Circle vs Rect]
// Returns true if a circle (cx, cy, r) overlaps a rectangle.
// Used by: GoldDrop/ItemDrop pickup, Tank knockback range.
// ============================================================
export function circleRect(
  cx: number, cy: number, r: number,
  rect: Rect
): boolean {
  const nearestX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
  const nearestY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < r * r;
}

// ============================================================
// [🧱 BLOCK: Circle vs Circle]
// Returns true if two circles overlap.
// Used by: boss slam AoE, ShopNPC/Door proximity checks,
//          Grunt dash-lunge range check.
// ============================================================
export function circleCircle(
  ax: number, ay: number, ar: number,
  bx: number, by: number, br: number
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const minDist = ar + br;
  return dx * dx + dy * dy < minDist * minDist;
}

// ============================================================
// [🧱 BLOCK: Circle vs Circle Squared Distance]
// Returns the squared distance between two circle centers.
// Use when you need the actual distance for comparisons
// but want to avoid the sqrt (e.g. sorting, range checks).
// ============================================================
export function distSq(
  ax: number, ay: number,
  bx: number, by: number
): number {
  return (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
}

export function dist(
  ax: number, ay: number,
  bx: number, by: number
): number {
  return Math.sqrt(distSq(ax, ay, bx, by));
}

// ============================================================
// [🧱 BLOCK: Proximity Check]
// Returns true if the CENTER of rect b is within `radius`
// pixels of the CENTER of rect a.
// Used by: Door.checkPlayerProximity, ShopNPC.checkPlayerProximity.
// ============================================================
export function withinRadius(a: Rect, b: Rect, radius: number): boolean {
  const acx = a.x + a.width  / 2;
  const acy = a.y + a.height / 2;
  const bcx = b.x + b.width  / 2;
  const bcy = b.y + b.height / 2;
  return distSq(acx, acy, bcx, bcy) < radius * radius;
}

// ============================================================
// [🧱 BLOCK: Point in Rect]
// Returns true if world point (px, py) is inside rect.
// ============================================================
export function pointInRect(px: number, py: number, rect: Rect): boolean {
  return (
    px >= rect.x &&
    px <= rect.x + rect.width &&
    py >= rect.y &&
    py <= rect.y + rect.height
  );
}

// ============================================================
// [🧱 BLOCK: Knockback Direction]
// Returns a normalized Vec2 pointing FROM `from` TOWARD `to`.
// Used by Tank.applyKnockback and any future push effects.
// Pass the center coords of each entity.
// Returns {x:0, y:1} as a safe fallback if centers overlap.
// ============================================================
export function knockbackDir(
  fromCX: number, fromCY: number,
  toCX:   number, toCY:   number
): Vec2 {
  const dx  = toCX - fromCX;
  const dy  = toCY - fromCY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.001) return { x: 0, y: 1 };
  return { x: dx / len, y: dy / len };
}

// ============================================================
// [🧱 BLOCK: Rect Center]
// Convenience — returns the center point of a Rect.
// ============================================================
export function rectCenter(r: Rect): Vec2 {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

// ============================================================
// [🧱 BLOCK: Melee Arc Hit Test]
// Checks if an arc-shaped melee hitbox (origin at attacker
// center, facing direction, half-angle) overlaps an enemy rect.
// Used by Grunt strike check and any future arc-melee enemies.
//
// Parameters
//   ox, oy      — attacker center (world space)
//   facing      — normalized direction vector
//   range       — arc radius
//   halfAngle   — half of the arc's angular width (radians)
//   target      — enemy Rect
// ============================================================
export function arcHitsRect(
  ox: number, oy: number,
  facing: Vec2,
  range: number,
  halfAngle: number,
  target: Rect
): boolean {
  const tcx = target.x + target.width  / 2;
  const tcy = target.y + target.height / 2;
  const dx  = tcx - ox;
  const dy  = tcy - oy;
  const d   = Math.sqrt(dx * dx + dy * dy);

  // Outside range (add target half-size as generous buffer)
  if (d > range + Math.max(target.width, target.height) / 2) return false;

  // Point-blank — always hits
  if (d < 10) return true;

  const facingAngle = Math.atan2(facing.y, facing.x);
  const targetAngle = Math.atan2(dy, dx);
  let   diff        = targetAngle - facingAngle;

  // Normalize to [-π, π]
  while (diff >  Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;

  return Math.abs(diff) <= halfAngle;
}

// ============================================================
// [🧱 BLOCK: Circle Pickup Check]
// Returns true when a pickup (at wx, wy with radius pr) is
// touched by the player rect.  Consolidates the identical
// logic in GoldDrop and ItemDrop.
// ============================================================
export function pickupOverlap(
  pickupX: number, pickupY: number, pickupRadius: number,
  player: Rect
): boolean {
  const px = player.x + player.width  / 2;
  const py = player.y + player.height / 2;
  return distSq(pickupX, pickupY, px, py) < (pickupRadius + player.width / 2) ** 2;
}