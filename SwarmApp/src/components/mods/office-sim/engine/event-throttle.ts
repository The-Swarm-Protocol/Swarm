/** Event Throttle — RAF-batched event coalescing for office updates
 *
 * Adapted from WW-AI-Lab/openclaw-office event-throttle module.
 * Batches high-frequency agent position/status updates into
 * requestAnimationFrame ticks to prevent React over-rendering.
 *
 * Priority system:
 *   - "critical" — errors, lifecycle events → flush immediately
 *   - "high"     — status changes, task completions → next RAF frame
 *   - "normal"   — position updates, speech bubbles → batched into RAF
 *   - "low"      — utilization recalcs, metric updates → debounced 200ms
 */

/* ═══════════════════════════════════════
   Types
   ═══════════════════════════════════════ */

export type EventPriority = "critical" | "high" | "normal" | "low";

export interface ThrottledEvent<T = unknown> {
  /** Event type key for coalescing (latest wins per key) */
  key: string;
  priority: EventPriority;
  payload: T;
  timestamp: number;
}

export type EventHandler<T = unknown> = (events: ThrottledEvent<T>[]) => void;

/* ═══════════════════════════════════════
   Throttle Configuration
   ═══════════════════════════════════════ */

export interface ThrottleConfig {
  /** Low-priority debounce interval in ms. Default 200 */
  lowPriorityDebounceMs?: number;
  /** Max events to hold before force-flushing. Default 100 */
  maxBufferSize?: number;
  /** Whether to use RAF (false = setTimeout fallback for SSR). Default true */
  useRaf?: boolean;
}

const DEFAULT_CONFIG: Required<ThrottleConfig> = {
  lowPriorityDebounceMs: 200,
  maxBufferSize: 100,
  useRaf: true,
};

/* ═══════════════════════════════════════
   EventThrottle Class
   ═══════════════════════════════════════ */

export class EventThrottle<T = unknown> {
  private config: Required<ThrottleConfig>;
  private handler: EventHandler<T>;
  private buffer = new Map<string, ThrottledEvent<T>>();
  private rafId: number | null = null;
  private lowTimerId: ReturnType<typeof setTimeout> | null = null;
  private lowBuffer = new Map<string, ThrottledEvent<T>>();
  private disposed = false;

  constructor(handler: EventHandler<T>, config?: ThrottleConfig) {
    this.handler = handler;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Push an event into the throttle.
   * - Critical events flush the entire buffer immediately.
   * - High/normal events schedule a RAF flush.
   * - Low events go into a debounced buffer.
   */
  push(key: string, payload: T, priority: EventPriority = "normal"): void {
    if (this.disposed) return;

    const event: ThrottledEvent<T> = {
      key,
      priority,
      payload,
      timestamp: Date.now(),
    };

    if (priority === "critical") {
      // Flush everything immediately, including this event
      this.buffer.set(key, event);
      this.flushNow();
      return;
    }

    if (priority === "low") {
      this.lowBuffer.set(key, event);
      this.scheduleLowFlush();
      return;
    }

    // High + normal → RAF batched
    this.buffer.set(key, event);

    // Force flush if buffer grows too large
    if (this.buffer.size >= this.config.maxBufferSize) {
      this.flushNow();
      return;
    }

    this.scheduleRafFlush();
  }

  /**
   * Push multiple events at once.
   */
  pushBatch(events: Array<{ key: string; payload: T; priority?: EventPriority }>): void {
    for (const e of events) {
      this.push(e.key, e.payload, e.priority ?? "normal");
    }
  }

  /**
   * Immediately flush all buffered events.
   */
  flushNow(): void {
    // Merge low-priority into main buffer
    for (const [k, v] of this.lowBuffer) {
      if (!this.buffer.has(k)) {
        this.buffer.set(k, v);
      }
    }
    this.lowBuffer.clear();

    if (this.buffer.size === 0) return;

    const events = Array.from(this.buffer.values());
    this.buffer.clear();

    // Cancel pending schedules
    this.cancelRaf();
    this.cancelLowTimer();

    // Sort: critical first, then high, normal, low
    events.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));

    this.handler(events);
  }

  /**
   * Get the current buffer size (for diagnostics).
   */
  get pendingCount(): number {
    return this.buffer.size + this.lowBuffer.size;
  }

  /**
   * Dispose the throttle, canceling all pending flushes.
   */
  dispose(): void {
    this.disposed = true;
    this.cancelRaf();
    this.cancelLowTimer();
    this.buffer.clear();
    this.lowBuffer.clear();
  }

  /* ── Private ── */

  private scheduleRafFlush(): void {
    if (this.rafId !== null) return;

    if (this.config.useRaf && typeof requestAnimationFrame === "function") {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        this.flushRaf();
      });
    } else {
      // SSR / Node fallback
      this.rafId = setTimeout(() => {
        this.rafId = null;
        this.flushRaf();
      }, 16) as unknown as number;
    }
  }

  private flushRaf(): void {
    if (this.buffer.size === 0) return;
    const events = Array.from(this.buffer.values());
    this.buffer.clear();
    events.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
    this.handler(events);
  }

  private scheduleLowFlush(): void {
    if (this.lowTimerId !== null) return;
    this.lowTimerId = setTimeout(() => {
      this.lowTimerId = null;
      this.flushLow();
    }, this.config.lowPriorityDebounceMs);
  }

  private flushLow(): void {
    if (this.lowBuffer.size === 0) return;
    const events = Array.from(this.lowBuffer.values());
    this.lowBuffer.clear();
    this.handler(events);
  }

  private cancelRaf(): void {
    if (this.rafId !== null) {
      if (this.config.useRaf && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(this.rafId);
      } else {
        clearTimeout(this.rafId);
      }
      this.rafId = null;
    }
  }

  private cancelLowTimer(): void {
    if (this.lowTimerId !== null) {
      clearTimeout(this.lowTimerId);
      this.lowTimerId = null;
    }
  }
}

/* ═══════════════════════════════════════
   Helpers
   ═══════════════════════════════════════ */

function priorityRank(p: EventPriority): number {
  switch (p) {
    case "critical": return 0;
    case "high": return 1;
    case "normal": return 2;
    case "low": return 3;
  }
}

/* ═══════════════════════════════════════
   Convenience: Agent Update Throttle
   ═══════════════════════════════════════ */

export interface AgentUpdatePayload {
  agentId: string;
  patch: Record<string, unknown>;
}

/**
 * Create a pre-configured throttle for agent position/status updates.
 * Automatically assigns priority based on the patch content.
 */
export function createAgentThrottle(
  onFlush: (updates: AgentUpdatePayload[]) => void,
  config?: ThrottleConfig,
): EventThrottle<AgentUpdatePayload> {
  return new EventThrottle<AgentUpdatePayload>(
    (events) => onFlush(events.map((e) => e.payload)),
    config,
  );
}

/**
 * Determine event priority from an agent update patch.
 */
export function inferAgentUpdatePriority(
  patch: Record<string, unknown>,
): EventPriority {
  // Errors and lifecycle = critical
  if (patch.status === "error" || patch.status === "offline" || patch.status === "spawning") {
    return "critical";
  }
  // Status changes = high
  if ("status" in patch || "zone" in patch) {
    return "high";
  }
  // Position updates = normal
  if ("position" in patch || "targetPosition" in patch) {
    return "normal";
  }
  // Metrics, utilization = low
  if ("utilization" in patch || "toolCallCount" in patch) {
    return "low";
  }
  return "normal";
}
