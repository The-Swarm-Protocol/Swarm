/**
 * GET /api/v1/mods/office-sim/texture-design/:taskId
 *
 * Poll and advance the texture generation pipeline.
 * Each call advances the state machine by one step.
 *
 * Auth: x-wallet-address
 */

import { NextRequest } from "next/server";
import { getWalletAddress } from "@/lib/auth-guard";
import { getTextureTask } from "@/components/mods/office-sim/studio/texture-firestore";
import { advanceTexturePipeline } from "@/lib/mods/office-sim/texture-pipeline";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const wallet = getWalletAddress(req);
  if (!wallet) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const { taskId } = await params;
  const task = await getTextureTask(taskId);
  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  // If already terminal, return immediately
  if (task.status === "completed" || task.status === "failed") {
    return Response.json({
      ok: true,
      taskId: task.id,
      status: task.status,
      material: task.material,
      provider: task.provider,
    });
  }

  // Advance one step
  const result = await advanceTexturePipeline(task);

  return Response.json({
    ok: true,
    taskId: task.id,
    status: result.status,
    material: task.material,
    provider: result.provider,
    completed: result.completed,
  });
}
