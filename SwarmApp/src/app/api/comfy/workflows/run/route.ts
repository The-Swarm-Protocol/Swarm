/**
 * POST /api/comfy/workflows/run
 *
 * Submit a ComfyUI workflow for execution.
 * Creates a Firestore job record and queues the prompt with ComfyUI.
 *
 * Accepts either:
 *   - A raw workflow JSON (advanced mode)
 *   - A prompt + generation params that builds a text-to-image workflow (simple mode)
 *
 * Auth: org member
 */

import { NextRequest } from "next/server";
import { getWalletAddress, requireOrgMember } from "@/lib/auth-guard";
import { isComfyConfigured, queuePrompt } from "@/lib/comfyui";
import { createComfyJob, incrementWorkflowUsage } from "@/lib/comfyui-store";

interface RunBody {
  orgId: string;
  workflow?: Record<string, unknown>;
  prompt?: string;
  negativePrompt?: string;
  workflowName?: string;
  agentId?: string;
  templateId?: string;
  // Generation params (used when building workflow from prompt)
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  sampler?: string;
  scheduler?: string;
  seed?: number;
  checkpoint?: string;
  batchSize?: number;
}

function buildWorkflow(body: RunBody): Record<string, unknown> {
  const prompt = body.prompt || "";
  const negative = body.negativePrompt || "blurry, low quality, watermark, text, logo, frame, border";
  const width = body.width || 1024;
  const height = body.height || 1024;
  const steps = body.steps || 25;
  const cfg = body.cfg || 7.5;
  const sampler = body.sampler || "euler_ancestral";
  const scheduler = body.scheduler || "normal";
  const seed = body.seed ?? Math.floor(Math.random() * 2 ** 32);
  const checkpoint = body.checkpoint || "sd_xl_base_1.0.safetensors";
  const batch = body.batchSize || 1;

  return {
    "1": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: checkpoint },
    },
    "2": {
      class_type: "CLIPTextEncode",
      inputs: { text: prompt, clip: ["1", 1] },
    },
    "3": {
      class_type: "CLIPTextEncode",
      inputs: { text: negative, clip: ["1", 1] },
    },
    "4": {
      class_type: "EmptyLatentImage",
      inputs: { width, height, batch_size: batch },
    },
    "5": {
      class_type: "KSampler",
      inputs: {
        model: ["1", 0],
        positive: ["2", 0],
        negative: ["3", 0],
        latent_image: ["4", 0],
        seed,
        steps,
        cfg,
        sampler_name: sampler,
        scheduler,
        denoise: 1.0,
      },
    },
    "6": {
      class_type: "VAEDecode",
      inputs: { samples: ["5", 0], vae: ["1", 2] },
    },
    "7": {
      class_type: "SaveImage",
      inputs: { images: ["6", 0], filename_prefix: "swarm" },
    },
  };
}

export async function POST(req: NextRequest) {
  const wallet = getWalletAddress(req);
  if (!wallet) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: RunBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { orgId } = body;
  if (!orgId) {
    return Response.json({ error: "orgId is required" }, { status: 400 });
  }

  // Need either a workflow or a prompt
  if (!body.workflow && !body.prompt) {
    return Response.json(
      { error: "Either workflow or prompt is required" },
      { status: 400 },
    );
  }

  const orgAuth = await requireOrgMember(req, orgId);
  if (!orgAuth.ok) {
    return Response.json(
      { error: orgAuth.error },
      { status: orgAuth.status || 403 },
    );
  }

  if (!isComfyConfigured()) {
    return Response.json(
      { error: "ComfyUI is not configured. Set COMFYUI_BASE_URL." },
      { status: 503 },
    );
  }

  try {
    // Build or use provided workflow
    const workflow = body.workflow || buildWorkflow(body);
    const seed = body.seed ?? Math.floor(Math.random() * 2 ** 32);

    // Queue with ComfyUI
    const result = await queuePrompt(workflow);

    // Persist job record with full generation params
    const jobId = await createComfyJob({
      orgId,
      userId: wallet,
      agentId: body.agentId,
      comfyPromptId: result.prompt_id,
      workflowName: body.workflowName || (body.workflow ? "Custom Workflow" : "Text to Image"),
      prompt: body.prompt || "",
      negativePrompt: body.negativePrompt,
      workflow,
      status: "queued",
      progress: 0,
      width: body.width,
      height: body.height,
      steps: body.steps,
      cfg: body.cfg,
      sampler: body.sampler,
      scheduler: body.scheduler,
      seed,
      checkpoint: body.checkpoint,
    });

    // Track template usage
    if (body.templateId) {
      incrementWorkflowUsage(body.templateId).catch(() => {});
    }

    return Response.json({
      ok: true,
      jobId,
      comfyPromptId: result.prompt_id,
      queueNumber: result.number,
      seed,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to queue workflow" },
      { status: 500 },
    );
  }
}
