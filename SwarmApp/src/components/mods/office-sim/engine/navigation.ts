/** Navigation — A* pathfinding on grid with obstacle awareness
 *
 * Adapted from Claw3D's retro-office/core/navigation.ts.
 * Grid-based A* with diagonal movement and corner-clip prevention.
 */

import type { FurnitureItem, NavGrid, Waypoint } from "./scene3d-types";
import { ITEM_METADATA } from "./scene3d-types";
import { NAV_CELL_SIZE, ASTAR_MAX_ITERATIONS, CANVAS_W, CANVAS_H } from "./scene3d-constants";

/* ═══════════════════════════════════════
   Grid Construction
   ═══════════════════════════════════════ */

/**
 * Build a navigation grid from the current furniture layout.
 * Cells occupied by items with `blocksNavigation: true` are marked as blocked.
 */
export function buildNavGrid(furniture: FurnitureItem[]): NavGrid {
  const cellSize = NAV_CELL_SIZE;
  const width = Math.ceil(CANVAS_W / cellSize);
  const height = Math.ceil(CANVAS_H / cellSize);
  const data = new Uint8Array(width * height); // 0 = free

  for (const item of furniture) {
    const meta = ITEM_METADATA[item.type];
    if (!meta?.blocksNavigation) continue;

    const iw = item.w ?? meta.defaultSize[0];
    const ih = item.h ?? meta.defaultSize[1];

    // Mark all cells overlapping this item as blocked
    const startCol = Math.floor(item.x / cellSize);
    const endCol = Math.ceil((item.x + iw) / cellSize);
    const startRow = Math.floor(item.y / cellSize);
    const endRow = Math.ceil((item.y + ih) / cellSize);

    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        if (col >= 0 && col < width && row >= 0 && row < height) {
          data[row * width + col] = 1;
        }
      }
    }
  }

  return { width, height, cellSize, data };
}

/* ═══════════════════════════════════════
   A* Pathfinding
   ═══════════════════════════════════════ */

interface AStarNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: AStarNode | null;
}

function heuristic(ax: number, ay: number, bx: number, by: number): number {
  // Chebyshev distance (allows diagonal)
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

function isBlocked(grid: NavGrid, col: number, row: number): boolean {
  if (col < 0 || col >= grid.width || row < 0 || row >= grid.height) return true;
  return grid.data[row * grid.width + col] === 1;
}

/**
 * Find a path from (sx, sy) to (ex, ey) using A* on the navigation grid.
 * Returns waypoints in canvas coordinates, or null if no path found.
 */
export function findPath(
  grid: NavGrid,
  sx: number,
  sy: number,
  ex: number,
  ey: number,
): Waypoint[] | null {
  const startCol = Math.floor(sx / grid.cellSize);
  const startRow = Math.floor(sy / grid.cellSize);
  let endCol = Math.floor(ex / grid.cellSize);
  let endRow = Math.floor(ey / grid.cellSize);

  // Clamp to grid bounds
  const clampCol = (c: number) => Math.max(0, Math.min(grid.width - 1, c));
  const clampRow = (r: number) => Math.max(0, Math.min(grid.height - 1, r));

  // If start or end is blocked, find nearest free cell
  const startFree = findNearestFreeCell(grid, clampCol(startCol), clampRow(startRow));
  const endFree = findNearestFreeCell(grid, clampCol(endCol), clampRow(endRow));
  if (!startFree || !endFree) return null;

  const sc = startFree.x;
  const sr = startFree.y;
  endCol = endFree.x;
  endRow = endFree.y;

  if (sc === endCol && sr === endRow) {
    return [{ x: ex, y: ey }];
  }

  // A* with open/closed sets
  const openSet: AStarNode[] = [];
  const closedSet = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;

  const startNode: AStarNode = {
    x: sc,
    y: sr,
    g: 0,
    h: heuristic(sc, sr, endCol, endRow),
    f: 0,
    parent: null,
  };
  startNode.f = startNode.g + startNode.h;
  openSet.push(startNode);

  const bestG = new Map<string, number>();
  bestG.set(key(sc, sr), 0);

  // 8-directional neighbors
  const dirs = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0],           [1, 0],
    [-1, 1],  [0, 1],  [1, 1],
  ];

  let iterations = 0;

  while (openSet.length > 0 && iterations < ASTAR_MAX_ITERATIONS) {
    iterations++;

    // Find node with lowest f
    let bestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[bestIdx].f) bestIdx = i;
    }
    const current = openSet[bestIdx];
    openSet.splice(bestIdx, 1);

    if (current.x === endCol && current.y === endRow) {
      // Reconstruct path
      return reconstructPath(current, grid.cellSize, ex, ey);
    }

    const currentKey = key(current.x, current.y);
    if (closedSet.has(currentKey)) continue;
    closedSet.add(currentKey);

    for (const [dx, dy] of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;

      if (isBlocked(grid, nx, ny)) continue;

      // Prevent diagonal corner clipping
      if (dx !== 0 && dy !== 0) {
        if (isBlocked(grid, current.x + dx, current.y) || isBlocked(grid, current.x, current.y + dy)) {
          continue;
        }
      }

      const neighborKey = key(nx, ny);
      if (closedSet.has(neighborKey)) continue;

      const moveCost = (dx !== 0 && dy !== 0) ? Math.SQRT2 : 1;
      const tentativeG = current.g + moveCost;

      const existingG = bestG.get(neighborKey);
      if (existingG !== undefined && tentativeG >= existingG) continue;

      bestG.set(neighborKey, tentativeG);

      const h = heuristic(nx, ny, endCol, endRow);
      openSet.push({
        x: nx,
        y: ny,
        g: tentativeG,
        h,
        f: tentativeG + h,
        parent: current,
      });
    }
  }

  return null; // No path found
}

function reconstructPath(
  endNode: AStarNode,
  cellSize: number,
  finalX: number,
  finalY: number,
): Waypoint[] {
  const cells: { x: number; y: number }[] = [];
  let node: AStarNode | null = endNode;
  while (node) {
    cells.push({ x: node.x, y: node.y });
    node = node.parent;
  }
  cells.reverse();

  // Convert grid cells to canvas waypoints (center of cell)
  const waypoints: Waypoint[] = cells.map((c) => ({
    x: (c.x + 0.5) * cellSize,
    y: (c.y + 0.5) * cellSize,
  }));

  // Replace last waypoint with exact target
  if (waypoints.length > 0) {
    waypoints[waypoints.length - 1] = { x: finalX, y: finalY };
  }

  return waypoints;
}

/**
 * Find the nearest free cell to (col, row) using BFS.
 */
function findNearestFreeCell(
  grid: NavGrid,
  col: number,
  row: number,
): { x: number; y: number } | null {
  if (!isBlocked(grid, col, row)) return { x: col, y: row };

  const visited = new Set<string>();
  const queue: { x: number; y: number }[] = [{ x: col, y: row }];
  const key = (x: number, y: number) => `${x},${y}`;
  visited.add(key(col, row));

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const k = key(nx, ny);
      if (visited.has(k)) continue;
      visited.add(k);

      if (nx < 0 || nx >= grid.width || ny < 0 || ny >= grid.height) continue;

      if (!isBlocked(grid, nx, ny)) return { x: nx, y: ny };
      queue.push({ x: nx, y: ny });
    }

    if (visited.size > 200) break; // Safety limit
  }

  return null;
}

/* ═══════════════════════════════════════
   Coordinate Transforms
   ═══════════════════════════════════════ */

import { SCALE } from "./scene3d-constants";

/** Convert 2D canvas coordinates to 3D world coordinates */
export function toWorld(canvasX: number, canvasY: number): [number, number, number] {
  return [
    (canvasX - CANVAS_W / 2) * SCALE,
    0,
    (canvasY - CANVAS_H / 2) * SCALE,
  ];
}

/** Convert 3D world coordinates to 2D canvas coordinates */
export function toCanvas(worldX: number, worldZ: number): { x: number; y: number } {
  return {
    x: worldX / SCALE + CANVAS_W / 2,
    y: worldZ / SCALE + CANVAS_H / 2,
  };
}

/** Get item bounds in canvas coordinates */
export function getItemBounds(item: FurnitureItem): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const meta = ITEM_METADATA[item.type];
  return {
    x: item.x,
    y: item.y,
    w: item.w ?? meta?.defaultSize[0] ?? 40,
    h: item.h ?? meta?.defaultSize[1] ?? 40,
  };
}

/** Convert item facing (degrees) to radians */
export function getItemRotation(item: FurnitureItem): number {
  return ((item.facing ?? 0) * Math.PI) / 180;
}

/* ═══════════════════════════════════════
   Roaming Points (default wandering targets)
   ═══════════════════════════════════════ */

export const ROAM_POINTS: Waypoint[] = [
  { x: 300, y: 200 },
  { x: 600, y: 200 },
  { x: 900, y: 200 },
  { x: 1200, y: 200 },
  { x: 300, y: 500 },
  { x: 600, y: 500 },
  { x: 900, y: 500 },
  { x: 1200, y: 500 },
  { x: 450, y: 350 },
  { x: 750, y: 350 },
  { x: 1050, y: 350 },
];
