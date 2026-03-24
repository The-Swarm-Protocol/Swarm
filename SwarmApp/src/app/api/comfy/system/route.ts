/**
 * GET /api/comfy/system
 *
 * Returns ComfyUI system stats: OS, Python version, GPU devices, VRAM usage.
 *
 * Auth: org member
 */

import { NextRequest } from "next/server";
import { getWalletAddress, requireOrgMember } from "@/lib/auth-guard";
import { isComfyConfigured, getSystemStats } from "@/lib/comfyui";

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

  if (!isComfyConfigured()) {
    return Response.json(
      { error: "ComfyUI is not configured. Set COMFYUI_BASE_URL." },
      { status: 503 },
    );
  }

  try {
    const stats = await getSystemStats();
    return Response.json({ ok: true, ...stats });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to fetch system stats" },
      { status: 500 },
    );
  }
}
