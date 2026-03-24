/**
 * Credit Operations — Audit Log
 *
 * Thin Firestore helper for recording and querying credit-ops
 * admin actions in the `creditOpsAuditLog` collection.
 * Mirrors pattern from `@/lib/audit-log.ts`.
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
import { db } from "@/lib/firebase";
import type { CreditOpsAuditEntry, CreditOpsAuditTargetType } from "./types";

const CREDIT_OPS_AUDIT_COLLECTION = "creditOpsAuditLog";

/** Record a credit-ops audit entry. Returns the new document ID. */
export async function recordCreditOpsAudit(
  entry: Omit<CreditOpsAuditEntry, "id" | "timestamp">,
): Promise<string> {
  const ref = await addDoc(collection(db, CREDIT_OPS_AUDIT_COLLECTION), {
    ...entry,
    timestamp: serverTimestamp(),
  });
  return ref.id;
}

/** Query the credit-ops audit log with optional filters. */
export async function getCreditOpsAuditLog(opts: {
  limit?: number;
  action?: string;
  targetId?: string;
  targetType?: CreditOpsAuditTargetType;
}): Promise<CreditOpsAuditEntry[]> {
  const constraints: Parameters<typeof query>[1][] = [];

  if (opts.action) {
    constraints.push(where("action", "==", opts.action));
  }
  if (opts.targetId) {
    constraints.push(where("targetId", "==", opts.targetId));
  }
  if (opts.targetType) {
    constraints.push(where("targetType", "==", opts.targetType));
  }

  constraints.push(orderBy("timestamp", "desc"));
  constraints.push(firestoreLimit(opts.limit || 50));

  const q = query(collection(db, CREDIT_OPS_AUDIT_COLLECTION), ...constraints);
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as CreditOpsAuditEntry[];
}

/** Get audit entries for a specific agent (by ASN or agentId in targetId). */
export async function getCreditOpsAuditForAgent(
  agentIdentifier: string,
  max?: number,
): Promise<CreditOpsAuditEntry[]> {
  const q = query(
    collection(db, CREDIT_OPS_AUDIT_COLLECTION),
    where("targetType", "==", "agent"),
    where("targetId", "==", agentIdentifier),
    orderBy("timestamp", "desc"),
    firestoreLimit(max || 50),
  );
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as CreditOpsAuditEntry[];
}
