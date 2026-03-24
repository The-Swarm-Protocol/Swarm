/**
 * POST /api/v1/mods/cdp-addon/billing/charge
 *
 * Trigger a billing cycle charge. Used by cron or admin.
 */
import { NextRequest } from "next/server";
import { requireOrgAdmin, requireInternalService, forbidden } from "@/lib/auth-guard";
import { getBillingCycle, updateBillingCycle, getServerWallet, logCdpAudit } from "@/lib/cdp-firestore";
import { executeTransfer } from "@/lib/cdp-client";
import { CdpBillingCycleStatus } from "@/lib/cdp";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { billingCycleId, orgId } = body;

        if (!billingCycleId) {
            return Response.json({ error: "billingCycleId required" }, { status: 400 });
        }

        // Auth: internal service OR org admin
        const internal = requireInternalService(req);
        if (!internal.ok) {
            if (!orgId) return Response.json({ error: "orgId required for admin auth" }, { status: 400 });
            const auth = await requireOrgAdmin(req, orgId);
            if (!auth.ok) return forbidden(auth.error);
        }

        const cycle = await getBillingCycle(billingCycleId);
        if (!cycle) {
            return Response.json({ error: "Billing cycle not found" }, { status: 404 });
        }

        if (cycle.status !== CdpBillingCycleStatus.Active) {
            return Response.json({ error: `Billing cycle is ${cycle.status}` }, { status: 400 });
        }

        // Load server wallet
        const wallet = await getServerWallet(cycle.walletId);
        if (!wallet) {
            return Response.json({ error: "Associated wallet not found" }, { status: 404 });
        }

        // Get treasury address
        const treasuryAddress = process.env.BASE_TREASURY_ADDRESS || process.env.EVM_TREASURY_ADDRESS;
        if (!treasuryAddress) {
            return Response.json({ error: "Treasury address not configured" }, { status: 500 });
        }

        try {
            // Execute USDC transfer from server wallet to treasury
            const result = await executeTransfer({
                cdpWalletId: wallet.cdpWalletId,
                addressId: wallet.address,
                toAddress: treasuryAddress,
                tokenAddress: cycle.tokenAddress,
                amount: cycle.amountUsd.toString(),
            });

            // Calculate next charge date
            const nextChargeAt = new Date();
            nextChargeAt.setDate(nextChargeAt.getDate() + cycle.intervalDays);

            await updateBillingCycle(billingCycleId, {
                lastChargedAt: new Date(),
                lastChargeTxHash: result.txHash,
                nextChargeAt,
                failureCount: 0,
            });

            await logCdpAudit({
                orgId: cycle.orgId,
                walletId: cycle.walletId,
                action: "billing.charge",
                details: {
                    billingCycleId,
                    amountUsd: cycle.amountUsd,
                    txHash: result.txHash,
                    nextChargeAt: nextChargeAt.toISOString(),
                },
                outcome: "success",
            });

            return Response.json({
                charged: true,
                txHash: result.txHash,
                amountUsd: cycle.amountUsd,
                nextChargeAt: nextChargeAt.toISOString(),
            });
        } catch (chargeErr) {
            const newFailureCount = (cycle.failureCount || 0) + 1;
            const newStatus = newFailureCount > 3
                ? CdpBillingCycleStatus.PastDue
                : CdpBillingCycleStatus.Active;

            await updateBillingCycle(billingCycleId, {
                failureCount: newFailureCount,
                status: newStatus,
            });

            await logCdpAudit({
                orgId: cycle.orgId,
                walletId: cycle.walletId,
                action: "billing.charge",
                details: {
                    billingCycleId,
                    failureCount: newFailureCount,
                    error: chargeErr instanceof Error ? chargeErr.message : "unknown",
                },
                outcome: "error",
            });

            return Response.json({
                error: "Charge failed",
                failureCount: newFailureCount,
                status: newStatus,
            }, { status: 502 });
        }
    } catch (err) {
        console.error("cdp-addon/billing/charge error:", err);
        const message = err instanceof Error ? err.message : "Internal server error";
        return Response.json({ error: message }, { status: 500 });
    }
}
