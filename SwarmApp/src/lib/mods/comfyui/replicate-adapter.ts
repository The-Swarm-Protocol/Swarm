/**
 * Replicate Adapter — Cloud-hosted image generation via Replicate's SDXL API.
 *
 * Same interface as the self-hosted ComfyUI client but targets
 * Replicate's predictions REST API. Used when COMFYUI_PROVIDER=replicate.
 */

const REPLICATE_BASE = "https://api.replicate.com/v1";
const SDXL_MODEL = "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b";

function getToken(): string {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN is not set");
  return token;
}

export function isReplicateConfigured(): boolean {
  return !!process.env.REPLICATE_API_TOKEN;
}

async function replicateFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${REPLICATE_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
      Prefer: "wait",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Replicate API ${res.status}: ${body}`);
  }

  return res.json();
}

/* ═══════════════════════════════════════
   Submit generation
   ═══════════════════════════════════════ */

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string[];
  error?: string;
}

export async function submitGeneration(
  prompt: string,
  negativePrompt = "",
  width = 1024,
  height = 1024,
): Promise<string> {
  const [owner, model_and_version] = SDXL_MODEL.split(":");
  const [ownerName, modelName] = owner.split("/");

  const prediction = await replicateFetch<ReplicatePrediction>(
    `/models/${ownerName}/${modelName}/predictions`,
    {
      method: "POST",
      body: JSON.stringify({
        input: {
          prompt,
          negative_prompt: negativePrompt,
          width,
          height,
          num_outputs: 1,
          scheduler: "K_EULER_ANCESTRAL",
          num_inference_steps: 25,
          guidance_scale: 7.5,
        },
      }),
    },
  );

  return prediction.id;
}

/* ═══════════════════════════════════════
   Poll prediction status
   ═══════════════════════════════════════ */

export async function getPredictionStatus(
  predictionId: string,
): Promise<{
  status: "pending" | "running" | "completed" | "failed";
  outputUrl?: string;
}> {
  const prediction = await replicateFetch<ReplicatePrediction>(
    `/predictions/${predictionId}`,
  );

  switch (prediction.status) {
    case "starting":
    case "processing":
      return { status: prediction.status === "starting" ? "pending" : "running" };
    case "succeeded":
      return {
        status: "completed",
        outputUrl: prediction.output?.[0],
      };
    case "failed":
    case "canceled":
      return { status: "failed" };
    default:
      return { status: "pending" };
  }
}

/* ═══════════════════════════════════════
   Download generated image
   ═══════════════════════════════════════ */

export async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image download failed: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
