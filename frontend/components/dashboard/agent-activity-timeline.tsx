"use client";

import { useMemo } from "react";
import { Activity, ExternalLink } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EXPLORER_BASE } from "@/lib/constants";
import type { ActivityEntry } from "@/types";

interface AgentActivityTimelineProps {
  entries: ActivityEntry[];
}

export function AgentActivityTimeline({
  entries,
}: AgentActivityTimelineProps) {
  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.timestamp - a.timestamp),
    [entries]
  );

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Agent Activity
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {entries.length} events
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No activity recorded
          </p>
        ) : (
          <div className="relative pl-6">
            {/* Vertical line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

            <div className="space-y-4">
              {sorted.map((entry, idx) => {
                const date = new Date(entry.timestamp * 1000);
                return (
                  <div key={idx} className="relative">
                    {/* Dot */}
                    <div className="absolute -left-6 top-1.5 h-3 w-3 rounded-full border-2 border-primary bg-background" />

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                          {entry.actionType}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {date.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-foreground">
                        {entry.description}
                      </p>
                      {entry.dataHash && entry.dataHash !== "0x0000000000000000000000000000000000000000000000000000000000000000" && (
                        <a
                          href={`${EXPLORER_BASE}/transaction/${entry.dataHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 hover:text-primary transition-colors"
                        >
                          <code className="text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded">
                            {entry.dataHash.slice(0, 20)}...
                          </code>
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
