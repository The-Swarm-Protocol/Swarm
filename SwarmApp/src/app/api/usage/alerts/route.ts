/**
 * POST /api/usage/alerts
 * Create a new budget alert
 *
 * Body: { orgId, alertType: "daily" | "weekly" | "monthly", threshold }
 *
 * GET /api/usage/alerts
 * Get all budget alerts for an org
 *
 * Query params: orgId (required)
 */

import { NextRequest } from "next/server";
import {
  createBudgetAlert,
  getBudgetAlerts,
  checkBudgetAlerts,
  type AlertType,
} from "@/lib/cost-intelligence";
import { getWalletAddress, requireOrgMember } from "@/lib/auth-guard";

export async function POST(request: NextRequest) {
  const wallet = getWalletAddress(request);
  if (!wallet) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { orgId, alertType, threshold } = body;

  if (!orgId || !alertType || typeof threshold !== "number") {
    return Response.json(
      { error: "orgId, alertType, and threshold (number) are required" },
      { status: 400 }
    );
  }

  // Verify caller is a member of the org
  const orgAuth = await requireOrgMember(request, orgId as string);
  if (!orgAuth.ok) {
    return Response.json({ error: orgAuth.error }, { status: orgAuth.status || 403 });
  }

  if (!["daily", "weekly", "monthly"].includes(alertType as string)) {
    return Response.json(
      { error: "alertType must be daily, weekly, or monthly" },
      { status: 400 }
    );
  }

  if (threshold <= 0 || threshold > 1_000_000) {
    return Response.json(
      { error: "threshold must be between 0 and 1,000,000" },
      { status: 400 }
    );
  }

  try {
    const alertId = await createBudgetAlert(
      orgId as string,
      alertType as AlertType,
      threshold as number
    );

    return Response.json({
      ok: true,
      alertId,
      message: `${alertType} budget alert created with threshold $${threshold}`,
    });
  } catch (err) {
    console.error("Create alert error:", err);
    return Response.json(
      { error: "Failed to create budget alert" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const wallet = getWalletAddress(request);
  if (!wallet) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId");
  const check = searchParams.get("check") === "true";

  if (!orgId) {
    return Response.json({ error: "orgId is required" }, { status: 400 });
  }

  const orgAuth = await requireOrgMember(request, orgId);
  if (!orgAuth.ok) {
    return Response.json({ error: orgAuth.error }, { status: orgAuth.status || 403 });
  }

  try {
    if (check) {
      // Check for triggered alerts
      const triggeredAlerts = await checkBudgetAlerts(orgId);
      return Response.json({
        ok: true,
        triggeredAlerts,
        count: triggeredAlerts.length,
      });
    } else {
      // Get all alerts
      const alerts = await getBudgetAlerts(orgId);
      return Response.json({
        ok: true,
        alerts,
        count: alerts.length,
      });
    }
  } catch (err) {
    console.error("Get alerts error:", err);
    return Response.json(
      { error: "Failed to retrieve budget alerts" },
      { status: 500 }
    );
  }
}
