/**
 * POST /api/v1/credit
 *
 * Update an agent's credit and trust scores — both in Firestore and on-chain
 * (SwarmAgentRegistryLink + SwarmASNRegistry on Sepolia).
 *
 * Body: { agentId, creditScore, trustScore, reason? }
 *   creditScore — 300–900
 *   trustScore  — 0–100
 *   reason      — optional audit log text
 */
import { NextRequest } from "next/server";
import { ethers } from "ethers";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import {
    LINK_CONTRACTS,
    LINK_AGENT_REGISTRY_ABI,
    LINK_ASN_REGISTRY_ABI,
    SEPOLIA_RPC_URL,
} from "@/lib/link-contracts";
import { requirePlatformAdmin, forbidden } from "@/lib/auth-guard";
import { recordCreditAudit } from "@/lib/credit-audit-log";
import { fireWebhooks } from "@/lib/credit-webhooks";
import { invalidateCache } from "@/lib/credit-cache";

/** Update credit scores on-chain via platform wallet */
async function updateCreditOnChain(
    agentAddr: string,
    asn: string,
    creditScore: number,
    trustScore: number,
): Promise<{ agentTxHash?: string; asnTxHash?: string }> {
    const privateKey = process.env.SEPOLIA_PLATFORM_KEY;
    if (!privateKey) return {};

    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    const result: { agentTxHash?: string; asnTxHash?: string } = {};

    if (LINK_CONTRACTS.AGENT_REGISTRY && agentAddr) {
        try {
            const registry = new ethers.Contract(
                LINK_CONTRACTS.AGENT_REGISTRY,
                LINK_AGENT_REGISTRY_ABI,
                wallet,
            );
            const tx = await registry.updateCredit(agentAddr, creditScore, trustScore);
            const receipt = await tx.wait();
            result.agentTxHash = receipt.hash;
        } catch (err) {
            console.error("updateCredit on AgentRegistry failed:", err);
        }
    }

    if (LINK_CONTRACTS.ASN_REGISTRY && asn) {
        try {
            const asnRegistry = new ethers.Contract(
                LINK_CONTRACTS.ASN_REGISTRY,
                LINK_ASN_REGISTRY_ABI,
                wallet,
            );
            const tx = await asnRegistry.updateCredit(asn, creditScore, trustScore);
            const receipt = await tx.wait();
            result.asnTxHash = receipt.hash;
        } catch (err) {
            console.error("updateCredit on ASNRegistry failed:", err);
        }
    }

    return result;
}

export async function POST(request: NextRequest) {
    // Auth: platform admin only — arbitrary credit writes are privileged
    const auth = requirePlatformAdmin(request);
    if (!auth.ok) return forbidden(auth.error);

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const agentId = body.agentId as string | undefined;
    if (!agentId) {
        return Response.json({ error: "agentId is required" }, { status: 400 });
    }

    // Load agent from Firestore
    const agentRef = doc(db, "agents", agentId);
    const agentSnap = await getDoc(agentRef);
    if (!agentSnap.exists()) {
        return Response.json({ error: "Agent not found" }, { status: 404 });
    }

    const agentData = agentSnap.data();
    const asn = (agentData.asn as string) || "";

    const creditScore = body.creditScore as number | undefined;
    const trustScore = body.trustScore as number | undefined;
    const reason = (body.reason as string) || undefined;

    if (creditScore === undefined || trustScore === undefined) {
        return Response.json(
            { error: "creditScore and trustScore are required" },
            { status: 400 },
        );
    }

    if (creditScore < 300 || creditScore > 900) {
        return Response.json({ error: "creditScore must be 300-900" }, { status: 400 });
    }
    if (trustScore < 0 || trustScore > 100) {
        return Response.json({ error: "trustScore must be 0-100" }, { status: 400 });
    }

    const previousCredit = (agentData.creditScore as number) || 680;
    const previousTrust = (agentData.trustScore as number) || 50;

    // Update Firestore
    await updateDoc(agentRef, {
        creditScore,
        trustScore,
        lastCreditUpdate: serverTimestamp(),
        ...(reason ? { lastCreditReason: reason } : {}),
    });

    // Record credit audit entry
    recordCreditAudit({
        agentId,
        asn,
        source: "admin",
        performedBy: request.headers.get("x-wallet-address") || "platform-admin",
        creditBefore: previousCredit,
        creditAfter: creditScore,
        trustBefore: previousTrust,
        trustAfter: trustScore,
        reason: reason || "Admin credit override",
    }).catch((err) => console.error("Failed to record credit audit:", err));

    // Invalidate credit cache
    invalidateCache(`credit:${agentId}`);

    // Fire webhooks (non-blocking)
    fireWebhooks(agentId, "score_change", {
        previousCreditScore: previousCredit,
        newCreditScore: creditScore,
        previousTrustScore: previousTrust,
        newTrustScore: trustScore,
        delta: { credit: creditScore - previousCredit, trust: trustScore - previousTrust },
        trigger: "admin_update",
        reason,
    }).catch(err => console.error("[credit] Webhook dispatch error:", err));

    // Update on-chain
    const onChainResult = await updateCreditOnChain(
        agentData.walletAddress || "",
        asn,
        creditScore,
        trustScore,
    );

    return Response.json({
        agentId,
        asn,
        creditScore,
        trustScore,
        reason,
        onChain: {
            agentTxHash: onChainResult.agentTxHash || null,
            asnTxHash: onChainResult.asnTxHash || null,
        },
    });
}
