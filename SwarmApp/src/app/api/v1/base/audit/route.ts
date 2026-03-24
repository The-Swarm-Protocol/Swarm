/**
 * GET /api/v1/base/audit?orgId=X&limit=100&action=payment_sent
 *
 * Query the Base mod audit log.
 */

import { NextRequest, NextResponse } from "next/server";
import { getWalletAddress } from "@/lib/auth-guard";
import { getAuditLog, type AuditAction } from "@/lib/base-accounts";

export async function GET(req: NextRequest) {
    const wallet = getWalletAddress(req);
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId is required" }, { status: 400 });

    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "100", 10);
    const action = req.nextUrl.searchParams.get("action") as AuditAction | null;

    try {
        const entries = await getAuditLog(orgId, Math.min(limit, 500), action ?? undefined);
        return NextResponse.json({ entries });
    } catch (err) {
        console.error("[Base] Get audit log error:", err);
        return NextResponse.json({ error: "Failed to get audit log" }, { status: 500 });
    }
}
