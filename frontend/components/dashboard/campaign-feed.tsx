"use client";

import { useMemo } from "react";
import { Megaphone, ExternalLink } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EXPLORER_BASE } from "@/lib/constants";
import type { Campaign } from "@/types";

interface CampaignFeedProps {
  campaigns: Campaign[];
}

const STATUS_MAP: Record<number, { label: string; className: string }> = {
  0: { label: "Draft", className: "bg-muted text-muted-foreground" },
  1: { label: "Active", className: "bg-primary/20 text-primary" },
  2: { label: "Complete", className: "bg-green-500/20 text-green-400" },
  3: { label: "Scheduled", className: "bg-secondary/20 text-secondary" },
};

export function CampaignFeed({ campaigns }: CampaignFeedProps) {
  const sorted = useMemo(
    () => [...campaigns].sort((a, b) => b.createdAt - a.createdAt),
    [campaigns]
  );

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-secondary" />
          Campaign Feed
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {campaigns.length} total
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No campaigns yet
          </p>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {sorted.map((c) => {
              const status = STATUS_MAP[c.status] ?? STATUS_MAP[0];
              const date = new Date(c.createdAt * 1000);
              const platforms = c.platforms
                .split(",")
                .map((p) => p.trim())
                .filter(Boolean);
              return (
                <div
                  key={c.id}
                  className="rounded-lg border border-border/50 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm text-foreground">
                      {c.name}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent-foreground">
                      {c.campaignType}
                    </span>
                    {platforms.map((p) => (
                      <span
                        key={p}
                        className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <a
                      href={`${EXPLORER_BASE}/transaction/${c.contentHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                    >
                      <code className="bg-muted px-1 py-0.5 rounded text-[10px]">
                        {c.contentHash.slice(0, 16)}...
                      </code>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <span>{date.toLocaleDateString()}</span>
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
