/**
 * PATCH /api/v1/base/signatures/[id]
 *
 * Submit a signature or reject a signature request.
 */

import { NextRequest, NextResponse } from "next/server";
import { getWalletAddress } from "@/lib/auth-guard";
import { submitSignature, rejectSignatureRequest, appendAuditLog } from "@/lib/base-accounts";

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
    const wallet = getWalletAddress(req);
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;
    try {
        const { action, signature, orgId } = await req.json();

        if (!action || !orgId) {
            return NextResponse.json({ error: "action and orgId are required" }, { status: 400 });
        }

        if (action === "sign") {
            if (!signature) {
                return NextResponse.json({ error: "signature is required for sign action" }, { status: 400 });
            }
            await submitSignature(id, signature);

            await appendAuditLog({
                orgId,
                action: "signature_signed",
                actorType: "user",
                actorId: wallet,
                description: `Signature request ${id} signed`,
                metadata: { signatureId: id },
            });
        } else if (action === "reject") {
            await rejectSignatureRequest(id);

            await appendAuditLog({
                orgId,
                action: "signature_rejected",
                actorType: "user",
                actorId: wallet,
                description: `Signature request ${id} rejected`,
                metadata: { signatureId: id },
            });
        } else {
            return NextResponse.json({ error: "action must be 'sign' or 'reject'" }, { status: 400 });
        }

        return NextResponse.json({ updated: true, status: action === "sign" ? "signed" : "rejected" });
    } catch (err) {
        console.error("[Base] Update signature request error:", err);
        return NextResponse.json({ error: "Failed to update signature request" }, { status: 500 });
    }
}
