/** CostMetricsPanel — Token usage and cost overview stub */
"use client";

import { DollarSign, BarChart3, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useOffice } from "../office-store";

export function CostMetricsPanel() {
  const { state } = useOffice();
  const agents = Array.from(state.agents.values());

  // Aggregate tool calls as a proxy metric
  const totalToolCalls = agents.reduce((sum, a) => sum + a.toolCallCount, 0);
  const activeAgents = agents.filter(
    (a) =>
      a.status === "active" ||
      a.status === "thinking" ||
      a.status === "tool_calling",
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold">Cost Metrics</h3>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <MetricCard
          label="Total Tool Calls"
          value={String(totalToolCalls)}
          icon={<BarChart3 className="h-3.5 w-3.5 text-blue-400" />}
        />
        <MetricCard
          label="Active Agents"
          value={String(activeAgents)}
          icon={<TrendingUp className="h-3.5 w-3.5 text-green-400" />}
        />
        <MetricCard
          label="Est. Tokens"
          value={totalToolCalls > 0 ? `~${(totalToolCalls * 850).toLocaleString()}` : "\u2014"}
          icon={<DollarSign className="h-3.5 w-3.5 text-amber-400" />}
        />
      </div>

      <Card>
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          Detailed cost analytics coming in v2.0.
          <br />
          <span className="text-xs text-muted-foreground/60">
            Connect usage APIs for per-agent token and cost tracking.
          </span>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 mb-1">
          {icon}
          <span className="text-[10px] text-muted-foreground">{label}</span>
        </div>
        <span className="text-lg font-bold">{value}</span>
      </CardContent>
    </Card>
  );
}
