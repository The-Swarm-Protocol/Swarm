/**
 * GET    /api/v1/mods/cdp-addon/wallets/:walletId?orgId=...
 * PATCH  /api/v1/mods/cdp-addon/wallets/:walletId
 * DELETE /api/v1/mods/cdp-addon/wallets/:walletId
 *
 * Server wallet detail, update, and archive.
 */
import { NextRequest } from "next/server";
import { requireOrgAdmin, forbidden } from "@/lib/auth-guard";
import { getServerWallet, updateServerWallet, archiveServerWallet } from "@/lib/cdp-firestore";
import { logCdpAudit } from "@/lib/cdp-firestore";
import { CdpWalletStatus } from "@/lib/cdp";

type RouteParams = { params: Promise<{ walletId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
    const { walletId } = await params;
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return Response.json({ error: "orgId required" }, { status: 400 });

    const auth = await requireOrgAdmin(req, orgId);
    if (!auth.ok) return forbidden(auth.error);

    const wallet = await getServerWallet(walletId);
    if (!wallet || wallet.orgId !== orgId) {
        return Response.json({ error: "Wallet not found" }, { status: 404 });
    }

    return Response.json({ wallet });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
    const { walletId } = await params;

    try {
        const body = await req.json();
        const { orgId, label, agentId, status } = body;

        if (!orgId) return Response.json({ error: "orgId required" }, { status: 400 });

        const auth = await requireOrgAdmin(req, orgId);
        if (!auth.ok) return forbidden(auth.error);

        const wallet = await getServerWallet(walletId);
        if (!wallet || wallet.orgId !== orgId) {
            return Response.json({ error: "Wallet not found" }, { status: 404 });
        }

        const updates: Record<string, unknown> = {};
        if (label !== undefined) updates.label = label;
        if (agentId !== undefined) updates.agentId = agentId || null;
        if (status && [CdpWalletStatus.Active, CdpWalletStatus.Frozen].includes(status)) {
            updates.status = status;
        }

        await updateServerWallet(walletId, updates);

        await logCdpAudit({
            orgId,
            walletId,
            action: "wallet.update",
            details: updates,
            outcome: "success",
        });

        return Response.json({ updated: true, walletId });
    } catch (err) {
        console.error("cdp-addon/wallets PATCH error:", err);
        const message = err instanceof Error ? err.message : "Internal server error";
        return Response.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
    const { walletId } = await params;
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return Response.json({ error: "orgId required" }, { status: 400 });

    const auth = await requireOrgAdmin(req, orgId);
    if (!auth.ok) return forbidden(auth.error);

    const wallet = await getServerWallet(walletId);
    if (!wallet || wallet.orgId !== orgId) {
        return Response.json({ error: "Wallet not found" }, { status: 404 });
    }

    await archiveServerWallet(walletId);

    await logCdpAudit({
        orgId,
        walletId,
        action: "wallet.archive",
        details: { address: wallet.address, label: wallet.label },
        outcome: "success",
    });

    return Response.json({ archived: true, walletId });
}
