/**
 * GET /api/comfy/gallery?orgId=...&limit=...
 *
 * Returns recent completed jobs with their artifacts, optimized for gallery display.
 * Joins jobs + artifacts into a single response.
 *
 * Auth: org member
 */

import { NextRequest } from "next/server";
import { getWalletAddress, requireOrgMember } from "@/lib/auth-guard";
import {
  getRecentCompletedJobs,
  getJobArtifacts,
  getOrgComfyStats,
} from "@/lib/comfyui-store";

export async function GET(req: NextRequest) {
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

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "20", 10), 50);

  try {
    const [jobs, stats] = await Promise.all([
      getRecentCompletedJobs(orgId, limit),
      getOrgComfyStats(orgId),
    ]);

    // Fetch artifacts for each job in parallel
    const jobsWithArtifacts = await Promise.all(
      jobs.map(async (job) => {
        const artifacts = await getJobArtifacts(job.id);
        return {
          id: job.id,
          comfyPromptId: job.comfyPromptId,
          workflowName: job.workflowName,
          prompt: job.prompt,
          negativePrompt: job.negativePrompt,
          width: job.width,
          height: job.height,
          steps: job.steps,
          cfg: job.cfg,
          sampler: job.sampler,
          seed: job.seed,
          checkpoint: job.checkpoint,
          isFavorite: job.isFavorite,
          tags: job.tags,
          createdAt: job.createdAt?.toISOString(),
          completedAt: job.completedAt?.toISOString(),
          artifacts: artifacts.map((a) => ({
            id: a.id,
            filename: a.filename,
            subfolder: a.subfolder,
            mimeType: a.mimeType,
            nodeId: a.nodeId,
            url: a.url,
          })),
        };
      }),
    );

    return Response.json({
      ok: true,
      stats,
      gallery: jobsWithArtifacts,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to fetch gallery" },
      { status: 500 },
    );
  }
}
