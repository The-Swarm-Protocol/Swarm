/**
 * PATCH /api/v1/base/recurring/[id]
 *
 * Update recurring payment status (pause, resume, cancel).
 */

import { NextRequest, NextResponse } from "next/server";
import { getWalletAddress } from "@/lib/auth-guard";
import { updateRecurringPayment, appendAuditLog, type RecurringStatus } from "@/lib/base-accounts";

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
    const wallet = getWalletAddress(req);
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;
    try {
        const { status, orgId } = await req.json();

        if (!status || !orgId) {
            return NextResponse.json({ error: "status and orgId are required" }, { status: 400 });
        }

        const validStatuses: RecurringStatus[] = ["active", "paused", "cancelled"];
        if (!validStatuses.includes(status)) {
            return NextResponse.json({ error: `status must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
        }

        await updateRecurringPayment(id, { status });

        const auditActionMap: Record<string, "recurring_paused" | "recurring_cancelled"> = {
            paused: "recurring_paused",
            cancelled: "recurring_cancelled",
        };

        if (auditActionMap[status]) {
            await appendAuditLog({
                orgId,
                action: auditActionMap[status],
                actorType: "user",
                actorId: wallet,
                description: `Recurring payment ${id} ${status}`,
                metadata: { recurringId: id },
            });
        }

        return NextResponse.json({ updated: true, status });
    } catch (err) {
        console.error("[Base] Update recurring payment error:", err);
        return NextResponse.json({ error: "Failed to update recurring payment" }, { status: 500 });
    }
}
