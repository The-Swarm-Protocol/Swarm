/** GenerationProgress — Pipeline progress display for avatar generation */
"use client";

import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, XCircle, Box, Image } from "lucide-react";

interface PipelineStatus {
  status: string;
  progress?: number;
  error?: string;
  modelReady?: boolean;
  spriteReady?: boolean;
}

interface TaskStatus {
  id: string;
  status: string;
  prompt: string;
  pipelines: string[];
  meshy?: PipelineStatus;
  comfyui?: PipelineStatus;
  createdAt: unknown;
}

const MESHY_STEPS = [
  { key: "preview", label: "Preview" },
  { key: "refine", label: "Textures" },
  { key: "rig", label: "Rigging" },
  { key: "animate", label: "Animation" },
  { key: "uploading", label: "Uploading" },
  { key: "done", label: "Complete" },
];

const COMFY_STEPS = [
  { key: "generating", label: "Generating" },
  { key: "uploading", label: "Uploading" },
  { key: "done", label: "Complete" },
];

export function GenerationProgress({ taskId }: { taskId: string }) {
  const [task, setTask] = useState<TaskStatus | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Poll for status
  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const res = await fetch(
          `/api/v1/mods/office-sim/character-design/${taskId}`,
        );
        if (!res.ok) {
          setError("Failed to fetch status");
          return;
        }
        const data = await res.json();
        if (active) setTask(data.task);
      } catch {
        if (active) setError("Network error");
      }
    }

    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [taskId]);

  // Track elapsed time
  useEffect(() => {
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  if (error) {
    return (
      <div className="text-xs text-red-400 bg-red-500/10 rounded-md px-3 py-2">
        {error}
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading...
      </div>
    );
  }

  const isDone = ["completed", "partial", "failed"].includes(task.status);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isDone ? (
            task.status === "failed" ? (
              <XCircle className="h-3.5 w-3.5 text-red-400" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
            )
          ) : (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
          )}
          <span className="text-xs font-medium capitalize">
            {task.status.replace(/_/g, " ")}
          </span>
        </div>
        {!isDone && (
          <span className="text-[10px] text-muted-foreground font-mono">
            {minutes}:{seconds.toString().padStart(2, "0")}
          </span>
        )}
      </div>

      {/* 3D Pipeline */}
      {task.meshy && (
        <PipelineRow
          icon={<Box className="h-3 w-3" />}
          label="3D Model"
          steps={MESHY_STEPS}
          currentStatus={task.meshy.status}
          progress={task.meshy.progress}
          error={task.meshy.error}
        />
      )}

      {/* 2D Pipeline */}
      {task.comfyui && (
        <PipelineRow
          icon={<Image className="h-3 w-3" />}
          label="2D Sprite"
          steps={COMFY_STEPS}
          currentStatus={task.comfyui.status}
          progress={task.comfyui.progress}
          error={task.comfyui.error}
        />
      )}

      {/* Prompt reference */}
      <p className="text-[10px] text-muted-foreground/60 italic truncate">
        &quot;{task.prompt}&quot;
      </p>
    </div>
  );
}

function PipelineRow({
  icon,
  label,
  steps,
  currentStatus,
  progress,
  error,
}: {
  icon: React.ReactNode;
  label: string;
  steps: { key: string; label: string }[];
  currentStatus: string;
  progress?: number;
  error?: string;
}) {
  const currentIdx = steps.findIndex((s) => s.key === currentStatus);
  const isDone = currentStatus === "done";
  const isFailed = currentStatus === "failed";

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs">
        {icon}
        <span className="font-medium">{label}</span>
        {isDone && <CheckCircle2 className="h-3 w-3 text-green-400 ml-auto" />}
        {isFailed && <XCircle className="h-3 w-3 text-red-400 ml-auto" />}
      </div>

      {/* Step indicators */}
      {!isFailed && (
        <div className="flex items-center gap-0.5">
          {steps.map((step, i) => (
            <div
              key={step.key}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < currentIdx || isDone
                  ? "bg-green-500"
                  : i === currentIdx
                    ? "bg-amber-500 animate-pulse"
                    : "bg-muted"
              }`}
              title={step.label}
            />
          ))}
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-[10px] text-red-400">{error}</p>
      )}
    </div>
  );
}
