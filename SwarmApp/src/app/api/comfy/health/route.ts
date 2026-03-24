/**
 * GET /api/comfy/health
 *
 * Health check for the ComfyUI connection.
 * Returns latency, configuration status, and basic system info.
 * Does NOT require org membership — used by the dashboard to check connectivity.
 *
 * Auth: wallet address only (any authenticated user)
 */

import { NextRequest } from "next/server";
import { getWalletAddress } from "@/lib/auth-guard";
import { isComfyConfigured, healthCheck } from "@/lib/comfyui";

export async function GET(req: NextRequest) {
  const wallet = getWalletAddress(req);
  if (!wallet) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!isComfyConfigured()) {
    return Response.json({
      ok: false,
      configured: false,
      message: "COMFYUI_BASE_URL not set",
    });
  }

  const result = await healthCheck();

  return Response.json({
    ok: result.ok,
    configured: true,
    latencyMs: result.latencyMs,
    error: result.error,
  });
}
