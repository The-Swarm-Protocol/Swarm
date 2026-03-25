/** 3D Geometry Helpers — Coordinate transforms, matrix builders, collision
 *
 * Adapted from Claw3D's retro-office/core/geometry.ts.
 * Provides utilities for positioning furniture and agents in 3D space.
 */

import * as THREE from "three";
import type { FurnitureItem } from "./scene3d-types";
import { ITEM_METADATA } from "./scene3d-types";
import { SCALE, CANVAS_W, CANVAS_H, AGENT_RADIUS } from "./scene3d-constants";

/* ═══════════════════════════════════════
   Coordinate Transforms
   ═══════════════════════════════════════ */

/** Convert 2D canvas position to 3D world position */
export function canvasToWorld(canvasX: number, canvasY: number, elevation = 0): THREE.Vector3 {
  return new THREE.Vector3(
    (canvasX - CANVAS_W / 2) * SCALE,
    elevation * SCALE,
    (canvasY - CANVAS_H / 2) * SCALE,
  );
}

/** Convert 3D world position to 2D canvas position */
export function worldToCanvas(world: THREE.Vector3): { x: number; y: number } {
  return {
    x: world.x / SCALE + CANVAS_W / 2,
    y: world.z / SCALE + CANVAS_H / 2,
  };
}

/* ═══════════════════════════════════════
   Item Sizing
   ═══════════════════════════════════════ */

/** Get the base size of a furniture item in canvas units */
export function getItemBaseSize(item: FurnitureItem): { w: number; h: number } {
  const meta = ITEM_METADATA[item.type];
  return {
    w: item.w ?? meta?.defaultSize[0] ?? 40,
    h: item.h ?? meta?.defaultSize[1] ?? 40,
  };
}

/** Get item rotation in radians */
export function getItemRotationRadians(item: FurnitureItem): number {
  return ((item.facing ?? 0) * Math.PI) / 180;
}

/** Get axis-aligned bounding box in canvas coords */
export function getItemAABB(item: FurnitureItem): {
  minX: number; minY: number;
  maxX: number; maxY: number;
} {
  const { w, h } = getItemBaseSize(item);
  return {
    minX: item.x,
    minY: item.y,
    maxX: item.x + w,
    maxY: item.y + h,
  };
}

/* ═══════════════════════════════════════
   Matrix Building (for instanced meshes)
   ═══════════════════════════════════════ */

const _tempMatrix = new THREE.Matrix4();
const _tempPosition = new THREE.Vector3();
const _tempQuaternion = new THREE.Quaternion();
const _tempScale = new THREE.Vector3();
const _tempEuler = new THREE.Euler();

/**
 * Build a transformation matrix for a furniture item.
 * Used for instanced mesh rendering.
 */
export function buildFurnitureMatrix(
  item: FurnitureItem,
  modelScale = 1,
): THREE.Matrix4 {
  const { w, h } = getItemBaseSize(item);
  const centerX = item.x + w / 2;
  const centerY = item.y + h / 2;
  const elevation = item.elevation ?? 0;

  _tempPosition.set(
    (centerX - CANVAS_W / 2) * SCALE,
    elevation * SCALE,
    (centerY - CANVAS_H / 2) * SCALE,
  );

  const rotY = getItemRotationRadians(item);
  _tempEuler.set(0, rotY, 0);
  _tempQuaternion.setFromEuler(_tempEuler);

  const s = modelScale;
  _tempScale.set(s, s, s);

  _tempMatrix.compose(_tempPosition, _tempQuaternion, _tempScale);
  return _tempMatrix.clone();
}

/* ═══════════════════════════════════════
   Wall Geometry
   ═══════════════════════════════════════ */

/**
 * Create a wall FurnitureItem from start/end points.
 */
export function createWallItem(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  thickness = 8,
): FurnitureItem {
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  return {
    _uid: `wall-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: "wall",
    x: Math.min(startX, endX),
    y: Math.min(startY, endY) - thickness / 2,
    w: length,
    h: thickness,
    facing: angle,
  };
}

/* ═══════════════════════════════════════
   Collision Detection
   ═══════════════════════════════════════ */

/**
 * Check if two agents are colliding (circle-circle).
 */
export function agentsCollide(
  ax: number, ay: number,
  bx: number, by: number,
  radius = AGENT_RADIUS,
): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const distSq = dx * dx + dy * dy;
  const minDist = radius * 2;
  return distSq < minDist * minDist;
}

/**
 * Separate two colliding agents by pushing them apart equally.
 * Returns new positions for both agents.
 */
export function separateAgents(
  ax: number, ay: number,
  bx: number, by: number,
  radius = AGENT_RADIUS,
): { a: { x: number; y: number }; b: { x: number; y: number } } {
  const dx = ax - bx;
  const dy = ay - by;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minDist = radius * 2;

  if (dist >= minDist || dist === 0) {
    return { a: { x: ax, y: ay }, b: { x: bx, y: by } };
  }

  const overlap = (minDist - dist) / 2;
  const nx = dx / dist;
  const ny = dy / dist;

  return {
    a: { x: ax + nx * overlap, y: ay + ny * overlap },
    b: { x: bx - nx * overlap, y: by - ny * overlap },
  };
}

/**
 * Check if a point is inside a furniture item's AABB.
 */
export function pointInItem(
  px: number, py: number,
  item: FurnitureItem,
): boolean {
  const { minX, minY, maxX, maxY } = getItemAABB(item);
  return px >= minX && px <= maxX && py >= minY && py <= maxY;
}

/* ═══════════════════════════════════════
   Snap to Grid
   ═══════════════════════════════════════ */

import { SNAP_GRID } from "./scene3d-constants";

/** Snap a value to the nearest grid point */
export function snapToGrid(value: number): number {
  return Math.round(value / SNAP_GRID) * SNAP_GRID;
}

/** Snap a position to the nearest grid point */
export function snapPositionToGrid(x: number, y: number): { x: number; y: number } {
  return { x: snapToGrid(x), y: snapToGrid(y) };
}
