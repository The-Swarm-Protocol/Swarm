/**
 * GET  /api/v1/base/recurring?orgId=X
 * POST /api/v1/base/recurring
 *
 * List and create recurring payment configurations.
 * Note: This stores configuration only. Charge execution is handled by CDP.
 */

import { NextRequest, NextResponse } from "next/server";
import { getWalletAddress } from "@/lib/auth-guard";
import {
    getRecurringPayments,
    createRecurringPayment,
    appendAuditLog,
    type RecurringType,
    type RecurringFrequency,
} from "@/lib/base-accounts";

export async function GET(req: NextRequest) {
    const wallet = getWalletAddress(req);
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId is required" }, { status: 400 });

    try {
        const payments = await getRecurringPayments(orgId);
        return NextResponse.json({ payments });
    } catch (err) {
        console.error("[Base] List recurring payments error:", err);
        return NextResponse.json({ error: "Failed to list recurring payments" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const wallet = getWalletAddress(req);
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { orgId, label, type, recipientAddress, amount, frequency, subAccountId, maxTotalAmount, consentSignature } = await req.json();

        if (!orgId || !label || !type || !recipientAddress || !amount || !frequency) {
            return NextResponse.json(
                { error: "orgId, label, type, recipientAddress, amount, and frequency are required" },
                { status: 400 },
            );
        }

        const validTypes: RecurringType[] = ["mod_subscription", "plan", "agent_budget", "custom"];
        if (!validTypes.includes(type)) {
            return NextResponse.json({ error: `type must be one of: ${validTypes.join(", ")}` }, { status: 400 });
        }

        const validFreqs: RecurringFrequency[] = ["weekly", "monthly", "quarterly", "yearly"];
        if (!validFreqs.includes(frequency)) {
            return NextResponse.json({ error: `frequency must be one of: ${validFreqs.join(", ")}` }, { status: 400 });
        }

        const id = await createRecurringPayment({
            orgId,
            label,
            type,
            recipientAddress,
            amount,
            frequency,
            subAccountId: subAccountId || null,
            maxTotalAmount: maxTotalAmount ?? null,
            consentSignature: consentSignature || null,
            createdBy: wallet,
        });

        await appendAuditLog({
            orgId,
            action: "recurring_created",
            actorType: "user",
            actorId: wallet,
            description: `Created ${frequency} recurring payment "${label}" for ${amount} USDC`,
            metadata: { recurringId: id, type, amount, frequency },
        });

        return NextResponse.json({ id, status: "active" }, { status: 201 });
    } catch (err) {
        console.error("[Base] Create recurring payment error:", err);
        return NextResponse.json({ error: "Failed to create recurring payment" }, { status: 500 });
    }
}
