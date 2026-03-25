/** Cinematic Workflow — Staged workflow state machine with timed transitions
 *
 * Adapted from wickedapp/openclaw-office openclaw-ws.js
 * (runCinematicAnimation / runDelegationAnimation).
 *
 * Drives visual storytelling for task lifecycle:
 *   received → analyzing → task_created → assigned → in_progress → completed
 *
 * Each stage has a configurable duration, entry/exit effects, and
 * agent animation directives (walk to position, show speech bubble, etc.)
 */

import type { Position } from "../types";

/* ═══════════════════════════════════════
   Workflow Stages
   ═══════════════════════════════════════ */

export type WorkflowStage =
  | "idle"
  | "received"
  | "analyzing"
  | "task_created"
  | "delegating"
  | "assigned"
  | "in_progress"
  | "reviewing"
  | "completed"
  | "failed";

export type CinematicEffect =
  | "none"
  | "zoom_to_agent"
  | "zoom_to_ceo"
  | "pan_to_room"
  | "flash_highlight"
  | "particles_burst"
  | "screen_shake"
  | "dim_others";

/* ═══════════════════════════════════════
   Stage Configuration
   ═══════════════════════════════════════ */

export interface StageConfig {
  /** Stage identifier */
  stage: WorkflowStage;
  /** Duration in ms before auto-advancing */
  durationMs: number;
  /** Camera/visual effect on entry */
  entryEffect: CinematicEffect;
  /** Speech bubble text template (supports {agent}, {task} placeholders) */
  speechTemplate: string | null;
  /** Agent animation directive */
  agentAction: AgentDirective;
}

export type AgentDirective =
  | { type: "idle" }
  | { type: "walk_to"; target: Position }
  | { type: "walk_to_desk" }
  | { type: "walk_to_ceo" }
  | { type: "walk_to_meeting" }
  | { type: "sit" }
  | { type: "celebrate" }
  | { type: "think" }
  | { type: "work" }
  | { type: "present" };

/**
 * Default stage pipeline for a task lifecycle.
 * Durations and effects can be overridden per-workflow.
 */
export const DEFAULT_PIPELINE: StageConfig[] = [
  {
    stage: "received",
    durationMs: 2000,
    entryEffect: "flash_highlight",
    speechTemplate: "New task received!",
    agentAction: { type: "idle" },
  },
  {
    stage: "analyzing",
    durationMs: 3000,
    entryEffect: "zoom_to_ceo",
    speechTemplate: "Analyzing requirements...",
    agentAction: { type: "think" },
  },
  {
    stage: "task_created",
    durationMs: 1500,
    entryEffect: "particles_burst",
    speechTemplate: "Task created: {task}",
    agentAction: { type: "idle" },
  },
  {
    stage: "delegating",
    durationMs: 2500,
    entryEffect: "pan_to_room",
    speechTemplate: "Delegating to {agent}...",
    agentAction: { type: "walk_to_ceo" },
  },
  {
    stage: "assigned",
    durationMs: 2000,
    entryEffect: "zoom_to_agent",
    speechTemplate: "Got it! Starting work on {task}",
    agentAction: { type: "walk_to_desk" },
  },
  {
    stage: "in_progress",
    durationMs: 5000,
    entryEffect: "dim_others",
    speechTemplate: null,
    agentAction: { type: "work" },
  },
  {
    stage: "reviewing",
    durationMs: 3000,
    entryEffect: "zoom_to_ceo",
    speechTemplate: "Reviewing results...",
    agentAction: { type: "present" },
  },
  {
    stage: "completed",
    durationMs: 2000,
    entryEffect: "particles_burst",
    speechTemplate: "Task complete!",
    agentAction: { type: "celebrate" },
  },
];

/** Failure branch — overrides from any stage */
export const FAILURE_STAGES: StageConfig[] = [
  {
    stage: "failed",
    durationMs: 3000,
    entryEffect: "screen_shake",
    speechTemplate: "Task failed: {task}",
    agentAction: { type: "idle" },
  },
];

/* ═══════════════════════════════════════
   Workflow State Machine
   ═══════════════════════════════════════ */

export interface WorkflowState {
  /** Unique workflow instance ID */
  id: string;
  /** Current stage */
  stage: WorkflowStage;
  /** Index in the pipeline */
  stageIndex: number;
  /** Pipeline being executed */
  pipeline: StageConfig[];
  /** When the current stage started */
  stageStartedAt: number;
  /** Whether the workflow is paused (e.g., waiting for user input) */
  paused: boolean;
  /** Context variables for template interpolation */
  context: WorkflowContext;
  /** History of stage transitions */
  history: StageTransition[];
}

export interface WorkflowContext {
  agentId: string | null;
  agentName: string | null;
  taskId: string | null;
  taskName: string | null;
  ceoPosition: Position | null;
  agentDeskPosition: Position | null;
  meetingRoomPosition: Position | null;
  /** Custom variables */
  [key: string]: unknown;
}

export interface StageTransition {
  from: WorkflowStage;
  to: WorkflowStage;
  timestamp: number;
}

/* ═══════════════════════════════════════
   Factory
   ═══════════════════════════════════════ */

let _workflowId = 0;

/**
 * Create a new cinematic workflow.
 */
export function createWorkflow(
  context: Partial<WorkflowContext>,
  pipeline?: StageConfig[],
): WorkflowState {
  const p = pipeline ?? DEFAULT_PIPELINE;
  return {
    id: `wf-${++_workflowId}`,
    stage: "idle",
    stageIndex: -1,
    pipeline: p,
    stageStartedAt: Date.now(),
    paused: false,
    context: {
      agentId: null,
      agentName: null,
      taskId: null,
      taskName: null,
      ceoPosition: null,
      agentDeskPosition: null,
      meetingRoomPosition: null,
      ...context,
    },
    history: [],
  };
}

/* ═══════════════════════════════════════
   State Transitions
   ═══════════════════════════════════════ */

export interface TickOutput {
  /** Updated workflow state */
  workflow: WorkflowState;
  /** Current stage config (null if idle/completed) */
  currentStage: StageConfig | null;
  /** Whether a stage transition just occurred */
  transitioned: boolean;
  /** Whether the workflow is fully complete */
  completed: boolean;
  /** Resolved speech text (templates interpolated) */
  speechText: string | null;
  /** Resolved agent directive with positions filled in */
  resolvedDirective: AgentDirective;
}

/**
 * Tick the workflow forward. Call each frame or on a timer.
 * Auto-advances stages based on duration.
 */
export function tickWorkflow(state: WorkflowState, now = Date.now()): TickOutput {
  // Not started yet
  if (state.stageIndex === -1) {
    return advanceToNextStage(state, now);
  }

  // Paused
  if (state.paused) {
    const config = state.pipeline[state.stageIndex];
    return {
      workflow: state,
      currentStage: config,
      transitioned: false,
      completed: false,
      speechText: interpolateSpeech(config.speechTemplate, state.context),
      resolvedDirective: resolveDirective(config.agentAction, state.context),
    };
  }

  // Check if current stage has expired
  const config = state.pipeline[state.stageIndex];
  const elapsed = now - state.stageStartedAt;

  if (elapsed >= config.durationMs) {
    return advanceToNextStage(state, now);
  }

  // Still in current stage
  return {
    workflow: state,
    currentStage: config,
    transitioned: false,
    completed: false,
    speechText: interpolateSpeech(config.speechTemplate, state.context),
    resolvedDirective: resolveDirective(config.agentAction, state.context),
  };
}

function advanceToNextStage(state: WorkflowState, now: number): TickOutput {
  const nextIndex = state.stageIndex + 1;

  // Pipeline complete
  if (nextIndex >= state.pipeline.length) {
    return {
      workflow: { ...state, stage: "completed" as WorkflowStage },
      currentStage: null,
      transitioned: true,
      completed: true,
      speechText: null,
      resolvedDirective: { type: "idle" },
    };
  }

  const nextConfig = state.pipeline[nextIndex];
  const transition: StageTransition = {
    from: state.stage,
    to: nextConfig.stage,
    timestamp: now,
  };

  const updated: WorkflowState = {
    ...state,
    stage: nextConfig.stage,
    stageIndex: nextIndex,
    stageStartedAt: now,
    history: [...state.history, transition],
  };

  return {
    workflow: updated,
    currentStage: nextConfig,
    transitioned: true,
    completed: false,
    speechText: interpolateSpeech(nextConfig.speechTemplate, updated.context),
    resolvedDirective: resolveDirective(nextConfig.agentAction, updated.context),
  };
}

/**
 * Force the workflow to a failure state.
 */
export function failWorkflow(state: WorkflowState, now = Date.now()): WorkflowState {
  const failConfig = FAILURE_STAGES[0];
  return {
    ...state,
    stage: failConfig.stage,
    stageIndex: state.pipeline.length, // past end
    pipeline: [...state.pipeline, failConfig],
    stageStartedAt: now,
    history: [
      ...state.history,
      { from: state.stage, to: failConfig.stage, timestamp: now },
    ],
  };
}

/**
 * Pause the workflow at the current stage.
 */
export function pauseWorkflow(state: WorkflowState): WorkflowState {
  return { ...state, paused: true };
}

/**
 * Resume a paused workflow.
 */
export function resumeWorkflow(state: WorkflowState): WorkflowState {
  return { ...state, paused: false, stageStartedAt: Date.now() };
}

/**
 * Skip to a specific stage by name.
 */
export function skipToStage(state: WorkflowState, targetStage: WorkflowStage): WorkflowState | null {
  const idx = state.pipeline.findIndex((s) => s.stage === targetStage);
  if (idx === -1) return null;

  return {
    ...state,
    stage: targetStage,
    stageIndex: idx,
    stageStartedAt: Date.now(),
    history: [
      ...state.history,
      { from: state.stage, to: targetStage, timestamp: Date.now() },
    ],
  };
}

/* ═══════════════════════════════════════
   Template Interpolation
   ═══════════════════════════════════════ */

function interpolateSpeech(
  template: string | null,
  ctx: WorkflowContext,
): string | null {
  if (!template) return null;

  return template
    .replace(/\{agent\}/g, ctx.agentName ?? "Agent")
    .replace(/\{task\}/g, ctx.taskName ?? "task")
    .replace(/\{agentId\}/g, ctx.agentId ?? "")
    .replace(/\{taskId\}/g, ctx.taskId ?? "");
}

function resolveDirective(
  directive: AgentDirective,
  ctx: WorkflowContext,
): AgentDirective {
  switch (directive.type) {
    case "walk_to_ceo":
      return ctx.ceoPosition
        ? { type: "walk_to", target: ctx.ceoPosition }
        : { type: "idle" };
    case "walk_to_desk":
      return ctx.agentDeskPosition
        ? { type: "walk_to", target: ctx.agentDeskPosition }
        : { type: "idle" };
    case "walk_to_meeting":
      return ctx.meetingRoomPosition
        ? { type: "walk_to", target: ctx.meetingRoomPosition }
        : { type: "idle" };
    default:
      return directive;
  }
}

/* ═══════════════════════════════════════
   Multi-Workflow Manager
   ═══════════════════════════════════════ */

/**
 * Tick all active workflows, returning updated list and any events.
 */
export function tickAllWorkflows(
  workflows: WorkflowState[],
  now = Date.now(),
): {
  active: WorkflowState[];
  completed: WorkflowState[];
  transitions: Array<{ workflowId: string; transition: StageTransition }>;
} {
  const active: WorkflowState[] = [];
  const completed: WorkflowState[] = [];
  const transitions: Array<{ workflowId: string; transition: StageTransition }> = [];

  for (const wf of workflows) {
    const result = tickWorkflow(wf, now);
    if (result.completed) {
      completed.push(result.workflow);
    } else {
      active.push(result.workflow);
    }
    if (result.transitioned && result.workflow.history.length > 0) {
      transitions.push({
        workflowId: wf.id,
        transition: result.workflow.history[result.workflow.history.length - 1],
      });
    }
  }

  return { active, completed, transitions };
}
