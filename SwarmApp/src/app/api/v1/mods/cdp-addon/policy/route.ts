/**
 * GET  /api/v1/mods/cdp-addon/policy?orgId=...
 * POST /api/v1/mods/cdp-addon/policy
 *
 * List and create CDP policy rules for an org.
 */
import { NextRequest } from "next/server";
import { requireOrgAdmin, forbidden } from "@/lib/auth-guard";
import { createPolicyRule, getPolicyRules, logCdpAudit } from "@/lib/cdp-firestore";
import { CdpPolicyAction } from "@/lib/cdp";

export async function GET(req: NextRequest) {
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return Response.json({ error: "orgId required" }, { status: 400 });

    const auth = await requireOrgAdmin(req, orgId);
    if (!auth.ok) return forbidden(auth.error);

    const rules = await getPolicyRules(orgId);
    return Response.json({ rules });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            orgId,
            name,
            description,
            target,
            capabilityKey,
            action,
            rateLimit,
            dailySpendCapUsd,
            allowedTokens,
            allowedContracts,
            emergencyPause,
        } = body;

        if (!orgId || !name || !target || !capabilityKey || !action) {
            return Response.json(
                { error: "orgId, name, target, capabilityKey, and action are required" },
                { status: 400 },
            );
        }

        // Validate action enum
        const validActions = Object.values(CdpPolicyAction);
        if (!validActions.includes(action)) {
            return Response.json({ error: `action must be one of: ${validActions.join(", ")}` }, { status: 400 });
        }

        const auth = await requireOrgAdmin(req, orgId);
        if (!auth.ok) return forbidden(auth.error);

        const ruleId = await createPolicyRule({
            orgId,
            name,
            description: description || "",
            target,
            capabilityKey,
            action,
            rateLimit,
            dailySpendCapUsd,
            allowedTokens,
            allowedContracts,
            emergencyPause: emergencyPause ?? false,
            enabled: true,
            createdBy: auth.walletAddress || "",
        });

        await logCdpAudit({
            orgId,
            action: "policy.create",
            details: { ruleId, name, target, capabilityKey, policyAction: action },
            outcome: "success",
        });

        return Response.json({ ruleId, created: true });
    } catch (err) {
        console.error("cdp-addon/policy POST error:", err);
        const message = err instanceof Error ? err.message : "Internal server error";
        return Response.json({ error: message }, { status: 500 });
    }
}
