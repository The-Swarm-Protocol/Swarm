/**
 * POST /api/comfy/free
 *
 * Release GPU resources on the ComfyUI server.
 * Body: { unloadModels?: boolean, freeMemory?: boolean }
 *
 * Auth: platform admin (dangerous — frees VRAM mid-generation)
 */

import { NextRequest } from "next/server";
import { requirePlatformAdmin, forbidden } from "@/lib/auth-guard";
import { isComfyConfigured, freeModels } from "@/lib/comfyui";

export async function POST(req: NextRequest) {
  const adminAuth = requirePlatformAdmin(req);
  if (!adminAuth.ok) {
    return forbidden("Platform admin access required for free");
  }

  if (!isComfyConfigured()) {
    return Response.json(
      { error: "ComfyUI is not configured. Set COMFYUI_BASE_URL." },
      { status: 503 },
    );
  }

  let body: { unloadModels?: boolean; freeMemory?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is fine — defaults to false/false
  }

  try {
    await freeModels(body.unloadModels ?? false, body.freeMemory ?? false);
    return Response.json({
      ok: true,
      message: "GPU resources released",
      unloadModels: body.unloadModels ?? false,
      freeMemory: body.freeMemory ?? false,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to free GPU resources" },
      { status: 500 },
    );
  }
}
