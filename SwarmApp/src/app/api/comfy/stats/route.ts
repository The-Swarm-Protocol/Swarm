/**
 * GET /api/comfy/stats?orgId=...
 *
 * Returns aggregate stats for an org's ComfyUI usage.
 *
 * Auth: org member
 */

import { NextRequest } from "next/server";
import { getWalletAddress, requireOrgMember } from "@/lib/auth-guard";
import { getOrgComfyStats } from "@/lib/comfyui-store";

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

  try {
    const stats = await getOrgComfyStats(orgId);
    return Response.json({ ok: true, ...stats });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to fetch stats" },
      { status: 500 },
    );
  }
}
