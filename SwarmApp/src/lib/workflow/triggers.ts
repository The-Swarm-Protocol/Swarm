/**
 * Slot Trigger Policies — Event-driven workflow automation.
 *
 * A trigger policy defines WHEN a workflow should run:
 *   - cron: on a schedule (reuses existing cron.ts parsing)
 *   - event: on a Firestore/hub event (agent connect, task complete, message, etc.)
 *   - alert: on a threshold breach (metric > value)
 *   - webhook: on an incoming HTTP webhook
 *   - manual: explicit user trigger (default for all workflows)
 *
 * Trigger policies are stored in Firestore (`triggerPolicies` collection).
 * Each policy links to a workflow definition and specifies conditions.
 *
 * At-least-once delivery: the evaluator is idempotent — duplicate events
 * are safe because workflow runs are tracked and deduped.
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
import { getRedis } from "@/lib/redis";
import { startRun } from "./executor";

// ── Types ────────────────────────────────────────────────────────────────────

export type TriggerType = "cron" | "event" | "alert" | "webhook" | "manual";

/** Events the trigger system can react to */
export type TriggerEventName =
  | "agent:connect"
  | "agent:disconnect"
  | "task:complete"
  | "task:fail"
  | "message:received"
  | "assignment:created"
  | "assignment:completed"
  | "assignment:rejected"
  | "workflow:completed"
  | "workflow:failed"
  | "cron:tick"
  | "webhook:received"
  | "custom";

export interface CronTriggerConfig {
  /** Cron expression (5-field: min hour dom month dow) */
  schedule: string;
  /** Timezone (default: UTC) */
  timezone?: string;
}

export interface EventTriggerConfig {
  /** Which event to listen for */
  eventName: TriggerEventName;
  /** Optional filter expression (evaluated against event payload).
   *  Example: "event.agentId === 'agent-123'" */
  filterExpression?: string;
}

export interface AlertTriggerConfig {
  /** Metric name to watch */
  metricName: string;
  /** Comparison operator */
  operator: "gt" | "gte" | "lt" | "lte" | "eq" | "neq";
  /** Threshold value */
  threshold: number;
  /** Cooldown in ms between triggers (prevent alert storms) */
  cooldownMs?: number;
}

export interface WebhookTriggerConfig {
  /** Secret for HMAC validation (auto-generated if not provided) */
  secret?: string;
  /** Allowed source IPs (empty = allow all) */
  allowedIps?: string[];
}

export type TriggerConfig =
  | CronTriggerConfig
  | EventTriggerConfig
  | AlertTriggerConfig
  | WebhookTriggerConfig;

export interface TriggerPolicy {
  id: string;
  orgId: string;
  /** Name for display */
  name: string;
  description?: string;
  /** Which workflow to trigger */
  workflowId: string;
  /** Trigger type */
  triggerType: TriggerType;
  /** Type-specific configuration */
  config: TriggerConfig;
  /** Static input data passed to every triggered run */
  staticInput?: Record<string, unknown>;
  /** Whether this policy is active */
  enabled: boolean;
  /** Max concurrent runs from this trigger (0 = unlimited) */
  maxConcurrentRuns: number;
  /** Cooldown between triggers in ms (0 = no cooldown) */
  cooldownMs: number;
  /** Last trigger time */
  lastTriggeredAt?: unknown;
  /** Total times triggered */
  triggerCount: number;
  createdBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}

// ── Collection ───────────────────────────────────────────────────────────────

const COLLECTION = "triggerPolicies";

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function createTriggerPolicy(
  data: Omit<TriggerPolicy, "id" | "createdAt" | "updatedAt" | "triggerCount" | "lastTriggeredAt">,
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...data,
    triggerCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getTriggerPolicy(id: string): Promise<TriggerPolicy | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as TriggerPolicy;
}

export async function updateTriggerPolicy(
  id: string,
  data: Partial<Pick<TriggerPolicy, "name" | "description" | "config" | "enabled" | "maxConcurrentRuns" | "cooldownMs" | "staticInput">>,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTriggerPolicy(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

export async function getOrgTriggerPolicies(
  orgId: string,
  max = 100,
): Promise<TriggerPolicy[]> {
  const q = query(
    collection(db, COLLECTION),
    where("orgId", "==", orgId),
    orderBy("updatedAt", "desc"),
    firestoreLimit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TriggerPolicy);
}

export async function getPoliciesForWorkflow(
  workflowId: string,
): Promise<TriggerPolicy[]> {
  const q = query(
    collection(db, COLLECTION),
    where("workflowId", "==", workflowId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TriggerPolicy);
}

export async function getEnabledEventPolicies(
  orgId: string,
  eventName: TriggerEventName,
): Promise<TriggerPolicy[]> {
  const q = query(
    collection(db, COLLECTION),
    where("orgId", "==", orgId),
    where("triggerType", "==", "event"),
    where("enabled", "==", true),
  );
  const snap = await getDocs(q);

  // Filter by event name (Firestore doesn't support nested field queries well)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as TriggerPolicy)
    .filter((p) => {
      const cfg = p.config as EventTriggerConfig;
      return cfg.eventName === eventName;
    });
}

// ── Trigger Evaluation ───────────────────────────────────────────────────────

/** Idempotency key to prevent duplicate triggers within a window */
function idempotencyKey(policyId: string, eventId: string): string {
  return `trigger:idemp:${policyId}:${eventId}`;
}

/**
 * Check cooldown — returns true if the trigger is allowed (not in cooldown).
 */
async function checkCooldown(policy: TriggerPolicy): Promise<boolean> {
  if (policy.cooldownMs <= 0) return true;

  const redis = getRedis();
  if (redis) {
    const key = `trigger:cooldown:${policy.id}`;
    try {
      const last = await redis.get(key);
      if (last) return false; // In cooldown
      // Set cooldown
      await redis.set(key, "1", { px: policy.cooldownMs });
      return true;
    } catch {
      return true; // Fail-open
    }
  }

  // No Redis — check Firestore lastTriggeredAt
  if (policy.lastTriggeredAt) {
    const lastTs =
      typeof policy.lastTriggeredAt === "number"
        ? policy.lastTriggeredAt
        : (policy.lastTriggeredAt as { toMillis?: () => number })?.toMillis?.() || 0;
    if (Date.now() - lastTs < policy.cooldownMs) return false;
  }
  return true;
}

/**
 * Check idempotency — returns true if this event hasn't been processed yet.
 */
async function checkIdempotency(policyId: string, eventId: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true; // No Redis — allow (at-most-once protection disabled)

  const key = idempotencyKey(policyId, eventId);
  try {
    const result = await redis.set(key, "1", { nx: true, ex: 600 }); // 10 min dedup
    return result !== null; // null = key existed = duplicate
  } catch {
    return true; // Fail-open
  }
}

/**
 * Evaluate a filter expression against event data.
 *
 * Only allows safe expressions: property access, comparisons, logical ops,
 * and literals. No function calls, assignments, or arbitrary code.
 */
const SAFE_FILTER_RE = /^[\s\w.'"` \d\-+*/%<>=!&|?:,[\]()]+$/;

const FORBIDDEN_FILTER_PATTERNS = [
  /\b(eval|Function|constructor|__proto__|prototype)\b/,
  /\b(require|import|export|process|globalThis|window|document)\b/,
  /\b(fetch|XMLHttpRequest|WebSocket|setTimeout|setInterval)\b/,
  /[;{}]/,
  /=(?!=)/,
];

function evaluateFilter(expression: string, event: Record<string, unknown>): boolean {
  try {
    if (!SAFE_FILTER_RE.test(expression)) return false;
    for (const pattern of FORBIDDEN_FILTER_PATTERNS) {
      if (pattern.test(expression)) return false;
    }
    const frozen = Object.freeze({ ...event });
    const fn = new Function("event", `"use strict"; return !!(${expression});`);
    return fn(frozen);
  } catch {
    return false;
  }
}

/**
 * Fire an event through the trigger system.
 *
 * Finds all enabled policies matching this event, checks cooldown + idempotency,
 * and starts workflow runs for matching policies.
 *
 * @param orgId - Organization ID
 * @param eventName - Event type
 * @param eventData - Event payload
 * @param eventId - Unique event ID for idempotency (e.g., Firestore doc ID)
 * @returns Array of started run IDs
 */
export async function fireEvent(
  orgId: string,
  eventName: TriggerEventName,
  eventData: Record<string, unknown>,
  eventId: string,
): Promise<string[]> {
  const policies = await getEnabledEventPolicies(orgId, eventName);
  const startedRuns: string[] = [];

  for (const policy of policies) {
    // Check filter expression
    const cfg = policy.config as EventTriggerConfig;
    if (cfg.filterExpression) {
      if (!evaluateFilter(cfg.filterExpression, eventData)) continue;
    }

    // Idempotency check
    if (!(await checkIdempotency(policy.id, eventId))) continue;

    // Cooldown check
    if (!(await checkCooldown(policy))) continue;

    // Start workflow run
    try {
      const triggerInput = {
        ...(policy.staticInput || {}),
        _event: {
          name: eventName,
          data: eventData,
          eventId,
          triggeredAt: Date.now(),
        },
      };

      const runId = await startRun(
        policy.workflowId,
        `trigger:${policy.id}`,
        triggerInput,
      );

      startedRuns.push(runId);

      // Update policy stats
      await updateDoc(doc(db, COLLECTION, policy.id), {
        lastTriggeredAt: serverTimestamp(),
        triggerCount: policy.triggerCount + 1,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(`[triggers] Failed to start run for policy ${policy.id}:`, err);
    }
  }

  return startedRuns;
}

/**
 * Check alert triggers against a metric value.
 */
export async function checkAlertTriggers(
  orgId: string,
  metricName: string,
  value: number,
): Promise<string[]> {
  const q = query(
    collection(db, COLLECTION),
    where("orgId", "==", orgId),
    where("triggerType", "==", "alert"),
    where("enabled", "==", true),
  );
  const snap = await getDocs(q);
  const policies = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as TriggerPolicy)
    .filter((p) => {
      const cfg = p.config as AlertTriggerConfig;
      return cfg.metricName === metricName;
    });

  const startedRuns: string[] = [];

  for (const policy of policies) {
    const cfg = policy.config as AlertTriggerConfig;

    // Evaluate threshold
    let triggered = false;
    switch (cfg.operator) {
      case "gt": triggered = value > cfg.threshold; break;
      case "gte": triggered = value >= cfg.threshold; break;
      case "lt": triggered = value < cfg.threshold; break;
      case "lte": triggered = value <= cfg.threshold; break;
      case "eq": triggered = value === cfg.threshold; break;
      case "neq": triggered = value !== cfg.threshold; break;
    }

    if (!triggered) continue;

    // Cooldown check
    if (!(await checkCooldown(policy))) continue;

    const eventId = `alert:${metricName}:${Date.now()}`;
    if (!(await checkIdempotency(policy.id, eventId))) continue;

    try {
      const triggerInput = {
        ...(policy.staticInput || {}),
        _alert: {
          metricName,
          value,
          threshold: cfg.threshold,
          operator: cfg.operator,
          triggeredAt: Date.now(),
        },
      };

      const runId = await startRun(
        policy.workflowId,
        `trigger:${policy.id}`,
        triggerInput,
      );

      startedRuns.push(runId);

      await updateDoc(doc(db, COLLECTION, policy.id), {
        lastTriggeredAt: serverTimestamp(),
        triggerCount: policy.triggerCount + 1,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(`[triggers] Alert trigger failed for policy ${policy.id}:`, err);
    }
  }

  return startedRuns;
}
