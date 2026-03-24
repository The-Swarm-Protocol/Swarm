/**
 * GET /api/comfy/images?filename=...&subfolder=...&type=...
 *
 * Proxy for ComfyUI's /view endpoint — serves generated images.
 * Returns the raw image binary with appropriate content type.
 *
 * Auth: org member
 */

import { NextRequest } from "next/server";
import { getWalletAddress, requireOrgMember } from "@/lib/auth-guard";
import { isComfyConfigured, viewImage } from "@/lib/comfyui";

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

  const filename = req.nextUrl.searchParams.get("filename");
  if (!filename) {
    return Response.json({ error: "filename query param is required" }, { status: 400 });
  }

  if (!isComfyConfigured()) {
    return Response.json(
      { error: "ComfyUI is not configured. Set COMFYUI_BASE_URL." },
      { status: 503 },
    );
  }

  const subfolder = req.nextUrl.searchParams.get("subfolder") || undefined;
  const type = req.nextUrl.searchParams.get("type") || undefined;

  try {
    const buffer = await viewImage(filename, subfolder, type);

    // Infer content type from filename
    const ext = filename.split(".").pop()?.toLowerCase();
    const contentType = ext === "jpg" || ext === "jpeg"
      ? "image/jpeg"
      : ext === "webp"
        ? "image/webp"
        : "image/png";

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to fetch image" },
      { status: 500 },
    );
  }
}
