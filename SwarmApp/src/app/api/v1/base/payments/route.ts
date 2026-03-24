/**
 * GET  /api/v1/base/payments?orgId=X&limit=50
 * POST /api/v1/base/payments
 *
 * List and record USDC payments on Base.
 */

import { NextRequest, NextResponse } from "next/server";
import { getWalletAddress } from "@/lib/auth-guard";
import { getPayments, recordPayment, appendAuditLog } from "@/lib/base-accounts";

export async function GET(req: NextRequest) {
    const wallet = getWalletAddress(req);
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId is required" }, { status: 400 });

    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50", 10);

    try {
        const payments = await getPayments(orgId, Math.min(limit, 200));
        return NextResponse.json({ payments });
    } catch (err) {
        console.error("[Base] List payments error:", err);
        return NextResponse.json({ error: "Failed to list payments" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const wallet = getWalletAddress(req);
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { orgId, fromAddress, toAddress, amount, memo, txHash, chainId = 8453, subAccountId } = await req.json();

        if (!orgId || !fromAddress || !toAddress || !amount) {
            return NextResponse.json({ error: "orgId, fromAddress, toAddress, and amount are required" }, { status: 400 });
        }

        const id = await recordPayment({
            orgId,
            fromAddress,
            toAddress,
            amount,
            memo: memo || "",
            txHash: txHash || null,
            chainId,
            subAccountId: subAccountId || null,
            createdBy: wallet,
        });

        await appendAuditLog({
            orgId,
            action: "payment_sent",
            actorType: "user",
            actorId: wallet,
            description: `Sent ${amount} USDC to ${toAddress.slice(0, 8)}...${toAddress.slice(-4)}`,
            metadata: { paymentId: id, amount, txHash, chainId },
        });

        return NextResponse.json({ id, status: txHash ? "confirmed" : "pending" }, { status: 201 });
    } catch (err) {
        console.error("[Base] Record payment error:", err);
        return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
    }
}
