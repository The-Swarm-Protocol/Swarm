/** OpenClaw Office Sim — Shared type definitions */

/* ═══════════════════════════════════════
   Agent States & Zones
   ═══════════════════════════════════════ */

export type AgentVisualStatus =
  | "idle"
  | "active"
  | "thinking"
  | "tool_calling"
  | "speaking"
  | "error"
  | "blocked"
  | "offline"
  | "spawning";

export type AgentZone =
  | "desk"
  | "meeting"
  | "server"
  | "break"
  | "corridor"
  | "error_bay";

export type CameraMode = "orbit" | "follow" | "cinematic";

export type ViewMode = "2d" | "3d" | "background";

export type PanelType = "agent-detail" | "task-board" | "cost-metrics" | null;

/* ═══════════════════════════════════════
   Core Interfaces
   ═══════════════════════════════════════ */

export interface Position {
  x: number;
  y: number;
}

export interface VisualAgent {
  id: string;
  name: string;
  status: AgentVisualStatus;
  position: Position;
  targetPosition: Position;
  zone: AgentZone;
  currentTask: string | null;
  speechBubble: string | null;
  parentAgentId: string | null;
  childAgentIds: string[];
  lastActiveAt: number;
  toolCallCount: number;
  model: string | null;
  // Enriched fields
  agentType: string | null;
  capabilities: string[];
  bio: string | null;
  asn: string | null;
  // Custom avatar (populated from agentAvatars collection)
  modelUrl?: string;
  spriteUrl?: string;
  animationUrls?: Record<string, string>;
}

export interface CollaborationLink {
  sourceId: string;
  targetId: string;
  strength: number; // 0-1
  lastActivityAt: number;
}

export interface FilterState {
  statusFilter: AgentVisualStatus | "all";
  searchQuery: string;
}

export interface OfficeActivityEvent {
  timestamp: number;
  agentId: string;
  agentName: string;
  type: "status_change" | "error" | "recovery" | "spawn" | "despawn" | "task_start" | "task_complete";
  description: string;
}

/* ═══════════════════════════════════════
   Office Layout
   ═══════════════════════════════════════ */

export interface OfficeLayout {
  id: string;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  desks: DeskSlot[];
  rooms: RoomConfig[];
}

export interface DeskSlot {
  id: string;
  position: Position;
  assignedAgentId: string | null;
}

export interface RoomConfig {
  id: string;
  type: "meeting" | "server" | "break" | "error_bay";
  position: Position;
  width: number;
  height: number;
  label: string;
}

/* ═══════════════════════════════════════
   Status Visual Mappings
   ═══════════════════════════════════════ */

export const STATUS_COLORS: Record<AgentVisualStatus, string> = {
  idle: "#6b7280",
  active: "#22c55e",
  thinking: "#eab308",
  tool_calling: "#06b6d4",
  speaking: "#e5e7eb",
  error: "#ef4444",
  blocked: "#f59e0b",
  offline: "#374151",
  spawning: "#06b6d4",
};

export const STATUS_LABELS: Record<AgentVisualStatus, string> = {
  idle: "Idle",
  active: "Active",
  thinking: "Thinking",
  tool_calling: "Tool Call",
  speaking: "Speaking",
  error: "Error",
  blocked: "Blocked",
  offline: "Offline",
  spawning: "Spawning",
};

export const STATUS_ICONS: Record<AgentVisualStatus, string> = {
  idle: "💤",
  active: "💻",
  thinking: "🤔",
  tool_calling: "🔧",
  speaking: "💬",
  error: "⚠️",
  blocked: "🚧",
  offline: "⚪",
  spawning: "✨",
};

/* ═══════════════════════════════════════
   Floor Plan Templates
   ═══════════════════════════════════════ */

export const DEFAULT_LAYOUT: OfficeLayout = {
  id: "startup-loft",
  name: "Startup Loft",
  canvasWidth: 920,
  canvasHeight: 580,
  desks: [
    { id: "desk-1", position: { x: 80, y: 200 }, assignedAgentId: null },
    { id: "desk-2", position: { x: 240, y: 200 }, assignedAgentId: null },
    { id: "desk-3", position: { x: 400, y: 200 }, assignedAgentId: null },
    { id: "desk-4", position: { x: 560, y: 200 }, assignedAgentId: null },
    { id: "desk-5", position: { x: 80, y: 360 }, assignedAgentId: null },
    { id: "desk-6", position: { x: 240, y: 360 }, assignedAgentId: null },
    { id: "desk-7", position: { x: 400, y: 360 }, assignedAgentId: null },
    { id: "desk-8", position: { x: 560, y: 360 }, assignedAgentId: null },
  ],
  rooms: [
    { id: "meeting-a", type: "meeting", position: { x: 680, y: 60 }, width: 200, height: 160, label: "Meeting Room A" },
    { id: "break-room", type: "break", position: { x: 680, y: 280 }, width: 200, height: 120, label: "Break Room" },
    { id: "error-bay", type: "error_bay", position: { x: 680, y: 440 }, width: 200, height: 100, label: "Error Bay" },
  ],
};

export const CORPORATE_LAYOUT: OfficeLayout = {
  id: "corporate-floor",
  name: "Corporate Floor",
  canvasWidth: 1100,
  canvasHeight: 700,
  desks: [
    // Row 1
    { id: "desk-c1", position: { x: 60, y: 160 }, assignedAgentId: null },
    { id: "desk-c2", position: { x: 210, y: 160 }, assignedAgentId: null },
    { id: "desk-c3", position: { x: 360, y: 160 }, assignedAgentId: null },
    { id: "desk-c4", position: { x: 510, y: 160 }, assignedAgentId: null },
    // Row 2
    { id: "desk-c5", position: { x: 60, y: 310 }, assignedAgentId: null },
    { id: "desk-c6", position: { x: 210, y: 310 }, assignedAgentId: null },
    { id: "desk-c7", position: { x: 360, y: 310 }, assignedAgentId: null },
    { id: "desk-c8", position: { x: 510, y: 310 }, assignedAgentId: null },
    // Row 3
    { id: "desk-c9", position: { x: 60, y: 460 }, assignedAgentId: null },
    { id: "desk-c10", position: { x: 210, y: 460 }, assignedAgentId: null },
    { id: "desk-c11", position: { x: 360, y: 460 }, assignedAgentId: null },
    { id: "desk-c12", position: { x: 510, y: 460 }, assignedAgentId: null },
  ],
  rooms: [
    { id: "meeting-1", type: "meeting", position: { x: 700, y: 50 }, width: 180, height: 140, label: "Meeting Room" },
    { id: "meeting-2", type: "meeting", position: { x: 700, y: 220 }, width: 180, height: 140, label: "War Room" },
    { id: "server-room", type: "server", position: { x: 700, y: 390 }, width: 180, height: 120, label: "Server Room" },
    { id: "break-room", type: "break", position: { x: 700, y: 540 }, width: 180, height: 100, label: "Break Room" },
    { id: "error-bay", type: "error_bay", position: { x: 60, y: 600 }, width: 300, height: 70, label: "Error Bay" },
  ],
};

export const LAYOUT_TEMPLATES: OfficeLayout[] = [DEFAULT_LAYOUT, CORPORATE_LAYOUT];
