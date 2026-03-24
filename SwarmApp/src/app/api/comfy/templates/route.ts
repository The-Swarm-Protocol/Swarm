/**
 * GET  /api/comfy/templates?orgId=...  — list workflow templates
 * POST /api/comfy/templates             — create workflow template
 *
 * Auth: org member
 */

import { NextRequest } from "next/server";
import { getWalletAddress, requireOrgMember } from "@/lib/auth-guard";
import {
  createWorkflowTemplate,
  getOrgWorkflowTemplates,
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

  try {
    const templates = await getOrgWorkflowTemplates(orgId);
    return Response.json({
      ok: true,
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        defaultPrompt: t.defaultPrompt,
        defaultNegativePrompt: t.defaultNegativePrompt,
        defaultWidth: t.defaultWidth,
        defaultHeight: t.defaultHeight,
        defaultSteps: t.defaultSteps,
        defaultCfg: t.defaultCfg,
        defaultSampler: t.defaultSampler,
        defaultScheduler: t.defaultScheduler,
        thumbnail: t.thumbnail,
        tags: t.tags,
        isPublic: t.isPublic,
        usageCount: t.usageCount,
        createdAt: t.createdAt?.toISOString(),
      })),
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to fetch templates" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const wallet = getWalletAddress(req);
  if (!wallet) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: {
    orgId: string;
    name: string;
    description?: string;
    workflow: Record<string, unknown>;
    defaultPrompt?: string;
    defaultNegativePrompt?: string;
    defaultWidth?: number;
    defaultHeight?: number;
    defaultSteps?: number;
    defaultCfg?: number;
    defaultSampler?: string;
    defaultScheduler?: string;
    tags?: string[];
    isPublic?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.orgId || !body.name || !body.workflow) {
    return Response.json({ error: "orgId, name, and workflow are required" }, { status: 400 });
  }

  const orgAuth = await requireOrgMember(req, body.orgId);
  if (!orgAuth.ok) {
    return Response.json({ error: orgAuth.error }, { status: orgAuth.status || 403 });
  }

  try {
    const id = await createWorkflowTemplate({
      orgId: body.orgId,
      name: body.name,
      description: body.description || "",
      workflow: body.workflow,
      defaultPrompt: body.defaultPrompt,
      defaultNegativePrompt: body.defaultNegativePrompt,
      defaultWidth: body.defaultWidth,
      defaultHeight: body.defaultHeight,
      defaultSteps: body.defaultSteps,
      defaultCfg: body.defaultCfg,
      defaultSampler: body.defaultSampler,
      defaultScheduler: body.defaultScheduler,
      tags: body.tags,
      isPublic: body.isPublic ?? false,
      usageCount: 0,
      createdBy: wallet,
    });

    return Response.json({ ok: true, id });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to create template" },
      { status: 500 },
    );
  }
}
