/**
 * GET  /api/v1/mods/cdp-addon/spend-permissions?orgId=...&agentId=...
 * POST /api/v1/mods/cdp-addon/spend-permissions
 *
 * List and create spend permissions for agents.
 */
import { NextRequest } from "next/server";
import { requireOrgAdmin, forbidden } from "@/lib/auth-guard";
import { createSpendPermission, getSpendPermissions, getServerWallet, logCdpAudit } from "@/lib/cdp-firestore";
import { SpendPermissionStatus } from "@/lib/cdp";

export async function GET(req: NextRequest) {
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return Response.json({ error: "orgId required" }, { status: 400 });

    const auth = await requireOrgAdmin(req, orgId);
    if (!auth.ok) return forbidden(auth.error);

    const agentId = req.nextUrl.searchParams.get("agentId") || undefined;
    const permissions = await getSpendPermissions(orgId, agentId);
    return Response.json({ permissions });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { orgId, agentId, walletId, tokenAddress, allowanceAmount, expiresAt, allowedRecipients, description } = body;

        if (!orgId || !agentId || !walletId || !tokenAddress || !allowanceAmount) {
            return Response.json(
                { error: "orgId, agentId, walletId, tokenAddress, and allowanceAmount are required" },
                { status: 400 },
            );
        }

        const auth = await requireOrgAdmin(req, orgId);
        if (!auth.ok) return forbidden(auth.error);

        // Validate wallet belongs to org
        const wallet = await getServerWallet(walletId);
        if (!wallet || wallet.orgId !== orgId) {
            return Response.json({ error: "Wallet not found in this org" }, { status: 404 });
        }

        const permissionId = await createSpendPermission({
            orgId,
            agentId,
            walletId,
            tokenAddress,
            allowanceAmount: allowanceAmount.toString(),
            spentAmount: "0",
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            status: SpendPermissionStatus.Active,
            allowedRecipients,
            description: description || "",
            createdBy: auth.walletAddress || "",
        });

        await logCdpAudit({
            orgId,
            agentId,
            walletId,
            action: "spend_permission.create",
            details: { tokenAddress, allowanceAmount, expiresAt },
            outcome: "success",
        });

        return Response.json({ permissionId, created: true });
    } catch (err) {
        console.error("cdp-addon/spend-permissions POST error:", err);
        const message = err instanceof Error ? err.message : "Internal server error";
        return Response.json({ error: message }, { status: 500 });
    }
}
