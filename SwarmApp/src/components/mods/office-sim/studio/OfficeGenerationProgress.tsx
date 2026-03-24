/** OfficeGenerationProgress — Multi-task progress grid for batch office generation */
"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, Loader2, XCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  FURNITURE_LABELS,
  type FurnitureCategory,
} from "./furniture-types";
import {
  TEXTURE_LABELS,
  type TextureMaterial,
} from "./texture-types";

interface BatchTask {
  type: "furniture" | "texture";
  id: string;
  category: string;
}

interface TaskStatus {
  id: string;
  status: string;
  progress?: number;
  completed?: boolean;
}

export function OfficeGenerationProgress({
  tasks,
}: {
  tasks: BatchTask[];
}) {
  const [statuses, setStatuses] = useState<Map<string, TaskStatus>>(new Map());
  const [polling, setPolling] = useState(true);

  const pollTask = useCallback(async (task: BatchTask) => {
    try {
      const endpoint = task.type === "furniture"
        ? `/api/v1/mods/office-sim/furniture-design/${task.id}`
        : `/api/v1/mods/office-sim/texture-design/${task.id}`;

      const res = await fetch(endpoint);
      if (!res.ok) return;
      const data = await res.json();

      setStatuses((prev) => {
        const next = new Map(prev);
        next.set(task.id, {
          id: task.id,
          status: data.status,
          progress: data.meshy?.progress || data.provider?.progress,
          completed: data.completed,
        });
        return next;
      });
    } catch {
      // Ignore individual poll failures
    }
  }, []);

  // Poll all tasks periodically
  useEffect(() => {
    if (!polling || tasks.length === 0) return;

    const pollAll = () => {
      for (const task of tasks) {
        const current = statuses.get(task.id);
        if (current?.status === "completed" || current?.status === "failed") continue;
        pollTask(task);
      }
    };

    pollAll();
    const interval = setInterval(pollAll, 4000);
    return () => clearInterval(interval);
  }, [tasks, polling, pollTask, statuses]);

  // Check if all done
  useEffect(() => {
    if (tasks.length === 0) return;
    const allDone = tasks.every((t) => {
      const s = statuses.get(t.id);
      return s?.status === "completed" || s?.status === "failed";
    });
    if (allDone) setPolling(false);
  }, [tasks, statuses]);

  const completedCount = tasks.filter(
    (t) => statuses.get(t.id)?.status === "completed",
  ).length;
  const failedCount = tasks.filter(
    (t) => statuses.get(t.id)?.status === "failed",
  ).length;

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {completedCount}/{tasks.length} completed
          {failedCount > 0 && ` (${failedCount} failed)`}
        </span>
        {polling && (
          <Badge variant="outline" className="text-[10px] gap-1">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            Generating...
          </Badge>
        )}
        {!polling && completedCount === tasks.length && (
          <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-400">
            All done
          </Badge>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-amber-500 transition-all duration-500"
          style={{ width: `${tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0}%` }}
        />
      </div>

      {/* Task grid */}
      <div className="grid grid-cols-2 gap-2">
        {tasks.map((task) => {
          const status = statuses.get(task.id);
          const label = task.type === "furniture"
            ? FURNITURE_LABELS[task.category as FurnitureCategory] || task.category
            : TEXTURE_LABELS[task.category as TextureMaterial] || task.category;

          return (
            <div
              key={task.id}
              className="flex items-center gap-2 p-2 rounded border border-border text-xs"
            >
              <TaskIcon status={status?.status} />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{label}</p>
                <p className="text-[10px] text-muted-foreground capitalize">
                  {status?.status || "pending"}
                  {status?.progress ? ` (${Math.round(status.progress)}%)` : ""}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskIcon({ status }: { status?: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-400 shrink-0" />;
    case "generating_3d":
    case "refining_3d":
    case "generating":
    case "uploading":
      return <Loader2 className="h-4 w-4 text-amber-400 animate-spin shrink-0" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
}
