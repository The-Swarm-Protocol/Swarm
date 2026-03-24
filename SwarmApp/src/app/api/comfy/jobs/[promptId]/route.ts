/**
 * GET /api/comfy/jobs/[promptId]
 *
 * Poll the status of a ComfyUI job by its Firestore job ID or ComfyUI prompt ID.
 * Syncs status from ComfyUI if the job is still running.
 * On completion, creates artifact records for output images.
 *
 * Auth: org member (via orgId query param)
 */

import { NextRequest } from "next/server";
import { getWalletAddress, requireOrgMember } from "@/lib/auth-guard";
import { isComfyConfigured, getPromptHistory } from "@/lib/comfyui";
import {
  getComfyJob,
  getComfyJobByPromptId,
  updateComfyJob,
  createComfyArtifact,
  getJobArtifacts,
} from "@/lib/comfyui-store";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ promptId: string }> },
) {
  const wallet = getWalletAddress(req);
  if (!wallet) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return Response.json({ error: "orgId query param is required" }, { status: 400 });
  }

  const orgAuth = await requireOrgMember(req, orgId);
  if (!orgAuth.ok) {
    return Response.json({ error: orgAuth.error }, { status: orgAuth.status || 403 });
  }

  const { promptId } = await params;

  // Try to find by Firestore job ID first, then by ComfyUI prompt ID
  let job = await getComfyJob(promptId);
  if (!job) {
    job = await getComfyJobByPromptId(promptId);
  }
  if (!job) {
    return Response.json({ error: "Job not found" }, { status: 404 });
  }

  // Verify org ownership
  if (job.orgId !== orgId) {
    return Response.json({ error: "Job not found" }, { status: 404 });
  }

  // If still active, sync with ComfyUI
  if ((job.status === "queued" || job.status === "running") && isComfyConfigured()) {
    try {
      const history = await getPromptHistory(job.comfyPromptId);

      if (!history) {
        // Still in queue
        if (job.status !== "queued") {
          await updateComfyJob(job.id, { status: "queued", progress: 0 });
          job = { ...job, status: "queued", progress: 0 };
        }
      } else if (!history.status.completed) {
        // Running
        if (job.status !== "running") {
          await updateComfyJob(job.id, { status: "running", progress: 50 });
          job = { ...job, status: "running", progress: 50 };
        }
      } else {
        // Completed — check for outputs
        const outputImages: { filename: string; subfolder: string; nodeId: string }[] = [];
        for (const [nodeId, nodeOutput] of Object.entries(history.outputs)) {
          if (nodeOutput.images) {
            for (const img of nodeOutput.images) {
              outputImages.push({
                filename: img.filename,
                subfolder: img.subfolder,
                nodeId,
              });
            }
          }
        }

        if (outputImages.length > 0) {
          // Create artifact records (if not already created)
          const existing = await getJobArtifacts(job.id);
          if (existing.length === 0) {
            for (const img of outputImages) {
              await createComfyArtifact({
                orgId: job.orgId,
                jobId: job.id,
                comfyPromptId: job.comfyPromptId,
                filename: img.filename,
                subfolder: img.subfolder,
                mimeType: img.filename.endsWith(".png") ? "image/png" : "image/jpeg",
                nodeId: img.nodeId,
              });
            }
          }

          await updateComfyJob(job.id, {
            status: "completed",
            progress: 100,
            completedAt: new Date(),
          });
          job = { ...job, status: "completed", progress: 100 };
        } else {
          // Completed but no images — failed
          await updateComfyJob(job.id, {
            status: "failed",
            progress: 100,
            error: "Workflow completed but produced no images",
          });
          job = { ...job, status: "failed", progress: 100, error: "No images produced" };
        }
      }
    } catch (err) {
      // ComfyUI unreachable — don't fail the poll, just return stale data
      console.error("[comfy/jobs] Failed to sync with ComfyUI:", err);
    }
  }

  // Fetch artifacts if completed
  const artifacts = job.status === "completed" ? await getJobArtifacts(job.id) : [];

  return Response.json({
    ok: true,
    job: {
      id: job.id,
      comfyPromptId: job.comfyPromptId,
      workflowName: job.workflowName,
      prompt: job.prompt,
      status: job.status,
      progress: job.progress,
      error: job.error,
      createdAt: job.createdAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
    },
    artifacts: artifacts.map((a) => ({
      id: a.id,
      filename: a.filename,
      subfolder: a.subfolder,
      mimeType: a.mimeType,
      nodeId: a.nodeId,
      url: a.url,
    })),
  });
}
