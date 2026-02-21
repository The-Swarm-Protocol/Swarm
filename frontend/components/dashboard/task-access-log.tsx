"use client";

import { useState, useEffect } from "react";
import { KeyRound, CheckCircle2, XCircle, Clock, ShieldOff } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { shortAddr } from "@/lib/utils";
import type { TaskAccessEvent } from "@/types";

interface TaskAccessLogProps {
  entries: TaskAccessEvent[];
}

function ExpiresCountdown({ expiresAt }: { expiresAt: number }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = expiresAt - now;
  if (diff <= 0) {
    return <span className="text-muted-foreground text-xs">Expired</span>;
  }

  const hours = Math.floor(diff / 3600);
  const mins = Math.floor((diff % 3600) / 60);

  return (
    <span className="text-xs font-mono text-primary flex items-center gap-1">
      <Clock className="h-3 w-3" />
      {hours}h {mins}m left
    </span>
  );
}

export function TaskAccessLog({ entries }: TaskAccessLogProps) {
  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-accent-foreground" />
          Task Access Log
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {entries.length} delegations
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No worker delegations
          </p>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {entries.map((entry) => (
              <div
                key={entry.taskId}
                className={`rounded-lg border p-3 space-y-2 ${
                  entry.revoked ? "border-border/30 opacity-60" : "border-border/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    Task #{entry.taskId}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {entry.revoked && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/20 text-destructive flex items-center gap-1">
                        <ShieldOff className="h-3 w-3" />
                        Revoked
                      </span>
                    )}
                    {entry.delivered && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          entry.guidelinesMatch
                            ? "bg-green-500/20 text-green-400"
                            : "bg-destructive/20 text-destructive"
                        }`}
                      >
                        {entry.guidelinesMatch ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {entry.guidelinesMatch ? "PASS" : "FAIL"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <code className="bg-muted px-1.5 py-0.5 rounded">
                    {shortAddr(entry.workerAgent)}
                  </code>
                  <ExpiresCountdown expiresAt={entry.expiresAt} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
