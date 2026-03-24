/**
 * Meshy.ai API Client — Server-side only
 *
 * Full pipeline: text-to-3d (preview → refine) → auto-rig → animate
 * Follows the lazy-init pattern from src/lib/mods/gemini/client.ts.
 */

import type { MeshyTask, MeshyRigTask, MeshyAnimationTask } from "./types";

const MESHY_BASE = "https://api.meshy.ai/openapi";

function getApiKey(): string {
  const key = process.env.MESHY_API_KEY;
  if (!key) throw new Error("MESHY_API_KEY is not set");
  return key;
}

export function isMeshyConfigured(): boolean {
  return !!process.env.MESHY_API_KEY;
}

async function meshyFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${MESHY_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Meshy API ${res.status}: ${body}`);
  }

  return res.json();
}

/* ═══════════════════════════════════════
   Step 1: Create preview (mesh only)
   ═══════════════════════════════════════ */

export async function createPreview(prompt: string): Promise<string> {
  const data = await meshyFetch<{ result: string }>("/v2/text-to-3d", {
    method: "POST",
    body: JSON.stringify({
      mode: "preview",
      prompt,
      topology: "triangle",
      target_polycount: 30000,
      pose_mode: "a-pose",
      ai_model: "meshy-6",
      target_formats: ["glb"],
    }),
  });
  return data.result; // task ID
}

/* ═══════════════════════════════════════
   Step 2: Refine preview (add textures)
   ═══════════════════════════════════════ */

export async function refineModel(previewTaskId: string): Promise<string> {
  const data = await meshyFetch<{ result: string }>("/v2/text-to-3d", {
    method: "POST",
    body: JSON.stringify({
      mode: "refine",
      preview_task_id: previewTaskId,
      enable_pbr: true,
      ai_model: "meshy-6",
      target_formats: ["glb"],
    }),
  });
  return data.result;
}

/* ═══════════════════════════════════════
   Step 3: Auto-rig the model
   ═══════════════════════════════════════ */

export async function rigModel(inputTaskId: string): Promise<string> {
  const data = await meshyFetch<{ result: string }>("/v1/rigging", {
    method: "POST",
    body: JSON.stringify({
      input_task_id: inputTaskId,
    }),
  });
  return data.result;
}

/* ═══════════════════════════════════════
   Step 4: Generate animation
   ═══════════════════════════════════════ */

export async function generateAnimation(
  rigTaskId: string,
  actionId: number,
): Promise<string> {
  const data = await meshyFetch<{ result: string }>("/v1/animations", {
    method: "POST",
    body: JSON.stringify({
      rig_task_id: rigTaskId,
      action_id: actionId,
    }),
  });
  return data.result;
}

/* ═══════════════════════════════════════
   Poll task status (generic for all endpoints)
   ═══════════════════════════════════════ */

export async function getTextTo3DStatus(taskId: string): Promise<MeshyTask> {
  return meshyFetch<MeshyTask>(`/v2/text-to-3d/${taskId}`);
}

export async function getRigStatus(taskId: string): Promise<MeshyRigTask> {
  return meshyFetch<MeshyRigTask>(`/v1/rigging/${taskId}`);
}

export async function getAnimationStatus(
  taskId: string,
): Promise<MeshyAnimationTask> {
  return meshyFetch<MeshyAnimationTask>(`/v1/animations/${taskId}`);
}

/* ═══════════════════════════════════════
   Download model file as Buffer
   ═══════════════════════════════════════ */

export async function downloadModel(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download model: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
