/**
 * GET /api/v1/mods/cdp-addon/audit?orgId=...&agentId=...&action=...&limit=50
 *
 * Query CDP audit log for an org.
 */
import { NextRequest } from "next/server";
import { requireOrgAdmin, forbidden } from "@/lib/auth-guard";
import { getCdpAuditLog } from "@/lib/cdp-firestore";

export async function GET(req: NextRequest) {
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return Response.json({ error: "orgId required" }, { status: 400 });

    const auth = await requireOrgAdmin(req, orgId);
    if (!auth.ok) return forbidden(auth.error);

    const agentId = req.nextUrl.searchParams.get("agentId") || undefined;
    const action = req.nextUrl.searchParams.get("action") || undefined;
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "100", 10);

    const entries = await getCdpAuditLog(orgId, { agentId, action, limit: Math.min(limit, 500) });
    return Response.json({ entries });
}
