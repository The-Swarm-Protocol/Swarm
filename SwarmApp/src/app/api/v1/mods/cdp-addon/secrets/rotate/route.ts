/**
 * POST /api/v1/mods/cdp-addon/secrets/rotate
 *
 * Rotate CDP secrets (API key or wallet signing key).
 */
import { NextRequest } from "next/server";
import { requireOrgAdmin, forbidden } from "@/lib/auth-guard";
import { logCdpAudit } from "@/lib/cdp-firestore";
import { rotateSecret } from "@/lib/cdp-client";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { orgId, secretType } = body;

        if (!orgId || !secretType) {
            return Response.json({ error: "orgId and secretType required" }, { status: 400 });
        }

        const validTypes = ["cdp_api_key", "wallet_secret"];
        if (!validTypes.includes(secretType)) {
            return Response.json({ error: `secretType must be one of: ${validTypes.join(", ")}` }, { status: 400 });
        }

        const auth = await requireOrgAdmin(req, orgId);
        if (!auth.ok) return forbidden(auth.error);

        const result = await rotateSecret(secretType);

        await logCdpAudit({
            orgId,
            action: "secret.rotate",
            details: { secretType, rotated: result.rotated, newKeyPrefix: result.newKeyPrefix },
            outcome: result.rotated ? "success" : "error",
        });

        return Response.json(result);
    } catch (err) {
        console.error("cdp-addon/secrets/rotate error:", err);
        const message = err instanceof Error ? err.message : "Internal server error";
        return Response.json({ error: message }, { status: 500 });
    }
}
