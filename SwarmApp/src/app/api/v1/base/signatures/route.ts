/**
 * GET  /api/v1/base/signatures?orgId=X&status=pending
 * POST /api/v1/base/signatures
 *
 * List and create EIP-712 typed-data signature requests.
 */

import { NextRequest, NextResponse } from "next/server";
import { getWalletAddress } from "@/lib/auth-guard";
import {
    getSignatureRequests,
    createSignatureRequest,
    appendAuditLog,
    type SignatureRequestType,
    type SignatureStatus,
} from "@/lib/base-accounts";

export async function GET(req: NextRequest) {
    const wallet = getWalletAddress(req);
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId is required" }, { status: 400 });

    const status = req.nextUrl.searchParams.get("status") as SignatureStatus | null;

    try {
        const requests = await getSignatureRequests(orgId, status ?? undefined);
        return NextResponse.json({ requests });
    } catch (err) {
        console.error("[Base] List signature requests error:", err);
        return NextResponse.json({ error: "Failed to list signature requests" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const wallet = getWalletAddress(req);
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { orgId, type, requesterType, requesterId, requesterName, typedData, message, signerAddress } = await req.json();

        if (!orgId || !type || !requesterType || !requesterId || !requesterName || !typedData || !message || !signerAddress) {
            return NextResponse.json({ error: "All fields are required" }, { status: 400 });
        }

        const validTypes: SignatureRequestType[] = ["auth_challenge", "approval_prompt", "attestation", "mod_consent", "spend_approval"];
        if (!validTypes.includes(type)) {
            return NextResponse.json({ error: `type must be one of: ${validTypes.join(", ")}` }, { status: 400 });
        }

        const id = await createSignatureRequest({
            orgId,
            type,
            requesterType,
            requesterId,
            requesterName,
            typedData,
            message,
            signerAddress,
        });

        await appendAuditLog({
            orgId,
            action: "signature_requested",
            actorType: requesterType,
            actorId: requesterId,
            description: `${requesterName} requested ${type} signature from ${signerAddress.slice(0, 8)}...`,
            metadata: { signatureId: id, type },
        });

        return NextResponse.json({ id, status: "pending" }, { status: 201 });
    } catch (err) {
        console.error("[Base] Create signature request error:", err);
        return NextResponse.json({ error: "Failed to create signature request" }, { status: 500 });
    }
}
