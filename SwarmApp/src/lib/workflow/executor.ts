/**
 * Workflow Engine — DAG Executor.
 *
 * Server-orchestrated, Firestore-durable execution engine.
 *
 * Execution model:
 *   1. Client creates a run → all nodes start as "pending"
 *   2. Client polls `advanceRun(runId)` repeatedly
 *   3. Each poll: compute ready set → execute ONE ready node → persist → return
 *   4. Run completes when all nodes are terminal (completed/failed/skipped)
 *
 * Fits within Netlify's 10s serverless timeout — one node per poll.
 */

import type {
  WorkflowDefinition,
  WorkflowRun,
  WorkflowNode,
  WorkflowEdge,
  NodeRunState,
  NodeRunStatus,
  NodeExecutionResult,
  RunStatus,
} from "./types";
import {
  getWorkflowDefinition,
  getWorkflowRun,
  updateWorkflowRun,
  createWorkflowRun,
} from "./store";
import { getNodeHandler } from "./nodes";

// ── DAG utilities ────────────────────────────────────────────────────────────

/** Compute topological order of nodes. Throws if cycle detected. */
export function topologicalSort(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): string[] {
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    adj.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    adj.get(edge.from)?.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const neighbor of adj.get(current) || []) {
      const newDeg = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  if (sorted.length !== nodes.length) {
    throw new Error("Workflow contains a cycle — not a valid DAG");
  }

  return sorted;
}

/** Get IDs of parent nodes (nodes with edges pointing to this node) */
function getParents(nodeId: string, edges: WorkflowEdge[]): string[] {
  return edges.filter((e) => e.to === nodeId).map((e) => e.from);
}

/** Check if a node status is terminal */
function isTerminal(status: NodeRunStatus): boolean {
  return status === "completed" || status === "failed" || status === "skipped" || status === "cancelled";
}

/** Compute which nodes are ready to execute */
function computeReadySet(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  nodeStates: Record<string, NodeRunState>,
): string[] {
  const ready: string[] = [];

  for (const node of nodes) {
    const state = nodeStates[node.id];
    if (!state || state.status !== "pending") continue;

    const parents = getParents(node.id, edges);

    // Node is ready if ALL parents are completed (or there are no parents)
    const allParentsCompleted = parents.every((pid) => {
      const ps = nodeStates[pid];
      return ps && ps.status === "completed";
    });

    // If any parent failed/cancelled, skip this node
    const anyParentFailed = parents.some((pid) => {
      const ps = nodeStates[pid];
      return ps && (ps.status === "failed" || ps.status === "cancelled");
    });

    if (anyParentFailed) {
      // Mark as skipped (cascade failure)
      ready.push(node.id); // Will be handled specially
    } else if (allParentsCompleted) {
      ready.push(node.id);
    }
  }

  return ready;
}

/** Merge outputs from upstream nodes into inputs for a node */
function collectInputs(
  nodeId: string,
  edges: WorkflowEdge[],
  nodeStates: Record<string, NodeRunState>,
): Record<string, unknown> {
  const parents = getParents(nodeId, edges);
  const inputs: Record<string, unknown> = {};

  for (const parentId of parents) {
    const parentState = nodeStates[parentId];
    if (parentState?.output !== undefined) {
      inputs[parentId] = parentState.output;
    }
  }

  return inputs;
}

/** Calculate overall progress */
function calculateProgress(
  nodeStates: Record<string, NodeRunState>,
  totalNodes: number,
): number {
  if (totalNodes === 0) return 100;
  const completed = Object.values(nodeStates).filter((s) =>
    isTerminal(s.status),
  ).length;
  return Math.round((completed / totalNodes) * 100);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a new workflow run from a definition.
 * Initializes all nodes as "pending", marks trigger nodes as "ready".
 */
export async function startRun(
  workflowId: string,
  triggeredBy: string,
  triggerInput?: Record<string, unknown>,
): Promise<string> {
  const def = await getWorkflowDefinition(workflowId);
  if (!def) throw new Error("Workflow definition not found");
  if (!def.enabled) throw new Error("Workflow is disabled");

  // Validate DAG
  topologicalSort(def.nodes, def.edges);

  // Initialize node states
  const nodeStates: Record<string, NodeRunState> = {};
  for (const node of def.nodes) {
    const parents = getParents(node.id, def.edges);
    nodeStates[node.id] = {
      nodeId: node.id,
      status: parents.length === 0 ? "ready" : "pending",
      retriesUsed: 0,
    };
  }

  // Create run
  const runId = await createWorkflowRun({
    workflowId,
    workflowVersion: def.version,
    orgId: def.orgId,
    status: "running",
    nodeStates,
    triggerInput,
    progress: 0,
    triggeredBy,
  });

  return runId;
}

/**
 * Advance a workflow run by one step.
 *
 * Picks ONE ready node, executes it, persists the result, and
 * recomputes the ready set. Returns the updated run.
 *
 * Call this in a polling loop until run.status is terminal.
 */
export async function advanceRun(
  runId: string,
): Promise<WorkflowRun> {
  const run = await getWorkflowRun(runId);
  if (!run) throw new Error("Run not found");

  // Terminal states — nothing to do
  if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") {
    return run;
  }

  if (run.status === "paused") {
    return run;
  }

  // Load definition
  const def = await getWorkflowDefinition(run.workflowId);
  if (!def) throw new Error("Workflow definition not found");

  const nodeMap = new Map(def.nodes.map((n) => [n.id, n]));
  const nodeStates = { ...run.nodeStates };

  // Compute ready set
  const readyIds = computeReadySet(def.nodes, def.edges, nodeStates);

  if (readyIds.length === 0) {
    // Check if all nodes are terminal
    const allTerminal = def.nodes.every((n) => isTerminal(nodeStates[n.id]?.status));
    if (allTerminal) {
      // Collect outputs from output nodes
      const outputs: Record<string, unknown> = {};
      for (const node of def.nodes) {
        if (node.type === "output" && nodeStates[node.id]?.output !== undefined) {
          outputs[node.id] = nodeStates[node.id].output;
        }
      }

      // Check if any node failed
      const anyFailed = Object.values(nodeStates).some((s) => s.status === "failed");

      await updateWorkflowRun(runId, {
        status: anyFailed ? "failed" : "completed",
        nodeStates,
        outputs,
        progress: 100,
        completedAt: Date.now(),
      });

      return (await getWorkflowRun(runId))!;
    }

    // Some nodes still running — nothing ready yet, wait
    return run;
  }

  // Pick the first ready node (topological order priority)
  const topoOrder = topologicalSort(def.nodes, def.edges);
  const nextId = topoOrder.find((id) => readyIds.includes(id));
  if (!nextId) return run;

  const node = nodeMap.get(nextId);
  if (!node) return run;

  const parents = getParents(nextId, def.edges);

  // Check for cascade failure/skip
  const anyParentFailed = parents.some((pid) => {
    const ps = nodeStates[pid];
    return ps && (ps.status === "failed" || ps.status === "cancelled");
  });

  if (anyParentFailed) {
    // Skip this node and cascade
    nodeStates[nextId] = {
      ...nodeStates[nextId],
      status: "skipped",
      completedAt: Date.now(),
    };
  } else {
    // Execute the node
    const inputs = collectInputs(nextId, def.edges, nodeStates);

    // Include trigger input for root nodes
    if (parents.length === 0 && run.triggerInput) {
      Object.assign(inputs, { _trigger: run.triggerInput });
    }

    // Mark as running
    nodeStates[nextId] = {
      ...nodeStates[nextId],
      status: "running",
      inputs,
      startedAt: Date.now(),
    };

    try {
      const handler = getNodeHandler(node.type);
      const result: NodeExecutionResult = await handler.execute(node, inputs, run);

      nodeStates[nextId] = {
        ...nodeStates[nextId],
        status: result.status,
        output: result.output,
        error: result.error,
        externalRef: result.externalRef,
        completedAt: isTerminal(result.status) ? Date.now() : undefined,
      };

      // Handle retry on failure
      if (result.status === "failed" && node.retries && nodeStates[nextId].retriesUsed < node.retries) {
        nodeStates[nextId] = {
          ...nodeStates[nextId],
          status: "ready", // Re-queue for retry
          retriesUsed: nodeStates[nextId].retriesUsed + 1,
          error: undefined,
        };
      }
    } catch (err) {
      nodeStates[nextId] = {
        ...nodeStates[nextId],
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
        completedAt: Date.now(),
      };

      // Retry logic
      if (node.retries && nodeStates[nextId].retriesUsed < node.retries) {
        nodeStates[nextId] = {
          ...nodeStates[nextId],
          status: "ready",
          retriesUsed: nodeStates[nextId].retriesUsed + 1,
          error: undefined,
        };
      }
    }
  }

  // Recompute overall status
  const allTerminal = def.nodes.every((n) => isTerminal(nodeStates[n.id]?.status));
  const anyRunning = Object.values(nodeStates).some((s) => s.status === "running");

  let newStatus: RunStatus = run.status;
  if (allTerminal) {
    const anyFailed = Object.values(nodeStates).some((s) => s.status === "failed");
    newStatus = anyFailed ? "failed" : "completed";
  } else if (anyRunning) {
    newStatus = "running";
  }

  const progress = calculateProgress(nodeStates, def.nodes.length);

  // Collect outputs if completed
  const outputs: Record<string, unknown> = {};
  if (newStatus === "completed" || newStatus === "failed") {
    for (const n of def.nodes) {
      if (n.type === "output" && nodeStates[n.id]?.output !== undefined) {
        outputs[n.id] = nodeStates[n.id].output;
      }
    }
  }

  await updateWorkflowRun(runId, {
    status: newStatus,
    nodeStates,
    progress,
    ...(newStatus === "completed" || newStatus === "failed"
      ? { outputs, completedAt: Date.now() }
      : {}),
  });

  return (await getWorkflowRun(runId))!;
}

/**
 * Cancel a running workflow.
 */
export async function cancelRun(runId: string): Promise<void> {
  const run = await getWorkflowRun(runId);
  if (!run) throw new Error("Run not found");
  if (run.status === "completed" || run.status === "cancelled") return;

  const nodeStates = { ...run.nodeStates };
  for (const [id, state] of Object.entries(nodeStates)) {
    if (!isTerminal(state.status)) {
      nodeStates[id] = { ...state, status: "cancelled", completedAt: Date.now() };
    }
  }

  await updateWorkflowRun(runId, {
    status: "cancelled",
    nodeStates,
    progress: calculateProgress(nodeStates, Object.keys(nodeStates).length),
    completedAt: Date.now(),
  });
}

/**
 * Pause a running workflow (resumes on next advanceRun call after unpausing).
 */
export async function pauseRun(runId: string): Promise<void> {
  await updateWorkflowRun(runId, { status: "paused" });
}

/**
 * Resume a paused workflow.
 */
export async function resumeRun(runId: string): Promise<void> {
  const run = await getWorkflowRun(runId);
  if (!run) throw new Error("Run not found");
  if (run.status !== "paused") return;
  await updateWorkflowRun(runId, { status: "running" });
}

/**
 * Validate a workflow definition.
 * Returns errors if the DAG is invalid.
 */
export function validateWorkflow(
  def: Pick<WorkflowDefinition, "nodes" | "edges">,
): string[] {
  const errors: string[] = [];

  if (def.nodes.length === 0) {
    errors.push("Workflow must have at least one node");
    return errors;
  }

  // Check for cycles
  try {
    topologicalSort(def.nodes, def.edges);
  } catch {
    errors.push("Workflow contains a cycle — must be a DAG");
  }

  // Check for orphan nodes (no edges)
  const connectedIds = new Set<string>();
  for (const edge of def.edges) {
    connectedIds.add(edge.from);
    connectedIds.add(edge.to);
  }
  if (def.nodes.length > 1) {
    for (const node of def.nodes) {
      if (!connectedIds.has(node.id)) {
        errors.push(`Node "${node.label}" (${node.id}) is disconnected`);
      }
    }
  }

  // Check for trigger nodes
  const triggers = def.nodes.filter((n) => n.type === "trigger");
  if (triggers.length === 0) {
    errors.push("Workflow must have at least one trigger node");
  }

  // Check for dangling edges
  const nodeIds = new Set(def.nodes.map((n) => n.id));
  for (const edge of def.edges) {
    if (!nodeIds.has(edge.from)) {
      errors.push(`Edge references non-existent source node: ${edge.from}`);
    }
    if (!nodeIds.has(edge.to)) {
      errors.push(`Edge references non-existent target node: ${edge.to}`);
    }
  }

  return errors;
}
