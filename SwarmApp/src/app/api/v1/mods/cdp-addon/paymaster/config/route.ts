/**
 * GET /api/v1/mods/cdp-addon/paymaster/config?orgId=...
 * PUT /api/v1/mods/cdp-addon/paymaster/config
 *
 * Paymaster gas sponsorship configuration per org.
 */
import { NextRequest } from "next/server";
import { requireOrgAdmin, forbidden } from "@/lib/auth-guard";
import { getPaymasterConfig, upsertPaymasterConfig, logCdpAudit } from "@/lib/cdp-firestore";

export async function GET(req: NextRequest) {
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return Response.json({ error: "orgId required" }, { status: 400 });

    const auth = await requireOrgAdmin(req, orgId);
    if (!auth.ok) return forbidden(auth.error);

    const config = await getPaymasterConfig(orgId);
    return Response.json({ config });
}

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            orgId,
            enabled,
            monthlyBudgetUsd,
            allowedContracts,
            allowedSelectors,
            perTxGasLimitEth,
            autoPauseOnBudgetExhausted,
        } = body;

        if (!orgId) return Response.json({ error: "orgId required" }, { status: 400 });

        const auth = await requireOrgAdmin(req, orgId);
        if (!auth.ok) return forbidden(auth.error);

        const configId = await upsertPaymasterConfig(orgId, {
            enabled: enabled ?? false,
            monthlyBudgetUsd: monthlyBudgetUsd ?? 100,
            spentThisCycleUsd: 0,
            currentCycleStart: new Date(),
            allowedContracts: allowedContracts ?? [],
            allowedSelectors,
            perTxGasLimitEth: perTxGasLimitEth ?? 0.01,
            autoPauseOnBudgetExhausted: autoPauseOnBudgetExhausted ?? true,
            updatedBy: auth.walletAddress || "",
        });

        await logCdpAudit({
            orgId,
            action: "paymaster.config_update",
            details: { enabled, monthlyBudgetUsd, allowedContracts },
            outcome: "success",
        });

        return Response.json({ updated: true, configId });
    } catch (err) {
        console.error("cdp-addon/paymaster/config PUT error:", err);
        const message = err instanceof Error ? err.message : "Internal server error";
        return Response.json({ error: message }, { status: 500 });
    }
}
