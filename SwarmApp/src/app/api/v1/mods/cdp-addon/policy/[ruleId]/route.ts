/**
 * PATCH  /api/v1/mods/cdp-addon/policy/:ruleId
 * DELETE /api/v1/mods/cdp-addon/policy/:ruleId?orgId=...
 *
 * Update or delete a policy rule.
 */
import { NextRequest } from "next/server";
import { requireOrgAdmin, forbidden } from "@/lib/auth-guard";
import { updatePolicyRule, deletePolicyRule, getPolicyRules, logCdpAudit } from "@/lib/cdp-firestore";

type RouteParams = { params: Promise<{ ruleId: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
    const { ruleId } = await params;

    try {
        const body = await req.json();
        const { orgId, ...updates } = body;

        if (!orgId) return Response.json({ error: "orgId required" }, { status: 400 });

        const auth = await requireOrgAdmin(req, orgId);
        if (!auth.ok) return forbidden(auth.error);

        // Verify rule belongs to org
        const rules = await getPolicyRules(orgId);
        const rule = rules.find((r) => r.id === ruleId);
        if (!rule) return Response.json({ error: "Rule not found" }, { status: 404 });

        // Only allow safe fields to be updated
        const safeUpdates: Record<string, unknown> = {};
        const allowedFields = [
            "name", "description", "target", "capabilityKey", "action",
            "rateLimit", "dailySpendCapUsd", "allowedTokens", "allowedContracts",
            "emergencyPause", "enabled",
        ];
        for (const key of allowedFields) {
            if (updates[key] !== undefined) safeUpdates[key] = updates[key];
        }

        await updatePolicyRule(ruleId, safeUpdates);

        await logCdpAudit({
            orgId,
            action: "policy.update",
            details: { ruleId, updates: safeUpdates },
            outcome: "success",
        });

        return Response.json({ updated: true, ruleId });
    } catch (err) {
        console.error("cdp-addon/policy PATCH error:", err);
        const message = err instanceof Error ? err.message : "Internal server error";
        return Response.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
    const { ruleId } = await params;
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return Response.json({ error: "orgId required" }, { status: 400 });

    const auth = await requireOrgAdmin(req, orgId);
    if (!auth.ok) return forbidden(auth.error);

    // Verify rule belongs to org
    const rules = await getPolicyRules(orgId);
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return Response.json({ error: "Rule not found" }, { status: 404 });

    await deletePolicyRule(ruleId);

    await logCdpAudit({
        orgId,
        action: "policy.delete",
        details: { ruleId, ruleName: rule.name },
        outcome: "success",
    });

    return Response.json({ deleted: true, ruleId });
}
