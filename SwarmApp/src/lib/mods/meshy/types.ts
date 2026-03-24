/** Meshy.ai API — Type definitions */

export interface MeshyTask {
  id: string;
  mode: "preview" | "refine";
  status: "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "EXPIRED" | "CANCELED";
  progress: number;
  model_urls?: { glb?: string; fbx?: string; usdz?: string; obj?: string };
  thumbnail_url?: string;
  created_at: number;
  expires_at?: number;
}

export interface MeshyRigTask {
  id: string;
  status: "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELED";
  progress: number;
  rigged_character_glb_url?: string;
  rigged_character_fbx_url?: string;
  basic_animations?: {
    walking_glb_url?: string;
    running_glb_url?: string;
  };
}

export interface MeshyAnimationTask {
  id: string;
  status: "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELED";
  progress: number;
  animation_glb_url?: string;
  animation_fbx_url?: string;
}

/**
 * Pre-defined animation IDs from Meshy's library.
 * Relevant for office/work scenarios.
 */
export const OFFICE_ANIMATIONS = {
  idle: 0,
  walking: 1,
  sit_idle_f: 32,
  sit_idle_m: 33,
  talking: 285,
} as const;

export type OfficeAnimationName = keyof typeof OFFICE_ANIMATIONS;
