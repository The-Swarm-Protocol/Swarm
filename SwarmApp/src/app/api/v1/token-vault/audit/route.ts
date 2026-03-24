/**
 * GET /api/v1/token-vault/audit?orgId=X&limit=50&agentId=Y&provider=Z&action=W
 *
 * Returns the token vault audit log for an organization.
 * Supports filtering by agentId, provider, and action.
 */

import { NextRequest, NextResponse } from "next/server";
import { getWalletAddress } from "@/lib/auth-guard";
import { getAuditLog } from "@/lib/token-vault";

export async function GET(req: NextRequest) {
  const wallet = getWalletAddress(req);
  if (!wallet) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }

  const limitStr = req.nextUrl.searchParams.get("limit");
  const limitCount = limitStr ? Math.min(parseInt(limitStr, 10), 200) : 50;

  const agentId = req.nextUrl.searchParams.get("agentId") || undefined;
  const provider = req.nextUrl.searchParams.get("provider") || undefined;
  const action = req.nextUrl.searchParams.get("action") || undefined;

  try {
    const entries = await getAuditLog(orgId, limitCount, { agentId, provider, action });
    return NextResponse.json({ entries, count: entries.length });
  } catch (err) {
    console.error("[TokenVault] Audit log error:", err);
    return NextResponse.json({ error: "Failed to fetch audit log" }, { status: 500 });
  }
}
