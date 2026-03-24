/**
 * Hedera Checkpoint Service
 *
 * Periodically writes computed scores from the HCS event stream to the on-chain NFT contract.
 * Produces cryptographic snapshots with state hashes and Merkle roots, published to HCS.
 *
 * Architecture:
 * - Runs every 1 hour (configurable)
 * - Reads current scores from mirror node subscriber cache
 * - Writes to SwarmAgentIdentityNFT contract via batchUpdateReputation()
 * - Computes SHA-256 state hash + Merkle root of all agent scores
 * - Stores ScoreSnapshot in Firestore (scoreSnapshots collection)
 * - Publishes compact CheckpointHCSMessage to HCS for verifiable anchoring
 * - Emits checkpoint events back to HCS for per-agent audit trail
 */

import { ethers } from "ethers";
import { getAllScoreStates } from "./hedera-mirror-subscriber";
import { createCheckpointEvent, submitScoreEvent, isHCSConfigured } from "./hedera-hcs-client";
import { CONTRACTS, AGENT_IDENTITY_NFT_ABI } from "./swarm-contracts";
import { computeStateHash, computeMerkleRoot } from "./hedera-trust-crypto";
import { db } from "@/lib/firebase";
import {
    collection,
    doc,
    setDoc,
    getDoc,
    query,
    orderBy,
    limit,
    getDocs,
    updateDoc,
    serverTimestamp,
} from "firebase/firestore";
import type {
    AgentScoreEntry,
    ScoreSnapshot,
    CheckpointHCSMessage,
    TrustLayerConfig,
} from "./hedera-trust-types";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface CheckpointResult {
    asn: string;
    agentAddress: string;
    creditScore: number;
    trustScore: number;
    txHash: string;
    hcsTxId: string;
}

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

const HEDERA_TESTNET_RPC = "https://testnet.hashio.io/api";
const CHECKPOINT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const TRUST_CONFIG_DOC = "singleton";

// ═══════════════════════════════════════════════════════════════
// Trust Layer Config (Firestore)
// ═══════════════════════════════════════════════════════════════

async function getTrustConfig(): Promise<TrustLayerConfig> {
    try {
        const snap = await getDoc(doc(db, "trustLayerConfig", TRUST_CONFIG_DOC));
        if (snap.exists()) {
            return snap.data() as TrustLayerConfig;
        }
    } catch (error) {
        console.warn("Failed to read trust config:", error);
    }
    return {
        currentEpoch: 0,
        lastSnapshotId: null,
        lastDigestId: null,
        reconciliationEnabled: false,
    };
}

async function updateTrustConfig(updates: Partial<TrustLayerConfig>): Promise<void> {
    try {
        await setDoc(doc(db, "trustLayerConfig", TRUST_CONFIG_DOC), updates, { merge: true });
    } catch (error) {
        console.error("Failed to update trust config:", error);
    }
}

// ═══════════════════════════════════════════════════════════════
// Snapshot Helpers
// ═══════════════════════════════════════════════════════════════

/** Get the latest stored snapshot from Firestore. */
async function getLatestSnapshot(): Promise<ScoreSnapshot | null> {
    try {
        const q = query(
            collection(db, "scoreSnapshots"),
            orderBy("epoch", "desc"),
            limit(1),
        );
        const snap = await getDocs(q);
        if (snap.empty) return null;
        return snap.docs[0].data() as ScoreSnapshot;
    } catch (error) {
        console.warn("Failed to fetch latest snapshot:", error);
        return null;
    }
}

/** Get snapshot by epoch. */
export async function getSnapshotByEpoch(epoch: number): Promise<ScoreSnapshot | null> {
    try {
        const q = query(
            collection(db, "scoreSnapshots"),
            orderBy("epoch", "desc"),
            limit(100),
        );
        const snap = await getDocs(q);
        for (const d of snap.docs) {
            const data = d.data() as ScoreSnapshot;
            if (data.epoch === epoch) return data;
        }
        return null;
    } catch (error) {
        console.warn(`Failed to fetch snapshot for epoch ${epoch}:`, error);
        return null;
    }
}

/** Generate a short unique snapshot ID. */
function generateSnapshotId(): string {
    return crypto.randomUUID();
}

// ═══════════════════════════════════════════════════════════════
// On-Chain Checkpoint (Batch)
// ═══════════════════════════════════════════════════════════════

/**
 * Write all agent scores to the on-chain NFT contract in a single batch.
 * Uses batchUpdateReputation(address[], uint16[], uint8[]).
 */
async function batchCheckpointScores(
    states: Array<{ agentAddress: string; creditScore: number; trustScore: number }>,
): Promise<string> {
    const privateKey = process.env.HEDERA_PLATFORM_KEY;
    if (!privateKey) {
        throw new Error("HEDERA_PLATFORM_KEY not set - cannot write checkpoint");
    }

    const provider = new ethers.JsonRpcProvider(HEDERA_TESTNET_RPC);
    const wallet = new ethers.Wallet(privateKey, provider);
    const nftContract = new ethers.Contract(
        CONTRACTS.AGENT_IDENTITY_NFT,
        AGENT_IDENTITY_NFT_ABI,
        wallet,
    );

    const addresses = states.map((s) => s.agentAddress);
    const credits = states.map((s) => s.creditScore);
    const trusts = states.map((s) => s.trustScore);

    const tx = await nftContract.batchUpdateReputation(
        addresses,
        credits,
        trusts,
        { gasLimit: 1_000_000, type: 0 },
    );

    const receipt = await tx.wait();
    return receipt.hash;
}

/**
 * Fallback: write a single agent's score to the on-chain NFT contract.
 */
async function checkpointAgentScore(
    agentAddress: string,
    creditScore: number,
    trustScore: number,
): Promise<string> {
    const privateKey = process.env.HEDERA_PLATFORM_KEY;
    if (!privateKey) {
        throw new Error("HEDERA_PLATFORM_KEY not set - cannot write checkpoint");
    }

    const provider = new ethers.JsonRpcProvider(HEDERA_TESTNET_RPC);
    const wallet = new ethers.Wallet(privateKey, provider);
    const nftContract = new ethers.Contract(
        CONTRACTS.AGENT_IDENTITY_NFT,
        AGENT_IDENTITY_NFT_ABI,
        wallet,
    );

    const tx = await nftContract.updateReputation(
        agentAddress,
        creditScore,
        trustScore,
        { gasLimit: 500000, type: 0 },
    );

    const receipt = await tx.wait();
    return receipt.hash;
}

// ═══════════════════════════════════════════════════════════════
// Score Snapshot Creation
// ═══════════════════════════════════════════════════════════════

/**
 * Create a cryptographic score snapshot and publish to HCS.
 */
async function createScoreSnapshot(
    agents: AgentScoreEntry[],
    epoch: number,
    onChainTxHashes: string[],
): Promise<ScoreSnapshot> {
    const snapshotId = generateSnapshotId();
    const timestamp = Math.floor(Date.now() / 1000);

    // Compute cryptographic hashes
    const stateHash = computeStateHash(agents);
    const merkleRoot = computeMerkleRoot(agents);

    // Chain to previous snapshot
    const previousSnapshot = await getLatestSnapshot();
    const previousStateHash = previousSnapshot?.stateHash ?? null;

    // Build snapshot
    const snapshot: ScoreSnapshot = {
        snapshotId,
        timestamp,
        epoch,
        agents,
        agentCount: agents.length,
        stateHash,
        merkleRoot,
        previousStateHash,
        onChainTxHashes,
    };

    // Publish compact checkpoint message to HCS
    if (isHCSConfigured()) {
        try {
            const hcsMessage: CheckpointHCSMessage = {
                type: "score_checkpoint",
                epoch,
                ts: timestamp,
                hash: stateHash,
                merkle: merkleRoot,
                prev: previousStateHash,
                n: agents.length,
                sid: snapshotId.slice(0, 8),
            };

            const hcsResult = await submitScoreEvent({
                type: "checkpoint",
                asn: "SYSTEM",
                agentAddress: "0x0000000000000000000000000000000000000000",
                creditDelta: 0,
                trustDelta: 0,
                timestamp,
                metadata: hcsMessage as unknown as Record<string, unknown>,
            });

            snapshot.hcsTxId = hcsResult.txId;
            snapshot.hcsConsensusTimestamp = hcsResult.consensusTimestamp;

            console.log(`📋 Published checkpoint hash to HCS: epoch=${epoch}, hash=${stateHash.slice(0, 16)}...`);
        } catch (error) {
            console.error("Failed to publish checkpoint hash to HCS:", error);
        }
    }

    // Store snapshot in Firestore
    try {
        await setDoc(doc(db, "scoreSnapshots", snapshotId), {
            ...snapshot,
            createdAt: serverTimestamp(),
        });
        console.log(`💾 Stored snapshot ${snapshotId} (epoch ${epoch}) in Firestore`);
    } catch (error) {
        console.error("Failed to store snapshot in Firestore:", error);
    }

    // Update trust config epoch
    await updateTrustConfig({
        currentEpoch: epoch,
        lastSnapshotId: snapshotId,
    });

    return snapshot;
}

// ═══════════════════════════════════════════════════════════════
// Main Checkpoint Flow
// ═══════════════════════════════════════════════════════════════

/**
 * Checkpoint all agents with updated scores.
 * 1. Snapshot all score states
 * 2. Batch-write to on-chain NFT contract
 * 3. Emit per-agent checkpoint events to HCS
 * 4. Create and store cryptographic snapshot
 */
export async function checkpointAllScores(): Promise<CheckpointResult[]> {
    const allStates = getAllScoreStates();

    if (allStates.length === 0) {
        console.log("⏭️  No scores to checkpoint");
        return [];
    }

    console.log(`🔄 Checkpointing ${allStates.length} agent scores...`);

    // Get next epoch
    const config = await getTrustConfig();
    const epoch = config.currentEpoch + 1;

    // Build agent score entries for snapshot
    const agentEntries: AgentScoreEntry[] = allStates.map((state) => ({
        asn: state.asn,
        agentAddress: state.agentAddress,
        creditScore: state.creditScore,
        trustScore: state.trustScore,
        eventCount: state.eventCount,
    }));

    // 1. Batch write to on-chain NFT contract
    const onChainTxHashes: string[] = [];
    try {
        const batchTxHash = await batchCheckpointScores(allStates);
        onChainTxHashes.push(batchTxHash);
        console.log(`✅ Batch on-chain checkpoint: ${batchTxHash}`);
    } catch (error) {
        console.warn("Batch checkpoint failed, falling back to per-agent:", error);
        // Fallback to per-agent writes
        for (const state of allStates) {
            try {
                const txHash = await checkpointAgentScore(
                    state.agentAddress,
                    state.creditScore,
                    state.trustScore,
                );
                onChainTxHashes.push(txHash);
            } catch (err) {
                console.error(`❌ Failed to checkpoint ${state.asn} on-chain:`, err);
            }
        }
    }

    // 2. Emit per-agent checkpoint events to HCS
    const results: CheckpointResult[] = [];
    for (const state of allStates) {
        try {
            const checkpointEvent = createCheckpointEvent(
                state.asn,
                state.agentAddress,
                state.creditScore,
                state.trustScore,
            );
            const hcsResult = await submitScoreEvent(checkpointEvent);

            results.push({
                asn: state.asn,
                agentAddress: state.agentAddress,
                creditScore: state.creditScore,
                trustScore: state.trustScore,
                txHash: onChainTxHashes[0] || "",
                hcsTxId: hcsResult.txId,
            });

            console.log(`✅ Checkpointed ${state.asn}: credit=${state.creditScore}, trust=${state.trustScore}`);
        } catch (error) {
            console.error(`❌ Failed to checkpoint ${state.asn} on HCS:`, error);
        }
    }

    // 3. Create cryptographic snapshot
    try {
        const snapshot = await createScoreSnapshot(agentEntries, epoch, onChainTxHashes);
        console.log(`📦 Epoch ${epoch} snapshot: stateHash=${snapshot.stateHash.slice(0, 16)}... merkle=${snapshot.merkleRoot.slice(0, 16)}...`);
    } catch (error) {
        console.error("Failed to create score snapshot:", error);
    }

    console.log(`✅ Checkpoint complete: ${results.length}/${allStates.length} agents (epoch ${epoch})`);

    return results;
}

// ═══════════════════════════════════════════════════════════════
// Background Service
// ═══════════════════════════════════════════════════════════════

let checkpointInterval: NodeJS.Timeout | null = null;

/** Check if the checkpoint service is currently running. */
export function isCheckpointServiceRunning(): boolean {
    return checkpointInterval !== null;
}

/**
 * Start the periodic checkpoint service.
 * Runs every hour (configurable via CHECKPOINT_INTERVAL_MS).
 */
export function startCheckpointService(): void {
    if (checkpointInterval) {
        console.warn("Checkpoint service already running");
        return;
    }

    console.log(`🕒 Starting checkpoint service (interval: ${CHECKPOINT_INTERVAL_MS / 1000}s)`);

    // Run immediately on start
    checkpointAllScores().catch(error => {
        console.error("Initial checkpoint failed:", error);
    });

    // Then run periodically
    checkpointInterval = setInterval(async () => {
        try {
            await checkpointAllScores();
        } catch (error) {
            console.error("Checkpoint service error:", error);
        }
    }, CHECKPOINT_INTERVAL_MS);
}

/**
 * Stop the periodic checkpoint service.
 */
export function stopCheckpointService(): void {
    if (checkpointInterval) {
        clearInterval(checkpointInterval);
        checkpointInterval = null;
        console.log("🛑 Stopped checkpoint service");
    }
}
