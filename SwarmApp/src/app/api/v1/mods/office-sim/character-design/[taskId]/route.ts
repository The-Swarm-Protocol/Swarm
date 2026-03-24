/**
 * GET /api/v1/mods/office-sim/character-design/:taskId
 *
 * Poll generation status and advance the pipeline state machine.
 * Each poll advances at most one step per pipeline.
 *
 * Auth: x-wallet-address (org member) OR agent Ed25519/API key
 */

import { NextRequest } from "next/server";
import { getWalletAddress, requireAgentAuth } from "@/lib/auth-guard";
import { getAvatarTask } from "@/components/mods/office-sim/studio/avatar-firestore";
import { advancePipeline } from "@/lib/mods/office-sim/avatar-pipeline";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  // ── Auth ──
  const wallet = getWalletAddress(req);
  const agentAuth = !wallet
    ? await requireAgentAuth(req, "GET:/v1/mods/office-sim/character-design")
    : null;

  if (!wallet && (!agentAuth || !agentAuth.ok)) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const { taskId } = await params;

  // ── Fetch task ──
  const task = await getAvatarTask(taskId);
  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  // ── Advance pipeline (if still in progress) ──
  const terminalStatuses = ["completed", "partial", "failed"];
  const updated = terminalStatuses.includes(task.status)
    ? task
    : await advancePipeline(task);

  return Response.json({
    ok: true,
    task: {
      id: updated.id,
      agentId: updated.agentId,
      prompt: updated.prompt,
      status: updated.status,
      pipelines: updated.pipelines,
      meshy: updated.meshy
        ? {
            status: updated.meshy.status,
            progress: updated.meshy.progress,
            error: updated.meshy.error,
            modelReady: !!updated.meshy.gatewayUrl,
          }
        : undefined,
      comfyui: updated.comfyui
        ? {
            status: updated.comfyui.status,
            progress: updated.comfyui.progress,
            error: updated.comfyui.error,
            spriteReady: !!updated.comfyui.gatewayUrl,
          }
        : undefined,
      createdAt: updated.createdAt,
    },
  });
}
