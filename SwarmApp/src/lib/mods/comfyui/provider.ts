/**
 * ComfyUI Provider Factory — Returns the appropriate image generation client
 * based on COMFYUI_PROVIDER environment variable.
 *
 * "self-hosted" (default) → ComfyUI REST API
 * "replicate" → Replicate SDXL API
 */

export type ComfyUIProvider = "self-hosted" | "replicate";

export function getProvider(): ComfyUIProvider {
  const env = process.env.COMFYUI_PROVIDER?.toLowerCase();
  if (env === "replicate") return "replicate";
  return "self-hosted";
}

export function isImageGenerationConfigured(): boolean {
  const provider = getProvider();
  if (provider === "replicate") {
    return !!process.env.REPLICATE_API_TOKEN;
  }
  return !!process.env.COMFYUI_ENDPOINT;
}

/**
 * Submit image generation with the configured provider.
 * Returns a prediction/prompt ID for polling.
 */
export async function submitImageGeneration(
  prompt: string,
  negativePrompt = "",
  width = 1024,
  height = 1024,
): Promise<{ id: string; provider: ComfyUIProvider }> {
  const provider = getProvider();

  if (provider === "replicate") {
    const { submitGeneration } = await import("./replicate-adapter");
    const id = await submitGeneration(prompt, negativePrompt, width, height);
    return { id, provider };
  }

  // Self-hosted ComfyUI
  const { submitPixelArtWorkflow } = await import("./client");
  const id = await submitPixelArtWorkflow(prompt);
  return { id, provider };
}

/**
 * Poll generation status from the configured provider.
 */
export async function pollImageStatus(
  id: string,
  provider: ComfyUIProvider,
): Promise<{
  status: "pending" | "running" | "completed" | "failed";
  outputUrl?: string;
  filename?: string;
}> {
  if (provider === "replicate") {
    const { getPredictionStatus } = await import("./replicate-adapter");
    return getPredictionStatus(id);
  }

  // Self-hosted ComfyUI
  const { getPromptStatus } = await import("./client");
  return getPromptStatus(id);
}

/**
 * Download image from the configured provider.
 */
export async function downloadGeneratedImage(
  provider: ComfyUIProvider,
  options: { outputUrl?: string; filename?: string },
): Promise<Buffer> {
  if (provider === "replicate") {
    if (!options.outputUrl) throw new Error("Missing outputUrl for Replicate download");
    const { downloadImage } = await import("./replicate-adapter");
    return downloadImage(options.outputUrl);
  }

  // Self-hosted ComfyUI
  if (!options.filename) throw new Error("Missing filename for ComfyUI download");
  const { getGeneratedImage } = await import("./client");
  return getGeneratedImage(options.filename);
}
