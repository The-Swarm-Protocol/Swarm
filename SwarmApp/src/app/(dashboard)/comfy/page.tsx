/** ComfyUI — Dashboard page */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Paintbrush,
  Upload,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  StopCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useOrg } from "@/contexts/OrgContext";

/* ═══════════════════════════════════════
   Types
   ═══════════════════════════════════════ */

interface ComfyJobView {
  id: string;
  comfyPromptId: string;
  workflowName: string;
  prompt: string;
  status: string;
  progress: number;
  error?: string;
  createdAt?: string;
  completedAt?: string;
}

interface ComfyArtifactView {
  id: string;
  filename: string;
  subfolder: string;
  mimeType: string;
  nodeId: string;
  url?: string;
}

interface SystemInfo {
  system: { os: string; python_version: string };
  devices: { name: string; type: string; vram_total: number; vram_free: number }[];
}

interface QueueInfo {
  running: number;
  pending: number;
}

/* ═══════════════════════════════════════
   Page Component
   ═══════════════════════════════════════ */

export default function ComfyUIPage() {
  const { currentOrg } = useOrg();
  const orgId = currentOrg?.id;

  // Tabs state
  const [tab, setTab] = useState("generate");

  // Generate state
  const [prompt, setPrompt] = useState("");
  const [workflowName, setWorkflowName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Jobs state
  const [jobs, setJobs] = useState<ComfyJobView[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<ComfyArtifactView[]>([]);

  // System state
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [queue, setQueue] = useState<QueueInfo | null>(null);
  const [systemError, setSystemError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);

  /* ── Fetch jobs ── */
  const fetchJobs = useCallback(async () => {
    if (!orgId) return;
    setLoadingJobs(true);
    try {
      const res = await fetch(`/api/comfy/queue?orgId=${orgId}`);
      if (res.status === 503) {
        setConfigured(false);
        setLoadingJobs(false);
        return;
      }
      setConfigured(true);

      // Fetch Firestore jobs
      const jobsRes = await fetch(`/api/comfy/jobs/list?orgId=${orgId}`);
      if (jobsRes.ok) {
        const data = await jobsRes.json();
        setJobs(data.jobs || []);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingJobs(false);
    }
  }, [orgId]);

  /* ── Fetch system info ── */
  const fetchSystem = useCallback(async () => {
    if (!orgId) return;
    try {
      const [sysRes, queueRes] = await Promise.all([
        fetch(`/api/comfy/system?orgId=${orgId}`),
        fetch(`/api/comfy/queue?orgId=${orgId}`),
      ]);

      if (sysRes.status === 503 || queueRes.status === 503) {
        setConfigured(false);
        return;
      }
      setConfigured(true);

      if (sysRes.ok) {
        const data = await sysRes.json();
        setSystem({ system: data.system, devices: data.devices });
        setSystemError(null);
      } else {
        setSystemError("Failed to fetch system info");
      }

      if (queueRes.ok) {
        const data = await queueRes.json();
        setQueue({ running: data.running, pending: data.pending });
      }
    } catch (err) {
      setSystemError(err instanceof Error ? err.message : "Connection error");
    }
  }, [orgId]);

  useEffect(() => {
    if (tab === "generate" || tab === "jobs") fetchJobs();
    if (tab === "system") fetchSystem();
  }, [tab, fetchJobs, fetchSystem]);

  // Poll active jobs
  useEffect(() => {
    const activeJobs = jobs.filter(
      (j) => j.status === "queued" || j.status === "running",
    );
    if (activeJobs.length === 0) return;

    const timer = setInterval(async () => {
      for (const job of activeJobs) {
        try {
          const res = await fetch(
            `/api/comfy/jobs/${job.id}?orgId=${orgId}`,
          );
          if (res.ok) {
            const data = await res.json();
            setJobs((prev) =>
              prev.map((j) => (j.id === job.id ? data.job : j)),
            );
            if (data.job.status === "completed" && selectedJob === job.id) {
              setArtifacts(data.artifacts || []);
            }
          }
        } catch {
          // Ignore polling errors
        }
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [jobs, orgId, selectedJob]);

  /* ── Submit workflow ── */
  async function handleSubmit() {
    if (!orgId || !prompt.trim()) return;
    setSubmitting(true);
    setSubmitError(null);

    // Build a simple text-to-image workflow
    const workflow = buildTextToImageWorkflow(prompt);

    try {
      const res = await fetch("/api/comfy/workflows/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          workflow,
          prompt,
          workflowName: workflowName || "Text to Image",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Failed to submit");
        return;
      }

      setPrompt("");
      setWorkflowName("");
      fetchJobs();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Upload image ── */
  async function handleUpload(file: File) {
    if (!orgId) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch(`/api/comfy/upload?orgId=${orgId}`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (res.ok) {
        setUploadResult(`Uploaded: ${data.name}`);
      } else {
        setUploadResult(`Error: ${data.error}`);
      }
    } catch {
      setUploadResult("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  /* ── Select job ── */
  async function handleSelectJob(jobId: string) {
    setSelectedJob(jobId);
    setArtifacts([]);
    try {
      const res = await fetch(`/api/comfy/jobs/${jobId}?orgId=${orgId}`);
      if (res.ok) {
        const data = await res.json();
        setArtifacts(data.artifacts || []);
        // Update job in list
        setJobs((prev) =>
          prev.map((j) => (j.id === jobId ? data.job : j)),
        );
      }
    } catch {
      // Ignore
    }
  }

  /* ── Not configured state ── */
  if (!configured) {
    return (
      <div className="space-y-6">
        <Header />
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-10 w-10 text-yellow-400 mx-auto" />
            <h2 className="text-lg font-semibold">ComfyUI Not Configured</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Set <code className="bg-muted px-1.5 py-0.5 rounded text-xs">COMFYUI_BASE_URL</code> in
              your environment to connect to a ComfyUI instance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="generate" className="gap-1.5">
            <Paintbrush className="h-3.5 w-3.5" /> Generate
          </TabsTrigger>
          <TabsTrigger value="jobs" className="gap-1.5">
            <Layers className="h-3.5 w-3.5" /> Jobs
          </TabsTrigger>
          <TabsTrigger value="upload" className="gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Upload
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-1.5">
            <Cpu className="h-3.5 w-3.5" /> System
          </TabsTrigger>
        </TabsList>

        {/* ── Generate Tab ── */}
        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Workflow Name (optional)
                </label>
                <input
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  placeholder="Text to Image"
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Prompt
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="A futuristic cityscape at sunset, cyberpunk style, highly detailed..."
                  rows={3}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-none"
                />
              </div>
              {submitError && (
                <div className="flex items-center gap-2 text-sm text-red-400">
                  <XCircle className="h-4 w-4 shrink-0" />
                  {submitError}
                </div>
              )}
              <Button
                onClick={handleSubmit}
                disabled={submitting || !prompt.trim()}
                className="gap-2"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Paintbrush className="h-4 w-4" />
                )}
                Generate
              </Button>
            </CardContent>
          </Card>

          {/* Recent jobs quick list */}
          {jobs.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Recent Jobs
              </h3>
              <div className="space-y-2">
                {jobs.slice(0, 5).map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    selected={selectedJob === job.id}
                    onClick={() => handleSelectJob(job.id)}
                    orgId={orgId!}
                    artifacts={selectedJob === job.id ? artifacts : []}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Jobs Tab ── */}
        <TabsContent value="jobs" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">All Jobs</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchJobs}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="h-3 w-3" /> Refresh
            </Button>
          </div>
          {loadingJobs ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              </CardContent>
            </Card>
          ) : jobs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground text-sm">
                No jobs yet. Use the Generate tab to submit a workflow.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  selected={selectedJob === job.id}
                  onClick={() => handleSelectJob(job.id)}
                  orgId={orgId!}
                  artifacts={selectedJob === job.id ? artifacts : []}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Upload Tab ── */}
        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="text-center">
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  Upload images to ComfyUI&apos;s input directory for use in workflows.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="gap-2"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Choose Image
                </Button>
              </div>
              {uploadResult && (
                <div className="text-center text-sm text-muted-foreground">
                  {uploadResult}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── System Tab ── */}
        <TabsContent value="system" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">System Diagnostics</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchSystem}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="h-3 w-3" /> Refresh
            </Button>
          </div>

          {systemError ? (
            <Card>
              <CardContent className="p-6 text-center">
                <AlertCircle className="h-6 w-6 text-red-400 mx-auto mb-2" />
                <p className="text-sm text-red-400">{systemError}</p>
              </CardContent>
            </Card>
          ) : !system ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Queue stats */}
              {queue && (
                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    label="Running"
                    value={queue.running}
                    color="#22c55e"
                  />
                  <StatCard
                    label="Pending"
                    value={queue.pending}
                    color="#3b82f6"
                  />
                </div>
              )}

              {/* System info */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">OS</span>
                    <span className="font-mono text-xs">{system.system.os}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Python</span>
                    <span className="font-mono text-xs">
                      {system.system.python_version}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* GPU devices */}
              {system.devices.map((device, i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{device.name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {device.type}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>VRAM</span>
                        <span>
                          {formatBytes(device.vram_free)} free /{" "}
                          {formatBytes(device.vram_total)}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all"
                          style={{
                            width: `${device.vram_total > 0 ? ((device.vram_total - device.vram_free) / device.vram_total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ═══════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════ */

function Header() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20">
        <Paintbrush className="h-5 w-5 text-purple-400" />
      </div>
      <div>
        <h1 className="text-xl font-semibold">ComfyUI</h1>
        <p className="text-sm text-muted-foreground">
          AI image generation through your ComfyUI instance
        </p>
      </div>
    </div>
  );
}

const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  queued: { icon: Clock, color: "text-blue-400", label: "Queued" },
  running: { icon: Loader2, color: "text-amber-400", label: "Running" },
  completed: { icon: CheckCircle2, color: "text-green-400", label: "Completed" },
  failed: { icon: XCircle, color: "text-red-400", label: "Failed" },
  interrupted: { icon: StopCircle, color: "text-orange-400", label: "Interrupted" },
};

function JobCard({
  job,
  selected,
  onClick,
  orgId,
  artifacts,
}: {
  job: ComfyJobView;
  selected: boolean;
  onClick: () => void;
  orgId: string;
  artifacts: ComfyArtifactView[];
}) {
  const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.queued;
  const StatusIcon = config.icon;

  return (
    <Card
      className={`cursor-pointer transition-colors ${selected ? "border-amber-500/40" : "hover:border-border/80"}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <StatusIcon
              className={`h-4 w-4 ${config.color} ${job.status === "running" ? "animate-spin" : ""}`}
            />
            <span className="text-sm font-medium">{job.workflowName}</span>
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] ${config.color}`}
          >
            {config.label}
          </Badge>
        </div>
        {job.prompt && (
          <p className="text-xs text-muted-foreground truncate mb-2">
            {job.prompt}
          </p>
        )}
        {job.status === "running" && (
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        )}
        {job.error && (
          <p className="text-xs text-red-400 mt-1">{job.error}</p>
        )}
        {job.createdAt && (
          <p className="text-[10px] text-muted-foreground mt-2">
            {new Date(job.createdAt).toLocaleString()}
          </p>
        )}

        {/* Artifacts */}
        {selected && artifacts.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Output Images ({artifacts.length})
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {artifacts.map((art) => (
                <div
                  key={art.id}
                  className="aspect-square rounded-md border border-border overflow-hidden bg-muted/30"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      art.url ||
                      `/api/comfy/images?orgId=${orgId}&filename=${encodeURIComponent(art.filename)}&subfolder=${encodeURIComponent(art.subfolder)}`
                    }
                    alt={art.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <span className="text-2xl font-bold" style={{ color }}>
          {value}
        </span>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════
   Helpers
   ═══════════════════════════════════════ */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Build a simple text-to-image SDXL workflow.
 * The user can later submit arbitrary workflow JSON for advanced use.
 */
function buildTextToImageWorkflow(
  prompt: string,
): Record<string, unknown> {
  return {
    "1": {
      class_type: "CheckpointLoaderSimple",
      inputs: {
        ckpt_name: "sd_xl_base_1.0.safetensors",
      },
    },
    "2": {
      class_type: "CLIPTextEncode",
      inputs: { text: prompt, clip: ["1", 1] },
    },
    "3": {
      class_type: "CLIPTextEncode",
      inputs: {
        text: "blurry, low quality, watermark, text, logo, frame, border",
        clip: ["1", 1],
      },
    },
    "4": {
      class_type: "EmptyLatentImage",
      inputs: { width: 1024, height: 1024, batch_size: 1 },
    },
    "5": {
      class_type: "KSampler",
      inputs: {
        model: ["1", 0],
        positive: ["2", 0],
        negative: ["3", 0],
        latent_image: ["4", 0],
        seed: Math.floor(Math.random() * 2 ** 32),
        steps: 25,
        cfg: 7.5,
        sampler_name: "euler_ancestral",
        scheduler: "normal",
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
