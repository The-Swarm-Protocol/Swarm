/**
 * POST /api/v1/mods/office-sim/art-design
 *
 * Submit an art generation request for a specific slot and theme.
 * Routes to Meshy (3D) or ComfyUI/Replicate (2D) based on the slot's category.
 *
 * Auth: x-wallet-address (org member)
 *
 * Body:
 *   orgId   — Organization ID (required)
 *   themeId — Theme ID (required)
 *   slotId  — Art slot ID (required)
 *   prompt  — Custom prompt (required)
 *
 * DELETE /api/v1/mods/office-sim/art-design
 *
 * Revert an art piece to default.
 *
 * Body:
 *   taskId — Art task ID to delete
 */

import { NextRequest } from "next/server";
import { getWalletAddress } from "@/lib/auth-guard";
import { isMeshyConfigured } from "@/lib/mods/meshy/client";
import { isImageGenerationConfigured } from "@/lib/mods/comfyui/provider";
import {
  createArtTask,
  getActiveArtTask,
  deleteArtPiece,
} from "@/components/mods/office-sim/studio/art-firestore";
import {
  DEFAULT_ART_SLOTS,
  ART_PIPELINE,
  ART_LABELS,
} from "@/components/mods/office-sim/studio/art-types";
import { THEME_PRESETS } from "@/components/mods/office-sim/themes";

export async function POST(req: NextRequest) {
  const wallet = getWalletAddress(req);
  if (!wallet) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: { orgId?: string; themeId?: string; slotId?: string; prompt?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const orgId = body.orgId?.trim();
  const themeId = body.themeId?.trim();
  const slotId = body.slotId?.trim();
  const userPrompt = body.prompt?.trim();

  if (!orgId || !themeId || !slotId || !userPrompt) {
    return Response.json(
      { error: "Required fields: orgId, themeId, slotId, prompt" },
      { status: 400 },
    );
  }

  // Validate slot
  const slot = DEFAULT_ART_SLOTS.find((s) => s.id === slotId);
  if (!slot) {
    return Response.json(
      { error: `Invalid slot. Valid: ${DEFAULT_ART_SLOTS.map((s) => s.id).join(", ")}` },
      { status: 400 },
    );
  }

  const pipeline = ART_PIPELINE[slot.category];

  // Check pipeline availability
  if (pipeline === "meshy" && !isMeshyConfigured()) {
    return Response.json(
      { error: "Meshy.ai not configured. Set MESHY_API_KEY." },
      { status: 503 },
    );
  }
  if (pipeline === "comfyui" && !isImageGenerationConfigured()) {
    return Response.json(
      { error: "Image generation not configured. Set REPLICATE_API_TOKEN." },
      { status: 503 },
    );
  }

  // Check for active task
  const existing = await getActiveArtTask(orgId, themeId, slotId);
  if (existing) {
    return Response.json(
      { error: "An art task is already in progress", taskId: existing.id },
      { status: 409 },
    );
  }

  // Build prompt from theme + user input
  const theme = THEME_PRESETS.find((t) => t.id === themeId);
  const styleHint = theme?.artStylePrompt || "modern office art";
  const label = ART_LABELS[slot.category];
  const prompt = `${label}: ${userPrompt}, ${styleHint}, high quality`;

  const taskId = await createArtTask({
    orgId,
    themeId,
    slotId,
    category: slot.category,
    pipeline,
    prompt,
    requestedBy: wallet,
    status: "pending",
    ...(pipeline === "meshy"
      ? { meshy: { status: "pending" } }
      : { comfyui: { status: "pending" } }),
  });

  return Response.json({
    ok: true,
    taskId,
    status: "pending",
    slotId,
    category: slot.category,
    pipeline,
    prompt,
  });
}

export async function DELETE(req: NextRequest) {
  const wallet = getWalletAddress(req);
  if (!wallet) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: { taskId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const taskId = body.taskId?.trim();
  if (!taskId) {
    return Response.json({ error: "taskId is required" }, { status: 400 });
  }

  await deleteArtPiece(taskId);
  return Response.json({ ok: true });
}
