/**
 * Pull-Based Gateway Runtime — Task scheduling and worker matching.
 *
 * Workers pull tasks by calling `pullTasks(workerId)`.
 * The runtime matches tasks to workers based on:
 *   1. Task type compatibility (worker.capabilities.taskTypes)
 *   2. Resource availability (worker has enough CPU/memory headroom)
 *   3. Tag requirements (worker has all required tags)
 *   4. Priority ordering (critical > high > normal > low)
 *
 * Task lifecycle:
 *   queued → claimed → running → completed/failed/timeout
 *
 * Claims are atomic: only one worker can claim a task.
 * Timeout detection: stale claimed tasks are re-queued.
 */

import { getRedis } from "@/lib/redis";
import {
  getWorker,
  getTask,
  updateTask,
  updateWorker,
  heartbeatWorker,
  getQueuedTasks,
} from "./store";
import type {
  GatewayWorker,
  QueuedTask,
  TaskResourceRequirements,
  WorkerResources,
} from "./types";

// ── Resource matching ────────────────────────────────────────────────────────

/** Check if a worker can handle a task's resource requirements */
function workerMatchesTask(
  worker: GatewayWorker,
  task: QueuedTask,
): boolean {
  const req = task.resources;
  const res = worker.resources;

  // Check concurrent task limit
  if (res.activeTasks >= res.maxConcurrent) return false;

  // Check CPU
  if (req.minCpuCores && req.minCpuCores > res.maxCpuCores) return false;

  // Check memory
  if (req.minMemoryMb && req.minMemoryMb > res.maxMemoryMb) return false;

  // Check runtime
  if (req.runtime && !worker.capabilities.runtimes.includes(req.runtime)) return false;

  // Check required tags
  if (req.requiredTags) {
    const workerTags = new Set(worker.capabilities.tags);
    if (!req.requiredTags.every((t) => workerTags.has(t))) return false;
  }

  // Check task type
  if (!worker.capabilities.taskTypes.includes(task.taskType)) return false;

  return true;
}

// ── Atomic claim ─────────────────────────────────────────────────────────────

/**
 * Atomically claim a task for a worker using Redis SET NX.
 * Returns true if claim succeeded, false if another worker claimed it first.
 */
async function atomicClaim(taskId: string, workerId: string): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    const key = `gateway:claim:${taskId}`;
    try {
      const result = await redis.set(key, workerId, { nx: true, ex: 300 }); // 5 min lock
      return result !== null; // null = already claimed
    } catch {
      // Redis down — fall through to Firestore-only
    }
  }

  // Fallback: check Firestore status (not truly atomic but acceptable)
  const task = await getTask(taskId);
  return task?.status === "queued";
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Worker pulls tasks from the queue.
 *
 * 1. Fetches queued tasks matching worker capabilities
 * 2. Filters by resource requirements
 * 3. Atomically claims the first matching task
 * 4. Updates worker heartbeat + active task count
 *
 * Returns the claimed task or null if no tasks available.
 */
export async function pullTask(workerId: string): Promise<QueuedTask | null> {
  const worker = await getWorker(workerId);
  if (!worker) throw new Error("Worker not found");
  if (worker.status === "offline" || worker.status === "draining") {
    return null; // Worker is not accepting tasks
  }

  // Get queued tasks for this org matching worker's task types
  const candidates = await getQueuedTasks(
    worker.orgId,
    worker.capabilities.taskTypes,
    20,
  );

  // Find first matching task
  for (const task of candidates) {
    if (!workerMatchesTask(worker, task)) continue;

    // Attempt atomic claim
    if (await atomicClaim(task.id, workerId)) {
      // Claim succeeded — update task and worker
      await updateTask(task.id, {
        status: "claimed",
        claimedBy: workerId,
        claimedAt: Date.now(),
      });

      await heartbeatWorker(workerId, {
        activeTasks: worker.resources.activeTasks + 1,
      });

      // Return the claimed task
      return { ...task, status: "claimed", claimedBy: workerId };
    }
    // Claim failed — another worker got it, try next
  }

  return null; // No tasks available
}

/**
 * Worker reports task as started (running).
 */
export async function reportTaskRunning(
  workerId: string,
  taskId: string,
): Promise<void> {
  const task = await getTask(taskId);
  if (!task) throw new Error("Task not found");
  if (task.claimedBy !== workerId) throw new Error("Task not claimed by this worker");

  await updateTask(taskId, { status: "running" });
}

/**
 * Worker reports task completion with result.
 */
export async function reportTaskComplete(
  workerId: string,
  taskId: string,
  result: unknown,
): Promise<void> {
  const task = await getTask(taskId);
  if (!task) throw new Error("Task not found");
  if (task.claimedBy !== workerId) throw new Error("Task not claimed by this worker");

  await updateTask(taskId, {
    status: "completed",
    result,
    completedAt: Date.now(),
  });

  // Decrement worker active tasks
  const worker = await getWorker(workerId);
  if (worker) {
    await heartbeatWorker(workerId, {
      activeTasks: Math.max(0, worker.resources.activeTasks - 1),
    });
  }

  // Release Redis claim lock
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(`gateway:claim:${taskId}`);
    } catch {
      // ignore
    }
  }

  // Fire callback if configured
  if (task.callbackUrl) {
    try {
      await fetch(task.callbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          status: "completed",
          result,
          completedAt: Date.now(),
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Callback failure is non-fatal
    }
  }
}

/**
 * Worker reports task failure.
 */
export async function reportTaskFailed(
  workerId: string,
  taskId: string,
  error: string,
): Promise<void> {
  const task = await getTask(taskId);
  if (!task) throw new Error("Task not found");
  if (task.claimedBy !== workerId) throw new Error("Task not claimed by this worker");

  // Check if we should retry
  if (task.retriesUsed < task.maxRetries) {
    // Re-queue for retry
    await updateTask(taskId, {
      status: "queued" as const,
      claimedBy: undefined,
      error,
      retriesUsed: task.retriesUsed + 1,
    });
  } else {
    // Max retries exhausted
    await updateTask(taskId, {
      status: "failed",
      error,
      completedAt: Date.now(),
    });
  }

  // Decrement worker active tasks
  const worker = await getWorker(workerId);
  if (worker) {
    await heartbeatWorker(workerId, {
      activeTasks: Math.max(0, worker.resources.activeTasks - 1),
    });
  }

  // Release claim lock
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(`gateway:claim:${taskId}`);
    } catch {
      // ignore
    }
  }

  // Fire callback if configured and this was the final failure
  if (task.callbackUrl && task.retriesUsed >= task.maxRetries) {
    try {
      await fetch(task.callbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          status: "failed",
          error,
          completedAt: Date.now(),
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // non-fatal
    }
  }
}

/**
 * Detect timed-out tasks and re-queue them.
 * Should be called periodically (e.g., every 60s by a cron job).
 */
export async function reapTimedOutTasks(orgId: string): Promise<number> {
  // This is a simplified version — in production, use a Firestore query
  // with a composite index on status + claimedAt
  const { getDocs, collection, query, where } = await import("firebase/firestore");
  const { db } = await import("@/lib/firebase");

  const q = query(
    collection(db, "gatewayTaskQueue"),
    where("orgId", "==", orgId),
    where("status", "in", ["claimed", "running"]),
  );
  const snap = await getDocs(q);
  const now = Date.now();
  let reaped = 0;

  for (const d of snap.docs) {
    const task = { id: d.id, ...d.data() } as QueuedTask;
    const claimedAt = typeof task.claimedAt === "number"
      ? task.claimedAt
      : (task.claimedAt as { toMillis?: () => number })?.toMillis?.() || 0;

    if (claimedAt && now - claimedAt > task.timeoutMs) {
      if (task.retriesUsed < task.maxRetries) {
        await updateTask(task.id, {
          status: "queued" as const,
          claimedBy: undefined,
          error: "Execution timed out",
          retriesUsed: task.retriesUsed + 1,
        });
      } else {
        await updateTask(task.id, {
          status: "timeout",
          error: "Execution timed out (max retries exhausted)",
          completedAt: now,
        });
      }
      reaped++;
    }
  }

  return reaped;
}
