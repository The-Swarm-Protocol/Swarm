/** Delivery Animations — Cross-department delivery arcs and walk paths
 *
 * Adapted from Claw-Empire's officeTickerRoomAndDelivery.ts.
 * Provides two delivery animation modes:
 *   - "throw": Arc trajectory with scale pulse (for fast cross-dept transfers)
 *   - "walk": Linear eased interpolation with bounce (for agent-carried items)
 *
 * Also includes meeting seat hold logic for deliveries that arrive
 * and hold at a meeting position until dismissed.
 */

import type { Position } from "../types";

/* ═══════════════════════════════════════
   Constants
   ═══════════════════════════════════════ */

/** Default travel speed (progress per tick, 0–1) */
export const DELIVERY_SPEED = 0.012;

/** Default arc height for thrown deliveries (negative = upward arc) */
export const DEFAULT_ARC_HEIGHT = -30;

/** Walk bounce amplitude (pixels) */
export const WALK_BOUNCE_AMPLITUDE = 3;

/** Walk bounce frequency (oscillations per full traversal) */
export const WALK_BOUNCE_FREQ = 12;

/* ═══════════════════════════════════════
   Types
   ═══════════════════════════════════════ */

export type DeliveryMode = "throw" | "walk";

export interface DeliveryState {
  id: string;
  /** Source agent or department ID */
  sourceId: string;
  /** Target agent or department ID */
  targetId: string;
  /** Animation type */
  mode: DeliveryMode;
  /** Start position (canvas coords) */
  from: Position;
  /** End position (canvas coords) */
  to: Position;
  /** Progress 0.0 → 1.0 */
  progress: number;
  /** Travel speed (progress per tick) */
  speed: number;
  /** Arc height for throw mode (negative = upward) */
  arcHeight: number;
  /** Current interpolated position */
  current: Position;
  /** Current visual scale (1.0 = normal) */
  scale: number;
  /** Current opacity 0–1 */
  alpha: number;
  /** Payload type for visual styling */
  payloadType: "message" | "task" | "data" | "artifact";
  /** Payload color override */
  color: string;

  /* ── Meeting seat hold ── */
  /** If true, delivery holds at target position after arriving */
  holdAtSeat: boolean;
  /** Whether delivery has arrived at target */
  arrived: boolean;
  /** Timestamp when hold expires */
  holdUntil: number | null;
  /** Whether seated pose has been applied */
  seatedPoseApplied: boolean;
  /** Meeting seat index (for positioning) */
  meetingSeatIndex: number | null;

  /** Timestamp of creation */
  createdAt: number;
}

/* ═══════════════════════════════════════
   Easing
   ═══════════════════════════════════════ */

/** Quadratic ease-in-out */
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/* ═══════════════════════════════════════
   Factory
   ═══════════════════════════════════════ */

let _deliveryIdSeq = 0;

export function createDelivery(opts: {
  sourceId: string;
  targetId: string;
  from: Position;
  to: Position;
  mode?: DeliveryMode;
  speed?: number;
  arcHeight?: number;
  payloadType?: DeliveryState["payloadType"];
  color?: string;
  holdAtSeat?: boolean;
  holdDurationMs?: number;
  meetingSeatIndex?: number | null;
}): DeliveryState {
  const now = Date.now();
  return {
    id: `delivery-${++_deliveryIdSeq}-${now}`,
    sourceId: opts.sourceId,
    targetId: opts.targetId,
    mode: opts.mode ?? "throw",
    from: opts.from,
    to: opts.to,
    progress: 0,
    speed: opts.speed ?? DELIVERY_SPEED,
    arcHeight: opts.arcHeight ?? DEFAULT_ARC_HEIGHT,
    current: { ...opts.from },
    scale: 1,
    alpha: 1,
    payloadType: opts.payloadType ?? "message",
    color: opts.color ?? "#55aaff",
    holdAtSeat: opts.holdAtSeat ?? false,
    arrived: false,
    holdUntil: opts.holdAtSeat && opts.holdDurationMs
      ? now + (opts.holdDurationMs ?? 5000)
      : null,
    seatedPoseApplied: false,
    meetingSeatIndex: opts.meetingSeatIndex ?? null,
    createdAt: now,
  };
}

/* ═══════════════════════════════════════
   Tick Logic
   ═══════════════════════════════════════ */

export interface TickResult {
  /** Updated delivery state */
  delivery: DeliveryState;
  /** Whether this delivery is complete and should be removed */
  done: boolean;
}

/**
 * Advance a single delivery by one tick. Returns updated state + done flag.
 */
export function tickDelivery(d: DeliveryState): TickResult {
  const now = Date.now();

  // ── Hold at seat (already arrived) ──
  if (d.holdAtSeat && d.arrived) {
    const updated: DeliveryState = {
      ...d,
      current: { ...d.to },
      alpha: 1,
      seatedPoseApplied: true,
    };
    const expired = d.holdUntil != null && now >= d.holdUntil;
    return { delivery: updated, done: expired };
  }

  // ── Advance progress ──
  const nextProgress = Math.min(1, d.progress + d.speed);

  if (nextProgress >= 1) {
    // Arrived
    if (d.holdAtSeat) {
      return {
        delivery: {
          ...d,
          progress: 1,
          current: { ...d.to },
          alpha: 1,
          arrived: true,
          holdUntil: d.holdUntil ?? now + 5000,
        },
        done: false,
      };
    }
    return { delivery: { ...d, progress: 1 }, done: true };
  }

  const t = nextProgress;
  const ease = easeInOut(t);
  let x: number;
  let y: number;
  let scale = 1;
  let alpha = 1;

  if (d.mode === "walk") {
    // ── Walk mode: linear ease + bounce ──
    x = d.from.x + (d.to.x - d.from.x) * ease;
    y = d.from.y + (d.to.y - d.from.y) * ease;
    const walkBounce = Math.abs(Math.sin(t * Math.PI * WALK_BOUNCE_FREQ)) * WALK_BOUNCE_AMPLITUDE;
    y -= walkBounce;
    // Fade in/out at endpoints
    if (t < 0.05) alpha = t / 0.05;
    else if (t > 0.9) alpha = (1 - t) / 0.1;
  } else {
    // ── Throw mode: arc trajectory ──
    x = d.from.x + (d.to.x - d.from.x) * ease;
    y = d.from.y + (d.to.y - d.from.y) * ease + Math.sin(t * Math.PI) * d.arcHeight;
    scale = 0.8 + Math.sin(t * Math.PI) * 0.3;
    alpha = t > 0.85 ? (1 - t) / 0.15 : 1;
  }

  return {
    delivery: {
      ...d,
      progress: nextProgress,
      current: { x, y },
      scale,
      alpha,
    },
    done: false,
  };
}

/**
 * Tick all deliveries. Returns updated array with completed deliveries removed.
 */
export function tickAllDeliveries(deliveries: DeliveryState[]): DeliveryState[] {
  const updated: DeliveryState[] = [];
  for (const d of deliveries) {
    const result = tickDelivery(d);
    if (!result.done) {
      updated.push(result.delivery);
    }
  }
  return updated;
}

/* ═══════════════════════════════════════
   SVG Rendering Helpers
   ═══════════════════════════════════════ */

/** Payload type → fill color mapping */
export const PAYLOAD_COLORS: Record<DeliveryState["payloadType"], string> = {
  message: "#55aaff",
  task: "#55ff88",
  data: "#ffaa33",
  artifact: "#aa77ff",
};

/** Returns SVG path data for an arc trajectory preview line */
export function arcPreviewPath(from: Position, to: Position, arcHeight: number, segments = 20): string {
  const points: string[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const ease = easeInOut(t);
    const x = from.x + (to.x - from.x) * ease;
    const y = from.y + (to.y - from.y) * ease + Math.sin(t * Math.PI) * arcHeight;
    points.push(`${i === 0 ? "M" : "L"} ${x} ${y}`);
  }
  return points.join(" ");
}
