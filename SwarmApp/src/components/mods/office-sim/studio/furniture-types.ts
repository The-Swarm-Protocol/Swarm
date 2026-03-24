/** Office Sim — Furniture generation type definitions */

/* ═══════════════════════════════════════
   Furniture Categories
   ═══════════════════════════════════════ */

export type FurnitureCategory =
  | "desk"
  | "chair"
  | "plant"
  | "monitor"
  | "whiteboard"
  | "coffee-machine"
  | "server-rack"
  | "lamp"
  | "divider"
  | "couch";

export const FURNITURE_CATEGORIES: FurnitureCategory[] = [
  "desk",
  "chair",
  "plant",
  "monitor",
  "whiteboard",
  "coffee-machine",
  "server-rack",
  "lamp",
  "divider",
  "couch",
];

/** Display labels for UI */
export const FURNITURE_LABELS: Record<FurnitureCategory, string> = {
  desk: "Desk",
  chair: "Office Chair",
  plant: "Plant",
  monitor: "Monitor",
  whiteboard: "Whiteboard",
  "coffee-machine": "Coffee Machine",
  "server-rack": "Server Rack",
  lamp: "Desk Lamp",
  divider: "Room Divider",
  couch: "Couch",
};

/** Default scale per category (used when placing GLTF in scene) */
export const FURNITURE_SCALES: Record<FurnitureCategory, [number, number, number]> = {
  desk: [1.2, 0.8, 0.8],
  chair: [0.6, 0.9, 0.6],
  plant: [0.4, 0.6, 0.4],
  monitor: [0.5, 0.4, 0.1],
  whiteboard: [1.5, 1.2, 0.1],
  "coffee-machine": [0.3, 0.5, 0.3],
  "server-rack": [0.6, 1.8, 0.8],
  lamp: [0.2, 0.5, 0.2],
  divider: [1.5, 1.5, 0.1],
  couch: [1.6, 0.8, 0.8],
};

/* ═══════════════════════════════════════
   Generation Pipeline State
   ═══════════════════════════════════════ */

export type FurnitureGenerationStatus =
  | "pending"
  | "generating_3d"
  | "refining_3d"
  | "uploading"
  | "completed"
  | "failed";

export interface FurnitureMeshyState {
  previewTaskId?: string;
  refineTaskId?: string;
  status: "pending" | "preview" | "refine" | "uploading" | "done" | "failed";
  error?: string;
  progress?: number;
  /** Temporary Meshy download URL (retained ~3 days) */
  glbUrl?: string;
  /** Permanent Storacha CID after upload */
  storachaCid?: string;
  /** Storacha gateway URL */
  gatewayUrl?: string;
}

/* ═══════════════════════════════════════
   Firestore Document
   ═══════════════════════════════════════ */

export interface FurnitureGenerationTask {
  id: string;
  orgId: string;
  themeId: string;
  category: FurnitureCategory;
  prompt: string;
  requestedBy: string;
  status: FurnitureGenerationStatus;
  meshy: FurnitureMeshyState;
  createdAt: unknown; // serverTimestamp
  updatedAt: unknown;
  completedAt?: unknown;
}

/* ═══════════════════════════════════════
   Resolved Furniture Data (consumed by 3D renderer)
   ═══════════════════════════════════════ */

export interface OfficeFurnitureData {
  category: FurnitureCategory;
  themeId: string;
  /** Storacha gateway URL to the GLB */
  modelUrl: string;
  prompt?: string;
  generatedAt?: number;
}
