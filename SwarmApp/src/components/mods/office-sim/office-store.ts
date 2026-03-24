/** OpenClaw Office Sim — Central state store (React Context + useReducer) */
"use client";

import { createContext, useContext } from "react";
import type {
  VisualAgent,
  CollaborationLink,
  OfficeLayout,
  ViewMode,
  PanelType,
  FilterState,
  CameraMode,
  OfficeActivityEvent,
  AgentVisualStatus,
} from "./types";
import { DEFAULT_LAYOUT } from "./types";
import type { OfficeTheme } from "./themes";
import { THEME_PRESETS } from "./themes";
import type { OfficeFurnitureData } from "./studio/furniture-types";
import type { OfficeTextureData } from "./studio/texture-types";

/* ═══════════════════════════════════════
   State Shape
   ═══════════════════════════════════════ */

export interface OfficeState {
  agents: Map<string, VisualAgent>;
  collaborationLinks: CollaborationLink[];
  layout: OfficeLayout;
  viewMode: ViewMode;
  activePanel: PanelType;
  selectedAgentId: string | null;
  connected: boolean;
  hubConnected: boolean;
  demoMode: boolean;
  cameraMode: CameraMode;
  filter: FilterState;
  activityFeed: OfficeActivityEvent[];
  theme: OfficeTheme;
  furniture: Map<string, OfficeFurnitureData>;
  textures: Map<string, OfficeTextureData>;
  metrics: {
    activeCount: number;
    taskCount: number;
    errorCount: number;
  };
}

/* ═══════════════════════════════════════
   Actions
   ═══════════════════════════════════════ */

export type OfficeAction =
  | { type: "SET_AGENTS"; agents: VisualAgent[] }
  | { type: "UPDATE_AGENT"; id: string; patch: Partial<VisualAgent> }
  | { type: "UPDATE_SPEECH_BUBBLE"; agentId: string; bubble: string | null }
  | { type: "SET_VIEW_MODE"; mode: ViewMode }
  | { type: "SET_PANEL"; panel: PanelType }
  | { type: "SELECT_AGENT"; id: string | null }
  | { type: "SET_CONNECTED"; connected: boolean }
  | { type: "SET_HUB_CONNECTED"; hubConnected: boolean }
  | { type: "SET_LINKS"; links: CollaborationLink[] }
  | { type: "SET_FILTER"; filter: Partial<FilterState> }
  | { type: "TOGGLE_DEMO" }
  | { type: "SET_CAMERA_MODE"; mode: CameraMode }
  | { type: "SET_ACTIVITY_FEED"; events: OfficeActivityEvent[] }
  | { type: "PUSH_ACTIVITY"; event: OfficeActivityEvent }
  | { type: "SET_LAYOUT"; layout: OfficeLayout }
  | { type: "SET_THEME"; theme: OfficeTheme }
  | { type: "SET_FURNITURE"; furniture: Map<string, OfficeFurnitureData> }
  | { type: "SET_TEXTURES"; textures: Map<string, OfficeTextureData> };

/* ═══════════════════════════════════════
   Initial State
   ═══════════════════════════════════════ */

export const initialState: OfficeState = {
  agents: new Map(),
  collaborationLinks: [],
  layout: DEFAULT_LAYOUT,
  viewMode: "2d",
  activePanel: null,
  selectedAgentId: null,
  connected: false,
  hubConnected: false,
  demoMode: false,
  cameraMode: "orbit",
  filter: { statusFilter: "all", searchQuery: "" },
  activityFeed: [],
  theme: THEME_PRESETS[0],
  furniture: new Map(),
  textures: new Map(),
  metrics: { activeCount: 0, taskCount: 0, errorCount: 0 },
};

/* ═══════════════════════════════════════
   Reducer
   ═══════════════════════════════════════ */

function computeMetrics(agents: Map<string, VisualAgent>) {
  let activeCount = 0;
  let errorCount = 0;
  let taskCount = 0;
  for (const a of agents.values()) {
    if (a.status === "active" || a.status === "thinking" || a.status === "tool_calling" || a.status === "speaking") activeCount++;
    if (a.status === "error") errorCount++;
    if (a.currentTask) taskCount++;
  }
  return { activeCount, errorCount, taskCount };
}

export function officeReducer(state: OfficeState, action: OfficeAction): OfficeState {
  switch (action.type) {
    case "SET_AGENTS": {
      const agents = new Map<string, VisualAgent>();
      for (const a of action.agents) agents.set(a.id, a);
      return { ...state, agents, metrics: computeMetrics(agents) };
    }
    case "UPDATE_AGENT": {
      const agents = new Map(state.agents);
      const existing = agents.get(action.id);
      if (existing) {
        agents.set(action.id, { ...existing, ...action.patch });
        return { ...state, agents, metrics: computeMetrics(agents) };
      }
      return state;
    }
    case "UPDATE_SPEECH_BUBBLE": {
      const agents = new Map(state.agents);
      const existing = agents.get(action.agentId);
      if (existing) {
        agents.set(action.agentId, { ...existing, speechBubble: action.bubble });
      }
      return { ...state, agents };
    }
    case "SET_VIEW_MODE":
      return { ...state, viewMode: action.mode };
    case "SET_PANEL":
      return { ...state, activePanel: action.panel };
    case "SELECT_AGENT":
      return { ...state, selectedAgentId: action.id, activePanel: action.id ? "agent-detail" : null };
    case "SET_CONNECTED":
      return { ...state, connected: action.connected };
    case "SET_HUB_CONNECTED":
      return { ...state, hubConnected: action.hubConnected };
    case "SET_LINKS":
      return { ...state, collaborationLinks: action.links };
    case "SET_FILTER":
      return { ...state, filter: { ...state.filter, ...action.filter } };
    case "TOGGLE_DEMO":
      return { ...state, demoMode: !state.demoMode };
    case "SET_CAMERA_MODE":
      return { ...state, cameraMode: action.mode };
    case "SET_ACTIVITY_FEED":
      return { ...state, activityFeed: action.events };
    case "PUSH_ACTIVITY": {
      const feed = [action.event, ...state.activityFeed].slice(0, 50);
      return { ...state, activityFeed: feed };
    }
    case "SET_LAYOUT":
      return { ...state, layout: action.layout };
    case "SET_THEME":
      return { ...state, theme: action.theme };
    case "SET_FURNITURE":
      return { ...state, furniture: action.furniture };
    case "SET_TEXTURES":
      return { ...state, textures: action.textures };
    default:
      return state;
  }
}

/* ═══════════════════════════════════════
   Selectors
   ═══════════════════════════════════════ */

export function getFilteredAgents(state: OfficeState): Set<string> {
  const { statusFilter, searchQuery } = state.filter;
  const matchingIds = new Set<string>();
  const query = searchQuery.toLowerCase().trim();

  for (const agent of state.agents.values()) {
    const matchesStatus = statusFilter === "all" || agent.status === statusFilter;
    const matchesSearch = !query || agent.name.toLowerCase().includes(query) || (agent.agentType?.toLowerCase().includes(query) ?? false);
    if (matchesStatus && matchesSearch) {
      matchingIds.add(agent.id);
    }
  }
  return matchingIds;
}

/** Map raw Swarm agent status to visual status */
export function mapAgentStatus(raw: string): AgentVisualStatus {
  switch (raw) {
    case "online": return "active";
    case "busy": return "thinking";
    case "paused": return "blocked";
    case "error": return "error";
    case "offline": return "offline";
    default: return "idle";
  }
}

/* ═══════════════════════════════════════
   Context
   ═══════════════════════════════════════ */

export const OfficeContext = createContext<{
  state: OfficeState;
  dispatch: React.Dispatch<OfficeAction>;
} | null>(null);

export function useOffice() {
  const ctx = useContext(OfficeContext);
  if (!ctx) throw new Error("useOffice must be used within OfficeProvider");
  return ctx;
}
