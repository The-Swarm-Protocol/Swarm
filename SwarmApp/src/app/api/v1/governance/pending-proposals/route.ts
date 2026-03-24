/**
 * GET /api/v1/governance/pending-proposals
 *
 * Get all pending penalty proposals requiring your signature.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/lib/session";
import { getPendingProposalsForSigner } from "@/lib/hedera-governance";

export async function GET(req: NextRequest) {
    try {
        const session = await validateSession();
        if (!session?.address) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const proposals = await getPendingProposalsForSigner(session.sub);

        return NextResponse.json({
            count: proposals.length,
            proposals: proposals.map(p => ({
                id: p.id,
                asn: p.asn,
                agentAddress: p.agentAddress,
                creditPenalty: p.creditPenalty,
                trustPenalty: p.trustPenalty,
                reason: p.reason,
                proposedBy: p.proposedBy,
                signaturesCollected: p.currentSigners.length,
                signaturesRequired: p.requiredSigners.length,
                currentSigners: p.currentSigners,
                createdAt: p.createdAt,
            })),
        });
    } catch (error) {
        console.error("Get pending proposals error:", error);
        return NextResponse.json(
            {
                error: "Failed to get pending proposals",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 },
        );
    }
}
