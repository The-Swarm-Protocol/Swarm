/**
 * Fraud Detection Engine — Core Types & Orchestrator
 *
 * Scans existing Firestore data (taskAssignments, agents, jobs, validationStakes)
 * to detect manipulation patterns: self-dealing, collusion, spam farming, wash
 * settlement, identity resets, and more.
 *
 * Runs as a batch cron pipeline. Each detector returns RiskSignal[] which feed
 * into composite risk scoring, auto-penalties, and admin review queue.
 */

import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
} from "firebase/firestore";
import { computeRiskProfile, computeRiskTier, type RiskProfile } from "./fraud-risk-scoring";
import { applyAutoPenalties } from "./fraud-auto-penalty";
import { logActivity } from "./activity";

// ═══════════════════════════════════════════════════════════════
// Signal Types
// ═══════════════════════════════════════════════════════════════

export type RiskSignalType =
  | "self_deal_loop"
  | "trust_ring"
  | "spam_task_farming"
  | "wash_settlement"
  | "repetitive_low_value"
  | "graph_concentration"
  | "identity_reset"
  | "velocity_anomaly"
  | "cross_validation_abuse";

export type SignalSeverity = "low" | "medium" | "high" | "critical";

export type SignalStatus = "active" | "dismissed" | "penalized" | "escalated";

export type RiskTier = "clean" | "watch" | "suspicious" | "flagged" | "banned";

// ═══════════════════════════════════════════════════════════════
// Interfaces
// ═══════════════════════════════════════════════════════════════

export interface RiskSignalEvidence {
  counterpartyIds?: string[];
  taskIds?: string[];
  jobIds?: string[];
  walletAddresses?: string[];
  windowStart: number; // Unix timestamp
  windowEnd: number;   // Unix timestamp
  metric?: number;     // The quantified anomaly value
  threshold?: number;  // What normal looks like
  description: string; // Human-readable explanation
}

export interface RiskSignal {
  id?: string;
  agentId: string;
  asn: string;
  orgId: string;
  signalType: RiskSignalType;
  severity: SignalSeverity;
  confidence: number; // 0.0 - 1.0
  evidence: RiskSignalEvidence;
  scanRunId: string;
  status: SignalStatus;
  createdAt?: unknown;
  resolvedAt?: unknown;
  resolvedBy?: string;
}

export interface FraudReviewCase {
  id?: string;
  agentId: string;
  asn: string;
  orgId: string;
  agentName: string;
  riskScore: number;
  riskTier: string;
  triggerSignalIds: string[];
  triggerReason: string;
  severity: "medium" | "high" | "critical";
  status: "pending" | "investigating" | "resolved_clean" | "resolved_penalized" | "resolved_banned";
  assignedTo?: string;
  assignedAt?: unknown;
  resolution?: {
    action: "dismiss" | "warn" | "penalty" | "ban";
    creditPenalty?: number;
    trustPenalty?: number;
    notes: string;
    resolvedBy: string;
    resolvedAt: unknown;
  };
  reviewHistory: {
    action: string;
    performedBy: string;
    notes?: string;
    timestamp: string;
  }[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FraudScanRun {
  id?: string;
  startedAt: unknown;
  completedAt?: unknown;
  durationMs: number;
  status: "running" | "completed" | "failed";
  error?: string;
  agentsScanned: number;
  signalsGenerated: number;
  signalBreakdown: Record<string, number>;
  autoPenaltiesApplied: number;
  casesEscalated: number;
  config: FraudDetectionConfig;
}

export interface FraudDetectionConfig {
  windowDays: number;
  selfDealThreshold: number;
  selfDealMinCompletions: number;
  trustRingMaxSize: number;
  trustRingInsularity: number;
  spamVelocityThreshold: number;
  spamSimpleRatio: number;
  washSettlementMinutes: number;
  graphConcentrationHHI: number;
  graphConcentrationMinInteractions: number;
  velocityZScoreThreshold: number;
  lowValueSimilarityThreshold: number;
  crossValidationConcentration: number;
  autoPenaltyEnabled: boolean;
  autoPenaltyMaxCredit: number;
}

export const DEFAULT_CONFIG: FraudDetectionConfig = {
  windowDays: 30,
  selfDealThreshold: 0.5,
  selfDealMinCompletions: 3,
  trustRingMaxSize: 5,
  trustRingInsularity: 0.8,
  spamVelocityThreshold: 15,
  spamSimpleRatio: 0.8,
  washSettlementMinutes: 5,
  graphConcentrationHHI: 0.5,
  graphConcentrationMinInteractions: 10,
  velocityZScoreThreshold: 3.0,
  lowValueSimilarityThreshold: 0.7,
  crossValidationConcentration: 0.8,
  autoPenaltyEnabled: true,
  autoPenaltyMaxCredit: 50,
};

// ═══════════════════════════════════════════════════════════════
// Firestore CRUD
// ═══════════════════════════════════════════════════════════════

const SIGNALS_COLLECTION = "riskSignals";
const PROFILES_COLLECTION = "riskProfiles";
const REVIEW_COLLECTION = "fraudReviewQueue";
const SCAN_RUNS_COLLECTION = "fraudScanRuns";

/** Save a risk signal. Returns the document ID. */
export async function saveRiskSignal(signal: RiskSignal): Promise<string> {
  const ref = await addDoc(collection(db, SIGNALS_COLLECTION), {
    ...signal,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Get active signals for an agent. */
export async function getActiveSignals(agentId: string): Promise<RiskSignal[]> {
  const q = query(
    collection(db, SIGNALS_COLLECTION),
    where("agentId", "==", agentId),
    where("status", "==", "active"),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RiskSignal));
}

/** Get all signals for a scan run. */
export async function getSignalsByScanRun(scanRunId: string): Promise<RiskSignal[]> {
  const q = query(
    collection(db, SIGNALS_COLLECTION),
    where("scanRunId", "==", scanRunId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RiskSignal));
}

/** Get signals with filtering. */
export async function getSignals(opts: {
  agentId?: string;
  signalType?: RiskSignalType;
  severity?: SignalSeverity;
  status?: SignalStatus;
  max?: number;
}): Promise<RiskSignal[]> {
  const constraints: Parameters<typeof query>[1][] = [];
  if (opts.agentId) constraints.push(where("agentId", "==", opts.agentId));
  if (opts.signalType) constraints.push(where("signalType", "==", opts.signalType));
  if (opts.severity) constraints.push(where("severity", "==", opts.severity));
  if (opts.status) constraints.push(where("status", "==", opts.status));
  constraints.push(orderBy("createdAt", "desc"));
  constraints.push(firestoreLimit(opts.max || 100));

  const q = query(collection(db, SIGNALS_COLLECTION), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RiskSignal));
}

/** Update signal status. */
export async function updateSignalStatus(
  signalId: string,
  status: SignalStatus,
  resolvedBy?: string,
): Promise<void> {
  const ref = doc(db, SIGNALS_COLLECTION, signalId);
  const update: Record<string, unknown> = { status };
  if (resolvedBy) {
    update.resolvedBy = resolvedBy;
    update.resolvedAt = serverTimestamp();
  }
  await updateDoc(ref, update);
}

/** Save or update a risk profile (doc ID = agentId). */
export async function saveRiskProfile(profile: RiskProfile): Promise<void> {
  const ref = doc(db, PROFILES_COLLECTION, profile.agentId);
  await setDoc(ref, { ...profile, updatedAt: serverTimestamp() }, { merge: true });
}

/** Get risk profile for an agent. */
export async function getRiskProfile(agentId: string): Promise<RiskProfile | null> {
  const ref = doc(db, PROFILES_COLLECTION, agentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as RiskProfile;
}

/** Get all risk profiles with optional tier filter. */
export async function getRiskProfiles(opts?: {
  riskTier?: RiskTier;
  max?: number;
}): Promise<RiskProfile[]> {
  const constraints: Parameters<typeof query>[1][] = [];
  if (opts?.riskTier) constraints.push(where("riskTier", "==", opts.riskTier));
  constraints.push(firestoreLimit(opts?.max || 200));

  const q = query(collection(db, PROFILES_COLLECTION), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as RiskProfile);
}

/** Save a fraud review case. */
export async function saveFraudReviewCase(reviewCase: FraudReviewCase): Promise<string> {
  const ref = await addDoc(collection(db, REVIEW_COLLECTION), {
    ...reviewCase,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Get fraud review case by ID. */
export async function getFraudReviewCase(caseId: string): Promise<FraudReviewCase | null> {
  const ref = doc(db, REVIEW_COLLECTION, caseId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as FraudReviewCase;
}

/** List fraud review cases with filtering. */
export async function listFraudReviewCases(opts?: {
  status?: FraudReviewCase["status"];
  severity?: "medium" | "high" | "critical";
  agentId?: string;
  max?: number;
}): Promise<FraudReviewCase[]> {
  const constraints: Parameters<typeof query>[1][] = [];
  if (opts?.status) constraints.push(where("status", "==", opts.status));
  if (opts?.severity) constraints.push(where("severity", "==", opts.severity));
  if (opts?.agentId) constraints.push(where("agentId", "==", opts.agentId));
  constraints.push(orderBy("createdAt", "desc"));
  constraints.push(firestoreLimit(opts?.max || 100));

  const q = query(collection(db, REVIEW_COLLECTION), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FraudReviewCase));
}

/** Update a fraud review case. */
export async function updateFraudReviewCase(
  caseId: string,
  updates: Partial<FraudReviewCase>,
): Promise<void> {
  const ref = doc(db, REVIEW_COLLECTION, caseId);
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
}

/** Create a fraud scan run record. */
export async function createScanRun(config: FraudDetectionConfig): Promise<string> {
  const ref = await addDoc(collection(db, SCAN_RUNS_COLLECTION), {
    startedAt: serverTimestamp(),
    status: "running",
    durationMs: 0,
    agentsScanned: 0,
    signalsGenerated: 0,
    signalBreakdown: {},
    autoPenaltiesApplied: 0,
    casesEscalated: 0,
    config,
  } satisfies Omit<FraudScanRun, "id">);
  return ref.id;
}

/** Update a scan run with results. */
export async function updateScanRun(
  runId: string,
  updates: Partial<FraudScanRun>,
): Promise<void> {
  const ref = doc(db, SCAN_RUNS_COLLECTION, runId);
  await updateDoc(ref, updates);
}

/** Get a scan run by ID. */
export async function getScanRun(runId: string): Promise<FraudScanRun | null> {
  const ref = doc(db, SCAN_RUNS_COLLECTION, runId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as FraudScanRun;
}

/** List recent scan runs. */
export async function listScanRuns(max: number = 20): Promise<FraudScanRun[]> {
  const q = query(
    collection(db, SCAN_RUNS_COLLECTION),
    orderBy("startedAt", "desc"),
    firestoreLimit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FraudScanRun));
}

// ═══════════════════════════════════════════════════════════════
// Deduplication
// ═══════════════════════════════════════════════════════════════

/**
 * Check if a duplicate active signal already exists.
 * Deduplicates on (agentId, signalType, sorted counterpartyIds hash).
 */
async function isDuplicateSignal(signal: RiskSignal): Promise<boolean> {
  const q = query(
    collection(db, SIGNALS_COLLECTION),
    where("agentId", "==", signal.agentId),
    where("signalType", "==", signal.signalType),
    where("status", "==", "active"),
  );
  const snap = await getDocs(q);

  if (snap.empty) return false;

  // Check if any existing signal has the same counterparty set
  const newCounterparties = (signal.evidence.counterpartyIds || []).sort().join(",");
  for (const d of snap.docs) {
    const existing = d.data() as RiskSignal;
    const existingCounterparties = (existing.evidence?.counterpartyIds || []).sort().join(",");
    if (existingCounterparties === newCounterparties) return true;
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════
// Detector Interface
// ═══════════════════════════════════════════════════════════════

export type FraudDetector = (
  orgId: string,
  windowDays: number,
  config: FraudDetectionConfig,
  scanRunId: string,
) => Promise<RiskSignal[]>;

export type PlatformWideDetector = (
  config: FraudDetectionConfig,
  scanRunId: string,
) => Promise<RiskSignal[]>;

// ═══════════════════════════════════════════════════════════════
// Orchestrator
// ═══════════════════════════════════════════════════════════════

/**
 * Run a full fraud detection scan across all organizations.
 *
 * 1. Creates scan run record
 * 2. Fetches all organizations
 * 3. Runs all org-scoped detectors per org
 * 4. Runs platform-wide detectors
 * 5. Deduplicates and persists signals
 * 6. Recomputes risk profiles
 * 7. Applies auto-penalties
 * 8. Creates review cases
 * 9. Logs activity events
 * 10. Updates scan run record
 */
export async function runFraudScan(
  orgDetectors: FraudDetector[],
  platformDetectors: PlatformWideDetector[],
  config: Partial<FraudDetectionConfig> = {},
): Promise<FraudScanRun> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();

  // 1. Create scan run
  const scanRunId = await createScanRun(mergedConfig);

  try {
    // 2. Fetch all orgs
    const orgsSnap = await getDocs(collection(db, "organizations"));
    const orgIds = orgsSnap.docs.map((d) => d.id);

    const allSignals: RiskSignal[] = [];
    const affectedAgentIds = new Set<string>();
    const signalBreakdown: Record<string, number> = {};

    // 3. Run org-scoped detectors
    for (const orgId of orgIds) {
      for (const detector of orgDetectors) {
        try {
          const signals = await detector(orgId, mergedConfig.windowDays, mergedConfig, scanRunId);
          allSignals.push(...signals);
        } catch (error) {
          console.error(`Detector failed for org ${orgId}:`, error);
        }
      }
    }

    // 4. Run platform-wide detectors
    for (const detector of platformDetectors) {
      try {
        const signals = await detector(mergedConfig, scanRunId);
        allSignals.push(...signals);
      } catch (error) {
        console.error("Platform detector failed:", error);
      }
    }

    // 5. Deduplicate and persist
    let signalsGenerated = 0;
    for (const signal of allSignals) {
      const isDuplicate = await isDuplicateSignal(signal);
      if (!isDuplicate) {
        const signalId = await saveRiskSignal(signal);
        signal.id = signalId;
        signalsGenerated++;
        affectedAgentIds.add(signal.agentId);
        signalBreakdown[signal.signalType] = (signalBreakdown[signal.signalType] || 0) + 1;
      }
    }

    // 6. Recompute risk profiles for affected agents
    const agentsScanned = affectedAgentIds.size;
    for (const agentId of affectedAgentIds) {
      const activeSignals = await getActiveSignals(agentId);
      const profile = computeRiskProfile(agentId, activeSignals);
      await saveRiskProfile(profile);
    }

    // 7. Apply auto-penalties
    let autoPenaltiesApplied = 0;
    if (mergedConfig.autoPenaltyEnabled) {
      for (const agentId of affectedAgentIds) {
        const activeSignals = await getActiveSignals(agentId);
        const result = await applyAutoPenalties(agentId, activeSignals, mergedConfig);
        autoPenaltiesApplied += result.penaltiesApplied;
      }
    }

    // 8. Create review cases for suspicious+ agents
    let casesEscalated = 0;
    for (const agentId of affectedAgentIds) {
      const profile = await getRiskProfile(agentId);
      if (!profile) continue;

      const tier = computeRiskTier(profile.riskScore);
      if (tier === "suspicious" || tier === "flagged" || tier === "banned") {
        // Check if there's already a pending case
        const existingCases = await listFraudReviewCases({ agentId, status: "pending", max: 1 });
        if (existingCases.length > 0) continue;

        const activeSignals = await getActiveSignals(agentId);
        const triggerSignalIds = activeSignals.map((s) => s.id!).filter(Boolean);
        const highestSeverity = activeSignals.reduce<SignalSeverity>((max, s) => {
          const order: SignalSeverity[] = ["low", "medium", "high", "critical"];
          return order.indexOf(s.severity) > order.indexOf(max) ? s.severity : max;
        }, "low");

        // Fetch agent name
        const agentDoc = await getDoc(doc(db, "agents", agentId));
        const agentName = agentDoc.exists() ? (agentDoc.data().name || agentId) : agentId;
        const asn = agentDoc.exists() ? (agentDoc.data().asn || "") : "";
        const orgId = agentDoc.exists() ? (agentDoc.data().orgId || "") : "";

        const reviewSeverity: "medium" | "high" | "critical" =
          highestSeverity === "low" ? "medium" : highestSeverity as "medium" | "high" | "critical";

        await saveFraudReviewCase({
          agentId,
          asn,
          orgId,
          agentName,
          riskScore: profile.riskScore,
          riskTier: tier,
          triggerSignalIds,
          triggerReason: `Agent risk score ${profile.riskScore} (${tier}) with ${activeSignals.length} active signals`,
          severity: reviewSeverity,
          status: "pending",
          reviewHistory: [{
            action: "auto_created",
            performedBy: "system",
            notes: `Fraud scan detected ${activeSignals.length} signals`,
            timestamp: new Date().toISOString(),
          }],
        });
        casesEscalated++;
      }
    }

    // 9. Log activity
    try {
      await logActivity({
        orgId: "platform",
        eventType: "fraud.scan_completed" as any,
        actorType: "system",
        description: `Fraud scan completed: ${agentsScanned} agents, ${signalsGenerated} signals, ${autoPenaltiesApplied} penalties, ${casesEscalated} cases`,
        metadata: { scanRunId, signalBreakdown },
      });
    } catch {
      // Non-blocking
    }

    // 10. Update scan run
    const durationMs = Date.now() - startTime;
    const scanResult: Partial<FraudScanRun> = {
      completedAt: serverTimestamp(),
      durationMs,
      status: "completed",
      agentsScanned,
      signalsGenerated,
      signalBreakdown,
      autoPenaltiesApplied,
      casesEscalated,
    };
    await updateScanRun(scanRunId, scanResult);

    console.log(`Fraud scan completed in ${durationMs}ms: ${agentsScanned} agents, ${signalsGenerated} signals, ${autoPenaltiesApplied} penalties`);

    return {
      id: scanRunId,
      ...scanResult,
      startedAt: serverTimestamp(),
      config: mergedConfig,
    } as FraudScanRun;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    await updateScanRun(scanRunId, {
      completedAt: serverTimestamp(),
      durationMs,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
