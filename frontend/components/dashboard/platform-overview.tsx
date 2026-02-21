"use client";

import { Building2, Megaphone, DollarSign, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toHbar } from "@/lib/utils";
import type { DashboardData } from "@/types";

interface PlatformOverviewProps {
  data: DashboardData;
}

export function PlatformOverview({ data }: PlatformOverviewProps) {
  const stats = [
    {
      label: "Total Brands",
      value: data.registryTotalBrands.toString(),
      icon: Building2,
      color: "text-primary",
    },
    {
      label: "Total Campaigns",
      value: data.campaigns.length.toString(),
      icon: Megaphone,
      color: "text-secondary",
    },
    {
      label: "Registry Revenue",
      value: `${toHbar(data.registryTotalRevenue)} HBAR`,
      icon: DollarSign,
      color: "text-green-400",
    },
    {
      label: "Growth Balance",
      value: `${toHbar(data.treasury?.growthBalance ?? 0n)} HBAR`,
      icon: TrendingUp,
      color: "text-accent-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => (
        <Card key={s.label} className="border-primary/20">
          <CardContent className="pt-0">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2.5">
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
