/**
 * GET  /api/v1/base/permissions?orgId=X&status=pending
 * POST /api/v1/base/permissions
 *
 * List and create spend permissions for Base sub-accounts.
 */

import { NextRequest, NextResponse } from "next/server";
import { getWalletAddress } from "@/lib/auth-guard";
import {
    getSpendPermissions,
    createSpendPermission,
    appendAuditLog,
    type PermissionStatus,
    type PermissionPeriod,
} from "@/lib/base-accounts";

export async function GET(req: NextRequest) {
    const wallet = getWalletAddress(req);
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId is required" }, { status: 400 });

    const status = req.nextUrl.searchParams.get("status") as PermissionStatus | null;

    try {
        const permissions = await getSpendPermissions(orgId, status ?? undefined);
        return NextResponse.json({ permissions });
    } catch (err) {
        console.error("[Base] List permissions error:", err);
        return NextResponse.json({ error: "Failed to list permissions" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const wallet = getWalletAddress(req);
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { orgId, agentId, agentName, amount, period, reason, subAccountId } = await req.json();

        if (!orgId || !agentId || !agentName || !amount || !period || !reason) {
            return NextResponse.json(
                { error: "orgId, agentId, agentName, amount, period, and reason are required" },
                { status: 400 },
            );
        }

        const validPeriods: PermissionPeriod[] = ["one-time", "daily", "weekly", "monthly", "unlimited"];
        if (!validPeriods.includes(period)) {
            return NextResponse.json({ error: `period must be one of: ${validPeriods.join(", ")}` }, { status: 400 });
        }

        const id = await createSpendPermission({
            orgId,
            agentId,
            agentName,
            subAccountId: subAccountId || null,
            amount,
            period,
            reason,
        });

        await appendAuditLog({
            orgId,
            action: "permission_requested",
            actorType: "agent",
            actorId: agentId,
            description: `${agentName} requested ${amount} USDC ${period} spend permission: ${reason}`,
            metadata: { permissionId: id, amount, period },
        });

        return NextResponse.json({ id, status: "pending" }, { status: 201 });
    } catch (err) {
        console.error("[Base] Create permission error:", err);
        return NextResponse.json({ error: "Failed to create permission" }, { status: 500 });
    }
}
