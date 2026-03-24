/**
 * GET /api/comfy/jobs/list?orgId=...&status=...&limit=...
 *
 * List ComfyUI jobs for an organization.
 *
 * Auth: org member
 */

import { NextRequest } from "next/server";
import { getWalletAddress, requireOrgMember } from "@/lib/auth-guard";
import { getOrgComfyJobs } from "@/lib/comfyui-store";
import type { ComfyJobStatus } from "@/lib/comfyui-store";

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

  const status = req.nextUrl.searchParams.get("status") as ComfyJobStatus | null;
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50", 10);

  try {
    const jobs = await getOrgComfyJobs(orgId, {
      status: status || undefined,
      limit: Math.min(limit, 100),
    });

    return Response.json({
      ok: true,
      jobs: jobs.map((j) => ({
        id: j.id,
        comfyPromptId: j.comfyPromptId,
        workflowName: j.workflowName,
        prompt: j.prompt,
        status: j.status,
        progress: j.progress,
        error: j.error,
        createdAt: j.createdAt?.toISOString(),
        completedAt: j.completedAt?.toISOString(),
      })),
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to fetch jobs" },
      { status: 500 },
    );
  }
}
