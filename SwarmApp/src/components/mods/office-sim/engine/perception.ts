/** Perception Engine v1 — Simplified classify + narrate for MVP
 *
 * Full pipeline (classify → aggregate → narrate → hold) comes in v2.0.
 * This v1 operates synchronously on status transitions.
 */

import type { AgentVisualStatus, VisualAgent } from "../types";

/* ═══════════════════════════════════════
   Event Classification
   ═══════════════════════════════════════ */

export type TransitionType =
  | "status_change"
  | "error_onset"
  | "recovery"
  | "spawn"
  | "despawn"
  | "became_idle"
  | "became_active"
  | "started_thinking"
  | "tool_call_start"
  | "became_blocked"
  | "received_task"
  | "sent_message"
  | "typing";

export function classifyTransition(
  prev: AgentVisualStatus,
  next: AgentVisualStatus,
): TransitionType {
  if (prev === "offline" && next !== "offline") return "spawn";
  if (prev !== "offline" && next === "offline") return "despawn";
  if (prev !== "error" && next === "error") return "error_onset";
  if (prev === "error" && next !== "error") return "recovery";
  if (next === "idle") return "became_idle";
  if (next === "active") return "became_active";
  if (next === "thinking") return "started_thinking";
  if (next === "tool_calling") return "tool_call_start";
  if (next === "blocked") return "became_blocked";
  return "status_change";
}

/* ═══════════════════════════════════════
   Narrative Generation
   ═══════════════════════════════════════ */

const TASK_VERBS = [
  "Analyzing", "Reviewing", "Processing", "Working on",
  "Examining", "Evaluating", "Handling", "Executing",
];

const THINKING_PHRASES = [
  "Thinking...",
  "Considering approach...",
  "Planning next steps...",
  "Evaluating options...",
];

const TOOL_PHRASES = [
  "Calling API...",
  "Fetching data...",
  "Running tool...",
  "Executing command...",
];

const IDLE_PHRASES = [
  "Standing by",
  "Waiting for tasks",
  "Ready",
];

const ERROR_PHRASES = [
  "Error encountered",
  "Something went wrong",
  "Blocked by error",
];

const BLOCKED_PHRASES = [
  "Waiting for approval",
  "Blocked — awaiting response",
  "Paused — dependency pending",
];

const MESSAGE_PHRASES = [
  "Sharing update...",
  "Broadcasting results...",
  "Sending message...",
  "Reporting findings...",
];

const TASK_RECEIVED_PHRASES = [
  "New task received",
  "Assignment incoming...",
  "Task assigned — starting...",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function truncateNarrative(s: string, max = 60): string {
  return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

export function generateNarrative(
  agent: VisualAgent,
  eventType: TransitionType,
): string | null {
  switch (eventType) {
    case "spawn":
      return "Initializing...";
    case "despawn":
      return null;
    case "became_active": {
      if (agent.currentTask) {
        const verb = pickRandom(TASK_VERBS);
        return truncateNarrative(`${verb}: ${agent.currentTask}`);
      }
      return "Working...";
    }
    case "started_thinking":
      return pickRandom(THINKING_PHRASES);
    case "tool_call_start":
      return pickRandom(TOOL_PHRASES);
    case "error_onset":
      return pickRandom(ERROR_PHRASES);
    case "recovery":
      return "Recovered — resuming work";
    case "became_idle":
      return pickRandom(IDLE_PHRASES);
    case "became_blocked":
      return pickRandom(BLOCKED_PHRASES);
    case "received_task":
      return pickRandom(TASK_RECEIVED_PHRASES);
    case "sent_message":
      return pickRandom(MESSAGE_PHRASES);
    case "typing":
      return "...";
    default:
      return null;
  }
}

/* ═══════════════════════════════════════
   Hold Controller (anti-flicker)
   ═══════════════════════════════════════ */

const HOLD_DURATION_MS = 3000;

export function shouldHold(
  lastChangeAt: number,
  now = Date.now(),
): boolean {
  return now - lastChangeAt < HOLD_DURATION_MS;
}

/* ═══════════════════════════════════════
   Zone Assignment
   ═══════════════════════════════════════ */

export function getZoneForStatus(status: AgentVisualStatus): import("../types").AgentZone {
  switch (status) {
    case "error":
      return "error_bay";
    case "offline":
      return "corridor";
    case "spawning":
      return "corridor";
    default:
      return "desk";
  }
}
