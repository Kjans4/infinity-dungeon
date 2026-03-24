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
// [🧱 BLOCK: Scaling Helpers]
// ============================================================
export function getEnemySpeedScale(floor: number): number {
  return 1 + (floor - 1) * 0.15;
}
export function getEnemyHpScale(floor: number): number {
  return 1 + (floor - 1) * 0.20;
}
export function getBossHpScale(floor: number): number {
  return 1 + (floor - 1) * 0.30;
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
    // Go to shop placeholder before boss
    return {
      floor,
      roomInCycle: 3,
      roomDisplay: getRoomDisplay(floor, 3),
      phase:       'shop',
    };
  }

  // roomInCycle 3 = boss just beaten, handled by GameCanvas
  return current;
}

// ============================================================
// [🧱 BLOCK: Next Floor]
// Called after victory screen is dismissed.
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
// Called by GameCanvas after shop is dismissed.
// ============================================================
export function enterBossPhase(current: RoomState): RoomState {
  return {
    ...current,
    phase: 'boss',
  };
}