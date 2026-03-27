/**
 * POST /api/v1/mods/office-sim/generate-office
 *
 * Batch-create ALL generation tasks for a complete office setup:
 *   - Furniture (Meshy 3D): desk, chair, plant, whiteboard, coffee-machine, lamp
 *   - Textures (ComfyUI/Replicate): wood-floor, concrete-wall
 *   - Art — 2D pieces (ComfyUI): wall paintings, poster, mural
 *   - Art — 3D pieces (Meshy): sculpture, trophy, plant, vase, desk ornament
 *
 * Uses theme-aware default prompts so no manual input is needed.
 *
 * Auth: x-wallet-address
 *
 * Body:
 *   orgId   — Organization ID (required)
 *   themeId — Theme ID (required)
 *   skip    — Optional array of task types to skip: "furniture" | "texture" | "art"
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
  createArtTask,
  getActiveArtTask,
} from "@/components/mods/office-sim/studio/art-firestore";
import {
  FURNITURE_LABELS,
  type FurnitureCategory,
} from "@/components/mods/office-sim/studio/furniture-types";
import {
  TEXTURE_LABELS,
  type TextureMaterial,
} from "@/components/mods/office-sim/studio/texture-types";
import {
  DEFAULT_ART_SLOTS,
  ART_PIPELINE,
  ART_LABELS,
  getDefaultArtPrompt,
} from "@/components/mods/office-sim/studio/art-types";
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

  let body: { orgId?: string; themeId?: string; skip?: string[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const orgId = body.orgId?.trim();
  const themeId = body.themeId?.trim();
  const skipTypes = new Set(body.skip || []);

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

  const taskIds: { type: "furniture" | "texture" | "art"; id: string; category: string; pipeline?: string }[] = [];
  const skipped: string[] = [];

  // ── Furniture (Meshy 3D) ───────────────────────────────
  if (hasMeshy && !skipTypes.has("furniture")) {
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

  // ── Textures (ComfyUI/Replicate 2D) ───────────────────
  if (hasImageGen && !skipTypes.has("texture")) {
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

  // ── Art — all 8 default slots (Meshy 3D + ComfyUI 2D) ─
  if (!skipTypes.has("art")) {
    for (const slot of DEFAULT_ART_SLOTS) {
      const pipeline = ART_PIPELINE[slot.category];

      // Skip if the required pipeline isn't configured
      if (pipeline === "meshy" && !hasMeshy) {
        skipped.push(`art:${slot.id}:no-meshy`);
        continue;
      }
      if (pipeline === "comfyui" && !hasImageGen) {
        skipped.push(`art:${slot.id}:no-comfyui`);
        continue;
      }

      // Skip if already has an active task
      const existing = await getActiveArtTask(orgId, themeId, slot.id);
      if (existing) {
        skipped.push(`art:${slot.id}`);
        taskIds.push({ type: "art", id: existing.id, category: slot.category, pipeline });
        continue;
      }

      // Build prompt: theme-specific default + style hint
      const defaultPrompt = getDefaultArtPrompt(themeId, slot.id, slot.category);
      const label = ART_LABELS[slot.category];
      const prompt = `${label}: ${defaultPrompt}, ${theme.artStylePrompt}, high quality`;

      const taskId = await createArtTask({
        orgId,
        themeId,
        slotId: slot.id,
        category: slot.category,
        pipeline,
        prompt,
        requestedBy: wallet,
        status: "pending",
        ...(pipeline === "meshy"
          ? { meshy: { status: "pending" } }
          : { comfyui: { status: "pending" } }),
      });
      taskIds.push({ type: "art", id: taskId, category: slot.category, pipeline });
    }
  }

  // ── Summary ────────────────────────────────────────────
  const artTasks = taskIds.filter((t) => t.type === "art");
  const meshyArt = artTasks.filter((t) => t.pipeline === "meshy");
  const comfyuiArt = artTasks.filter((t) => t.pipeline === "comfyui");

  return Response.json({
    ok: true,
    themeId,
    tasks: taskIds,
    skipped,
    total: taskIds.length,
    breakdown: {
      furniture: taskIds.filter((t) => t.type === "furniture").length,
      textures: taskIds.filter((t) => t.type === "texture").length,
      art: artTasks.length,
      artMeshy3D: meshyArt.length,
      artComfyUI2D: comfyuiArt.length,
    },
  });
}
