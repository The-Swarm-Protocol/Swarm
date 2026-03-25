/**
 * Pull-Based Gateway — Firestore persistence.
 *
 * Collections:
 *   gatewayWorkers — registered workers with heartbeat
 *   gatewayTaskQueue — task queue (pull-based)
 */

import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
} from "firebase/firestore";
import type {
  GatewayWorker,
  QueuedTask,
  QueuedTaskStatus,
  WorkerStatus,
  TaskPriority,
} from "./types";

const WORKERS = "gatewayWorkers";
const QUEUE = "gatewayTaskQueue";

// ── Workers ──────────────────────────────────────────────────────────────────

export async function registerWorker(
  data: Omit<GatewayWorker, "id" | "registeredAt" | "updatedAt" | "lastHeartbeat">,
): Promise<string> {
  const ref = await addDoc(collection(db, WORKERS), {
    ...data,
    lastHeartbeat: serverTimestamp(),
    registeredAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getWorker(id: string): Promise<GatewayWorker | null> {
  const snap = await getDoc(doc(db, WORKERS, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as GatewayWorker;
}

export async function updateWorker(
  id: string,
  data: Partial<Pick<GatewayWorker, "status" | "resources" | "capabilities" | "region">>,
): Promise<void> {
  await updateDoc(doc(db, WORKERS, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function heartbeatWorker(
  id: string,
  resources?: Partial<GatewayWorker["resources"]>,
): Promise<void> {
  const update: Record<string, unknown> = {
    lastHeartbeat: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (resources) update.resources = resources;
  await updateDoc(doc(db, WORKERS, id), update);
}

export async function deregisterWorker(id: string): Promise<void> {
  await deleteDoc(doc(db, WORKERS, id));
}

export async function getOrgWorkers(
  orgId: string,
  status?: WorkerStatus,
): Promise<GatewayWorker[]> {
  const constraints = [
    where("orgId", "==", orgId),
    ...(status ? [where("status", "==", status)] : []),
    orderBy("lastHeartbeat", "desc"),
    firestoreLimit(100),
  ];
  const q = query(collection(db, WORKERS), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GatewayWorker);
}

export async function getAvailableWorkers(
  orgId: string,
): Promise<GatewayWorker[]> {
  const q = query(
    collection(db, WORKERS),
    where("orgId", "==", orgId),
    where("status", "in", ["idle", "busy"]),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GatewayWorker);
}

// ── Task Queue ───────────────────────────────────────────────────────────────

export async function enqueueTask(
  data: Omit<QueuedTask, "id" | "createdAt" | "updatedAt" | "retriesUsed" | "status">,
): Promise<string> {
  const ref = await addDoc(collection(db, QUEUE), {
    ...data,
    status: "queued",
    retriesUsed: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getTask(id: string): Promise<QueuedTask | null> {
  const snap = await getDoc(doc(db, QUEUE, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as QueuedTask;
}

export async function updateTask(
  id: string,
  data: Partial<
    Pick<QueuedTask, "status" | "claimedBy" | "claimedAt" | "result" | "error" | "retriesUsed" | "completedAt">
  >,
): Promise<void> {
  await updateDoc(doc(db, QUEUE, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get queued tasks for a specific org, ordered by priority then age.
 * Workers call this to find tasks to claim.
 */
export async function getQueuedTasks(
  orgId: string,
  taskTypes: string[],
  max = 10,
): Promise<QueuedTask[]> {
  // Query for queued tasks matching the worker's supported types
  const q = query(
    collection(db, QUEUE),
    where("orgId", "==", orgId),
    where("status", "==", "queued"),
    where("taskType", "in", taskTypes.slice(0, 10)), // Firestore 'in' max 10
    orderBy("createdAt", "asc"),
    firestoreLimit(max),
  );
  const snap = await getDocs(q);
  const tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as QueuedTask);

  // Sort by priority (highest first) then by creation time (oldest first)
  const priorityOrder: Record<TaskPriority, number> = {
    critical: 0, high: 1, normal: 2, low: 3,
  };
  tasks.sort((a, b) => {
    const pa = priorityOrder[a.priority] ?? 2;
    const pb = priorityOrder[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;
    return 0; // Already ordered by createdAt from Firestore
  });

  return tasks;
}

/**
 * Get tasks claimed by a specific worker (for status reporting).
 */
export async function getWorkerTasks(
  workerId: string,
): Promise<QueuedTask[]> {
  const q = query(
    collection(db, QUEUE),
    where("claimedBy", "==", workerId),
    where("status", "in", ["claimed", "running"]),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as QueuedTask);
}

/**
 * Get org task queue summary.
 */
export async function getQueueStats(orgId: string): Promise<{
  queued: number;
  running: number;
  completed: number;
  failed: number;
}> {
  const statuses: QueuedTaskStatus[] = ["queued", "claimed", "running", "completed", "failed"];
  const counts: Record<string, number> = {};

  for (const status of statuses) {
    const q = query(
      collection(db, QUEUE),
      where("orgId", "==", orgId),
      where("status", "==", status),
    );
    const snap = await getDocs(q);
    counts[status] = snap.size;
  }

  return {
    queued: counts.queued || 0,
    running: (counts.claimed || 0) + (counts.running || 0),
    completed: counts.completed || 0,
    failed: counts.failed || 0,
  };
}
