/** CharacterDesignDialog — Prompt dialog for AI character design */
"use client";

import { useState } from "react";
import { Palette, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { VisualAgent } from "../types";

const EXAMPLE_PROMPTS = [
  "Cyberpunk hacker with neon green hair",
  "Steampunk inventor with brass goggles",
  "Space marine in power armor",
  "Medieval wizard with a pointy hat",
  "Corporate executive in a sharp suit",
  "Robot with glowing blue eyes",
];

interface CharacterDesignDialogProps {
  agent: VisualAgent;
  orgId: string;
  onSubmitted?: (taskId: string) => void;
}

export function CharacterDesignDialog({
  agent,
  orgId,
  onSubmitted,
}: CharacterDesignDialogProps) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [pipelines, setPipelines] = useState<Set<string>>(new Set(["3d", "2d"]));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const togglePipeline = (p: string) => {
    setPipelines((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/mods/office-sim/character-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          agentId: agent.id,
          prompt: prompt.trim(),
          pipelines: Array.from(pipelines),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit");
        return;
      }

      onSubmitted?.(data.taskId);
      setOpen(false);
      setPrompt("");
    } catch {
      setError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="text-xs" onClick={() => setOpen(true)}>
        <Palette className="h-3 w-3 mr-1" />
        Design Character
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            Design Character for {agent.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Prompt */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              Describe the character appearance
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A cyberpunk hacker with neon green hair and a leather jacket..."
              className="w-full h-24 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-none"
              maxLength={500}
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-muted-foreground">
                {prompt.length}/500
              </span>
            </div>
          </div>

          {/* Example prompts */}
          <div>
            <label className="text-[10px] text-muted-foreground mb-1.5 block uppercase tracking-wider">
              Examples
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_PROMPTS.map((ex) => (
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

          {/* Pipeline selection */}
          <div>
            <label className="text-[10px] text-muted-foreground mb-1.5 block uppercase tracking-wider">
              Generate
            </label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={pipelines.has("3d")}
                  onChange={() => togglePipeline("3d")}
                  className="rounded border-border"
                />
                3D Model
                <Badge variant="outline" className="text-[9px]">
                  Meshy.ai
                </Badge>
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={pipelines.has("2d")}
                  onChange={() => togglePipeline("2d")}
                  className="rounded border-border"
                />
                2D Sprite
                <Badge variant="outline" className="text-[9px]">
                  ComfyUI
                </Badge>
              </label>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          {/* Submit */}
          <Button
            className="w-full"
            disabled={!prompt.trim() || pipelines.size === 0 || submitting}
            onClick={handleSubmit}
          >
            {submitting ? "Submitting..." : "Generate Character"}
          </Button>
        </div>
      </DialogContent>
      </Dialog>
    </>
  );
}
