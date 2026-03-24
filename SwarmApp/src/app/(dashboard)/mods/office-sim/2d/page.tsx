/** Office Sim — 2D Command Center View */
"use client";

import { useEffect, useCallback, useRef } from "react";
import { useOffice } from "@/components/mods/office-sim/office-store";
import { useOrg } from "@/contexts/OrgContext";
import { Office2D } from "@/components/mods/office-sim/Office2D";
import { AgentDetailDrawer } from "@/components/mods/office-sim/AgentDetailDrawer";
import { OfficeToolbar } from "@/components/mods/office-sim/OfficeToolbar";

export default function Office2DPage() {
  const { state, dispatch } = useOffice();
  const { currentOrg } = useOrg();
  const { activeCount, errorCount } = state.metrics;
  const searchRef = useRef<HTMLInputElement | null>(null);

  /* ── Keyboard navigation ── */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const agents = Array.from(state.agents.values());
      if (agents.length === 0) return;

      // Don't capture when typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;

      switch (e.key) {
        case "Tab": {
          e.preventDefault();
          const currentIdx = agents.findIndex(
            (a) => a.id === state.selectedAgentId,
          );
          const next = e.shiftKey
            ? (currentIdx - 1 + agents.length) % agents.length
            : (currentIdx + 1) % agents.length;
          dispatch({ type: "SELECT_AGENT", id: agents[next].id });
          break;
        }
        case "Escape":
          dispatch({ type: "SELECT_AGENT", id: null });
          break;
        case "/":
          e.preventDefault();
          // Focus the search input in toolbar
          const input = document.querySelector<HTMLInputElement>(
            'input[placeholder="Search agents..."]',
          );
          input?.focus();
          break;
        default:
          break;
      }
    },
    [state.agents, state.selectedAgentId, dispatch],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="space-y-3">
      {/* Shared Toolbar */}
      <OfficeToolbar view="2d" />

      {/* Floor plan */}
      <Office2D />

      {/* Status bar */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
        <span>{activeCount} active</span>
        <span className="text-border">|</span>
        <span>{errorCount} errors</span>
        <span className="text-border">|</span>
        <span>{state.metrics.taskCount} tasks</span>
        <span className="text-border">|</span>
        <span
          className={
            state.connected ? "text-green-400" : "text-red-400"
          }
        >
          {state.connected ? "connected" : "disconnected"}
        </span>
        <span className="ml-auto text-muted-foreground/50 text-[10px]">
          Tab: cycle agents &middot; Esc: close &middot; /: search
        </span>
      </div>

      {/* Agent Detail Drawer */}
      <AgentDetailDrawer orgId={currentOrg?.id} />
    </div>
  );
}
