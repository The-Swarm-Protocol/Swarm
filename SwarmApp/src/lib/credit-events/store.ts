/**
 * Credit Event Store
 *
 * Firestore CRUD for the canonical `creditEvents` collection.
 * Deduplication, flexible querying, and replay support.
 */

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
  Timestamp,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  CreditEvent,
  CreditEventInput,
  CreditEventQuery,
} from "./types";
import { computeIdempotencyKey } from "./validation";

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

const CREDIT_EVENTS_COLLECTION = "creditEvents";

// ═══════════════════════════════════════════════════════════════
// Deduplication
// ═══════════════════════════════════════════════════════════════

/**
 * Check if an event with the same idempotency key already exists.
 * Pattern from hedera-slashing.ts checkIfAlreadySlashed().
 */
export async function isDuplicate(idempotencyKey: string): Promise<boolean> {
  const ref = collection(db, CREDIT_EVENTS_COLLECTION);
  const q = query(ref, where("idempotencyKey", "==", idempotencyKey));
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

// ═══════════════════════════════════════════════════════════════
// Store
// ═══════════════════════════════════════════════════════════════

/**
 * Store a validated credit event in Firestore.
 * Returns the Firestore document ID.
 */
export async function storeCreditEvent(event: CreditEventInput): Promise<string> {
  const idempotencyKey = computeIdempotencyKey(
    event.source.system,
    event.source.sourceEventId,
  );

  const ref = await addDoc(collection(db, CREDIT_EVENTS_COLLECTION), {
    ...event,
    idempotencyKey,
    createdAt: serverTimestamp(),
  });

  return ref.id;
}

// ═══════════════════════════════════════════════════════════════
// Query
// ═══════════════════════════════════════════════════════════════

/**
 * Query credit events with flexible filtering.
 * Follows the constraint accumulation pattern from activity.ts.
 */
export async function queryCreditEvents(
  params: CreditEventQuery,
): Promise<CreditEvent[]> {
  const constraints: QueryConstraint[] = [];

  if (params.agentId) {
    constraints.push(where("agentId", "==", params.agentId));
  }
  if (params.asn) {
    constraints.push(where("asn", "==", params.asn));
  }
  if (params.orgId) {
    constraints.push(where("orgId", "==", params.orgId));
  }
  if (params.eventType) {
    constraints.push(where("eventType", "==", params.eventType));
  }
  if (params.provenance) {
    constraints.push(where("provenance", "==", params.provenance));
  }
  if (params.fromTimestamp) {
    constraints.push(where("timestamp", ">=", params.fromTimestamp));
  }
  if (params.toTimestamp) {
    constraints.push(where("timestamp", "<=", params.toTimestamp));
  }

  const direction = params.orderDirection || "desc";
  constraints.push(orderBy("timestamp", direction));
  constraints.push(firestoreLimit(params.limit || 100));

  const q = query(collection(db, CREDIT_EVENTS_COLLECTION), ...constraints);
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      createdAt: data.createdAt instanceof Timestamp
        ? data.createdAt.toDate()
        : data.createdAt,
    } as CreditEvent;
  });
}

/**
 * Get events for replay within a time range.
 * Returns events in ascending order for sequential replay.
 */
export async function getEventsForReplay(
  fromTimestamp: number,
  toTimestamp: number,
  agentId?: string,
  eventType?: string,
): Promise<CreditEvent[]> {
  return queryCreditEvents({
    fromTimestamp,
    toTimestamp,
    agentId,
    eventType: eventType as CreditEvent["eventType"],
    orderDirection: "asc",
    limit: 10000,
  });
}
