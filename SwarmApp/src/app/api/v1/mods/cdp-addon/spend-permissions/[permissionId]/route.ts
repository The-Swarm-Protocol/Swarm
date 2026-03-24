/**
 * GET    /api/v1/mods/cdp-addon/spend-permissions/:permissionId?orgId=...
 * DELETE /api/v1/mods/cdp-addon/spend-permissions/:permissionId?orgId=...
 *
 * Inspect or revoke a spend permission.
 */
import { NextRequest } from "next/server";
import { requireOrgAdmin, forbidden } from "@/lib/auth-guard";
import { getSpendPermission, revokeSpendPermission, logCdpAudit } from "@/lib/cdp-firestore";

type RouteParams = { params: Promise<{ permissionId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
    const { permissionId } = await params;
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return Response.json({ error: "orgId required" }, { status: 400 });

    const auth = await requireOrgAdmin(req, orgId);
    if (!auth.ok) return forbidden(auth.error);

    const permission = await getSpendPermission(permissionId);
    if (!permission || permission.orgId !== orgId) {
        return Response.json({ error: "Permission not found" }, { status: 404 });
    }

    return Response.json({ permission });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
    const { permissionId } = await params;
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return Response.json({ error: "orgId required" }, { status: 400 });

    const auth = await requireOrgAdmin(req, orgId);
    if (!auth.ok) return forbidden(auth.error);

    const permission = await getSpendPermission(permissionId);
    if (!permission || permission.orgId !== orgId) {
        return Response.json({ error: "Permission not found" }, { status: 404 });
    }

    await revokeSpendPermission(permissionId, auth.walletAddress || "");

    await logCdpAudit({
        orgId,
        agentId: permission.agentId,
        walletId: permission.walletId,
        action: "spend_permission.revoke",
        details: { permissionId, tokenAddress: permission.tokenAddress },
        outcome: "success",
    });

    return Response.json({ revoked: true, permissionId });
}
