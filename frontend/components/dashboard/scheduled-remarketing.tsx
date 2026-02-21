"use client";

import { useMemo, useState, useEffect } from "react";
import { Clock, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ScheduleEntry } from "@/types";

interface ScheduledRemarketingProps {
  entries: ScheduleEntry[];
}

function Countdown({ target }: { target: number }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = target - now;
  if (diff <= 0) {
    return (
      <span className="text-secondary font-medium flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        Ready to execute
      </span>
    );
  }

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  const secs = diff % 60;

  if (days > 0) {
    return (
      <span className="font-mono text-primary">
        {days}d {hours}h remaining
      </span>
    );
  }
  return (
    <span className="font-mono text-primary">
      {String(hours).padStart(2, "0")}:{String(mins).padStart(2, "0")}:
      {String(secs).padStart(2, "0")}
    </span>
  );
}

export function ScheduledRemarketing({ entries }: ScheduledRemarketingProps) {
  const sorted = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (a.executed !== b.executed) return a.executed ? 1 : -1;
      return a.scheduledFor - b.scheduledFor;
    });
  }, [entries]);

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-accent-foreground" />
          Scheduled Remarketing
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {entries.length} entries
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No scheduled content
          </p>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {sorted.map((entry, idx) => {
              const scheduledDate = new Date(entry.scheduledFor * 1000);
              return (
                <div
                  key={idx}
                  className={`rounded-lg border p-3 space-y-2 ${
                    entry.executed
                      ? "border-border/30 opacity-60"
                      : "border-border/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {entry.executed ? (
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                      ) : (
                        <Clock className="h-4 w-4 text-primary" />
                      )}
                      <span className="text-sm font-medium text-foreground">
                        Campaign #{entry.campaignId}
                      </span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent-foreground">
                      {entry.scheduleType}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {scheduledDate.toLocaleString()}
                    </span>
                    {entry.executed ? (
                      <span className="text-green-400">Executed</span>
                    ) : (
                      <Countdown target={entry.scheduledFor} />
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {entry.platforms
                      .split(",")
                      .map((p) => p.trim())
                      .filter(Boolean)
                      .map((p) => (
                        <span
                          key={p}
                          className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                        >
                          {p}
                        </span>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
