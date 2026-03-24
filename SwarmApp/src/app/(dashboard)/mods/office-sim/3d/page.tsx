/** Office Sim — 3D Immersive View */
"use client";

import dynamic from "next/dynamic";
import { useOffice } from "@/components/mods/office-sim/office-store";
import { useOrg } from "@/contexts/OrgContext";
import { AgentDetailDrawer } from "@/components/mods/office-sim/AgentDetailDrawer";
import { OfficeToolbar } from "@/components/mods/office-sim/OfficeToolbar";
import { Button } from "@/components/ui/button";
import type { CameraMode } from "@/components/mods/office-sim/types";

const Office3D = dynamic(
  () =>
    import("@/components/mods/office-sim/Office3D").then((m) => ({
      default: m.Office3D,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-video rounded-lg border border-border bg-card flex items-center justify-center">
        <p className="text-sm text-muted-foreground animate-pulse">
          Loading 3D scene...
        </p>
      </div>
    ),
  },
);

const CAMERA_MODES: { mode: CameraMode; label: string }[] = [
  { mode: "orbit", label: "Orbit" },
  { mode: "follow", label: "Follow" },
  { mode: "cinematic", label: "Cinematic" },
];

export default function Office3DPage() {
  const { state, dispatch } = useOffice();
  const { currentOrg } = useOrg();
  const selectedAgent = state.selectedAgentId
    ? state.agents.get(state.selectedAgentId)
    : null;

  return (
    <div className="space-y-3">
      {/* Shared Toolbar */}
      <OfficeToolbar view="3d" />

      {/* 3D Scene */}
      <Office3D />

      {/* Bottom HUD */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-2">
          {/* Camera mode selector */}
          <span className="text-muted-foreground/60">Camera:</span>
          <div className="flex items-center gap-1">
            {CAMERA_MODES.map(({ mode, label }) => (
              <Button
                key={mode}
                variant={state.cameraMode === mode ? "default" : "ghost"}
                size="sm"
                className={`h-6 px-2 text-[10px] ${
                  state.cameraMode === mode
                    ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                    : ""
                }`}
                onClick={() =>
                  dispatch({ type: "SET_CAMERA_MODE", mode })
                }
              >
                {label}
              </Button>
            ))}
          </div>
          {state.cameraMode === "follow" && selectedAgent && (
            <span className="text-amber-400/80 ml-2">
              Following: {selectedAgent.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span>Click agent to inspect</span>
          <span className="text-border">|</span>
          <span
            className={
              state.connected ? "text-green-400" : "text-red-400"
            }
          >
            {state.connected ? "connected" : "disconnected"}
          </span>
        </div>
      </div>

      {/* Agent Detail Drawer */}
      <AgentDetailDrawer orgId={currentOrg?.id} />
    </div>
  );
}
