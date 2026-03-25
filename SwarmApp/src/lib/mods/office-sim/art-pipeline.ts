/**
 * Art Generation Pipeline — State machine for office art pieces.
 *
 * Routes to either the Meshy (3D) or ComfyUI/Replicate (2D) pipeline
 * based on the art category.
 *
 * Meshy pipeline:   pending → preview → refine → uploading → done
 * ComfyUI pipeline: pending → generating → uploading → done
 *
 * Each poll advances one step to stay under Netlify's 10s timeout.
 */

import {
  createPreview,
  refineModel,
  getTextTo3DStatus,
  downloadModel,
} from "@/lib/mods/meshy/client";
import {
  getProvider,
  submitImageGeneration,
  pollImageStatus,
  downloadGeneratedImage,
} from "@/lib/mods/comfyui/provider";
import type {
  ArtGenerationTask,
  ArtMeshyState,
  ArtComfyUIState,
} from "@/components/mods/office-sim/studio/art-types";
import { updateArtTask } from "@/components/mods/office-sim/studio/art-firestore";

interface AdvanceResult {
  status: ArtGenerationTask["status"];
  meshy?: ArtMeshyState;
  comfyui?: ArtComfyUIState;
  completed: boolean;
}

/* ═══════════════════════════════════════
   Main Entry
   ═══════════════════════════════════════ */

export async function advanceArtPipeline(
  task: ArtGenerationTask,
): Promise<AdvanceResult> {
  if (task.pipeline === "meshy") {
    return advanceMeshyArt(task);
  }
  return advanceComfyUIArt(task);
}

/* ═══════════════════════════════════════
   Meshy (3D) Pipeline
   ═══════════════════════════════════════ */

async function advanceMeshyArt(
  task: ArtGenerationTask,
): Promise<AdvanceResult> {
  const meshy: ArtMeshyState = { ...(task.meshy || { status: "pending" }) };

  try {
    switch (meshy.status) {
      case "pending": {
        const previewTaskId = await createPreview(task.prompt);
        meshy.previewTaskId = previewTaskId;
        meshy.status = "preview";
        meshy.progress = 10;
        await updateArtTask(task.id, { status: "generating", meshy });
        return { status: "generating", meshy, completed: false };
      }

      case "preview": {
        if (!meshy.previewTaskId) throw new Error("Missing previewTaskId");
        const status = await getTextTo3DStatus(meshy.previewTaskId);

        if (status.status === "FAILED") {
          meshy.status = "failed";
          meshy.error = "Preview generation failed";
          await updateArtTask(task.id, { status: "failed", meshy });
          return { status: "failed", meshy, completed: true };
        }

        if (status.status === "SUCCEEDED") {
          const refineTaskId = await refineModel(meshy.previewTaskId);
          meshy.refineTaskId = refineTaskId;
          meshy.status = "refine";
          meshy.progress = 40;
          await updateArtTask(task.id, { status: "refining", meshy });
          return { status: "refining", meshy, completed: false };
        }

        meshy.progress = Math.min(10 + (status.progress || 0) * 0.3, 35);
        await updateArtTask(task.id, { meshy });
        return { status: "generating", meshy, completed: false };
      }

      case "refine": {
        if (!meshy.refineTaskId) throw new Error("Missing refineTaskId");
        const status = await getTextTo3DStatus(meshy.refineTaskId);

        if (status.status === "FAILED") {
          meshy.status = "failed";
          meshy.error = "Refine generation failed";
          await updateArtTask(task.id, { status: "failed", meshy });
          return { status: "failed", meshy, completed: true };
        }

        if (status.status === "SUCCEEDED") {
          const glbUrl = status.model_urls?.glb;
          if (!glbUrl) {
            meshy.status = "failed";
            meshy.error = "No GLB URL in refined model";
            await updateArtTask(task.id, { status: "failed", meshy });
            return { status: "failed", meshy, completed: true };
          }

          meshy.glbUrl = glbUrl;
          meshy.status = "uploading";
          meshy.progress = 70;
          await updateArtTask(task.id, { status: "uploading", meshy });
          return { status: "uploading", meshy, completed: false };
        }

        meshy.progress = Math.min(40 + (status.progress || 0) * 0.3, 65);
        await updateArtTask(task.id, { meshy });
        return { status: "refining", meshy, completed: false };
      }

      case "uploading": {
        if (!meshy.glbUrl) throw new Error("Missing glbUrl");
        const buffer = await downloadModel(meshy.glbUrl);

        try {
          const { uploadContent } = await import("@/lib/storacha/client");
          const blob = new Blob([new Uint8Array(buffer)], { type: "model/gltf-binary" });
          const file = new File(
            [blob],
            `art-${task.slotId}-${task.themeId}.glb`,
            { type: "model/gltf-binary" },
          );
          const cid = await uploadContent(file);
          const gateway = process.env.STORACHA_GATEWAY_DOMAIN || "w3s.link";
          meshy.storachaCid = cid.toString();
          meshy.gatewayUrl = `https://${gateway}/ipfs/${cid}`;
        } catch {
          meshy.gatewayUrl = meshy.glbUrl;
        }

        meshy.status = "done";
        meshy.progress = 100;
        await updateArtTask(task.id, {
          status: "completed",
          meshy,
          completedAt: new Date(),
        });
        return { status: "completed", meshy, completed: true };
      }

      case "done":
        return { status: "completed", meshy, completed: true };

      case "failed":
        return { status: "failed", meshy, completed: true };

      default:
        return { status: task.status, meshy, completed: false };
    }
  } catch (err) {
    meshy.status = "failed";
    meshy.error = err instanceof Error ? err.message : "Unknown error";
    await updateArtTask(task.id, { status: "failed", meshy });
    return { status: "failed", meshy, completed: true };
  }
}

/* ═══════════════════════════════════════
   ComfyUI / Replicate (2D) Pipeline
   ═══════════════════════════════════════ */

async function advanceComfyUIArt(
  task: ArtGenerationTask,
): Promise<AdvanceResult> {
  const comfyui: ArtComfyUIState = { ...(task.comfyui || { status: "pending" }) };

  try {
    switch (comfyui.status) {
      case "pending": {
        const negativePrompt =
          "blurry, text, watermark, logo, frame, low quality, deformed";
        const result = await submitImageGeneration(
          task.prompt,
          negativePrompt,
          1024,
          1024,
        );
        comfyui.promptId = result.id;
        comfyui.provider = result.provider;
        comfyui.status = "generating";
        comfyui.progress = 20;
        await updateArtTask(task.id, { status: "generating", comfyui });
        return { status: "generating", comfyui, completed: false };
      }

      case "generating": {
        if (!comfyui.promptId) throw new Error("Missing promptId");
        const provider = comfyui.provider || getProvider();
        const status = await pollImageStatus(comfyui.promptId, provider);

        if (status.status === "failed") {
          comfyui.status = "failed";
          comfyui.error = "Image generation failed";
          await updateArtTask(task.id, { status: "failed", comfyui });
          return { status: "failed", comfyui, completed: true };
        }

        if (status.status === "completed") {
          comfyui.outputUrl = status.outputUrl;
          comfyui.filename = status.filename;
          comfyui.status = "uploading";
          comfyui.progress = 70;
          await updateArtTask(task.id, { status: "uploading", comfyui });
          return { status: "uploading", comfyui, completed: false };
        }

        comfyui.progress = Math.min(20 + 50 * Math.random(), 65);
        await updateArtTask(task.id, { comfyui });
        return { status: "generating", comfyui, completed: false };
      }

      case "uploading": {
        const provider = comfyui.provider || getProvider();
        const buffer = await downloadGeneratedImage(provider, {
          outputUrl: comfyui.outputUrl,
          filename: comfyui.filename,
        });

        try {
          const { uploadContent } = await import("@/lib/storacha/client");
          const blob = new Blob([new Uint8Array(buffer)], { type: "image/png" });
          const file = new File(
            [blob],
            `art-${task.slotId}-${task.themeId}.png`,
            { type: "image/png" },
          );
          const cid = await uploadContent(file);
          const gateway = process.env.STORACHA_GATEWAY_DOMAIN || "w3s.link";
          comfyui.storachaCid = cid.toString();
          comfyui.gatewayUrl = `https://${gateway}/ipfs/${cid}`;
        } catch {
          comfyui.gatewayUrl = comfyui.outputUrl || "";
        }

        comfyui.status = "done";
        comfyui.progress = 100;
        await updateArtTask(task.id, {
          status: "completed",
          comfyui,
          completedAt: new Date(),
        });
        return { status: "completed", comfyui, completed: true };
      }

      case "done":
        return { status: "completed", comfyui, completed: true };

      case "failed":
        return { status: "failed", comfyui, completed: true };

      default:
        return { status: task.status, comfyui, completed: false };
    }
  } catch (err) {
    comfyui.status = "failed";
    comfyui.error = err instanceof Error ? err.message : "Unknown error";
    await updateArtTask(task.id, { status: "failed", comfyui });
    return { status: "failed", comfyui, completed: true };
  }
}
