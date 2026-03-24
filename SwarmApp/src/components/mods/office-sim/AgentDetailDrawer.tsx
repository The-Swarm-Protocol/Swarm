/** AgentDetailDrawer — Slide-in panel for inspecting a single agent */
"use client";

import { useEffect, useCallback, useState } from "react";
import {
  X,
  RotateCcw,
  Pause,
  Play,
  ExternalLink,
  Cpu,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOffice } from "./office-store";
import { STATUS_COLORS, STATUS_LABELS, STATUS_ICONS } from "./types";
import type { VisualAgent, OfficeActivityEvent } from "./types";
import { CharacterDesignDialog } from "./studio/CharacterDesignDialog";
import { GenerationProgress } from "./studio/GenerationProgress";
import { AvatarPreview } from "./studio/AvatarPreview";

function StatusDot({ status }: { status: string }) {
  const color =
    STATUS_COLORS[status as keyof typeof STATUS_COLORS] || "#6b7280";
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
      style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
    />
  );
}

export function AgentDetailDrawer({ orgId }: { orgId?: string }) {
  const { state, dispatch } = useOffice();
  const { selectedAgentId, activePanel } = state;
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const close = useCallback(
    () => dispatch({ type: "SELECT_AGENT", id: null }),
    [dispatch],
  );

  // Esc key closes drawer
  useEffect(() => {
    if (activePanel !== "agent-detail" || !selectedAgentId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activePanel, selectedAgentId, close]);

  if (activePanel !== "agent-detail" || !selectedAgentId) return null;

  const agent = state.agents.get(selectedAgentId);
  if (!agent) return null;

  const statusColor = STATUS_COLORS[agent.status];

  // Agent activity from feed
  const agentActivity = state.activityFeed
    .filter((e) => e.agentId === agent.id)
    .slice(0, 5);

  // Context-sensitive actions
  const showRetry = agent.status === "error";
  const showPause = agent.status === "active" || agent.status === "thinking" || agent.status === "tool_calling";
  const showResume = agent.status === "blocked";

  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      const endpoint =
        action === "retry"
          ? `/api/agents/${agent.id}/resume`
          : action === "pause"
            ? `/api/agents/${agent.id}/pause`
            : `/api/agents/${agent.id}/resume`;
      await fetch(endpoint, { method: "POST" });
    } catch {
      // Silently fail — polling will pick up actual state
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="fixed right-0 top-0 bottom-0 w-[400px] max-w-full z-50 bg-background/95 backdrop-blur-xl border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot status={agent.status} />
          <h2 className="font-semibold truncate">{agent.name}</h2>
          <Badge
            variant="outline"
            className="capitalize text-[10px] shrink-0"
            style={{ borderColor: statusColor + "40", color: statusColor }}
          >
            {STATUS_LABELS[agent.status]}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={close}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Status */}
        <Section title="Status">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">{STATUS_ICONS[agent.status]}</span>
            <span className="text-xs text-muted-foreground capitalize">
              Zone: {agent.zone.replace("_", " ")}
            </span>
          </div>
        </Section>

        {/* Current Task */}
        <Section title="Current Task">
          {agent.currentTask ? (
            <p className="text-sm">{agent.currentTask}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No active task</p>
          )}
        </Section>

        {/* Speech Bubble */}
        {agent.speechBubble && (
          <Section title="Current Output">
            <div className="bg-muted/30 rounded-md p-3 text-sm font-mono leading-relaxed border border-amber-500/10">
              {agent.speechBubble}
            </div>
          </Section>
        )}

        {/* Agent Info (enriched) */}
        <Section title="Agent Info">
          <DetailRow label="ID" value={agent.id} mono />
          {agent.agentType && (
            <DetailRow
              label="Type"
              value={agent.agentType}
              icon={<Cpu className="h-3 w-3 text-muted-foreground" />}
            />
          )}
          <DetailRow label="Model" value={agent.model || "\u2014"} mono />
          {agent.asn && <DetailRow label="ASN" value={agent.asn} mono />}
          {agent.bio && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground italic">
                {agent.bio}
              </p>
            </div>
          )}
        </Section>

        {/* Capabilities */}
        {agent.capabilities.length > 0 && (
          <Section title="Capabilities">
            <div className="flex flex-wrap gap-1.5">
              {agent.capabilities.map((cap) => (
                <Badge
                  key={cap}
                  variant="outline"
                  className="text-[10px] font-mono"
                >
                  {cap}
                </Badge>
              ))}
            </div>
          </Section>
        )}

        {/* Stats */}
        <Section title="Stats">
          <DetailRow label="Tool Calls" value={String(agent.toolCallCount)} />
          <DetailRow label="Last Active" value={formatTime(agent.lastActiveAt)} />
          {agent.parentAgentId && (
            <DetailRow label="Parent" value={agent.parentAgentId} mono />
          )}
          {agent.childAgentIds.length > 0 && (
            <DetailRow
              label="Sub-agents"
              value={String(agent.childAgentIds.length)}
            />
          )}
        </Section>

        {/* Character — Avatar preview + generation progress */}
        <Section title="Character">
          {(agent.modelUrl || agent.spriteUrl) && (
            <AvatarPreview
              modelUrl={agent.modelUrl}
              spriteUrl={agent.spriteUrl}
            />
          )}
          {activeTaskId && (
            <div className="mt-2">
              <GenerationProgress taskId={activeTaskId} />
            </div>
          )}
          {!activeTaskId && !(agent.modelUrl || agent.spriteUrl) && (
            <p className="text-xs text-muted-foreground">No custom avatar</p>
          )}
        </Section>

        {/* Recent Activity */}
        {agentActivity.length > 0 && (
          <Section title="Recent Activity">
            <div className="space-y-1.5">
              {agentActivity.map((event, i) => (
                <ActivityItem
                  key={`${event.timestamp}-${i}`}
                  event={event}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Actions */}
        <Section title="Actions">
          <div className="flex flex-wrap gap-2">
            {showRetry && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={actionLoading === "retry"}
                onClick={() => handleAction("retry")}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                {actionLoading === "retry" ? "Retrying..." : "Retry"}
              </Button>
            )}
            {showPause && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={actionLoading === "pause"}
                onClick={() => handleAction("pause")}
              >
                <Pause className="h-3 w-3 mr-1" />
                {actionLoading === "pause" ? "Pausing..." : "Pause"}
              </Button>
            )}
            {showResume && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={actionLoading === "resume"}
                onClick={() => handleAction("resume")}
              >
                <Play className="h-3 w-3 mr-1" />
                {actionLoading === "resume" ? "Resuming..." : "Resume"}
              </Button>
            )}
            {orgId && (
              <CharacterDesignDialog
                agent={agent}
                orgId={orgId}
                onSubmitted={(taskId) => setActiveTaskId(taskId)}
              />
            )}
            <Link href={`/agents`}>
              <Button variant="outline" size="sm" className="text-xs">
                <ExternalLink className="h-3 w-3 mr-1" />
                View Logs
              </Button>
            </Link>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-medium">
        {title}
      </h3>
      {children}
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
  icon,
}: {
  label: string;
  value: string;
  mono?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </span>
      <span
        className={`text-xs ${mono ? "font-mono" : ""} truncate max-w-[200px]`}
      >
        {value}
      </span>
    </div>
  );
}

function ActivityItem({ event }: { event: OfficeActivityEvent }) {
  const timeStr = formatTime(event.timestamp);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
      <span className="text-muted-foreground truncate flex-1">
        {event.description}
      </span>
      <span className="text-muted-foreground/50 shrink-0">{timeStr}</span>
    </div>
  );
}

function formatTime(ts: number): string {
  if (!ts) return "\u2014";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}
