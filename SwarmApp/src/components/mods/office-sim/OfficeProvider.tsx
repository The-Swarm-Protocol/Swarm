/** OfficeProvider — Wraps the Office Sim with state + data fetching + perception */
"use client";

import { useReducer, useEffect, useCallback, useRef, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import {
  OfficeContext,
  officeReducer,
  initialState,
  mapAgentStatus,
} from "./office-store";
import type { VisualAgent, Position, AgentVisualStatus, OfficeActivityEvent } from "./types";
import { DEFAULT_LAYOUT } from "./types";
import { classifyTransition, generateNarrative, shouldHold, getZoneForStatus } from "./engine/perception";
import { generateDemoState, rotateDemoState, generateDemoLinks } from "./demo-data";
import type { AgentAvatarData } from "./studio/avatar-types";
import type { OfficeFurnitureData } from "./studio/furniture-types";
import type { OfficeTextureData } from "./studio/texture-types";
import { useHubStream } from "@/hooks/useHubStream";

/* ═══════════════════════════════════════
   Position Assignment
   ═══════════════════════════════════════ */

interface RawAgent {
  id: string;
  name: string;
  status: string;
  model?: string;
  type?: string;
  capabilities?: string[];
  bio?: string;
  asn?: string;
  description?: string;
  reportedSkills?: { skillId: string }[];
}

function assignPositions(
  agents: RawAgent[],
  desks: typeof DEFAULT_LAYOUT.desks,
): VisualAgent[] {
  return agents.map((a, i) => {
    const desk = desks[i % desks.length];
    const status = mapAgentStatus(a.status);
    const zone = getZoneForStatus(status);
    const pos: Position = zone === "error_bay"
      ? { x: 730, y: 470 }
      : zone === "corridor"
      ? { x: 20, y: desk.position.y }
      : desk.position;

    return {
      id: a.id,
      name: a.name,
      status,
      position: pos,
      targetPosition: pos,
      zone,
      currentTask: null,
      speechBubble: null,
      parentAgentId: null,
      childAgentIds: [],
      lastActiveAt: Date.now(),
      toolCallCount: 0,
      model: a.model || null,
      agentType: a.type || null,
      capabilities: a.capabilities || a.reportedSkills?.map(s => s.skillId) || [],
      bio: a.bio || a.description || null,
      asn: a.asn || null,
    };
  });
}

/* ═══════════════════════════════════════
   Provider Component
   ═══════════════════════════════════════ */

export function OfficeProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(officeReducer, initialState);
  const { currentOrg } = useOrg();

  // Track SSE vs polling mode
  const [sseActive, setSseActive] = useState(false);

  // Track previous agent states for perception engine
  const prevStatesRef = useRef<Map<string, AgentVisualStatus>>(new Map());
  const bubbleTimesRef = useRef<Map<string, number>>(new Map());

  /* ── SSE real-time stream (preferred) ── */
  useHubStream({
    orgId: currentOrg?.id,
    enabled: !state.demoMode,
    dispatch,
    onConnected: () => setSseActive(true),
    onDisconnected: () => setSseActive(false),
    onFallback: () => setSseActive(false),
  });

  /* ── Live agent fetching (initial load + periodic refresh) ── */
  const fetchAgents = useCallback(async () => {
    if (!currentOrg || state.demoMode) return;
    try {
      // Fetch hub-aware agents + avatars in parallel
      const [agentRes, avatarRes] = await Promise.all([
        fetch(`/api/v1/mods/office-sim/hub-agents?orgId=${currentOrg.id}`),
        fetch(`/api/v1/mods/office-sim/avatars?orgId=${currentOrg.id}`).catch(() => null),
      ]);
      if (!agentRes.ok) return;
      const data = await agentRes.json();
      const raw = (data.agents || []) as RawAgent[];

      // Track hub connectivity
      if (typeof data.hubConnected === "boolean") {
        dispatch({ type: "SET_HUB_CONNECTED", hubConnected: data.hubConnected });
      }
      const visual = assignPositions(raw, state.layout.desks);

      // Merge avatar data onto agents (graceful — if avatar fetch fails, agents still render)
      if (avatarRes?.ok) {
        try {
          const avatarData = await avatarRes.json();
          const avatars = (avatarData.avatars || {}) as Record<string, AgentAvatarData>;
          for (const agent of visual) {
            const avatar = avatars[agent.id];
            if (avatar) {
              if (avatar.modelUrl) agent.modelUrl = avatar.modelUrl;
              if (avatar.spriteUrl) agent.spriteUrl = avatar.spriteUrl;
              if (avatar.animationUrls) agent.animationUrls = avatar.animationUrls;
            }
          }
        } catch {
          // Avatar parse failed — agents render with procedural fallback
        }
      }

      // Run perception engine on transitions
      const now = Date.now();
      for (const agent of visual) {
        const prevStatus = prevStatesRef.current.get(agent.id);
        if (prevStatus && prevStatus !== agent.status) {
          const eventType = classifyTransition(prevStatus, agent.status);
          const lastBubbleTime = bubbleTimesRef.current.get(agent.id) || 0;

          if (!shouldHold(lastBubbleTime, now)) {
            const narrative = generateNarrative(agent, eventType);
            agent.speechBubble = narrative;
            bubbleTimesRef.current.set(agent.id, now);
          }

          // Record activity event
          dispatch({
            type: "PUSH_ACTIVITY",
            event: {
              timestamp: now,
              agentId: agent.id,
              agentName: agent.name,
              type: eventType === "error_onset" ? "error"
                : eventType === "recovery" ? "recovery"
                : eventType === "spawn" ? "spawn"
                : eventType === "despawn" ? "despawn"
                : "status_change",
              description: `${agent.name}: ${prevStatus} → ${agent.status}`,
            },
          });
        }
        prevStatesRef.current.set(agent.id, agent.status);
      }

      dispatch({ type: "SET_AGENTS", agents: visual });
      dispatch({ type: "SET_CONNECTED", connected: true });
    } catch {
      dispatch({ type: "SET_CONNECTED", connected: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg, state.demoMode, state.layout.desks]);

  /* ── Polling loop — initial fetch always, then slower interval when SSE is active ── */
  useEffect(() => {
    if (state.demoMode) return;
    fetchAgents();
    // When SSE is active, poll less frequently (30s) as a safety net
    // When SSE is not active, poll at 5s for near-real-time updates
    const interval = setInterval(fetchAgents, sseActive ? 30_000 : 5_000);
    return () => clearInterval(interval);
  }, [fetchAgents, state.demoMode, sseActive]);

  /* ── Fetch furniture + textures when theme changes ── */
  useEffect(() => {
    if (!currentOrg || state.demoMode) return;
    const themeId = state.theme.id;

    Promise.all([
      fetch(`/api/v1/mods/office-sim/furniture?orgId=${currentOrg.id}&themeId=${themeId}`).catch(() => null),
    ]).then(async ([furnitureRes]) => {
      if (furnitureRes?.ok) {
        try {
          const data = await furnitureRes.json();
          const furnitureMap = new Map<string, OfficeFurnitureData>();
          if (data.furniture) {
            for (const [cat, info] of Object.entries(data.furniture)) {
              furnitureMap.set(cat, info as OfficeFurnitureData);
            }
          }
          dispatch({ type: "SET_FURNITURE", furniture: furnitureMap });
        } catch {
          // Furniture fetch failed gracefully
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg, state.theme.id, state.demoMode]);

  /* ── Demo mode ── */
  useEffect(() => {
    if (!state.demoMode) return;

    const demoAgents = generateDemoState();
    dispatch({ type: "SET_AGENTS", agents: demoAgents });
    dispatch({ type: "SET_LINKS", links: generateDemoLinks(demoAgents) });
    dispatch({ type: "SET_CONNECTED", connected: true });

    // Seed some activity events
    const seedEvents: OfficeActivityEvent[] = demoAgents
      .filter(a => a.status !== "idle" && a.status !== "offline")
      .map(a => ({
        timestamp: Date.now() - Math.floor(Math.random() * 600_000),
        agentId: a.id,
        agentName: a.name,
        type: a.status === "error" ? "error" as const : "status_change" as const,
        description: `${a.name} is ${a.status}`,
      }));
    dispatch({ type: "SET_ACTIVITY_FEED", events: seedEvents.sort((a, b) => b.timestamp - a.timestamp) });

    // Rotate demo state every 4s
    const interval = setInterval(() => {
      dispatch({ type: "SET_AGENTS", agents: rotateDemoState(Array.from(state.agents.values()).length > 0 ? Array.from(state.agents.values()) : generateDemoState()) });
    }, 4000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.demoMode]);

  return (
    <OfficeContext.Provider value={{ state, dispatch }}>
      {children}
    </OfficeContext.Provider>
  );
}
