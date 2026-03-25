/** ArtCustomizeDialog — Prompt dialog for AI art generation per slot */
"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, RotateCcw, Loader2, CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ArtSlot, ArtPipeline, ArtGenerationStatus } from "./art-types";
import { ART_LABELS, ART_PIPELINE, ART_EXAMPLE_PROMPTS } from "./art-types";
import type { OfficeTheme } from "../themes";

interface ArtCustomizeDialogProps {
  slot: ArtSlot;
  orgId: string;
  theme: OfficeTheme;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when art generation completes or is reverted */
  onArtChanged?: () => void;
  /** Existing art task ID for revert */
  existingTaskId?: string;
}

export function ArtCustomizeDialog({
  slot,
  orgId,
  theme,
  open,
  onOpenChange,
  onArtChanged,
  existingTaskId,
}: ArtCustomizeDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<ArtGenerationStatus | null>(null);
  const [progress, setProgress] = useState(0);

  const pipeline: ArtPipeline = ART_PIPELINE[slot.category];
  const examples = ART_EXAMPLE_PROMPTS[slot.category];

  // Poll task progress
  useEffect(() => {
    if (!taskId || taskStatus === "completed" || taskStatus === "failed") return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/v1/mods/office-sim/art-design/${taskId}`);
        if (!res.ok) return;
        const data = await res.json();
        setTaskStatus(data.status);

        const pipelineState = data.meshy || data.comfyui;
        if (pipelineState?.progress) {
          setProgress(pipelineState.progress);
        }

        if (data.completed) {
          if (data.status === "completed") {
            onArtChanged?.();
          }
        }
      } catch {
        // Ignore poll errors
      }
    };

    poll();
    const interval = setInterval(poll, 4000);
    return () => clearInterval(interval);
  }, [taskId, taskStatus, onArtChanged]);

  const handleSubmit = useCallback(async () => {
    if (!prompt.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/mods/office-sim/art-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          themeId: theme.id,
          slotId: slot.id,
          prompt: prompt.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit");
        return;
      }

      setTaskId(data.taskId);
      setTaskStatus("pending");
      setProgress(0);
    } catch {
      setError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }, [prompt, orgId, theme.id, slot.id]);

  const handleRevert = useCallback(async () => {
    if (!existingTaskId) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/mods/office-sim/art-design", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: existingTaskId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to revert");
        return;
      }

      onArtChanged?.();
      onOpenChange(false);
    } catch {
      setError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }, [existingTaskId, onArtChanged, onOpenChange]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setPrompt("");
      setError(null);
      setTaskId(null);
      setTaskStatus(null);
      setProgress(0);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            Customize: {slot.label}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Category + Pipeline info */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {ART_LABELS[slot.category]}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {pipeline === "meshy" ? "3D Model (Meshy)" : "2D Image (ComfyUI)"}
            </Badge>
          </div>

          {/* Theme style hint */}
          <div className="text-[10px] text-muted-foreground bg-muted/30 rounded px-2 py-1.5">
            Theme style: <span className="text-foreground/70">{theme.artStylePrompt}</span>
          </div>

          {/* Generation in progress */}
          {taskId && taskStatus && taskStatus !== "completed" && taskStatus !== "failed" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                <span className="capitalize">{taskStatus}...</span>
                <span className="text-muted-foreground text-xs ml-auto">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : taskStatus === "completed" ? (
            <div className="flex items-center gap-2 text-sm text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              Art generated successfully!
            </div>
          ) : taskStatus === "failed" ? (
            <div className="flex items-center gap-2 text-sm text-red-400">
              <XCircle className="h-4 w-4" />
              Generation failed. Please try again.
            </div>
          ) : (
            <>
              {/* Prompt input */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  Describe the art piece
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={`Describe the ${ART_LABELS[slot.category].toLowerCase()} you want...`}
                  className="w-full h-24 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-none"
                  maxLength={500}
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  {prompt.length}/500
                </span>
              </div>

              {/* Example prompts */}
              <div>
                <label className="text-[10px] text-muted-foreground mb-1.5 block uppercase tracking-wider">
                  Examples
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {examples.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setPrompt(ex)}
                      className="text-[10px] px-2 py-1 rounded-full border border-border hover:border-amber-500/30 hover:text-amber-400 transition-colors"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {existingTaskId && !taskId && (
              <Button
                variant="outline"
                size="sm"
                disabled={submitting}
                onClick={handleRevert}
                className="text-xs"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Revert to Default
              </Button>
            )}

            {!taskId && (
              <Button
                className="flex-1"
                disabled={!prompt.trim() || submitting}
                onClick={handleSubmit}
              >
                {submitting ? "Submitting..." : "Generate Art"}
              </Button>
            )}

            {taskStatus === "completed" && (
              <Button className="flex-1" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            )}

            {taskStatus === "failed" && (
              <Button
                className="flex-1"
                onClick={() => {
                  setTaskId(null);
                  setTaskStatus(null);
                  setProgress(0);
                }}
              >
                Try Again
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
