// src/engine/RoomManager.ts

// ============================================================
// [🧱 BLOCK: Types]
// ============================================================
export type RoomPhase = 'horde' | 'elite' | 'boss' | 'victory';

export interface RoomState {
  floor:       number;
  roomInCycle: 1 | 2 | 3;
  roomDisplay: number;
  phase:       RoomPhase;
}

// ============================================================
// [🧱 BLOCK: Scaling Helpers]
// All functions work for any floor number — pure infinite scaling.
//
// Enemy HP:     +100% per floor  (floor 1=1× floor 10=10×)
// Enemy Speed:  +25% per floor   (soft cap feel — fast but killable)
// Boss HP:      +50% per floor   (ramps harder than horde)
// ============================================================
export function getEnemySpeedScale(floor: number): number {
  return 1 + (floor - 1) * 0.25;
}

export function getEnemyHpScale(floor: number): number {
  return 1 + (floor - 1) * 1.0;
}

export function getBossHpScale(floor: number): number {
  return 1 + (floor - 1) * 0.50;
}

// ============================================================
// [🧱 BLOCK: Room Display Number]
// Simple linear calculation: Floor 1 (Rooms 1,2,3), Floor 2 (Rooms 4,5,6), etc.
// ============================================================
export function getRoomDisplay(floor: number, roomInCycle: 1 | 2 | 3): number {
  return (floor - 1) * 3 + roomInCycle;
}

// ============================================================
// [🧱 BLOCK: Initial State]
// ============================================================
export function initialRoomState(): RoomState {
  return {
    floor:       1,
    roomInCycle: 1,
    roomDisplay: 1,
    phase:       'horde',
  };
}

// ============================================================
// [🧱 BLOCK: Advance Room]
// Room 1 → Room 2 (horde)
// Room 2 → Room 3 (elite)
// Room 3 → Boss
// ============================================================
export function advanceRoom(current: RoomState): RoomState {
  const { floor, roomInCycle } = current;

  if (roomInCycle === 1) {
    return {
      floor,
      roomInCycle: 2,
      roomDisplay: getRoomDisplay(floor, 2),
      phase:       'horde',
    };
  }

  if (roomInCycle === 2) {
    return {
      floor,
      roomInCycle: 3,
      roomDisplay: getRoomDisplay(floor, 3),
      phase:       'elite',
    };
  }

  // roomInCycle === 3 (elite cleared) → boss
  return { ...current, phase: 'boss' };
}

// ============================================================
// [🧱 BLOCK: Next Floor]
// Always advances — the run is infinite.
// ============================================================
export function nextFloor(current: RoomState): RoomState {
  const floor = current.floor + 1;
  return {
    floor,
    roomInCycle: 1,
    roomDisplay: getRoomDisplay(floor, 1),
    phase:       'horde',
  };
}

// ============================================================
// [🧱 BLOCK: Enter Boss Phase]
// Utility used by dev tools to skip directly to boss.
// ============================================================
export function enterBossPhase(current: RoomState): RoomState {
  return { ...current, phase: 'boss' };
}