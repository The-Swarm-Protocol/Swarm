/**
 * POST /api/v1/mods/office-sim/generate-office
 *
 * Batch-create furniture + texture generation tasks for a theme.
 * Creates ~8 tasks (6 furniture categories + 2 textures).
 *
 * Auth: x-wallet-address
 *
 * Body:
 *   orgId   — Organization ID (required)
 *   themeId — Theme ID (required)
 */

import { NextRequest } from "next/server";
import { getWalletAddress } from "@/lib/auth-guard";
import { isMeshyConfigured } from "@/lib/mods/meshy/client";
import { isImageGenerationConfigured } from "@/lib/mods/comfyui/provider";
import { getProvider } from "@/lib/mods/comfyui/provider";
import {
  createFurnitureTask,
  getActiveFurnitureTask,
} from "@/components/mods/office-sim/studio/furniture-firestore";
import {
  createTextureTask,
  getActiveTextureTask,
} from "@/components/mods/office-sim/studio/texture-firestore";
import {
  FURNITURE_LABELS,
  type FurnitureCategory,
} from "@/components/mods/office-sim/studio/furniture-types";
import {
  TEXTURE_LABELS,
  type TextureMaterial,
} from "@/components/mods/office-sim/studio/texture-types";
import { THEME_PRESETS } from "@/components/mods/office-sim/themes";

/** Essential furniture for a complete office look */
const BATCH_FURNITURE: FurnitureCategory[] = [
  "desk",
  "chair",
  "plant",
  "whiteboard",
  "coffee-machine",
  "lamp",
];

/** Essential textures for the office */
const BATCH_TEXTURES: TextureMaterial[] = [
  "wood-floor",
  "concrete-wall",
];

export async function POST(req: NextRequest) {
  const wallet = getWalletAddress(req);
  if (!wallet) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: { orgId?: string; themeId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const orgId = body.orgId?.trim();
  const themeId = body.themeId?.trim();

  if (!orgId || !themeId) {
    return Response.json(
      { error: "Required fields: orgId, themeId" },
      { status: 400 },
    );
  }

  const theme = THEME_PRESETS.find((t) => t.id === themeId);
  if (!theme) {
    return Response.json(
      { error: `Unknown theme: ${themeId}` },
      { status: 400 },
    );
  }

  const hasMeshy = isMeshyConfigured();
  const hasImageGen = isImageGenerationConfigured();

  if (!hasMeshy && !hasImageGen) {
    return Response.json(
      { error: "No generation pipelines configured. Set MESHY_API_KEY and/or REPLICATE_API_TOKEN." },
      { status: 503 },
    );
  }

  const taskIds: { type: "furniture" | "texture"; id: string; category: string }[] = [];
  const skipped: string[] = [];

  // Create furniture tasks
  if (hasMeshy) {
    for (const category of BATCH_FURNITURE) {
      const existing = await getActiveFurnitureTask(orgId, themeId, category);
      if (existing) {
        skipped.push(`furniture:${category}`);
        taskIds.push({ type: "furniture", id: existing.id, category });
        continue;
      }

      const label = FURNITURE_LABELS[category];
      const prompt = `${label}, ${theme.furnitureStylePrompt}, office furniture, 3D model, high quality`;
      const taskId = await createFurnitureTask({
        orgId,
        themeId,
        category,
        prompt,
        requestedBy: wallet,
        status: "pending",
        meshy: { status: "pending" },
      });
      taskIds.push({ type: "furniture", id: taskId, category });
    }
  }

  // Create texture tasks
  if (hasImageGen) {
    const provider = getProvider();
    for (const material of BATCH_TEXTURES) {
      const existing = await getActiveTextureTask(orgId, themeId, material);
      if (existing) {
        skipped.push(`texture:${material}`);
        taskIds.push({ type: "texture", id: existing.id, category: material });
        continue;
      }

      const label = TEXTURE_LABELS[material];
      const prompt = `seamless tileable ${label} texture, ${theme.textureStylePrompt}, photorealistic PBR, top-down view, high resolution`;
      const taskId = await createTextureTask({
        orgId,
        themeId,
        material,
        prompt,
        requestedBy: wallet,
        status: "pending",
        provider: { status: "pending", provider },
      });
      taskIds.push({ type: "texture", id: taskId, category: material });
    }
  }

  return Response.json({
    ok: true,
    themeId,
    tasks: taskIds,
    skipped,
    total: taskIds.length,
  });
}
