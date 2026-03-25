/**
 * GET /api/llm/routing-stats
 *
 * Get routing analytics and cost savings
 *
 * Query params:
 *   orgId: string (required)
 *   daysBack: number (optional, default: 7)
 *
 * Returns: {
 *   decisions: RoutingDecision[]
 *   totalSavings: number
 *   fallbackRate: number
 * }
 */

import { NextRequest } from "next/server";
import { getRoutingStats } from "@/lib/model-router";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const orgId = searchParams.get("orgId");
  const rawDays = parseInt(searchParams.get("daysBack") || "7", 10);
  const daysBack = isNaN(rawDays) ? 7 : Math.max(1, Math.min(rawDays, 90));

  if (!orgId) {
    return Response.json({ error: "orgId is required" }, { status: 400 });
  }

  try {
    const stats = await getRoutingStats(orgId, daysBack);

    return Response.json({
      ok: true,
      ...stats,
    });
  } catch (err) {
    console.error("Error fetching routing stats:", err);
    return Response.json(
      { error: "Failed to fetch routing stats" },
      { status: 500 }
    );
  }
}
