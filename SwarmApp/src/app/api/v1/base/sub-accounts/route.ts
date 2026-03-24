/**
 * GET  /api/v1/base/sub-accounts?orgId=X
 * POST /api/v1/base/sub-accounts
 *
 * List and create Base sub-accounts for an organization.
 */

import { NextRequest, NextResponse } from "next/server";
import { getWalletAddress } from "@/lib/auth-guard";
import { getSubAccounts, createSubAccount, appendAuditLog } from "@/lib/base-accounts";

export async function GET(req: NextRequest) {
    const wallet = getWalletAddress(req);
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId is required" }, { status: 400 });

    try {
        const accounts = await getSubAccounts(orgId);
        return NextResponse.json({ accounts });
    } catch (err) {
        console.error("[Base] List sub-accounts error:", err);
        return NextResponse.json({ error: "Failed to list sub-accounts" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const wallet = getWalletAddress(req);
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { orgId, agentId, label, address, dailyLimit = 0, monthlyLimit = 0 } = await req.json();

        if (!orgId || !label || !address) {
            return NextResponse.json({ error: "orgId, label, and address are required" }, { status: 400 });
        }

        const id = await createSubAccount({
            orgId,
            agentId: agentId || null,
            label,
            address,
            dailyLimit,
            monthlyLimit,
            createdBy: wallet,
        });

        await appendAuditLog({
            orgId,
            action: "subaccount_created",
            actorType: "user",
            actorId: wallet,
            description: `Created sub-account "${label}" for ${agentId || "org"}`,
            metadata: { subAccountId: id, address, agentId },
        });

        return NextResponse.json({ id, address }, { status: 201 });
    } catch (err) {
        console.error("[Base] Create sub-account error:", err);
        return NextResponse.json({ error: "Failed to create sub-account" }, { status: 500 });
    }
}
