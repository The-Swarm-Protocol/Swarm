/**
 * Furniture Generation Pipeline — Simplified state machine for office furniture.
 *
 * Unlike avatars, furniture doesn't need rigging or animation.
 * Pipeline: pending → preview → refine → upload → done
 *
 * Each poll advances one step to stay under Netlify's 10s timeout.
 */

import {
  createPreview,
  refineModel,
  getTextTo3DStatus,
  downloadModel,
} from "@/lib/mods/meshy/client";
import type { FurnitureGenerationTask, FurnitureMeshyState } from "@/components/mods/office-sim/studio/furniture-types";
import {
  updateFurnitureTask,
} from "@/components/mods/office-sim/studio/furniture-firestore";

interface AdvanceResult {
  status: FurnitureGenerationTask["status"];
  meshy: FurnitureMeshyState;
  completed: boolean;
}

/**
 * Advance the furniture generation pipeline by one step.
 * Returns the new state after the step completes.
 */
export async function advanceFurniturePipeline(
  task: FurnitureGenerationTask,
): Promise<AdvanceResult> {
  const meshy = { ...task.meshy };

  try {
    switch (meshy.status) {
      case "pending": {
        // Step 1: Create preview
        const previewTaskId = await createPreview(task.prompt);
        meshy.previewTaskId = previewTaskId;
        meshy.status = "preview";
        meshy.progress = 10;
        await updateFurnitureTask(task.id, {
          status: "generating_3d",
          meshy,
        });
        return { status: "generating_3d", meshy, completed: false };
      }

      case "preview": {
        // Poll preview status
        if (!meshy.previewTaskId) throw new Error("Missing previewTaskId");
        const status = await getTextTo3DStatus(meshy.previewTaskId);

        if (status.status === "FAILED") {
          meshy.status = "failed";
          meshy.error = "Preview generation failed";
          await updateFurnitureTask(task.id, { status: "failed", meshy });
          return { status: "failed", meshy, completed: true };
        }

        if (status.status === "SUCCEEDED") {
          // Kick off refine
          const refineTaskId = await refineModel(meshy.previewTaskId);
          meshy.refineTaskId = refineTaskId;
          meshy.status = "refine";
          meshy.progress = 40;
          await updateFurnitureTask(task.id, {
            status: "refining_3d",
            meshy,
          });
          return { status: "refining_3d", meshy, completed: false };
        }

        // Still in progress
        meshy.progress = Math.min(10 + (status.progress || 0) * 0.3, 35);
        await updateFurnitureTask(task.id, { meshy });
        return { status: "generating_3d", meshy, completed: false };
      }

      case "refine": {
        // Poll refine status
        if (!meshy.refineTaskId) throw new Error("Missing refineTaskId");
        const status = await getTextTo3DStatus(meshy.refineTaskId);

        if (status.status === "FAILED") {
          meshy.status = "failed";
          meshy.error = "Refine generation failed";
          await updateFurnitureTask(task.id, { status: "failed", meshy });
          return { status: "failed", meshy, completed: true };
        }

        if (status.status === "SUCCEEDED") {
          const glbUrl = status.model_urls?.glb;
          if (!glbUrl) {
            meshy.status = "failed";
            meshy.error = "No GLB URL in refined model";
            await updateFurnitureTask(task.id, { status: "failed", meshy });
            return { status: "failed", meshy, completed: true };
          }

          meshy.glbUrl = glbUrl;
          meshy.status = "uploading";
          meshy.progress = 70;
          await updateFurnitureTask(task.id, {
            status: "uploading",
            meshy,
          });
          return { status: "uploading", meshy, completed: false };
        }

        // Still in progress
        meshy.progress = Math.min(40 + (status.progress || 0) * 0.3, 65);
        await updateFurnitureTask(task.id, { meshy });
        return { status: "refining_3d", meshy, completed: false };
      }

      case "uploading": {
        // Download from Meshy and upload to Storacha
        if (!meshy.glbUrl) throw new Error("Missing glbUrl");

        const buffer = await downloadModel(meshy.glbUrl);

        // Try Storacha upload, fall back to keeping Meshy URL
        try {
          const { uploadContent } = await import("@/lib/storacha/client");
          const blob = new Blob([new Uint8Array(buffer)], { type: "model/gltf-binary" });
          const file = new File([blob], `furniture-${task.category}-${task.themeId}.glb`, {
            type: "model/gltf-binary",
          });
          const cid = await uploadContent(file);
          const gateway = process.env.STORACHA_GATEWAY_DOMAIN || "w3s.link";
          meshy.storachaCid = cid.toString();
          meshy.gatewayUrl = `https://${gateway}/ipfs/${cid}`;
        } catch {
          // Storacha not configured — use Meshy URL directly (expires in ~3 days)
          meshy.gatewayUrl = meshy.glbUrl;
        }

        meshy.status = "done";
        meshy.progress = 100;
        await updateFurnitureTask(task.id, {
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
    await updateFurnitureTask(task.id, { status: "failed", meshy });
    return { status: "failed", meshy, completed: true };
  }
}
