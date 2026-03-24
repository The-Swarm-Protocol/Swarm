/**
 * GET /api/v1/mods/office-sim/furniture-design/:taskId
 *
 * Poll and advance the furniture generation pipeline.
 * Each call advances the state machine by one step.
 *
 * Auth: x-wallet-address
 */

import { NextRequest } from "next/server";
import { getWalletAddress } from "@/lib/auth-guard";
import { getFurnitureTask } from "@/components/mods/office-sim/studio/furniture-firestore";
import { advanceFurniturePipeline } from "@/lib/mods/office-sim/furniture-pipeline";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const wallet = getWalletAddress(req);
  if (!wallet) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const { taskId } = await params;
  const task = await getFurnitureTask(taskId);
  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  // If already terminal, return immediately
  if (task.status === "completed" || task.status === "failed") {
    return Response.json({
      ok: true,
      taskId: task.id,
      status: task.status,
      category: task.category,
      meshy: task.meshy,
    });
  }

  // Advance one step
  const result = await advanceFurniturePipeline(task);

  return Response.json({
    ok: true,
    taskId: task.id,
    status: result.status,
    category: task.category,
    meshy: result.meshy,
    completed: result.completed,
  });
}
