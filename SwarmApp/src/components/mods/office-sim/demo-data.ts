/** Demo Data — Mock agents for demo mode (no backend needed) */

import type { VisualAgent, CollaborationLink, AgentVisualStatus, AgentZone, Position } from "./types";
import { DEFAULT_LAYOUT, STATUS_COLORS } from "./types";
import { getZoneForStatus } from "./engine/perception";

/* ═══════════════════════════════════════
   Demo Agent Definitions
   ═══════════════════════════════════════ */

interface DemoAgentDef {
  name: string;
  agentType: string;
  model: string;
  bio: string;
  capabilities: string[];
}

const AGENT_DEFS: DemoAgentDef[] = [
  { name: "Cipher", agentType: "Security", model: "claude-sonnet-4-5-20250929", bio: "Security auditor and penetration testing specialist", capabilities: ["Code Analysis", "Web Fetch", "File Reader"] },
  { name: "Nova", agentType: "Engineering", model: "claude-sonnet-4-5-20250929", bio: "Full-stack engineer building scalable systems", capabilities: ["Code Gen", "Git Ops", "Testing"] },
  { name: "Atlas", agentType: "Research", model: "claude-opus-4-6", bio: "Deep research agent with web synthesis", capabilities: ["Web Search", "Data Analysis", "Report Gen"] },
  { name: "Echo", agentType: "Support", model: "claude-haiku-4-5-20251001", bio: "Customer support and documentation writer", capabilities: ["Chat", "Docs", "Ticket Mgmt"] },
  { name: "Sage", agentType: "Analytics", model: "claude-sonnet-4-5-20250929", bio: "Data analytics and business intelligence", capabilities: ["SQL", "Charts", "Forecasting"] },
  { name: "Bolt", agentType: "DevOps", model: "claude-haiku-4-5-20251001", bio: "CI/CD pipeline and infrastructure automation", capabilities: ["Docker", "K8s", "Monitoring"] },
  { name: "Luna", agentType: "Creative", model: "claude-opus-4-6", bio: "Creative content generation and brand strategy", capabilities: ["Writing", "Design", "Brand"] },
  { name: "Flux", agentType: "Coordinator", model: "claude-sonnet-4-5-20250929", bio: "Orchestrates multi-agent workflows", capabilities: ["Delegation", "Planning", "Routing"] },
];

const SPEECH_BUBBLES: Record<AgentVisualStatus, string[]> = {
  active: [
    "Reviewing PR #142...",
    "Writing test suite...",
    "Analyzing codebase...",
    "Deploying to staging...",
    "Refactoring auth module...",
    "Building API endpoint...",
    "Optimizing queries...",
    "Updating documentation...",
  ],
  thinking: [
    "Considering approach...",
    "Planning next steps...",
    "Evaluating options...",
    "Reasoning about design...",
  ],
  tool_calling: [
    "Calling fetch() API...",
    "Reading config files...",
    "Querying database...",
    "Running git diff...",
  ],
  speaking: [
    "Reporting findings...",
    "Summarizing results...",
    "Explaining approach...",
  ],
  error: [
    "Rate limited — retry in 30s",
    "API timeout — retrying...",
    "Auth token expired",
  ],
  blocked: [
    "Waiting for approval...",
    "Dependency not ready...",
    "Awaiting user input...",
  ],
  idle: [],
  offline: [],
  spawning: ["Initializing..."],
};

/* ═══════════════════════════════════════
   State Generation
   ═══════════════════════════════════════ */

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const STATUS_DISTRIBUTION: AgentVisualStatus[] = [
  "active", "active", "active",
  "thinking",
  "tool_calling",
  "idle",
  "error",
  "blocked",
];

function getDemoPosition(index: number, zone: AgentZone): Position {
  const desks = DEFAULT_LAYOUT.desks;
  if (zone === "error_bay") return { x: 730, y: 470 };
  if (zone === "corridor") return { x: 20, y: desks[index % desks.length].position.y };
  return desks[index % desks.length].position;
}

export function generateDemoState(): VisualAgent[] {
  return AGENT_DEFS.map((def, i) => {
    const status = STATUS_DISTRIBUTION[i % STATUS_DISTRIBUTION.length];
    const zone = getZoneForStatus(status);
    const pos = getDemoPosition(i, zone);
    const bubbles = SPEECH_BUBBLES[status];

    return {
      id: `demo-${def.name.toLowerCase()}`,
      name: def.name,
      status,
      position: pos,
      targetPosition: pos,
      zone,
      currentTask: status === "active" || status === "thinking" ? pickRandom(["PR Review", "Code Generation", "Test Suite", "API Build", "Data Migration", "Security Audit"]) : null,
      speechBubble: bubbles.length > 0 ? pickRandom(bubbles) : null,
      parentAgentId: i > 0 && Math.random() > 0.7 ? `demo-${AGENT_DEFS[0].name.toLowerCase()}` : null,
      childAgentIds: [],
      lastActiveAt: Date.now() - Math.floor(Math.random() * 300_000),
      toolCallCount: Math.floor(Math.random() * 50),
      model: def.model,
      agentType: def.agentType,
      capabilities: def.capabilities,
      bio: def.bio,
      asn: `ASN-${1000 + i}`,
    };
  });
}

export function rotateDemoState(current: VisualAgent[]): VisualAgent[] {
  const next = current.map((a) => ({ ...a }));
  // Rotate 1-2 random agents to new states
  const count = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * next.length);
    const agent = next[idx];
    const possibleStatuses: AgentVisualStatus[] = ["active", "thinking", "tool_calling", "idle", "speaking"];
    // Don't change offline/spawning agents
    if (agent.status === "offline" || agent.status === "spawning") continue;
    const newStatus = pickRandom(possibleStatuses);
    const newZone = getZoneForStatus(newStatus);
    const newPos = getDemoPosition(idx, newZone);
    const bubbles = SPEECH_BUBBLES[newStatus];

    next[idx] = {
      ...agent,
      status: newStatus,
      zone: newZone,
      position: newPos,
      targetPosition: newPos,
      speechBubble: bubbles.length > 0 ? pickRandom(bubbles) : null,
      lastActiveAt: Date.now(),
    };
  }
  return next;
}

export function generateDemoLinks(agents: VisualAgent[]): CollaborationLink[] {
  const active = agents.filter((a) => a.status === "active" || a.status === "thinking" || a.status === "tool_calling");
  if (active.length < 2) return [];

  const links: CollaborationLink[] = [];
  // Create 2-3 links between active agents
  const count = Math.min(active.length - 1, 2 + Math.floor(Math.random() * 2));
  for (let i = 0; i < count; i++) {
    links.push({
      sourceId: active[i].id,
      targetId: active[(i + 1) % active.length].id,
      strength: 0.4 + Math.random() * 0.5,
      lastActivityAt: Date.now(),
    });
  }
  return links;
}
