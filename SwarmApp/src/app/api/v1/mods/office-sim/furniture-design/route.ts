/**
 * POST /api/v1/mods/office-sim/furniture-design
 *
 * Submit a furniture generation request for a specific category and theme.
 * Triggers the Meshy.ai 3D pipeline (preview → refine → upload).
 *
 * Auth: x-wallet-address (org member)
 *
 * Body:
 *   orgId    — Organization ID (required)
 *   themeId  — Theme ID (required)
 *   category — Furniture category (required)
 *   prompt   — Optional custom prompt override
 */

import { NextRequest } from "next/server";
import { getWalletAddress } from "@/lib/auth-guard";
import { isMeshyConfigured } from "@/lib/mods/meshy/client";
import {
  createFurnitureTask,
  getActiveFurnitureTask,
} from "@/components/mods/office-sim/studio/furniture-firestore";
import {
  FURNITURE_CATEGORIES,
  FURNITURE_LABELS,
  type FurnitureCategory,
} from "@/components/mods/office-sim/studio/furniture-types";
import { THEME_PRESETS } from "@/components/mods/office-sim/themes";

export async function POST(req: NextRequest) {
  const wallet = getWalletAddress(req);
  if (!wallet) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!isMeshyConfigured()) {
    return Response.json(
      { error: "Meshy.ai not configured. Set MESHY_API_KEY." },
      { status: 503 },
    );
  }

  let body: { orgId?: string; themeId?: string; category?: string; prompt?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const orgId = body.orgId?.trim();
  const themeId = body.themeId?.trim();
  const category = body.category?.trim() as FurnitureCategory | undefined;

  if (!orgId || !themeId || !category) {
    return Response.json(
      { error: "Required fields: orgId, themeId, category" },
      { status: 400 },
    );
  }

  if (!FURNITURE_CATEGORIES.includes(category)) {
    return Response.json(
      { error: `Invalid category. Valid: ${FURNITURE_CATEGORIES.join(", ")}` },
      { status: 400 },
    );
  }

  // Check for active task
  const existing = await getActiveFurnitureTask(orgId, themeId, category);
  if (existing) {
    return Response.json(
      { error: "A furniture task is already in progress", taskId: existing.id },
      { status: 409 },
    );
  }

  // Build prompt from theme + category
  const theme = THEME_PRESETS.find((t) => t.id === themeId);
  const styleHint = theme?.furnitureStylePrompt || "modern office";
  const label = FURNITURE_LABELS[category];
  const prompt =
    body.prompt?.trim() ||
    `${label}, ${styleHint}, office furniture, 3D model, high quality`;

  const taskId = await createFurnitureTask({
    orgId,
    themeId,
    category,
    prompt,
    requestedBy: wallet,
    status: "pending",
    meshy: { status: "pending" },
  });

  return Response.json({
    ok: true,
    taskId,
    status: "pending",
    category,
    prompt,
  });
}
