/** Flying Mail — Arc trajectory animations for task delegation
 *
 * Adapted from wickedapp/openclaw-office IsometricOffice.js
 * (FlyingEmail / ReturnEmail components).
 *
 * Provides arc-based projectile animations between agents for:
 *   - Task delegation (CEO → agent)
 *   - Status reports (agent → CEO)
 *   - Inter-agent messaging
 *
 * Designed for 2D SVG rendering. The arc uses a quadratic bezier
 * with configurable apex height and flight duration.
 */

import type { Position } from "../types";

/* ═══════════════════════════════════════
   Types
   ═══════════════════════════════════════ */

export type MailType = "task" | "report" | "message" | "error" | "approval";

export type MailDirection = "outbound" | "return";

export interface FlyingMail {
  id: string;
  /** Source agent/CEO position */
  from: Position;
  /** Target agent/CEO position */
  to: Position;
  /** Animation progress 0→1 */
  progress: number;
  /** Flight type for visual styling */
  type: MailType;
  /** Outbound (CEO→agent) or return (agent→CEO) */
  direction: MailDirection;
  /** Duration in ticks */
  duration: number;
  /** Ticks elapsed */
  elapsed: number;
  /** Current interpolated position */
  current: Position;
  /** Trail positions for particle effect */
  trail: Position[];
  /** Whether the impact flash should show */
  impacted: boolean;
  /** Impact flash remaining ticks */
  impactFlash: number;
  /** Source agent name (for label) */
  sourceName?: string;
  /** Target agent name (for label) */
  targetName?: string;
}

/* ═══════════════════════════════════════
   Constants
   ═══════════════════════════════════════ */

/** Default flight duration in ticks (60fps → ~1.5s) */
const DEFAULT_DURATION = 90;

/** Arc apex height as fraction of distance */
const ARC_HEIGHT_RATIO = 0.35;

/** Maximum trail length */
const MAX_TRAIL_LENGTH = 12;

/** Impact flash duration in ticks */
const IMPACT_FLASH_TICKS = 15;

/** Visual styling per mail type */
export const MAIL_STYLES: Record<MailType, {
  color: string;
  glowColor: string;
  icon: string;
  trailColor: string;
}> = {
  task: {
    color: "#3b82f6",
    glowColor: "rgba(59, 130, 246, 0.5)",
    icon: "📋",
    trailColor: "rgba(59, 130, 246, 0.3)",
  },
  report: {
    color: "#22c55e",
    glowColor: "rgba(34, 197, 94, 0.5)",
    icon: "📊",
    trailColor: "rgba(34, 197, 94, 0.3)",
  },
  message: {
    color: "#8b5cf6",
    glowColor: "rgba(139, 92, 246, 0.5)",
    icon: "✉️",
    trailColor: "rgba(139, 92, 246, 0.3)",
  },
  error: {
    color: "#ef4444",
    glowColor: "rgba(239, 68, 68, 0.5)",
    icon: "⚠️",
    trailColor: "rgba(239, 68, 68, 0.3)",
  },
  approval: {
    color: "#eab308",
    glowColor: "rgba(234, 179, 8, 0.5)",
    icon: "✅",
    trailColor: "rgba(234, 179, 8, 0.3)",
  },
};

/* ═══════════════════════════════════════
   Factory
   ═══════════════════════════════════════ */

let _mailId = 0;

/**
 * Create a new flying mail projectile.
 */
export function createFlyingMail(opts: {
  from: Position;
  to: Position;
  type: MailType;
  direction?: MailDirection;
  duration?: number;
  sourceName?: string;
  targetName?: string;
}): FlyingMail {
  return {
    id: `mail-${++_mailId}`,
    from: { ...opts.from },
    to: { ...opts.to },
    progress: 0,
    type: opts.type,
    direction: opts.direction ?? "outbound",
    duration: opts.duration ?? DEFAULT_DURATION,
    elapsed: 0,
    current: { ...opts.from },
    trail: [],
    impacted: false,
    impactFlash: 0,
    sourceName: opts.sourceName,
    targetName: opts.targetName,
  };
}

/* ═══════════════════════════════════════
   Arc Interpolation
   ═══════════════════════════════════════ */

/**
 * Ease function: smooth start + end with fast middle
 */
function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Compute position along a quadratic bezier arc.
 * The control point is at the midpoint, elevated by the arc height.
 */
function arcPosition(from: Position, to: Position, t: number): Position {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const arcHeight = dist * ARC_HEIGHT_RATIO;

  // Midpoint + elevation
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2 - arcHeight;

  // Quadratic bezier: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
  const omt = 1 - t;
  return {
    x: omt * omt * from.x + 2 * omt * t * midX + t * t * to.x,
    y: omt * omt * from.y + 2 * omt * t * midY + t * t * to.y,
  };
}

/* ═══════════════════════════════════════
   Tick System
   ═══════════════════════════════════════ */

export interface MailTickResult {
  /** Updated mail state */
  mail: FlyingMail;
  /** Whether the mail has completed its flight */
  completed: boolean;
  /** Whether this tick triggered an impact */
  justImpacted: boolean;
}

/**
 * Tick a single flying mail forward by one frame.
 */
export function tickFlyingMail(mail: FlyingMail): MailTickResult {
  // Impact flash countdown
  if (mail.impacted) {
    const flash = mail.impactFlash - 1;
    return {
      mail: { ...mail, impactFlash: flash },
      completed: flash <= 0,
      justImpacted: false,
    };
  }

  const elapsed = mail.elapsed + 1;
  const progress = Math.min(1, elapsed / mail.duration);
  const easedT = easeInOutCubic(progress);

  const current = arcPosition(mail.from, mail.to, easedT);

  // Update trail
  const trail = [current, ...mail.trail].slice(0, MAX_TRAIL_LENGTH);

  // Check if arrived
  if (progress >= 1) {
    return {
      mail: {
        ...mail,
        elapsed,
        progress: 1,
        current: { ...mail.to },
        trail,
        impacted: true,
        impactFlash: IMPACT_FLASH_TICKS,
      },
      completed: false,
      justImpacted: true,
    };
  }

  return {
    mail: { ...mail, elapsed, progress, current, trail, impacted: false },
    completed: false,
    justImpacted: false,
  };
}

/**
 * Tick all flying mails, removing completed ones.
 */
export function tickAllMails(mails: FlyingMail[]): {
  active: FlyingMail[];
  completed: FlyingMail[];
  impacts: FlyingMail[];
} {
  const active: FlyingMail[] = [];
  const completed: FlyingMail[] = [];
  const impacts: FlyingMail[] = [];

  for (const mail of mails) {
    const result = tickFlyingMail(mail);
    if (result.completed) {
      completed.push(result.mail);
    } else {
      active.push(result.mail);
    }
    if (result.justImpacted) {
      impacts.push(result.mail);
    }
  }

  return { active, completed, impacts };
}

/* ═══════════════════════════════════════
   SVG Path Helpers (for 2D renderer)
   ═══════════════════════════════════════ */

/**
 * Generate an SVG path string for the arc preview.
 * Useful for showing projected flight path before launch.
 */
export function arcSvgPath(from: Position, to: Position): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const arcHeight = dist * ARC_HEIGHT_RATIO;

  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2 - arcHeight;

  return `M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`;
}

/**
 * Generate SVG trail circles for a flying mail's trail.
 */
export function trailSvgCircles(mail: FlyingMail): string {
  const style = MAIL_STYLES[mail.type];
  return mail.trail
    .map((p, i) => {
      const opacity = 1 - i / mail.trail.length;
      const r = 3 - (i / mail.trail.length) * 2;
      return `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${style.trailColor}" opacity="${opacity.toFixed(2)}" />`;
    })
    .join("");
}

/**
 * Generate SVG impact flash circle.
 */
export function impactSvgFlash(mail: FlyingMail): string {
  if (!mail.impacted || mail.impactFlash <= 0) return "";
  const style = MAIL_STYLES[mail.type];
  const opacity = mail.impactFlash / IMPACT_FLASH_TICKS;
  const r = 20 * (1 - opacity) + 5;
  return `<circle cx="${mail.to.x}" cy="${mail.to.y}" r="${r}" fill="none" stroke="${style.color}" stroke-width="2" opacity="${opacity.toFixed(2)}" />`;
}
