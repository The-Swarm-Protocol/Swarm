/**
 * ComfyUI Integration Plugin — Marketplace-publishable plugin definition.
 *
 * This registers the canonical ComfyUI integration as a Swarm marketplace plugin.
 * It exposes capabilities (comfy.generate, comfy.upload, comfy.nodes, comfy.queue)
 * that agents and users can invoke through the /api/comfy/* proxy routes.
 *
 * This is separate from the generation-pipeline plugin at `./comfyui/index.ts`
 * which handles texture/sprite generation for the Office Sim mod.
 */

/** Plugin manifest for marketplace publishing */
export const COMFYUI_PLUGIN_MANIFEST = {
  id: "comfyui-integration",
  name: "ComfyUI",
  slug: "comfyui",
  version: "1.0.0",
  type: "plugin" as const,
  description:
    "AI image generation through ComfyUI. Submit workflows, upload images, inspect nodes, and manage the generation queue — all through Swarm's authenticated proxy.",
  author: "Swarm Protocol",

  /** Capabilities this plugin provides */
  capabilities: [
    "comfy.generate",
    "comfy.upload_image",
    "comfy.inspect_nodes",
    "comfy.manage_queue",
    "comfy.view_images",
    "comfy.system_info",
  ],

  /** API routes exposed by this plugin */
  routes: {
    "comfy.generate": {
      method: "POST",
      path: "/api/comfy/workflows/run",
      description: "Submit a ComfyUI workflow for execution",
      auth: "org_member",
    },
    "comfy.upload_image": {
      method: "POST",
      path: "/api/comfy/upload",
      description: "Upload an image to ComfyUI input directory",
      auth: "org_member",
    },
    "comfy.inspect_nodes": {
      method: "GET",
      path: "/api/comfy/nodes",
      description: "List all available ComfyUI nodes",
      auth: "org_member",
    },
    "comfy.manage_queue": {
      method: "GET",
      path: "/api/comfy/queue",
      description: "View current ComfyUI queue status",
      auth: "org_member",
    },
    "comfy.view_images": {
      method: "GET",
      path: "/api/comfy/images",
      description: "Retrieve generated images",
      auth: "org_member",
    },
    "comfy.system_info": {
      method: "GET",
      path: "/api/comfy/system",
      description: "View ComfyUI system stats (GPU, VRAM, etc.)",
      auth: "org_member",
    },
    "comfy.poll_job": {
      method: "GET",
      path: "/api/comfy/jobs/[promptId]",
      description: "Poll job status and retrieve artifacts",
      auth: "org_member",
    },
    "comfy.list_jobs": {
      method: "GET",
      path: "/api/comfy/jobs/list",
      description: "List all jobs for an organization",
      auth: "org_member",
    },
    "comfy.interrupt": {
      method: "POST",
      path: "/api/comfy/interrupt",
      description: "Interrupt the current ComfyUI execution",
      auth: "platform_admin",
    },
  },

  /** Required environment variables */
  requiredEnv: ["COMFYUI_BASE_URL"],
  optionalEnv: ["COMFYUI_API_KEY"],

  /** Firestore collections used */
  collections: ["comfyJobs", "comfyArtifacts"],

  /** Tags for marketplace search */
  tags: [
    "ai",
    "image-generation",
    "comfyui",
    "stable-diffusion",
    "sdxl",
    "gpu",
    "workflow",
  ],

  /** Dashboard page */
  dashboardPath: "/comfy",

  /** Icon for marketplace listing */
  icon: "paintbrush",

  /** Category */
  category: "ai-tools",
} as const;

/** Check if the ComfyUI integration is configured */
export function isComfyIntegrationConfigured(): boolean {
  return !!process.env.COMFYUI_BASE_URL;
}
