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
// Per-floor display: resets to 1 each floor.
// Room 1 = horde, Room 2 = horde, Room 3 = elite, Room 4 = boss.
// roomInCycle maps directly to roomDisplay within the floor.
// ============================================================
export function getRoomDisplay(floor: number, roomInCycle: 1 | 2 | 3): number {
  return roomInCycle;
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
// Per-floor room numbering: 1,2,3,4 each floor regardless of
// which floor the player is on.
//
// Room 1 (horde)  → Room 2 (horde)
// Room 2 (horde)  → Room 3 (elite)
// Room 3 (elite)  → Room 4 (boss)
// ============================================================
export function advanceRoom(current: RoomState): RoomState {
  const { floor, roomInCycle } = current;

  if (roomInCycle === 1) {
    return {
      floor,
      roomInCycle: 2,
      roomDisplay: 2,
      phase:       'horde',
    };
  }

  if (roomInCycle === 2) {
    return {
      floor,
      roomInCycle: 3,
      roomDisplay: 3,
      phase:       'elite',
    };
  }

  // roomInCycle === 3 (elite cleared) → boss (room 4 within floor)
  return { ...current, roomDisplay: 4, phase: 'boss' };
}

// ============================================================
// [🧱 BLOCK: Next Floor]
// Always advances — the run is infinite.
// roomDisplay resets to 1 for the new floor.
// ============================================================
export function nextFloor(current: RoomState): RoomState {
  const floor = current.floor + 1;
  return {
    floor,
    roomInCycle: 1,
    roomDisplay: 1,
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