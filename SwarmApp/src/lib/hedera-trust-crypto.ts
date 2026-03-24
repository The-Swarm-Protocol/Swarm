/**
 * Hedera Trust Layer — Cryptographic Utilities
 *
 * Pure functions for SHA-256 hashing, Merkle tree construction,
 * proof generation/verification, and canonical serialization.
 * No side effects, no Hedera SDK calls.
 */

import crypto from "crypto";
import type { AgentScoreEntry } from "./hedera-trust-types";

// ═══════════════════════════════════════════════════════════════
// Core Hashing
// ═══════════════════════════════════════════════════════════════

/** Compute SHA-256 hex digest of arbitrary string input. */
export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input, "utf-8").digest("hex");
}

/**
 * Compute SHA-256 of a single agent score entry (leaf node).
 * Canonical format: "asn:creditScore:trustScore:eventCount"
 */
export function hashAgentScore(entry: AgentScoreEntry): string {
  const canonical = `${entry.asn}:${entry.creditScore}:${entry.trustScore}:${entry.eventCount}`;
  return sha256(canonical);
}

/**
 * Compute the aggregate stateHash from a list of agent scores.
 * Sort by ASN for determinism, then SHA-256 the canonical JSON.
 */
export function computeStateHash(agents: AgentScoreEntry[]): string {
  const sorted = [...agents].sort((a, b) => a.asn.localeCompare(b.asn));
  const canonical = JSON.stringify(sorted);
  return sha256(canonical);
}

// ═══════════════════════════════════════════════════════════════
// Merkle Tree
// ═══════════════════════════════════════════════════════════════

/**
 * Build a Merkle tree from agent score leaf hashes.
 * Returns the Merkle root.
 */
export function computeMerkleRoot(agents: AgentScoreEntry[]): string {
  if (agents.length === 0) return sha256("empty");

  const sorted = [...agents].sort((a, b) => a.asn.localeCompare(b.asn));
  let leaves = sorted.map(hashAgentScore);

  // Pad to power of 2 by duplicating last leaf
  while (leaves.length > 1 && (leaves.length & (leaves.length - 1)) !== 0) {
    leaves.push(leaves[leaves.length - 1]);
  }

  while (leaves.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < leaves.length; i += 2) {
      const left = leaves[i];
      const right = leaves[i + 1] || left;
      nextLevel.push(sha256(left + right));
    }
    leaves = nextLevel;
  }

  return leaves[0];
}

/**
 * Generate a Merkle proof for a specific agent (by ASN).
 * Returns array of { hash, position } from leaf to root.
 */
export function generateMerkleProof(
  agents: AgentScoreEntry[],
  targetAsn: string,
): string[] {
  if (agents.length === 0) return [];

  const sorted = [...agents].sort((a, b) => a.asn.localeCompare(b.asn));
  let leaves = sorted.map(hashAgentScore);

  // Find target index
  const targetIndex = sorted.findIndex((a) => a.asn === targetAsn);
  if (targetIndex === -1) return [];

  // Pad to power of 2
  while (leaves.length > 1 && (leaves.length & (leaves.length - 1)) !== 0) {
    leaves.push(leaves[leaves.length - 1]);
  }

  const proof: string[] = [];
  let index = targetIndex;

  // Build proof by collecting siblings at each level
  let currentLevel = leaves;
  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = currentLevel[i + 1] || left;
      nextLevel.push(sha256(left + right));
    }

    // Collect sibling hash
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
    if (siblingIndex < currentLevel.length) {
      proof.push(currentLevel[siblingIndex]);
    }

    index = Math.floor(index / 2);
    currentLevel = nextLevel;
  }

  return proof;
}

/**
 * Verify a Merkle proof for a specific agent leaf.
 */
export function verifyMerkleProof(
  leafHash: string,
  proof: string[],
  merkleRoot: string,
  leafIndex: number,
): boolean {
  let currentHash = leafHash;
  let index = leafIndex;

  for (const siblingHash of proof) {
    if (index % 2 === 0) {
      currentHash = sha256(currentHash + siblingHash);
    } else {
      currentHash = sha256(siblingHash + currentHash);
    }
    index = Math.floor(index / 2);
  }

  return currentHash === merkleRoot;
}

// ═══════════════════════════════════════════════════════════════
// Event Digest Hashing
// ═══════════════════════════════════════════════════════════════

/**
 * Compute digest hash for a batch of score events.
 * Hash each event individually, then hash the concatenation.
 */
export function computeEventDigestHash(eventJsonStrings: string[]): string {
  const individualHashes = eventJsonStrings.map((e) => sha256(e));
  return sha256(individualHashes.join(""));
}
