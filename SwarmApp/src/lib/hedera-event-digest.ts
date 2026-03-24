/**
 * Hedera Event Digest Chain
 *
 * Produces cryptographic digests of batches of score events.
 * Each digest contains the SHA-256 hash of N events and chains
 * to the previous digest, forming a verifiable event log.
 *
 * Flow:
 * - Mirror node subscriber calls onEventProcessed() for each event
 * - Every DIGEST_BATCH_SIZE events, a digest is computed and published to HCS
 * - Digests chain via previousDigestHash
 * - Digests are stored in Firestore (eventDigests collection)
 */

import { submitScoreEvent, isHCSConfigured } from "./hedera-hcs-client";
import { computeEventDigestHash } from "./hedera-trust-crypto";
import { db } from "@/lib/firebase";
import {
    collection,
    doc,
    setDoc,
    query,
    orderBy,
    limit,
    getDocs,
    serverTimestamp,
} from "firebase/firestore";
import type { EventDigest, DigestHCSMessage } from "./hedera-trust-types";

// ═══════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════

const DIGEST_BATCH_SIZE = 50;

// ═══════════════════════════════════════════════════════════════
// In-Memory State
// ═══════════════════════════════════════════════════════════════

/** Buffer of raw event JSON strings since last digest */
let eventBuffer: string[] = [];
let currentFirstSequence = 0;
let currentLastSequence = 0;
let currentEpoch = 0;

/** Set the current epoch (called by checkpoint service). */
export function setDigestEpoch(epoch: number): void {
    currentEpoch = epoch;
}

// ═══════════════════════════════════════════════════════════════
// Digest Production
// ═══════════════════════════════════════════════════════════════

/**
 * Called by the mirror node subscriber for each processed event.
 * Accumulates events; when batch size reached, produces a digest.
 */
export async function onEventProcessed(
    eventJson: string,
    sequenceNumber: number,
): Promise<EventDigest | null> {
    if (eventBuffer.length === 0) {
        currentFirstSequence = sequenceNumber;
    }
    currentLastSequence = sequenceNumber;
    eventBuffer.push(eventJson);

    if (eventBuffer.length >= DIGEST_BATCH_SIZE) {
        return await produceDigest();
    }

    return null;
}

/**
 * Force-flush the current event buffer into a digest.
 * Called at checkpoint time even if batch isn't full.
 */
export async function flushEventDigest(): Promise<EventDigest | null> {
    if (eventBuffer.length === 0) return null;
    return await produceDigest();
}

/**
 * Internal: produce a digest from the current buffer.
 */
async function produceDigest(): Promise<EventDigest> {
    const digestId = crypto.randomUUID();
    const timestamp = Math.floor(Date.now() / 1000);
    const digestHash = computeEventDigestHash(eventBuffer);

    // Chain to previous digest
    const previousDigest = await getLatestDigest();
    const previousDigestHash = previousDigest?.digestHash ?? null;

    const digest: EventDigest = {
        digestId,
        epoch: currentEpoch,
        firstSequence: currentFirstSequence,
        lastSequence: currentLastSequence,
        eventCount: eventBuffer.length,
        digestHash,
        previousDigestHash,
        timestamp,
    };

    // Publish to HCS
    if (isHCSConfigured()) {
        try {
            const hcsMessage: DigestHCSMessage = {
                type: "event_digest",
                epoch: currentEpoch,
                ts: timestamp,
                hash: digestHash,
                prev: previousDigestHash,
                first: currentFirstSequence,
                last: currentLastSequence,
                n: eventBuffer.length,
            };

            const hcsResult = await submitScoreEvent({
                type: "checkpoint",
                asn: "SYSTEM_DIGEST",
                agentAddress: "0x0000000000000000000000000000000000000000",
                creditDelta: 0,
                trustDelta: 0,
                timestamp,
                metadata: hcsMessage as unknown as Record<string, unknown>,
            });

            digest.hcsTxId = hcsResult.txId;
            console.log(`📋 Published event digest to HCS: ${digestHash.slice(0, 16)}... (${eventBuffer.length} events)`);
        } catch (error) {
            console.error("Failed to publish event digest to HCS:", error);
        }
    }

    // Store in Firestore
    try {
        await setDoc(doc(db, "eventDigests", digestId), {
            ...digest,
            createdAt: serverTimestamp(),
        });
    } catch (error) {
        console.error("Failed to store event digest:", error);
    }

    // Reset buffer
    eventBuffer = [];
    currentFirstSequence = 0;
    currentLastSequence = 0;

    return digest;
}

// ═══════════════════════════════════════════════════════════════
// Queries
// ═══════════════════════════════════════════════════════════════

/** Get the latest event digest from Firestore. */
export async function getLatestDigest(): Promise<EventDigest | null> {
    try {
        const q = query(
            collection(db, "eventDigests"),
            orderBy("timestamp", "desc"),
            limit(1),
        );
        const snap = await getDocs(q);
        if (snap.empty) return null;
        return snap.docs[0].data() as EventDigest;
    } catch (error) {
        console.warn("Failed to fetch latest digest:", error);
        return null;
    }
}

/** Get digests by epoch. */
export async function getDigestsByEpoch(epoch: number): Promise<EventDigest[]> {
    try {
        const q = query(
            collection(db, "eventDigests"),
            orderBy("timestamp", "desc"),
            limit(200),
        );
        const snap = await getDocs(q);
        return snap.docs
            .map((d) => d.data() as EventDigest)
            .filter((d) => d.epoch === epoch);
    } catch (error) {
        console.warn(`Failed to fetch digests for epoch ${epoch}:`, error);
        return [];
    }
}

/**
 * Verify the integrity of the digest chain.
 * Walks backward from the latest digest, checking each previousDigestHash link.
 */
export async function verifyDigestChain(
    fromEpoch: number,
): Promise<{ valid: boolean; checkedCount: number; brokenAt?: number; reason?: string }> {
    try {
        const q = query(
            collection(db, "eventDigests"),
            orderBy("timestamp", "desc"),
            limit(500),
        );
        const snap = await getDocs(q);
        const allDigests = snap.docs
            .map((d) => d.data() as EventDigest)
            .filter((d) => d.epoch >= fromEpoch)
            .sort((a, b) => a.timestamp - b.timestamp);

        if (allDigests.length === 0) {
            return { valid: true, checkedCount: 0 };
        }

        for (let i = 1; i < allDigests.length; i++) {
            const current = allDigests[i];
            const previous = allDigests[i - 1];

            if (current.previousDigestHash !== previous.digestHash) {
                return {
                    valid: false,
                    checkedCount: i,
                    brokenAt: i,
                    reason: `Digest ${current.digestId} previousDigestHash (${current.previousDigestHash?.slice(0, 16)}) does not match previous digest hash (${previous.digestHash.slice(0, 16)})`,
                };
            }
        }

        return { valid: true, checkedCount: allDigests.length };
    } catch (error) {
        return {
            valid: false,
            checkedCount: 0,
            reason: `Failed to verify chain: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
    }
}
