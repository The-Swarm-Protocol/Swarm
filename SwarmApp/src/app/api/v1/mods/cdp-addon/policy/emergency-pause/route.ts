/**
 * POST /api/v1/mods/cdp-addon/policy/emergency-pause
 *
 * Toggle emergency pause for an org. Immediately blocks ALL CDP operations.
 */
import { NextRequest } from "next/server";
import { requireOrgAdmin, forbidden } from "@/lib/auth-guard";
import { createPolicyRule, getPolicyRules, updatePolicyRule, logCdpAudit } from "@/lib/cdp-firestore";
import { CdpPolicyAction } from "@/lib/cdp";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { orgId, enabled, reason } = body;

        if (!orgId || enabled === undefined) {
            return Response.json({ error: "orgId and enabled are required" }, { status: 400 });
        }

        const auth = await requireOrgAdmin(req, orgId);
        if (!auth.ok) return forbidden(auth.error);

        // Find existing emergency pause rule
        const rules = await getPolicyRules(orgId);
        const existing = rules.find((r) => r.emergencyPause);

        if (enabled) {
            if (existing) {
                await updatePolicyRule(existing.id, { enabled: true, emergencyPause: true });
            } else {
                await createPolicyRule({
                    orgId,
                    name: "Emergency Pause",
                    description: reason || "Emergency pause activated — all CDP operations blocked",
                    target: "*",
                    capabilityKey: "*",
                    action: CdpPolicyAction.Deny,
                    emergencyPause: true,
                    enabled: true,
                    createdBy: auth.walletAddress || "",
                });
            }
        } else {
            // Disable pause
            if (existing) {
                await updatePolicyRule(existing.id, { enabled: false, emergencyPause: false });
            }
        }

        await logCdpAudit({
            orgId,
            action: enabled ? "policy.emergency_pause_on" : "policy.emergency_pause_off",
            details: { reason },
            outcome: "success",
        });

        return Response.json({ emergencyPause: enabled });
    } catch (err) {
        console.error("cdp-addon/policy/emergency-pause error:", err);
        const message = err instanceof Error ? err.message : "Internal server error";
        return Response.json({ error: message }, { status: 500 });
    }
}
