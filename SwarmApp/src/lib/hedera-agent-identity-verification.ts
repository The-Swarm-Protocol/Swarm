/**
 * Hedera Agent Identity Verification
 *
 * Allows agents to cryptographically prove ownership of their ASN
 * by signing a challenge message with their wallet. The proof is
 * published to HCS for immutable verification.
 *
 * Mirrors the org ownership pattern from hedera-org-ownership.ts:
 * Sign message → Submit to HCS → Verify from HCS history.
 */

import { ethers } from "ethers";
import {
    Client,
    AccountId,
    PrivateKey,
    TopicMessageSubmitTransaction,
    TopicId,
} from "@hashgraph/sdk";
import { db } from "@/lib/firebase";
import {
    doc,
    setDoc,
    getDoc,
    serverTimestamp,
} from "firebase/firestore";
import type { AgentIdentityProof } from "./hedera-trust-types";

// ═══════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════

const HEDERA_NETWORK = process.env.HEDERA_NETWORK || "testnet";
const HEDERA_OPERATOR_ID = process.env.HEDERA_OPERATOR_ID || "";
const HEDERA_OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY || "";
const HEDERA_REPUTATION_TOPIC_ID = process.env.HEDERA_REPUTATION_TOPIC_ID || "";

function getClient(): Client {
    if (HEDERA_NETWORK === "mainnet") {
        return Client.forMainnet();
    }
    return Client.forTestnet();
}

function configureClient(client: Client): Client {
    if (!HEDERA_OPERATOR_ID || !HEDERA_OPERATOR_KEY) {
        throw new Error("HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set");
    }
    client.setOperator(
        AccountId.fromString(HEDERA_OPERATOR_ID),
        PrivateKey.fromString(HEDERA_OPERATOR_KEY),
    );
    return client;
}

// ═══════════════════════════════════════════════════════════════
// Identity Message Format
// ═══════════════════════════════════════════════════════════════

/** Create the message that agents must sign to prove ASN ownership. */
export function createAgentIdentityMessage(asn: string, timestamp: number): string {
    return `Swarm Protocol Agent Identity: ${asn} at ${timestamp}`;
}

/**
 * Verify that an EVM signature matches the expected signer.
 */
function verifySignature(message: string, signature: string, expectedAddress: string): boolean {
    try {
        const recoveredAddress = ethers.verifyMessage(message, signature);
        return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
    } catch (error) {
        console.error("Agent signature verification failed:", error);
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════
// Identity Proof Submission
// ═══════════════════════════════════════════════════════════════

/**
 * Submit agent identity proof to HCS.
 * Agent signs a message containing their ASN; we verify and publish to HCS.
 */
export async function submitAgentIdentityProof(
    asn: string,
    agentAddress: string,
    signature: string,
): Promise<AgentIdentityProof> {
    // Verify signature
    const timestamp = Math.floor(Date.now() / 1000);
    // Allow a 5-minute window for timestamp in the signed message
    let verified = false;
    for (let offset = 0; offset <= 300; offset += 30) {
        const msg = createAgentIdentityMessage(asn, timestamp - offset);
        if (verifySignature(msg, signature, agentAddress)) {
            verified = true;
            break;
        }
    }

    if (!verified) {
        throw new Error("Invalid agent signature — could not verify ASN ownership");
    }

    // Publish to HCS
    let hcsTxId = "";
    let hcsConsensusTimestamp = "";

    if (HEDERA_REPUTATION_TOPIC_ID) {
        const client = configureClient(getClient());
        try {
            const topicId = TopicId.fromString(HEDERA_REPUTATION_TOPIC_ID);
            const payload = JSON.stringify({
                type: "agent_identity",
                asn,
                agentAddress,
                signature,
                timestamp,
            });

            const tx = await new TopicMessageSubmitTransaction()
                .setTopicId(topicId)
                .setMessage(payload)
                .execute(client);

            const receipt = await tx.getReceipt(client);
            hcsTxId = tx.transactionId.toString();
            hcsConsensusTimestamp = receipt.topicSequenceNumber?.toString() || "";

            console.log(`[Hedera] Agent identity proof submitted to HCS: ${asn}`);
        } catch (error) {
            console.error("[Hedera] Failed to submit agent identity to HCS:", error);
            throw error;
        } finally {
            client.close();
        }
    }

    // Build proof
    const proof: AgentIdentityProof = {
        asn,
        agentAddress,
        signature,
        hcsTxId,
        hcsConsensusTimestamp,
        verified: true,
        verifiedAt: timestamp,
    };

    // Store in Firestore
    try {
        await setDoc(doc(db, "agentIdentityProofs", asn), {
            ...proof,
            createdAt: serverTimestamp(),
        });
    } catch (error) {
        console.error("Failed to store agent identity proof:", error);
    }

    return proof;
}

// ═══════════════════════════════════════════════════════════════
// Identity Verification
// ═══════════════════════════════════════════════════════════════

/**
 * Verify an agent's identity by checking Firestore records.
 * Returns the latest verified identity proof, or null if none exists.
 */
export async function verifyAgentIdentity(asn: string): Promise<AgentIdentityProof | null> {
    try {
        const snap = await getDoc(doc(db, "agentIdentityProofs", asn));
        if (!snap.exists()) return null;

        const proof = snap.data() as AgentIdentityProof;

        // Re-verify the signature for freshness
        const msg = createAgentIdentityMessage(asn, proof.verifiedAt);
        const stillValid = verifySignature(msg, proof.signature, proof.agentAddress);

        return {
            ...proof,
            verified: stillValid,
        };
    } catch (error) {
        console.error(`Failed to verify agent identity for ${asn}:`, error);
        return null;
    }
}

/**
 * Check if an address owns a specific ASN.
 */
export async function checkAgentOwnership(
    asn: string,
    address: string,
): Promise<boolean> {
    try {
        const proof = await verifyAgentIdentity(asn);
        if (!proof) return false;
        return proof.verified && proof.agentAddress.toLowerCase() === address.toLowerCase();
    } catch (error) {
        console.error(`Failed to check agent ownership for ${asn}:`, error);
        return false;
    }
}
