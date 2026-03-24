/**
 * useHubStream — React hook for consuming the hub SSE stream.
 *
 * Connects to /api/v1/mods/office-sim/hub-stream via EventSource,
 * dispatches UPDATE_AGENT and activity events to the office store.
 * Falls back to polling if SSE fails 3 times consecutively.
 */
"use client";

import { useEffect, useRef, useCallback } from "react";
import type { OfficeAction } from "@/components/mods/office-sim/office-store";
import { mapAgentStatus } from "@/components/mods/office-sim/office-store";
import { getZoneForStatus } from "@/components/mods/office-sim/engine/perception";

interface UseHubStreamOptions {
  orgId: string | undefined;
  enabled: boolean;
  dispatch: React.Dispatch<OfficeAction>;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onFallback?: () => void;
}

export function useHubStream({
  orgId,
  enabled,
  dispatch,
  onConnected,
  onDisconnected,
  onFallback,
}: UseHubStreamOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const failCountRef = useRef(0);
  const fallbackRef = useRef(false);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !orgId || fallbackRef.current) return;

    cleanup();

    const url = `/api/v1/mods/office-sim/hub-stream?orgId=${encodeURIComponent(orgId)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener("status", (e) => {
      try {
        const data = JSON.parse(e.data);
        dispatch({ type: "SET_HUB_CONNECTED", hubConnected: data.hubConnected });
        if (data.hubConnected) {
          dispatch({ type: "SET_CONNECTED", connected: true });
        }
      } catch {
        // Ignore parse errors
      }
    });

    es.addEventListener("snapshot", (e) => {
      try {
        const agents = JSON.parse(e.data) as Record<
          string,
          { online: boolean; name?: string }
        >;
        for (const [agentId, info] of Object.entries(agents)) {
          const status = info.online ? "active" : "offline";
          dispatch({
            type: "UPDATE_AGENT",
            id: agentId,
            patch: {
              status: mapAgentStatus(info.online ? "online" : "offline"),
              zone: getZoneForStatus(mapAgentStatus(info.online ? "online" : "offline")),
              name: info.name || agentId,
            },
          });
        }
      } catch {
        // Ignore
      }
    });

    es.addEventListener("agent", (e) => {
      try {
        const event = JSON.parse(e.data) as {
          type: string;
          agentId: string;
          agentName?: string;
          data?: Record<string, unknown>;
          ts: number;
        };

        if (event.type === "agent:online") {
          const visualStatus = mapAgentStatus("online");
          dispatch({
            type: "UPDATE_AGENT",
            id: event.agentId,
            patch: {
              status: visualStatus,
              zone: getZoneForStatus(visualStatus),
              lastActiveAt: event.ts,
              name: event.agentName || event.agentId,
            },
          });
          dispatch({
            type: "PUSH_ACTIVITY",
            event: {
              timestamp: event.ts,
              agentId: event.agentId,
              agentName: event.agentName || event.agentId,
              type: "spawn",
              description: `${event.agentName || event.agentId} came online`,
            },
          });
        } else if (event.type === "agent:offline") {
          const visualStatus = mapAgentStatus("offline");
          dispatch({
            type: "UPDATE_AGENT",
            id: event.agentId,
            patch: {
              status: visualStatus,
              zone: getZoneForStatus(visualStatus),
            },
          });
          dispatch({
            type: "PUSH_ACTIVITY",
            event: {
              timestamp: event.ts,
              agentId: event.agentId,
              agentName: event.agentName || event.agentId,
              type: "despawn",
              description: `${event.agentName || event.agentId} went offline`,
            },
          });
        } else if (event.type === "agent:typing") {
          dispatch({
            type: "UPDATE_AGENT",
            id: event.agentId,
            patch: {
              status: "thinking",
              zone: "desk",
              speechBubble: "...",
              lastActiveAt: event.ts,
            },
          });
        } else if (event.type === "agent:message") {
          const messageText =
            (event.data?.content as string) ||
            (event.data?.body as string) ||
            "Sent a message";
          dispatch({
            type: "UPDATE_AGENT",
            id: event.agentId,
            patch: {
              status: "speaking",
              speechBubble: messageText.slice(0, 80),
              lastActiveAt: event.ts,
            },
          });
          dispatch({
            type: "PUSH_ACTIVITY",
            event: {
              timestamp: event.ts,
              agentId: event.agentId,
              agentName: event.agentName || event.agentId,
              type: "status_change",
              description: `${event.agentName || event.agentId}: ${messageText.slice(0, 100)}`,
            },
          });
        } else if (event.type === "agent:task") {
          const taskType = event.data?.type as string;
          const taskDesc =
            (event.data?.taskName as string) ||
            (event.data?.description as string) ||
            "Task update";

          if (taskType === "task:assign") {
            dispatch({
              type: "UPDATE_AGENT",
              id: event.agentId,
              patch: {
                status: "active",
                zone: "desk",
                currentTask: taskDesc.slice(0, 80),
                speechBubble: "New task received",
                lastActiveAt: event.ts,
              },
            });
            dispatch({
              type: "PUSH_ACTIVITY",
              event: {
                timestamp: event.ts,
                agentId: event.agentId,
                agentName: event.agentName || event.agentId,
                type: "task_start",
                description: `${event.agentName || event.agentId} started: ${taskDesc.slice(0, 80)}`,
              },
            });
          } else if (taskType === "task:complete") {
            dispatch({
              type: "UPDATE_AGENT",
              id: event.agentId,
              patch: {
                currentTask: null,
                speechBubble: "Task completed",
                lastActiveAt: event.ts,
              },
            });
            dispatch({
              type: "PUSH_ACTIVITY",
              event: {
                timestamp: event.ts,
                agentId: event.agentId,
                agentName: event.agentName || event.agentId,
                type: "task_complete",
                description: `${event.agentName || event.agentId} completed: ${taskDesc.slice(0, 80)}`,
              },
            });
          }
        } else if (event.type === "agent:status") {
          const rawStatus = event.data?.status as string;
          if (rawStatus) {
            const visualStatus = mapAgentStatus(rawStatus);
            dispatch({
              type: "UPDATE_AGENT",
              id: event.agentId,
              patch: {
                status: visualStatus,
                zone: getZoneForStatus(visualStatus),
                lastActiveAt: event.ts,
                currentTask: (event.data?.task as string) || null,
              },
            });
          }
        }
      } catch {
        // Ignore parse errors
      }
    });

    es.onopen = () => {
      failCountRef.current = 0;
      onConnected?.();
    };

    es.onerror = () => {
      failCountRef.current++;
      if (failCountRef.current >= 3) {
        cleanup();
        fallbackRef.current = true;
        onFallback?.();
        onDisconnected?.();
      }
    };

    return cleanup;
  }, [orgId, enabled, dispatch, cleanup, onConnected, onDisconnected, onFallback]);

  // Reset fallback when org changes
  useEffect(() => {
    fallbackRef.current = false;
  }, [orgId]);

  return {
    isStreaming: !!eventSourceRef.current && !fallbackRef.current,
    isFallback: fallbackRef.current,
    disconnect: cleanup,
  };
}
