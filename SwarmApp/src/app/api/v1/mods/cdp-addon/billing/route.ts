/**
 * GET  /api/v1/mods/cdp-addon/billing?orgId=...
 * POST /api/v1/mods/cdp-addon/billing
 *
 * List and create billing cycles for recurring subscription charges.
 */
import { NextRequest } from "next/server";
import { requireOrgAdmin, forbidden } from "@/lib/auth-guard";
import { createBillingCycle, getBillingCycles, getServerWallet, logCdpAudit } from "@/lib/cdp-firestore";
import { CdpBillingCycleStatus, CDP_USDC_ADDRESS } from "@/lib/cdp";

export async function GET(req: NextRequest) {
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return Response.json({ error: "orgId required" }, { status: 400 });

    const auth = await requireOrgAdmin(req, orgId);
    if (!auth.ok) return forbidden(auth.error);

    const cycles = await getBillingCycles(orgId);
    return Response.json({ billingCycles: cycles });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { orgId, subscriptionId, walletId, amountUsd, tokenAddress, intervalDays } = body;

        if (!orgId || !subscriptionId || !walletId || !amountUsd) {
            return Response.json(
                { error: "orgId, subscriptionId, walletId, and amountUsd are required" },
                { status: 400 },
            );
        }

        const auth = await requireOrgAdmin(req, orgId);
        if (!auth.ok) return forbidden(auth.error);

        // Validate wallet
        const wallet = await getServerWallet(walletId);
        if (!wallet || wallet.orgId !== orgId) {
            return Response.json({ error: "Wallet not found" }, { status: 404 });
        }

        const nextChargeAt = new Date();
        nextChargeAt.setDate(nextChargeAt.getDate() + (intervalDays || 30));

        const cycleId = await createBillingCycle({
            orgId,
            subscriptionId,
            walletId,
            amountUsd,
            tokenAddress: tokenAddress || CDP_USDC_ADDRESS,
            intervalDays: intervalDays || 30,
            nextChargeAt,
            lastChargedAt: null,
            lastChargeTxHash: undefined,
            status: CdpBillingCycleStatus.Active,
            failureCount: 0,
        });

        await logCdpAudit({
            orgId,
            walletId,
            action: "billing.cycle_create",
            details: { cycleId, subscriptionId, amountUsd, intervalDays },
            outcome: "success",
        });

        return Response.json({ cycleId, created: true });
    } catch (err) {
        console.error("cdp-addon/billing POST error:", err);
        const message = err instanceof Error ? err.message : "Internal server error";
        return Response.json({ error: message }, { status: 500 });
    }
}
