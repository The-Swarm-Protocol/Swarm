/** Movement Animator — Walk path planning with corridor routing
 *
 * Adapted from WW-AI-Lab/openclaw-office movement-animator and position-allocator.
 * Provides corridor-aware walk path planning between office zones,
 * distance-proportional interpolation, and position allocation.
 *
 * The 2D walk system uses zone doorpoints so agents walk through
 * corridors rather than phasing through walls.
 */

import type { Position, AgentZone, OfficeLayout, DeskSlot, RoomConfig } from "../types";

/* ═══════════════════════════════════════
   Constants
   ═══════════════════════════════════════ */

/** Walk speed in canvas units per tick */
export const WALK_SPEED = 2.5;

/** Minimum distance before snapping to target */
export const ARRIVAL_THRESHOLD = 4;

/** Corridor Y position (horizontal spine connecting zones) */
export const CORRIDOR_Y = 140;

/** Zone doorpoints — where agents enter/exit each zone type */
export interface ZoneDoorpoint {
  zone: AgentZone;
  /** Room ID this doorpoint serves (null = general corridor) */
  roomId: string | null;
  position: Position;
}

/* ═══════════════════════════════════════
   Doorpoint Extraction
   ═══════════════════════════════════════ */

/**
 * Compute doorpoints for a layout.
 * Each room gets a doorpoint at the center of its top edge (corridor-facing).
 * The desk area gets a doorpoint at its corridor entrance.
 */
export function computeDoorpoints(layout: OfficeLayout): ZoneDoorpoint[] {
  const doors: ZoneDoorpoint[] = [];

  // Room doorpoints (center of top edge, offset into corridor)
  for (const room of layout.rooms) {
    const zoneType = roomTypeToZone(room.type);
    doors.push({
      zone: zoneType,
      roomId: room.id,
      position: {
        x: room.position.x + room.width / 2,
        y: room.position.y - 15, // just outside the room
      },
    });
  }

  // Desk area doorpoint (leftmost desk area, at corridor level)
  if (layout.desks.length > 0) {
    const minX = Math.min(...layout.desks.map((d) => d.position.x));
    doors.push({
      zone: "desk",
      roomId: null,
      position: { x: minX + 40, y: CORRIDOR_Y },
    });
  }

  return doors;
}

function roomTypeToZone(roomType: RoomConfig["type"]): AgentZone {
  switch (roomType) {
    case "meeting": return "meeting";
    case "server": return "server";
    case "break": return "break";
    case "error_bay": return "error_bay";
    default: return "corridor";
  }
}

/* ═══════════════════════════════════════
   Path Planning
   ═══════════════════════════════════════ */

/**
 * Plan a walk path between two positions, routing through corridor
 * doorpoints when crossing zone boundaries.
 *
 * Path segments:
 *   1. Current position → source zone doorpoint
 *   2. Source doorpoint → destination doorpoint (via corridor)
 *   3. Destination doorpoint → target position
 *
 * If source and target are in the same zone, returns a direct path.
 */
export function planWalkPath(
  from: Position,
  to: Position,
  fromZone: AgentZone,
  toZone: AgentZone,
  doorpoints: ZoneDoorpoint[],
): Position[] {
  // Same zone → direct path
  if (fromZone === toZone) {
    return [to];
  }

  const path: Position[] = [];

  // Find source doorpoint
  const sourceDoor = findNearestDoorpoint(from, fromZone, doorpoints);
  if (sourceDoor) {
    path.push(sourceDoor.position);
  }

  // If zones are far apart, add a corridor waypoint
  const destDoor = findNearestDoorpoint(to, toZone, doorpoints);
  if (sourceDoor && destDoor) {
    const dx = Math.abs(sourceDoor.position.x - destDoor.position.x);
    if (dx > 100) {
      // Add corridor midpoint for natural-looking walk
      path.push({
        x: (sourceDoor.position.x + destDoor.position.x) / 2,
        y: CORRIDOR_Y,
      });
    }
  }

  if (destDoor) {
    path.push(destDoor.position);
  }

  path.push(to);
  return path;
}

function findNearestDoorpoint(
  pos: Position,
  zone: AgentZone,
  doorpoints: ZoneDoorpoint[],
): ZoneDoorpoint | null {
  let best: ZoneDoorpoint | null = null;
  let bestDist = Infinity;

  for (const dp of doorpoints) {
    if (dp.zone !== zone) continue;
    const dist = Math.hypot(dp.position.x - pos.x, dp.position.y - pos.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = dp;
    }
  }

  return best;
}

/* ═══════════════════════════════════════
   Walk Interpolation
   ═══════════════════════════════════════ */

export interface WalkState {
  /** Current position */
  position: Position;
  /** Remaining waypoints in the path */
  waypoints: Position[];
  /** Walk speed multiplier */
  speed: number;
  /** Is currently walking? */
  isWalking: boolean;
  /** Direction facing (radians, 0 = right) */
  facing: number;
  /** Animation frame counter */
  frame: number;
}

/**
 * Tick a walk state forward by one frame.
 * Moves toward the next waypoint, pops it when reached.
 * Returns updated state (immutable).
 */
export function tickWalk(state: WalkState): WalkState {
  if (state.waypoints.length === 0) {
    return { ...state, isWalking: false };
  }

  const target = state.waypoints[0];
  const dx = target.x - state.position.x;
  const dy = target.y - state.position.y;
  const dist = Math.hypot(dx, dy);

  // Arrived at current waypoint
  if (dist < ARRIVAL_THRESHOLD) {
    const remaining = state.waypoints.slice(1);
    return {
      ...state,
      position: target,
      waypoints: remaining,
      isWalking: remaining.length > 0,
      frame: state.frame + 1,
    };
  }

  // Move toward waypoint
  const step = Math.min(state.speed * WALK_SPEED, dist);
  const nx = dx / dist;
  const ny = dy / dist;
  const facing = Math.atan2(dy, dx);

  return {
    ...state,
    position: {
      x: state.position.x + nx * step,
      y: state.position.y + ny * step,
    },
    isWalking: true,
    facing,
    frame: state.frame + 1,
  };
}

/**
 * Compute total remaining walk distance.
 */
export function remainingDistance(state: WalkState): number {
  if (state.waypoints.length === 0) return 0;

  let total = Math.hypot(
    state.waypoints[0].x - state.position.x,
    state.waypoints[0].y - state.position.y,
  );

  for (let i = 1; i < state.waypoints.length; i++) {
    total += Math.hypot(
      state.waypoints[i].x - state.waypoints[i - 1].x,
      state.waypoints[i].y - state.waypoints[i - 1].y,
    );
  }

  return total;
}

/**
 * Estimated ticks to arrive at destination.
 */
export function estimatedArrival(state: WalkState): number {
  const dist = remainingDistance(state);
  return Math.ceil(dist / (state.speed * WALK_SPEED));
}

/* ═══════════════════════════════════════
   Position Allocation
   ═══════════════════════════════════════ */

/**
 * Assign an agent to the nearest unoccupied desk.
 * Returns the desk slot, or null if all desks are taken.
 */
export function allocateDesk(
  agentId: string,
  agentPos: Position,
  desks: DeskSlot[],
  occupiedDeskIds: Set<string>,
): DeskSlot | null {
  let best: DeskSlot | null = null;
  let bestDist = Infinity;

  for (const desk of desks) {
    if (desk.assignedAgentId && desk.assignedAgentId !== agentId) continue;
    if (occupiedDeskIds.has(desk.id)) continue;

    const dist = Math.hypot(desk.position.x - agentPos.x, desk.position.y - agentPos.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = desk;
    }
  }

  return best;
}

/**
 * Get a random position inside a room's bounds (with padding).
 */
export function randomRoomPosition(room: RoomConfig, padding = 20): Position {
  return {
    x: room.position.x + padding + Math.random() * (room.width - padding * 2),
    y: room.position.y + padding + Math.random() * (room.height - padding * 2),
  };
}

/**
 * Get the center position of a desk slot (for seating).
 */
export function deskCenter(desk: DeskSlot): Position {
  return {
    x: desk.position.x + 40, // half desk width
    y: desk.position.y + 28, // half desk height
  };
}

/* ═══════════════════════════════════════
   Meeting Seat Allocation
   ═══════════════════════════════════════ */

/**
 * Compute meeting seat positions around a meeting room.
 * Returns positions arranged in a circle/oval within the room.
 */
export function computeMeetingSeats(
  room: RoomConfig,
  participantCount: number,
): Position[] {
  const cx = room.position.x + room.width / 2;
  const cy = room.position.y + room.height / 2;
  const rx = room.width * 0.35;
  const ry = room.height * 0.35;

  const seats: Position[] = [];
  for (let i = 0; i < participantCount; i++) {
    const angle = (i / participantCount) * Math.PI * 2 - Math.PI / 2;
    seats.push({
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry,
    });
  }

  return seats;
}

/**
 * Detect collaboration groups from active collaboration links.
 * Returns arrays of agent IDs that should be in meetings together.
 */
export function detectCollaborationGroups(
  links: Array<{ sourceId: string; targetId: string; strength: number }>,
  minStrength = 0.5,
): string[][] {
  // Build adjacency from strong links
  const adj = new Map<string, Set<string>>();
  for (const link of links) {
    if (link.strength < minStrength) continue;
    if (!adj.has(link.sourceId)) adj.set(link.sourceId, new Set());
    if (!adj.has(link.targetId)) adj.set(link.targetId, new Set());
    adj.get(link.sourceId)!.add(link.targetId);
    adj.get(link.targetId)!.add(link.sourceId);
  }

  // BFS to find connected components
  const visited = new Set<string>();
  const groups: string[][] = [];

  for (const agentId of adj.keys()) {
    if (visited.has(agentId)) continue;

    const group: string[] = [];
    const queue = [agentId];
    visited.add(agentId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      group.push(current);
      for (const neighbor of adj.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    if (group.length >= 2) {
      groups.push(group);
    }
  }

  return groups;
}
