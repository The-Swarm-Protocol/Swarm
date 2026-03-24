/**
 * POST /api/v1/trust/verify-agent
 * Submit agent identity proof: { asn, agentAddress, signature }
 * Verifies EVM signature, publishes to HCS, stores proof.
 *
 * GET /api/v1/trust/verify-agent?asn=ASN-XXX
 * Retrieve existing identity proof for an agent.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/lib/session";
import {
    submitAgentIdentityProof,
    verifyAgentIdentity,
} from "@/lib/hedera-agent-identity-verification";

export async function POST(req: NextRequest) {
    try {
        const session = await validateSession();
        if (!session?.address) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { asn, agentAddress, signature } = body;

        if (!asn || !agentAddress || !signature) {
            return NextResponse.json(
                { error: "Missing required fields: asn, agentAddress, signature" },
                { status: 400 },
            );
        }

        const proof = await submitAgentIdentityProof(asn, agentAddress, signature);

        return NextResponse.json({
            success: true,
            proof,
        });
    } catch (error) {
        console.error("Agent identity proof error:", error);
        return NextResponse.json(
            {
                error: "Failed to submit agent identity proof",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 },
        );
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const asn = searchParams.get("asn");

        if (!asn) {
            return NextResponse.json(
                { error: "Missing required parameter: asn" },
                { status: 400 },
            );
        }

        const proof = await verifyAgentIdentity(asn);

        if (!proof) {
            return NextResponse.json(
                { error: `No identity proof found for ASN ${asn}` },
                { status: 404 },
            );
        }

        return NextResponse.json({ proof });
    } catch (error) {
        console.error("Agent identity verification error:", error);
        return NextResponse.json(
            {
                error: "Failed to verify agent identity",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 },
        );
    }
}
