// src/engine/RoomManager.ts

// ============================================================
// [🧱 BLOCK: Types]
// ============================================================
export type RoomPhase = 'horde' | 'boss' | 'shop' | 'victory';

export interface RoomState {
  floor:       number;
  roomInCycle: 1 | 2 | 3;
  roomDisplay: number;
  phase:       RoomPhase;
}

// ============================================================
// [🧱 BLOCK: Win Condition]
// After clearing the boss on MAX_FLOORS the run is won.
// Raise this number to add more floors — no other code changes needed.
// ============================================================
export const MAX_FLOORS = 5;

export function isFinalFloor(floor: number): boolean {
  return floor >= MAX_FLOORS;
}

// ============================================================
// [🧱 BLOCK: Scaling Helpers]
// Using Floor 1 as the base for all multiplication.
//
// HP:    doubles each floor  → F1=1×  F2=2×  F3=3×  F4=4×
// Speed: grows gently        → F1=1×  F2=1.25×  F3=1.5×  F4=1.75×
//
// Speed is kept gentler than HP so enemies don't become
// impossible to kite at high floors while still feeling faster.
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
// Floor 1: 1,2,3 | Floor 2: 4,5,6 | Floor 3: 7,8,9
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
// Called when player walks through the door.
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
      phase:       'shop',
    };
  }

  return current;
}

// ============================================================
// [🧱 BLOCK: Next Floor]
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
// ============================================================
export function enterBossPhase(current: RoomState): RoomState {
  return { ...current, phase: 'boss' };
}