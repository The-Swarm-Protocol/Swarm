/**
 * GET  /api/v1/mods/cdp-addon/wallets?orgId=...
 * POST /api/v1/mods/cdp-addon/wallets
 *
 * List and create CDP server wallets for an org.
 */
import { NextRequest } from "next/server";
import { requireOrgAdmin, forbidden } from "@/lib/auth-guard";
import { createServerWallet, getServerWallets, logCdpAudit } from "@/lib/cdp-firestore";
import { createCdpWallet } from "@/lib/cdp-client";
import { CdpWalletType, CdpWalletStatus } from "@/lib/cdp";

export async function GET(req: NextRequest) {
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return Response.json({ error: "orgId required" }, { status: 400 });

    const auth = await requireOrgAdmin(req, orgId);
    if (!auth.ok) return forbidden(auth.error);

    const wallets = await getServerWallets(orgId);
    return Response.json({ wallets });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { orgId, label, walletType, agentId } = body;

        if (!orgId || !label) {
            return Response.json({ error: "orgId and label are required" }, { status: 400 });
        }

        const auth = await requireOrgAdmin(req, orgId);
        if (!auth.ok) return forbidden(auth.error);

        const type = walletType === "eoa" ? CdpWalletType.EOA : CdpWalletType.SmartAccount;

        // Create wallet via CDP API
        const result = await createCdpWallet({ walletType: type, label });

        // Persist to Firestore
        const walletId = await createServerWallet({
            orgId,
            agentId: agentId || undefined,
            walletType: type,
            address: result.address,
            label,
            chainId: result.chainId,
            status: CdpWalletStatus.Active,
            cdpWalletId: result.cdpWalletId,
            createdBy: auth.walletAddress || "",
        });

        await logCdpAudit({
            orgId,
            walletId,
            action: "wallet.create",
            details: { label, walletType: type, address: result.address, agentId },
            outcome: "success",
        });

        return Response.json({
            wallet: {
                id: walletId,
                address: result.address,
                label,
                walletType: type,
                status: CdpWalletStatus.Active,
                chainId: result.chainId,
            },
        });
    } catch (err) {
        console.error("cdp-addon/wallets POST error:", err);
        const message = err instanceof Error ? err.message : "Internal server error";
        return Response.json({ error: message }, { status: 500 });
    }
}
