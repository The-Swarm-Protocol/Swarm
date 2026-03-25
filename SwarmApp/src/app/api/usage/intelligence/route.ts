/**
 * GET /api/usage/intelligence
 *
 * Returns cost intelligence data: predictions, anomalies, trends, leaderboard
 * Query params:
 *  - orgId (required)
 *  - daysBack (optional, default 30 for historical analysis)
 *  - daysToPredict (optional, default 7 for future projections)
 */

import { NextRequest } from "next/server";
import {
  predictFutureCost,
  detectAnomalies,
  analyzeCostTrend,
  getAgentCostLeaderboard,
  calculateBurnRate,
} from "@/lib/cost-intelligence";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId");
  const rawDaysBack = parseInt(searchParams.get("daysBack") || "30", 10);
  const daysBack = isNaN(rawDaysBack) ? 30 : Math.max(1, Math.min(rawDaysBack, 90));
  const rawPredict = parseInt(searchParams.get("daysToPredict") || "7", 10);
  const daysToPredict = isNaN(rawPredict) ? 7 : Math.max(1, Math.min(rawPredict, 30));

  if (!orgId) {
    return Response.json(
      { error: "orgId is required" },
      { status: 400 }
    );
  }

  try {
    // Run all analytics in parallel
    const [projections, anomalies, trend, leaderboard, burnRate] = await Promise.all([
      predictFutureCost(orgId, daysToPredict),
      detectAnomalies(orgId, daysBack),
      analyzeCostTrend(orgId, Math.min(daysBack, 14)), // Use max 14 days for trend
      getAgentCostLeaderboard(orgId, daysBack, 10),
      calculateBurnRate(orgId, 24),
    ]);

    return Response.json({
      ok: true,
      data: {
        projections,
        anomalies,
        trend,
        leaderboard,
        burnRate,
        daysAnalyzed: daysBack,
      },
    });
  } catch (err) {
    console.error("Intelligence API error:", err);
    return Response.json(
      { error: "Failed to generate cost intelligence" },
      { status: 500 }
    );
  }
}
