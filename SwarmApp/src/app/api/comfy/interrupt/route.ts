/**
 * POST /api/comfy/interrupt
 *
 * Interrupt the currently running prompt on ComfyUI.
 *
 * Auth: platform admin only (dangerous operation — cancels queue execution)
 */

import { NextRequest } from "next/server";
import { requirePlatformAdmin, forbidden } from "@/lib/auth-guard";
import { isComfyConfigured, interrupt } from "@/lib/comfyui";

export async function POST(req: NextRequest) {
  const adminAuth = requirePlatformAdmin(req);
  if (!adminAuth.ok) {
    return forbidden("Platform admin access required for interrupt");
  }

  if (!isComfyConfigured()) {
    return Response.json(
      { error: "ComfyUI is not configured. Set COMFYUI_BASE_URL." },
      { status: 503 },
    );
  }

  try {
    await interrupt();
    return Response.json({ ok: true, message: "Interrupt signal sent" });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to interrupt" },
      { status: 500 },
    );
  }
}
