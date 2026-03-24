/**
 * Credit Audit Log
 *
 * Firestore collection `creditAuditLog` that records every credit/trust
 * score change with before/after values, source, and reason.
 *
 * Separate from the marketplace `marketplaceAuditLog` — this tracks
 * score changes specifically.
 */

import {
    addDoc,
    collection,
    getDocs,
    query,
    where,
    orderBy,
    limit as firestoreLimit,
    serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

const CREDIT_AUDIT_COLLECTION = "creditAuditLog";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface CreditAuditEntry {
    id?: string;
    /** Agent document ID */
    agentId: string;
    /** Agent Social Number */
    asn: string;
    /** How the change originated */
    source: "auto" | "admin" | "system";
    /** Wallet address of the admin who performed the override (admin source only) */
    performedBy?: string;
    /** Credit score before the change */
    creditBefore: number;
    /** Credit score after the change */
    creditAfter: number;
    /** Trust score before the change */
    trustBefore: number;
    /** Trust score after the change */
    trustAfter: number;
    /** Human-readable reason for the change */
    reason: string;
    /** HCS event type if source is "auto" */
    eventType?: string;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
    /** Firestore server timestamp */
    timestamp?: { seconds: number; nanoseconds: number };
}

// ═══════════════════════════════════════════════════════════════
// Write
// ═══════════════════════════════════════════════════════════════

/** Record a credit audit entry. Returns the new document ID. */
export async function recordCreditAudit(
    entry: Omit<CreditAuditEntry, "id" | "timestamp">,
): Promise<string> {
    const ref = await addDoc(collection(db, CREDIT_AUDIT_COLLECTION), {
        ...entry,
        timestamp: serverTimestamp(),
    });
    return ref.id;
}

// ═══════════════════════════════════════════════════════════════
// Read
// ═══════════════════════════════════════════════════════════════

/** Query the credit audit log with optional filters. */
export async function getCreditAuditLog(opts: {
    agentId?: string;
    limit?: number;
    source?: CreditAuditEntry["source"];
}): Promise<CreditAuditEntry[]> {
    const constraints: Parameters<typeof query>[1][] = [];

    if (opts.agentId) {
        constraints.push(where("agentId", "==", opts.agentId));
    }
    if (opts.source) {
        constraints.push(where("source", "==", opts.source));
    }

    constraints.push(orderBy("timestamp", "desc"));
    constraints.push(firestoreLimit(opts.limit || 50));

    const q = query(collection(db, CREDIT_AUDIT_COLLECTION), ...constraints);
    const snap = await getDocs(q);

    return snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
    })) as CreditAuditEntry[];
}
