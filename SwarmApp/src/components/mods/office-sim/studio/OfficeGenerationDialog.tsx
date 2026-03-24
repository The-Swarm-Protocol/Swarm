/** OfficeGenerationDialog — "Generate Office" button + dialog for batch AI generation */
"use client";

import { useState, useCallback } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOffice } from "../office-store";
import { useOrg } from "@/contexts/OrgContext";
import { THEME_PRESETS } from "../themes";
import { OfficeGenerationProgress } from "./OfficeGenerationProgress";

interface BatchTask {
  type: "furniture" | "texture";
  id: string;
  category: string;
}

export function OfficeGenerationDialog() {
  const { state } = useOffice();
  const { currentOrg } = useOrg();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<BatchTask[]>([]);
  const [error, setError] = useState<string | null>(null);

  const theme = THEME_PRESETS.find((t) => t.id === state.theme.id) || THEME_PRESETS[0];

  const handleGenerate = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/mods/office-sim/generate-office", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: currentOrg.id,
          themeId: theme.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start generation");
        return;
      }

      setTasks(data.tasks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [currentOrg, theme.id]);

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="text-xs gap-1.5 h-8"
        onClick={() => setOpen(true)}
      >
        <Sparkles className="h-3 w-3" />
        Generate Office
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="w-full max-w-lg mx-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              Generate Office
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                setOpen(false);
                setTasks([]);
                setError(null);
              }}
            >
              Close
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Theme preview */}
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{theme.name}</span>
              <Badge variant="outline" className="text-[10px]">
                {theme.id}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {theme.description}
            </p>
            <div className="flex gap-2">
              {[theme.floorColor, theme.wallColor, theme.deskColor, theme.accentColor].map(
                (color, i) => (
                  <div
                    key={i}
                    className="w-6 h-6 rounded border border-border"
                    style={{ backgroundColor: color }}
                  />
                ),
              )}
            </div>
          </div>

          {/* Generation info */}
          {tasks.length === 0 && (
            <div className="text-xs text-muted-foreground space-y-1">
              <p>This will generate AI artwork for your office:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>6 furniture pieces (desk, chair, plant, whiteboard, coffee machine, lamp)</li>
                <li>2 tileable textures (wood floor, concrete wall)</li>
              </ul>
              <p className="mt-2">
                Generation takes 2-5 minutes per item. You can close this dialog
                and check back later.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Progress */}
          {tasks.length > 0 && (
            <OfficeGenerationProgress tasks={tasks} />
          )}

          {/* Actions */}
          {tasks.length === 0 && (
            <Button
              onClick={handleGenerate}
              disabled={loading || !currentOrg}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Starting...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate for "{theme.name}"
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
