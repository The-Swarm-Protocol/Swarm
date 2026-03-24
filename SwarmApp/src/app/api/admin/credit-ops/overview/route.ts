/**
 * GET /api/admin/credit-ops/overview
 *
 * Dashboard stats for the credit operations admin panel.
 */

import { NextRequest } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth-guard";
import { getReviewQueueStats } from "@/lib/credit-ops/review";
import { getCreditOpsAuditLog } from "@/lib/credit-ops/audit";

export async function GET(req: NextRequest) {
  const auth = requirePlatformAdmin(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: 403 });

  try {
    const [queueStats, recentAudit] = await Promise.all([
      getReviewQueueStats(),
      getCreditOpsAuditLog({ limit: 10 }),
    ]);

    return Response.json({
      ok: true,
      stats: {
        queueDepth: queueStats.pending + queueStats.inReview,
        pending: queueStats.pending,
        inReview: queueStats.inReview,
        resolved: queueStats.resolved,
        byPriority: queueStats.byPriority,
        byFlagType: queueStats.byFlagType,
        // Placeholders for future phases
        activeAlerts: 0,
        openAppeals: 0,
        openDisputes: 0,
      },
      recentAudit,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to fetch overview" },
      { status: 500 },
    );
  }
}
