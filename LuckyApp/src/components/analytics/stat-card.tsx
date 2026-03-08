/** Stat Card — Reusable analytics card with title, value, trend indicator, and optional sparkline. */
"use client";

import React from "react";
import { cn } from "@/lib/utils";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import CountUp from "@/components/reactbits/CountUp";
import DecryptedText from "@/components/reactbits/DecryptedText";

interface StatCardProps {
  title: string;
  value: string;
  icon: string | React.ComponentType<{ className?: string }>;
  change?: number;
  changeLabel?: string;
  prefix?: string;
}

export function StatCard({ title, value, icon: IconOrEmoji, change, changeLabel, prefix }: StatCardProps) {
  const isPositive = change !== undefined && change >= 0;
  const hasChange = change !== undefined;
  const numericValue = parseFloat(value.replace(/[^0-9.-]/g, ''));
  const isNumeric = !isNaN(numericValue) && isFinite(numericValue);

  return (
    <div className="gradient-border-spin overflow-hidden rounded-xl">
      <SpotlightCard className="p-4">
        <div className="flex items-center justify-between mb-1">
          <DecryptedText
            text={title}
            speed={40}
            maxIterations={8}
            className="text-xs font-medium text-muted-foreground"
            encryptedClassName="text-xs font-medium text-amber-500/50"
            animateOn="view"
            sequential
            revealDirection="start"
          />
          {typeof IconOrEmoji === "string" ? (
            <span className="text-xl">{IconOrEmoji}</span>
          ) : (
            <IconOrEmoji className="h-5 w-5 text-amber-400" />
          )}
        </div>
        <div className="text-xl font-bold tracking-tight text-glow-gold">
          {prefix}
          {isNumeric ? (
            <CountUp to={numericValue} duration={1.5} separator="," />
          ) : (
            value
          )}
        </div>
        {hasChange && change !== 0 && (
          <div className="flex items-center gap-1 mt-1">
            <span
              className={cn(
                "text-[10px] font-medium flex items-center gap-0.5",
                isPositive ? "text-amber-600 dark:text-amber-400" : "text-red-500"
              )}
            >
              {isPositive ? "↑" : "↓"} {Math.abs(change).toFixed(1)}%
            </span>
            {changeLabel && (
              <span className="text-xs text-muted-foreground">{changeLabel}</span>
            )}
          </div>
        )}
      </SpotlightCard>
    </div>
  );
}
