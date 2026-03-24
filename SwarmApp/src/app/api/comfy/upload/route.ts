/**
 * POST /api/comfy/upload
 *
 * Upload an image to ComfyUI's input directory.
 * Accepts multipart/form-data with a single "image" field.
 *
 * Auth: org member
 */

import { NextRequest } from "next/server";
import { getWalletAddress, requireOrgMember } from "@/lib/auth-guard";
import { isComfyConfigured, uploadImage } from "@/lib/comfyui";

export async function POST(req: NextRequest) {
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
    const formData = await req.formData();
    const file = formData.get("image") as File | null;
    if (!file) {
      return Response.json({ error: "No image file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const subfolder = formData.get("subfolder") as string | null;
    const overwrite = formData.get("overwrite") === "true";

    const result = await uploadImage(buffer, file.name, {
      subfolder: subfolder || undefined,
      overwrite,
    });

    return Response.json({ ok: true, ...result });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}
