/**
 * Texture Generation Pipeline — State machine for office textures.
 *
 * Pipeline: pending → generating → uploading → done
 * Uses the provider factory to support both self-hosted ComfyUI and Replicate.
 */

import {
  submitImageGeneration,
  pollImageStatus,
  downloadGeneratedImage,
} from "@/lib/mods/comfyui/provider";
import type {
  TextureGenerationTask,
  TextureProviderState,
} from "@/components/mods/office-sim/studio/texture-types";
import { updateTextureTask } from "@/components/mods/office-sim/studio/texture-firestore";

interface AdvanceResult {
  status: TextureGenerationTask["status"];
  provider: TextureProviderState;
  completed: boolean;
}

export async function advanceTexturePipeline(
  task: TextureGenerationTask,
): Promise<AdvanceResult> {
  const provider = { ...task.provider };

  try {
    switch (provider.status) {
      case "pending": {
        const negativePrompt =
          "blurry, text, watermark, logo, frame, border, low quality, seam visible";
        const result = await submitImageGeneration(
          task.prompt,
          negativePrompt,
          1024,
          1024,
        );
        provider.predictionId = result.id;
        provider.provider = result.provider;
        provider.status = "generating";
        provider.progress = 20;
        await updateTextureTask(task.id, {
          status: "generating",
          provider,
        });
        return { status: "generating", provider, completed: false };
      }

      case "generating": {
        if (!provider.predictionId) throw new Error("Missing predictionId");
        const status = await pollImageStatus(
          provider.predictionId,
          provider.provider,
        );

        if (status.status === "failed") {
          provider.status = "failed";
          provider.error = "Image generation failed";
          await updateTextureTask(task.id, { status: "failed", provider });
          return { status: "failed", provider, completed: true };
        }

        if (status.status === "completed") {
          provider.outputUrl = status.outputUrl;
          provider.filename = status.filename;
          provider.status = "uploading";
          provider.progress = 70;
          await updateTextureTask(task.id, {
            status: "uploading",
            provider,
          });
          return { status: "uploading", provider, completed: false };
        }

        // Still in progress
        provider.progress = Math.min(20 + 50 * Math.random(), 65);
        await updateTextureTask(task.id, { provider });
        return { status: "generating", provider, completed: false };
      }

      case "uploading": {
        const buffer = await downloadGeneratedImage(provider.provider, {
          outputUrl: provider.outputUrl,
          filename: provider.filename,
        });

        // Try Storacha upload, fall back to keeping original URL
        try {
          const { uploadContent } = await import("@/lib/storacha/client");
          const blob = new Blob([new Uint8Array(buffer)], { type: "image/png" });
          const file = new File(
            [blob],
            `texture-${task.material}-${task.themeId}.png`,
            { type: "image/png" },
          );
          const cid = await uploadContent(file);
          const gateway = process.env.STORACHA_GATEWAY_DOMAIN || "w3s.link";
          provider.storachaCid = cid.toString();
          provider.gatewayUrl = `https://${gateway}/ipfs/${cid}`;
        } catch {
          // Storacha not configured — use original URL
          provider.gatewayUrl = provider.outputUrl || "";
        }

        provider.status = "done";
        provider.progress = 100;
        await updateTextureTask(task.id, {
          status: "completed",
          provider,
          completedAt: new Date(),
        });
        return { status: "completed", provider, completed: true };
      }

      case "done":
        return { status: "completed", provider, completed: true };

      case "failed":
        return { status: "failed", provider, completed: true };

      default:
        return { status: task.status, provider, completed: false };
    }
  } catch (err) {
    provider.status = "failed";
    provider.error = err instanceof Error ? err.message : "Unknown error";
    await updateTextureTask(task.id, { status: "failed", provider });
    return { status: "failed", provider, completed: true };
  }
}
