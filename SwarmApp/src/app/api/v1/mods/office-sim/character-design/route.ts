/**
 * POST /api/v1/mods/office-sim/character-design
 *
 * Submit a character design prompt for an agent.
 * Triggers async Meshy.ai (3D) and ComfyUI (2D) generation pipelines.
 *
 * Auth: x-wallet-address (org member) OR agent Ed25519/API key
 *
 * Body:
 *   prompt    — Character description (required, max 500 chars)
 *   orgId     — Organization ID (required)
 *   agentId   — Agent to design character for (required)
 *   pipelines — ["3d", "2d"] (optional, defaults to both available)
 */

import { NextRequest } from "next/server";
import { getWalletAddress, requireAgentAuth } from "@/lib/auth-guard";
import { isMeshyConfigured } from "@/lib/mods/meshy/client";
import { isComfyUIConfigured } from "@/lib/mods/comfyui/client";
import {
  createAvatarTask,
  getActiveAvatarTask,
} from "@/components/mods/office-sim/studio/avatar-firestore";
import type { AvatarGenerationTask } from "@/components/mods/office-sim/studio/avatar-types";

export async function POST(req: NextRequest) {
  // ── Auth ──
  const wallet = getWalletAddress(req);
  const agentAuth = !wallet
    ? await requireAgentAuth(req, "POST:/v1/mods/office-sim/character-design")
    : null;

  if (!wallet && (!agentAuth || !agentAuth.ok)) {
    return Response.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  // ── Parse body ──
  let body: { prompt?: string; orgId?: string; agentId?: string; pipelines?: string[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  const orgId = agentAuth?.ok ? agentAuth.agent?.orgId : body.orgId?.trim();
  const agentId = agentAuth?.ok ? agentAuth.agent?.agentId : body.agentId?.trim();

  if (!prompt || !orgId || !agentId) {
    return Response.json(
      { error: "Required fields: prompt, orgId, agentId" },
      { status: 400 },
    );
  }

  if (prompt.length > 500) {
    return Response.json(
      { error: "Prompt must be 500 characters or fewer" },
      { status: 400 },
    );
  }

  // ── Check for active task ──
  const existing = await getActiveAvatarTask(agentId);
  if (existing) {
    return Response.json(
      { error: "A character design is already in progress for this agent", taskId: existing.id },
      { status: 409 },
    );
  }

  // ── Determine available pipelines ──
  const requestedPipelines = (body.pipelines || ["3d", "2d"]).filter(
    (p): p is "3d" | "2d" => {
      if (p === "3d") return isMeshyConfigured();
      if (p === "2d") return isComfyUIConfigured();
      return false;
    },
  );

  if (requestedPipelines.length === 0) {
    return Response.json(
      {
        error: "No generation pipelines available. Configure MESHY_API_KEY and/or COMFYUI_ENDPOINT.",
      },
      { status: 503 },
    );
  }

  // ── Create task ──
  const requestedBy = wallet || agentAuth?.agent?.agentId || "unknown";

  const taskId = await createAvatarTask({
    orgId,
    agentId,
    prompt,
    requestedBy,
    status: "pending",
    pipelines: requestedPipelines,
    meshy: requestedPipelines.includes("3d") ? { status: "pending" } : undefined,
    comfyui: requestedPipelines.includes("2d") ? { status: "pending" } : undefined,
  });

  return Response.json({
    ok: true,
    taskId,
    status: "pending",
    pipelines: requestedPipelines,
  });
}
