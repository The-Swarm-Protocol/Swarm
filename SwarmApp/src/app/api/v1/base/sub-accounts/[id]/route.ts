/**
 * GET    /api/v1/base/sub-accounts/[id]
 * PATCH  /api/v1/base/sub-accounts/[id]
 * DELETE /api/v1/base/sub-accounts/[id]
 *
 * Get, update, or close a specific Base sub-account.
 */

import { NextRequest, NextResponse } from "next/server";
import { getWalletAddress } from "@/lib/auth-guard";
import { getSubAccount, updateSubAccount, appendAuditLog } from "@/lib/base-accounts";

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, ctx: RouteContext) {
    const wallet = getWalletAddress(req);
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;
    try {
        const account = await getSubAccount(id);
        if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ account });
    } catch (err) {
        console.error("[Base] Get sub-account error:", err);
        return NextResponse.json({ error: "Failed to get sub-account" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
    const wallet = getWalletAddress(req);
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;
    try {
        const updates = await req.json() as Record<string, unknown>;
        const allowed = ["label", "dailyLimit", "monthlyLimit", "balance", "status"];
        const filtered: Record<string, unknown> = {};
        for (const key of allowed) {
            if (updates[key] !== undefined) filtered[key] = updates[key];
        }

        if (Object.keys(filtered).length === 0) {
            return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
        }

        await updateSubAccount(id, filtered);

        const account = await getSubAccount(id);
        if (account) {
            const actionMap: Record<string, string> = {
                frozen: "subaccount_frozen",
                closed: "subaccount_closed",
            };
            const auditAction = filtered.status ? actionMap[filtered.status as string] : null;
            if (auditAction) {
                await appendAuditLog({
                    orgId: account.orgId,
                    action: auditAction as "subaccount_frozen" | "subaccount_closed",
                    actorType: "user",
                    actorId: wallet,
                    description: `Sub-account "${account.label}" ${filtered.status}`,
                    metadata: { subAccountId: id },
                });
            }
        }

        return NextResponse.json({ updated: true });
    } catch (err) {
        console.error("[Base] Update sub-account error:", err);
        return NextResponse.json({ error: "Failed to update sub-account" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
    const wallet = getWalletAddress(req);
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;
    try {
        const account = await getSubAccount(id);
        if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

        await updateSubAccount(id, { status: "closed" });

        await appendAuditLog({
            orgId: account.orgId,
            action: "subaccount_closed",
            actorType: "user",
            actorId: wallet,
            description: `Closed sub-account "${account.label}"`,
            metadata: { subAccountId: id },
        });

        return NextResponse.json({ closed: true });
    } catch (err) {
        console.error("[Base] Close sub-account error:", err);
        return NextResponse.json({ error: "Failed to close sub-account" }, { status: 500 });
    }
}
