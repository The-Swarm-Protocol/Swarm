"use client";

import { RefreshCw, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/header";
import { useDashboardData } from "@/hooks/useDashboardData";
import { PlatformOverview } from "@/components/dashboard/platform-overview";
import { AgentPnL } from "@/components/dashboard/agent-pnl";
import { VaultStatus } from "@/components/dashboard/vault-status";
import { CampaignFeed } from "@/components/dashboard/campaign-feed";
import { ScheduledRemarketing } from "@/components/dashboard/scheduled-remarketing";
import { TaskAccessLog } from "@/components/dashboard/task-access-log";
import { AgentActivityTimeline } from "@/components/dashboard/agent-activity-timeline";

export default function Home() {
  const { data, isLoading, error, refetch, lastRefresh } = useDashboardData();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header lastRefresh={lastRefresh} />

      <main className="flex-1 container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">
              Loading data from Hedera Testnet...
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
              <Button variant="ghost" size="sm" onClick={refetch}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>

            {/* Platform Overview - full width stat row */}
            <PlatformOverview data={data} />

            {/* Agent P&L - full width */}
            {data.treasury && <AgentPnL treasury={data.treasury} />}

            {/* 2-column grid: Vault Status | Campaign Feed */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {data.vault && <VaultStatus vault={data.vault} />}
              <CampaignFeed campaigns={data.campaigns} />
            </div>

            {/* 2-column grid: Task Access Log | Scheduled Remarketing */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TaskAccessLog entries={data.taskAccess} />
              <ScheduledRemarketing entries={data.scheduled} />
            </div>

            {/* Full width: Agent Activity Timeline */}
            <AgentActivityTimeline entries={data.activity} />
          </div>
        )}
      </main>

      <footer className="border-t border-border mt-auto">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>BrandMover — Autonomous AI CMO on Hedera</p>
        </div>
      </footer>
    </div>
  );
}
