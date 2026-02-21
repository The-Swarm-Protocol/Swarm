"use client";

import { Wallet, Cpu, TrendingUp, Shield } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toHbar } from "@/lib/utils";
import type { TreasuryPnL } from "@/types";

interface AgentPnLProps {
  treasury: TreasuryPnL;
}

export function AgentPnL({ treasury }: AgentPnLProps) {
  const total = Number(treasury.totalRevenue);
  const reserve = Number(treasury.reserveBalance);
  const compute = Number(treasury.computeBalance);
  const growth = Number(treasury.growthBalance);
  const threshold = Number(treasury.growthThreshold);

  // Percentages for the progress bar
  const reservePct = total > 0 ? (reserve / total) * 100 : 80;
  const computePct = total > 0 ? (compute / total) * 100 : 10;
  const growthPct = total > 0 ? (growth / total) * 100 : 10;

  // Growth threshold progress
  const growthToThreshold = threshold > 0 ? Math.min((growth / threshold) * 100, 100) : 0;

  const buckets = [
    {
      label: "Total Revenue",
      value: treasury.totalRevenue,
      icon: Wallet,
      color: "text-primary",
      bg: "bg-primary/20",
    },
    {
      label: "Reserve (80%)",
      value: treasury.reserveBalance,
      icon: Shield,
      color: "text-blue-400",
      bg: "bg-blue-400/20",
    },
    {
      label: "Compute (10%)",
      value: treasury.computeBalance,
      icon: Cpu,
      color: "text-secondary",
      bg: "bg-secondary/20",
    },
    {
      label: "Growth (10%)",
      value: treasury.growthBalance,
      icon: TrendingUp,
      color: "text-green-400",
      bg: "bg-green-400/20",
    },
  ];

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          Agent Treasury P&L
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {buckets.map((b) => (
            <div key={b.label} className="space-y-1">
              <div className="flex items-center gap-1.5">
                <b.icon className={`h-4 w-4 ${b.color}`} />
                <span className="text-xs text-muted-foreground">{b.label}</span>
              </div>
              <p className={`text-lg font-bold ${b.color}`}>
                {toHbar(b.value)} HBAR
              </p>
            </div>
          ))}
        </div>

        {/* Split bar */}
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Revenue Split</p>
          <div className="h-3 rounded-full overflow-hidden flex bg-muted">
            <div
              className="bg-blue-400 transition-all"
              style={{ width: `${reservePct}%` }}
              title={`Reserve: ${reservePct.toFixed(1)}%`}
            />
            <div
              className="bg-secondary transition-all"
              style={{ width: `${computePct}%` }}
              title={`Compute: ${computePct.toFixed(1)}%`}
            />
            <div
              className="bg-green-400 transition-all"
              style={{ width: `${growthPct}%` }}
              title={`Growth: ${growthPct.toFixed(1)}%`}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>Reserve 80%</span>
            <span>Compute 10%</span>
            <span>Growth 10%</span>
          </div>
        </div>

        {/* Growth threshold */}
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">
            Growth Threshold: {toHbar(treasury.growthBalance)} / {toHbar(treasury.growthThreshold)} HBAR
          </p>
          <div className="h-2 rounded-full overflow-hidden bg-muted">
            <div
              className="h-full bg-green-400 rounded-full transition-all"
              style={{ width: `${growthToThreshold}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {growthToThreshold >= 100
              ? "Threshold reached — self-marketing triggered"
              : `${(100 - growthToThreshold).toFixed(0)}% to auto-trigger`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
