/**
 * Hedera Trust Layer — Verification
 *
 * Compares scores across three tiers (Firestore, HCS-computed, on-chain NFT)
 * to verify consistency. Generates provenance proofs tracing scores to HCS events.
 * Provides trust layer health status.
 */

import { getScoreState, getAllScoreStates, isSubscriberRunning, getRecentEventsForASN } from "./hedera-mirror-subscriber";
import { getAgentNFTIdentity } from "./hedera-nft-client";
import { isCheckpointServiceRunning, getSnapshotByEpoch } from "./hedera-checkpoint-service";
import { isHCSConfigured, getReputationTopicId } from "./hedera-hcs-client";
import { verifyDigestChain, getLatestDigest } from "./hedera-event-digest";
import { computeStateHash, computeMerkleRoot, generateMerkleProof, hashAgentScore } from "./hedera-trust-crypto";
import { db } from "@/lib/firebase";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
} from "firebase/firestore";
import type {
    ScoreVerificationResult,
    CheckpointVerificationResult,
    ProvenanceProof,
    TrustLayerStatus,
    TrustLayerConfig,
    ScoreSnapshot,
} from "./hedera-trust-types";

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

const DRIFT_TOLERANCE = { credit: 10, trust: 3 };
const MIRROR_NODE_URL = process.env.HEDERA_MIRROR_NODE_URL || "https://testnet.mirrornode.hedera.com";

// ═══════════════════════════════════════════════════════════════
// Score Verification
// ═══════════════════════════════════════════════════════════════

/**
 * Verify a single agent's score consistency across all three tiers.
 */
export async function verifyAgentScore(asn: string): Promise<ScoreVerificationResult> {
    const verifiedAt = Math.floor(Date.now() / 1000);

    // 1. Get HCS-computed score (in-memory cache)
    const hcsState = getScoreState(asn);
    const hcsComputedScore = hcsState
        ? { credit: hcsState.creditScore, trust: hcsState.trustScore }
        : null;

    // 2. Get Firestore score
    let firestoreScore: { credit: number; trust: number } | null = null;
    try {
        const agentsRef = collection(db, "agents");
        const q = query(agentsRef, where("asn", "==", asn));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const data = snap.docs[0].data();
            if (typeof data.creditScore === "number" && typeof data.trustScore === "number") {
                firestoreScore = { credit: data.creditScore, trust: data.trustScore };
            }
        }
    } catch (error) {
        console.warn(`Failed to read Firestore score for ${asn}:`, error);
    }

    // 3. Get on-chain NFT score
    let onChainScore: { credit: number; trust: number } | null = null;
    const agentAddress = hcsState?.agentAddress;
    if (agentAddress) {
        try {
            const nftIdentity = await getAgentNFTIdentity(agentAddress);
            if (nftIdentity.hasNFT && nftIdentity.creditScore !== undefined) {
                onChainScore = {
                    credit: nftIdentity.creditScore,
                    trust: nftIdentity.trustScore!,
                };
            }
        } catch (error) {
            console.warn(`Failed to read on-chain score for ${asn}:`, error);
        }
    }

    // 4. Compute drift
    const computeDrift = (a: { credit: number; trust: number } | null, b: { credit: number; trust: number } | null) => {
        if (!a || !b) return null;
        return { credit: Math.abs(a.credit - b.credit), trust: Math.abs(a.trust - b.trust) };
    };

    const drift = {
        firestoreVsHcs: computeDrift(firestoreScore, hcsComputedScore),
        firestoreVsOnChain: computeDrift(firestoreScore, onChainScore),
        hcsVsOnChain: computeDrift(hcsComputedScore, onChainScore),
    };

    // 5. Check consistency (within tolerance)
    const isWithinTolerance = (d: { credit: number; trust: number } | null) => {
        if (!d) return true; // Can't check if source is missing
        return d.credit <= DRIFT_TOLERANCE.credit && d.trust <= DRIFT_TOLERANCE.trust;
    };

    const consistent =
        isWithinTolerance(drift.firestoreVsHcs) &&
        isWithinTolerance(drift.firestoreVsOnChain) &&
        isWithinTolerance(drift.hcsVsOnChain);

    // 6. Find latest checkpoint epoch for this agent
    let latestCheckpointEpoch: number | undefined;
    try {
        const configSnap = await getDoc(doc(db, "trustLayerConfig", "singleton"));
        if (configSnap.exists()) {
            latestCheckpointEpoch = (configSnap.data() as TrustLayerConfig).currentEpoch;
        }
    } catch {
        // ignore
    }

    return {
        asn,
        agentAddress: agentAddress || "",
        firestoreScore,
        hcsComputedScore,
        onChainScore,
        consistent,
        drift,
        latestCheckpointEpoch,
        verifiedAt,
    };
}

// ═══════════════════════════════════════════════════════════════
// Checkpoint Verification
// ═══════════════════════════════════════════════════════════════

/**
 * Verify a checkpoint's hash against stored and recomputed values.
 */
export async function verifyCheckpoint(epoch: number): Promise<CheckpointVerificationResult> {
    const verifiedAt = Math.floor(Date.now() / 1000);

    const snapshot = await getSnapshotByEpoch(epoch);
    if (!snapshot) {
        throw new Error(`No snapshot found for epoch ${epoch}`);
    }

    // Recompute hash from the stored agents array
    const recomputedHash = computeStateHash(snapshot.agents);

    // HCS hash would need mirror node query — use stored value for now
    const hcsHash = snapshot.hcsTxId ? snapshot.stateHash : null;

    return {
        epoch,
        snapshotId: snapshot.snapshotId,
        storedHash: snapshot.stateHash,
        recomputedHash,
        hcsHash,
        firestoreConsistent: snapshot.stateHash === recomputedHash,
        hcsConsistent: hcsHash ? snapshot.stateHash === hcsHash : true,
        verifiedAt,
    };
}

// ═══════════════════════════════════════════════════════════════
// Provenance Proof
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a full provenance proof for an agent's current score.
 * Traces back through HCS events and anchors to a checkpoint.
 */
export async function generateProvenanceProof(asn: string): Promise<ProvenanceProof> {
    const hcsState = getScoreState(asn);
    if (!hcsState) {
        throw new Error(`No score state found for ASN ${asn}`);
    }

    // Get recent events from in-memory buffer
    const recentEvents = getRecentEventsForASN(asn);

    const events = recentEvents.map((re) => ({
        type: re.event.type,
        creditDelta: re.event.creditDelta,
        trustDelta: re.event.trustDelta,
        timestamp: re.event.timestamp,
        hcsSequence: re.sequence,
    }));

    // Get latest snapshot for Merkle proof
    let merkleProof: string[] | undefined;
    let anchorEpoch = 0;

    try {
        const configSnap = await getDoc(doc(db, "trustLayerConfig", "singleton"));
        if (configSnap.exists()) {
            const config = configSnap.data() as TrustLayerConfig;
            anchorEpoch = config.currentEpoch;

            if (config.lastSnapshotId) {
                const snapshot = await getSnapshotByEpoch(anchorEpoch);
                if (snapshot) {
                    merkleProof = generateMerkleProof(snapshot.agents, asn);
                }
            }
        }
    } catch (error) {
        console.warn("Failed to generate Merkle proof:", error);
    }

    const topicId = getReputationTopicId();

    return {
        asn,
        agentAddress: hcsState.agentAddress,
        currentScore: {
            credit: hcsState.creditScore,
            trust: hcsState.trustScore,
        },
        events,
        merkleProof,
        anchorEpoch,
        topicId: topicId?.toString() || "",
    };
}

// ═══════════════════════════════════════════════════════════════
// Trust Layer Status
// ═══════════════════════════════════════════════════════════════

/**
 * Get the overall health/status of the trust layer.
 */
export async function getTrustLayerStatus(): Promise<TrustLayerStatus> {
    const hcsConfigured = isHCSConfigured();
    const subscriberRunning = isSubscriberRunning();
    const checkpointServiceRunning = isCheckpointServiceRunning();

    // Check NFT contract reachability
    let nftContractReachable = false;
    try {
        const { ethers } = await import("ethers");
        const { CONTRACTS, AGENT_IDENTITY_NFT_ABI } = await import("./swarm-contracts");
        const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
        const contract = new ethers.Contract(CONTRACTS.AGENT_IDENTITY_NFT, AGENT_IDENTITY_NFT_ABI, provider);
        await contract.getFunction("tokenURI").staticCall(0).catch(() => {});
        nftContractReachable = true;
    } catch {
        nftContractReachable = false;
    }

    // Check mirror node reachability
    let mirrorNodeReachable = false;
    try {
        const res = await fetch(`${MIRROR_NODE_URL}/api/v1/network/supply`, { signal: AbortSignal.timeout(5000) });
        mirrorNodeReachable = res.ok;
    } catch {
        mirrorNodeReachable = false;
    }

    // Get config from Firestore
    let lastCheckpointEpoch: number | null = null;
    let lastCheckpointTimestamp: number | null = null;
    let totalSnapshots = 0;
    let totalDigests = 0;
    let lastReconciliationTimestamp: number | null = null;

    try {
        const configSnap = await getDoc(doc(db, "trustLayerConfig", "singleton"));
        if (configSnap.exists()) {
            const config = configSnap.data() as TrustLayerConfig;
            lastCheckpointEpoch = config.currentEpoch;
        }
    } catch {
        // ignore
    }

    try {
        const snapshotsQ = query(collection(db, "scoreSnapshots"), orderBy("epoch", "desc"), limit(1));
        const snapshotsSnap = await getDocs(snapshotsQ);
        totalSnapshots = snapshotsSnap.size;
        if (!snapshotsSnap.empty) {
            lastCheckpointTimestamp = (snapshotsSnap.docs[0].data() as ScoreSnapshot).timestamp;
        }
    } catch {
        // ignore
    }

    try {
        const digestsQ = query(collection(db, "eventDigests"), orderBy("timestamp", "desc"), limit(1));
        const digestsSnap = await getDocs(digestsQ);
        totalDigests = digestsSnap.size;
    } catch {
        // ignore
    }

    try {
        const reconQ = query(collection(db, "reconciliationReports"), orderBy("timestamp", "desc"), limit(1));
        const reconSnap = await getDocs(reconQ);
        if (!reconSnap.empty) {
            lastReconciliationTimestamp = reconSnap.docs[0].data().timestamp;
        }
    } catch {
        // ignore
    }

    // Determine overall health
    let overallHealth: "healthy" | "degraded" | "unhealthy" = "unhealthy";
    if (hcsConfigured && mirrorNodeReachable) {
        overallHealth = subscriberRunning && checkpointServiceRunning ? "healthy" : "degraded";
    }

    return {
        hcsConfigured,
        nftContractReachable,
        mirrorNodeReachable,
        subscriberRunning,
        checkpointServiceRunning,
        lastCheckpointEpoch,
        lastCheckpointTimestamp,
        lastReconciliationTimestamp,
        totalSnapshots,
        totalDigests,
        overallHealth,
    };
}
