/**
 * Hedera Trust Layer — Shared Types
 *
 * Central type definitions for the trust layer: score snapshots,
 * event digests, verification results, reconciliation reports,
 * and agent identity proofs.
 */

// ═══════════════════════════════════════════════════════════════
// Score Snapshot Types
// ═══════════════════════════════════════════════════════════════

/** A point-in-time score for a single agent within a snapshot */
export interface AgentScoreEntry {
  asn: string;
  agentAddress: string;
  creditScore: number;
  trustScore: number;
  eventCount: number;
}

/** Full snapshot of all agent scores at a point in time */
export interface ScoreSnapshot {
  /** Unique snapshot ID (uuid) */
  snapshotId: string;
  /** Unix timestamp (seconds) of snapshot creation */
  timestamp: number;
  /** Monotonically increasing epoch number */
  epoch: number;
  /** All agent scores at this point in time */
  agents: AgentScoreEntry[];
  /** Total number of agents */
  agentCount: number;
  /** SHA-256 hash of canonical JSON of sorted agents array */
  stateHash: string;
  /** Merkle root of agent score leaves */
  merkleRoot: string;
  /** Previous snapshot's stateHash (forms a chain) */
  previousStateHash: string | null;
  /** HCS transaction ID after publishing */
  hcsTxId?: string;
  /** HCS consensus timestamp */
  hcsConsensusTimestamp?: string;
  /** On-chain tx hashes for agent checkpoints */
  onChainTxHashes?: string[];
}

/** Compact HCS checkpoint message (must fit in 1024 bytes) */
export interface CheckpointHCSMessage {
  type: "score_checkpoint";
  /** Epoch number */
  epoch: number;
  /** Unix timestamp (seconds) */
  ts: number;
  /** State hash (64 hex chars) */
  hash: string;
  /** Merkle root (64 hex chars) */
  merkle: string;
  /** Previous state hash */
  prev: string | null;
  /** Agent count */
  n: number;
  /** Snapshot ID (first 8 chars) */
  sid: string;
}

// ═══════════════════════════════════════════════════════════════
// Event Digest Types
// ═══════════════════════════════════════════════════════════════

/** A batch digest of N score events */
export interface EventDigest {
  digestId: string;
  /** Epoch number this digest belongs to */
  epoch: number;
  /** First event sequence number in this batch */
  firstSequence: number;
  /** Last event sequence number in this batch */
  lastSequence: number;
  /** Number of events in this digest */
  eventCount: number;
  /** SHA-256 hash of concatenated event hashes */
  digestHash: string;
  /** Previous digest hash (forms chain) */
  previousDigestHash: string | null;
  /** Unix timestamp (seconds) */
  timestamp: number;
  /** HCS transaction ID */
  hcsTxId?: string;
}

/** Compact HCS digest message */
export interface DigestHCSMessage {
  type: "event_digest";
  epoch: number;
  ts: number;
  hash: string;
  prev: string | null;
  first: number;
  last: number;
  n: number;
}

// ═══════════════════════════════════════════════════════════════
// Verification Types
// ═══════════════════════════════════════════════════════════════

export interface ScoreVerificationResult {
  asn: string;
  agentAddress: string;
  /** Score from Firestore */
  firestoreScore: { credit: number; trust: number } | null;
  /** Score computed from HCS events */
  hcsComputedScore: { credit: number; trust: number } | null;
  /** Score from on-chain NFT contract */
  onChainScore: { credit: number; trust: number } | null;
  /** Whether all available sources agree (within tolerance) */
  consistent: boolean;
  /** Drift amounts between sources */
  drift: {
    firestoreVsHcs: { credit: number; trust: number } | null;
    firestoreVsOnChain: { credit: number; trust: number } | null;
    hcsVsOnChain: { credit: number; trust: number } | null;
  };
  /** Latest checkpoint epoch containing this agent */
  latestCheckpointEpoch?: number;
  verifiedAt: number;
}

export interface CheckpointVerificationResult {
  epoch: number;
  snapshotId: string;
  /** Hash from Firestore snapshot */
  storedHash: string;
  /** Hash recomputed from snapshot agents array */
  recomputedHash: string;
  /** Hash from HCS message */
  hcsHash: string | null;
  /** Whether stored matches recomputed */
  firestoreConsistent: boolean;
  /** Whether stored matches HCS */
  hcsConsistent: boolean;
  verifiedAt: number;
}

export interface ProvenanceProof {
  asn: string;
  agentAddress: string;
  currentScore: { credit: number; trust: number };
  /** HCS events that contributed to this score */
  events: Array<{
    type: string;
    creditDelta: number;
    trustDelta: number;
    timestamp: number;
    hcsSequence: number;
  }>;
  /** Merkle proof path from agent leaf to merkle root */
  merkleProof?: string[];
  /** Checkpoint epoch this proof is anchored to */
  anchorEpoch: number;
  /** HCS topic ID */
  topicId: string;
}

export interface ReconciliationReport {
  reportId: string;
  timestamp: number;
  epoch: number;
  totalAgents: number;
  consistentAgents: number;
  inconsistentAgents: number;
  discrepancies: Array<{
    asn: string;
    source: "firestore_vs_hcs" | "firestore_vs_onchain" | "hcs_vs_onchain";
    expected: { credit: number; trust: number };
    actual: { credit: number; trust: number };
    drift: { credit: number; trust: number };
  }>;
  autoHealedCount: number;
}

export interface TrustLayerStatus {
  hcsConfigured: boolean;
  nftContractReachable: boolean;
  mirrorNodeReachable: boolean;
  subscriberRunning: boolean;
  checkpointServiceRunning: boolean;
  lastCheckpointEpoch: number | null;
  lastCheckpointTimestamp: number | null;
  lastReconciliationTimestamp: number | null;
  totalSnapshots: number;
  totalDigests: number;
  overallHealth: "healthy" | "degraded" | "unhealthy";
}

// ═══════════════════════════════════════════════════════════════
// Agent Identity Verification Types
// ═══════════════════════════════════════════════════════════════

export interface AgentIdentityProof {
  asn: string;
  agentAddress: string;
  /** Signed message proving ownership */
  signature: string;
  /** HCS transaction ID of identity claim */
  hcsTxId: string;
  /** HCS consensus timestamp */
  hcsConsensusTimestamp: string;
  /** On-chain NFT token ID */
  nftTokenId?: string;
  verified: boolean;
  verifiedAt: number;
}

// ═══════════════════════════════════════════════════════════════
// Trust Layer Config
// ═══════════════════════════════════════════════════════════════

export interface TrustLayerConfig {
  currentEpoch: number;
  lastSnapshotId: string | null;
  lastDigestId: string | null;
  reconciliationEnabled: boolean;
}
