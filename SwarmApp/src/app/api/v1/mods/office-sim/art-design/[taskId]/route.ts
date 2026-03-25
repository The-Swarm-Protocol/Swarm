/**
 * GET /api/v1/mods/office-sim/art-design/:taskId
 *
 * Poll and advance the art generation pipeline.
 * Each call advances the state machine by one step.
 *
 * Auth: x-wallet-address
 */

import { NextRequest } from "next/server";
import { getWalletAddress } from "@/lib/auth-guard";
import { getArtTask } from "@/components/mods/office-sim/studio/art-firestore";
import { advanceArtPipeline } from "@/lib/mods/office-sim/art-pipeline";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const wallet = getWalletAddress(req);
  if (!wallet) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const { taskId } = await params;
  const task = await getArtTask(taskId);
  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  // If already terminal, return immediately
  if (task.status === "completed" || task.status === "failed") {
    return Response.json({
      ok: true,
      taskId: task.id,
      status: task.status,
      slotId: task.slotId,
      category: task.category,
      pipeline: task.pipeline,
      meshy: task.meshy,
      comfyui: task.comfyui,
    });
  }

  // Advance one step
  const result = await advanceArtPipeline(task);

  return Response.json({
    ok: true,
    taskId: task.id,
    status: result.status,
    slotId: task.slotId,
    category: task.category,
    pipeline: task.pipeline,
    meshy: result.meshy,
    comfyui: result.comfyui,
    completed: result.completed,
  });
}
