/**
 * POST /api/v1/base/auth/verify
 *
 * Verify a SIWE signature for Base chain authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyMessage } from "ethers";
import { appendAuditLog } from "@/lib/base-accounts";

export async function POST(req: NextRequest) {
    try {
        const { payload, signature } = await req.json();

        if (!payload?.message || !signature) {
            return NextResponse.json({ error: "payload and signature are required" }, { status: 400 });
        }

        // Check expiration
        if (payload.expirationTime && new Date(payload.expirationTime) < new Date()) {
            return NextResponse.json({ error: "Payload has expired" }, { status: 400 });
        }

        // Verify signature — EOA verification
        // TODO: Add EIP-1271 smart wallet verification (isValidSignature) when CDP SDK available
        let recoveredAddress: string;
        try {
            recoveredAddress = verifyMessage(payload.message, signature);
        } catch {
            return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
        }

        const isValid = recoveredAddress.toLowerCase() === payload.address.toLowerCase();

        if (!isValid) {
            return NextResponse.json({
                verified: false,
                error: "Signature does not match address",
            }, { status: 400 });
        }

        // Log the verification (orgId may not be known at sign-in time)
        try {
            await appendAuditLog({
                orgId: "system",
                action: "siwe_verify",
                actorType: "user",
                actorId: recoveredAddress,
                description: `SIWE verification for ${recoveredAddress} on chain ${payload.chainId}`,
                metadata: { chainId: payload.chainId, nonce: payload.nonce },
            });
        } catch {
            // Audit logging is best-effort
        }

        return NextResponse.json({
            verified: true,
            address: recoveredAddress,
            chainId: payload.chainId,
        });
    } catch (err) {
        console.error("[Base Auth] Verify error:", err);
        return NextResponse.json({ error: "Failed to verify signature" }, { status: 500 });
    }
}
