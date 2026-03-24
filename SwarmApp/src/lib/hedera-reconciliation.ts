/**
 * Hedera Trust Layer — Reconciliation Service
 *
 * Periodically compares scores across three tiers:
 * Firestore <-> HCS in-memory cache <-> On-chain NFT
 *
 * Flags discrepancies, auto-heals Firestore (HCS is source of truth),
 * and generates reconciliation reports.
 */

import { getAllScoreStates } from "./hedera-mirror-subscriber";
import { getAgentNFTIdentity } from "./hedera-nft-client";
import { db } from "@/lib/firebase";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
} from "firebase/firestore";
import type { ReconciliationReport, TrustLayerConfig } from "./hedera-trust-types";

// ═══════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════

const RECONCILIATION_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

/** Tolerance thresholds for score drift */
const DRIFT_THRESHOLDS = {
    credit: 10,
    trust: 3,
};

// ═══════════════════════════════════════════════════════════════
// Reconciliation Logic
// ═══════════════════════════════════════════════════════════════

/**
 * Run a full reconciliation pass across all agents.
 * Compares: Firestore <-> HCS cache <-> On-chain NFT
 */
export async function runReconciliation(): Promise<ReconciliationReport> {
    const reportId = crypto.randomUUID();
    const timestamp = Math.floor(Date.now() / 1000);

    // Get current epoch
    let epoch = 0;
    try {
        const configSnap = await getDoc(doc(db, "trustLayerConfig", "singleton"));
        if (configSnap.exists()) {
            epoch = (configSnap.data() as TrustLayerConfig).currentEpoch;
        }
    } catch {
        // ignore
    }

    const allHcsStates = getAllScoreStates();
    const discrepancies: ReconciliationReport["discrepancies"] = [];
    let consistentAgents = 0;
    let autoHealedCount = 0;

    for (const hcsState of allHcsStates) {
        let hasDiscrepancy = false;

        // Compare with Firestore
        try {
            const agentsRef = collection(db, "agents");
            const q = query(agentsRef, where("asn", "==", hcsState.asn));
            const snap = await getDocs(q);

            if (!snap.empty) {
                const data = snap.docs[0].data();
                const fsCredit = data.creditScore as number | undefined;
                const fsTrust = data.trustScore as number | undefined;

                if (fsCredit !== undefined && fsTrust !== undefined) {
                    const creditDrift = Math.abs(fsCredit - hcsState.creditScore);
                    const trustDrift = Math.abs(fsTrust - hcsState.trustScore);

                    if (creditDrift > DRIFT_THRESHOLDS.credit || trustDrift > DRIFT_THRESHOLDS.trust) {
                        hasDiscrepancy = true;
                        discrepancies.push({
                            asn: hcsState.asn,
                            source: "firestore_vs_hcs",
                            expected: { credit: hcsState.creditScore, trust: hcsState.trustScore },
                            actual: { credit: fsCredit, trust: fsTrust },
                            drift: { credit: creditDrift, trust: trustDrift },
                        });

                        // Auto-heal: HCS is source of truth
                        const healed = await autoHealAgent(
                            snap.docs[0].id,
                            hcsState.creditScore,
                            hcsState.trustScore,
                        );
                        if (healed) autoHealedCount++;
                    }
                }
            }
        } catch (error) {
            console.warn(`Reconciliation: Firestore check failed for ${hcsState.asn}:`, error);
        }

        // Compare with on-chain NFT
        try {
            const nftIdentity = await getAgentNFTIdentity(hcsState.agentAddress);
            if (nftIdentity.hasNFT && nftIdentity.creditScore !== undefined) {
                const creditDrift = Math.abs(nftIdentity.creditScore - hcsState.creditScore);
                const trustDrift = Math.abs(nftIdentity.trustScore! - hcsState.trustScore);

                if (creditDrift > DRIFT_THRESHOLDS.credit || trustDrift > DRIFT_THRESHOLDS.trust) {
                    hasDiscrepancy = true;
                    discrepancies.push({
                        asn: hcsState.asn,
                        source: "hcs_vs_onchain",
                        expected: { credit: hcsState.creditScore, trust: hcsState.trustScore },
                        actual: { credit: nftIdentity.creditScore, trust: nftIdentity.trustScore! },
                        drift: { credit: creditDrift, trust: trustDrift },
                    });
                }
            }
        } catch (error) {
            console.warn(`Reconciliation: On-chain check failed for ${hcsState.asn}:`, error);
        }

        if (!hasDiscrepancy) {
            consistentAgents++;
        }
    }

    const report: ReconciliationReport = {
        reportId,
        timestamp,
        epoch,
        totalAgents: allHcsStates.length,
        consistentAgents,
        inconsistentAgents: allHcsStates.length - consistentAgents,
        discrepancies,
        autoHealedCount,
    };

    // Store report in Firestore
    try {
        await setDoc(doc(db, "reconciliationReports", reportId), {
            ...report,
            createdAt: serverTimestamp(),
        });
    } catch (error) {
        console.error("Failed to store reconciliation report:", error);
    }

    console.log(
        `🔄 Reconciliation complete: ${consistentAgents}/${allHcsStates.length} consistent, ` +
        `${discrepancies.length} discrepancies, ${autoHealedCount} auto-healed`,
    );

    return report;
}

/**
 * Auto-heal a specific agent's Firestore score.
 * HCS-computed score is the source of truth.
 */
async function autoHealAgent(
    agentDocId: string,
    hcsCredit: number,
    hcsTrust: number,
): Promise<boolean> {
    try {
        await updateDoc(doc(db, "agents", agentDocId), {
            creditScore: hcsCredit,
            trustScore: hcsTrust,
            lastScoreUpdate: serverTimestamp(),
            reconciledAt: serverTimestamp(),
        });
        console.log(`🔧 Auto-healed agent ${agentDocId}: credit=${hcsCredit}, trust=${hcsTrust}`);
        return true;
    } catch (error) {
        console.error(`Failed to auto-heal agent ${agentDocId}:`, error);
        return false;
    }
}

/**
 * Get reconciliation history.
 */
export async function getReconciliationHistory(
    maxResults: number = 10,
): Promise<ReconciliationReport[]> {
    try {
        const q = query(
            collection(db, "reconciliationReports"),
            orderBy("timestamp", "desc"),
            limit(maxResults),
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => d.data() as ReconciliationReport);
    } catch (error) {
        console.warn("Failed to fetch reconciliation history:", error);
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════
// Background Service
// ═══════════════════════════════════════════════════════════════

let reconciliationInterval: NodeJS.Timeout | null = null;

/** Check if the reconciliation service is currently running. */
export function isReconciliationRunning(): boolean {
    return reconciliationInterval !== null;
}

/**
 * Start the periodic reconciliation service.
 * Runs every 6 hours (configurable).
 */
export function startReconciliationService(): void {
    if (reconciliationInterval) {
        console.warn("Reconciliation service already running");
        return;
    }

    console.log(`🔄 Starting reconciliation service (interval: ${RECONCILIATION_INTERVAL_MS / 1000}s)`);

    // Run immediately on start
    runReconciliation().catch((error) => {
        console.error("Initial reconciliation failed:", error);
    });

    // Then run periodically
    reconciliationInterval = setInterval(async () => {
        try {
            await runReconciliation();
        } catch (error) {
            console.error("Reconciliation service error:", error);
        }
    }, RECONCILIATION_INTERVAL_MS);
}

/**
 * Stop the reconciliation service.
 */
export function stopReconciliationService(): void {
    if (reconciliationInterval) {
        clearInterval(reconciliationInterval);
        reconciliationInterval = null;
        console.log("🛑 Stopped reconciliation service");
    }
}
