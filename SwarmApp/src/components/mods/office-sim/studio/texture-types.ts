/** Office Sim — Texture generation type definitions */

/* ═══════════════════════════════════════
   Texture Material Types
   ═══════════════════════════════════════ */

export type TextureMaterial =
  | "wood-floor"
  | "carpet"
  | "concrete-wall"
  | "glass-panel"
  | "brick-wall"
  | "tile-floor";

export const TEXTURE_MATERIALS: TextureMaterial[] = [
  "wood-floor",
  "carpet",
  "concrete-wall",
  "glass-panel",
  "brick-wall",
  "tile-floor",
];

export const TEXTURE_LABELS: Record<TextureMaterial, string> = {
  "wood-floor": "Wood Floor",
  carpet: "Carpet",
  "concrete-wall": "Concrete Wall",
  "glass-panel": "Glass Panel",
  "brick-wall": "Brick Wall",
  "tile-floor": "Tile Floor",
};

/* ═══════════════════════════════════════
   Generation Pipeline State
   ═══════════════════════════════════════ */

export type TextureGenerationStatus =
  | "pending"
  | "generating"
  | "uploading"
  | "completed"
  | "failed";

export interface TextureProviderState {
  predictionId?: string;
  provider: "replicate" | "self-hosted";
  status: "pending" | "generating" | "uploading" | "done" | "failed";
  error?: string;
  progress?: number;
  /** Temporary output URL */
  outputUrl?: string;
  filename?: string;
  /** Permanent Storacha CID */
  storachaCid?: string;
  /** Storacha gateway URL */
  gatewayUrl?: string;
}

/* ═══════════════════════════════════════
   Firestore Document
   ═══════════════════════════════════════ */

export interface TextureGenerationTask {
  id: string;
  orgId: string;
  themeId: string;
  material: TextureMaterial;
  prompt: string;
  requestedBy: string;
  status: TextureGenerationStatus;
  provider: TextureProviderState;
  createdAt: unknown; // serverTimestamp
  updatedAt: unknown;
  completedAt?: unknown;
}

/* ═══════════════════════════════════════
   Resolved Texture Data (consumed by renderer)
   ═══════════════════════════════════════ */

export interface OfficeTextureData {
  material: TextureMaterial;
  themeId: string;
  /** Storacha gateway URL to the texture PNG */
  textureUrl: string;
  prompt?: string;
  generatedAt?: number;
}
