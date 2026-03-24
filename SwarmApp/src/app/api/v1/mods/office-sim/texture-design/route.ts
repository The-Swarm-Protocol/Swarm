/**
 * POST /api/v1/mods/office-sim/texture-design
 *
 * Submit a texture generation request for a specific material and theme.
 * Uses the ComfyUI provider factory (self-hosted or Replicate).
 *
 * Auth: x-wallet-address
 *
 * Body:
 *   orgId    — Organization ID (required)
 *   themeId  — Theme ID (required)
 *   material — Texture material type (required)
 *   prompt   — Optional custom prompt override
 */

import { NextRequest } from "next/server";
import { getWalletAddress } from "@/lib/auth-guard";
import { isImageGenerationConfigured, getProvider } from "@/lib/mods/comfyui/provider";
import {
  createTextureTask,
  getActiveTextureTask,
} from "@/components/mods/office-sim/studio/texture-firestore";
import {
  TEXTURE_MATERIALS,
  TEXTURE_LABELS,
  type TextureMaterial,
} from "@/components/mods/office-sim/studio/texture-types";
import { THEME_PRESETS } from "@/components/mods/office-sim/themes";

export async function POST(req: NextRequest) {
  const wallet = getWalletAddress(req);
  if (!wallet) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!isImageGenerationConfigured()) {
    return Response.json(
      { error: "Image generation not configured. Set REPLICATE_API_TOKEN or COMFYUI_ENDPOINT." },
      { status: 503 },
    );
  }

  let body: { orgId?: string; themeId?: string; material?: string; prompt?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const orgId = body.orgId?.trim();
  const themeId = body.themeId?.trim();
  const material = body.material?.trim() as TextureMaterial | undefined;

  if (!orgId || !themeId || !material) {
    return Response.json(
      { error: "Required fields: orgId, themeId, material" },
      { status: 400 },
    );
  }

  if (!TEXTURE_MATERIALS.includes(material)) {
    return Response.json(
      { error: `Invalid material. Valid: ${TEXTURE_MATERIALS.join(", ")}` },
      { status: 400 },
    );
  }

  // Check for active task
  const existing = await getActiveTextureTask(orgId, themeId, material);
  if (existing) {
    return Response.json(
      { error: "A texture task is already in progress", taskId: existing.id },
      { status: 409 },
    );
  }

  // Build prompt from theme + material
  const theme = THEME_PRESETS.find((t) => t.id === themeId);
  const styleHint = theme?.textureStylePrompt || "modern office";
  const label = TEXTURE_LABELS[material];
  const prompt =
    body.prompt?.trim() ||
    `seamless tileable ${label} texture, ${styleHint}, photorealistic PBR, top-down view, high resolution`;

  const provider = getProvider();

  const taskId = await createTextureTask({
    orgId,
    themeId,
    material,
    prompt,
    requestedBy: wallet,
    status: "pending",
    provider: { status: "pending", provider },
  });

  return Response.json({
    ok: true,
    taskId,
    status: "pending",
    material,
    prompt,
    provider,
  });
}
