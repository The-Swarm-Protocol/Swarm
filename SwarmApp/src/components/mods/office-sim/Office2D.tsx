/** Office2D — Isometric 2D floor plan with agent desks, rooms, speech bubbles, and filter dimming */
"use client";

import { useState, useRef, useCallback } from "react";
import { useOffice, getFilteredAgents } from "./office-store";
import { STATUS_COLORS, STATUS_ICONS } from "./types";
import type { VisualAgent, DeskSlot, RoomConfig, AgentVisualStatus } from "./types";

export function Office2D() {
  const { state, dispatch } = useOffice();
  const { agents, layout, collaborationLinks, selectedAgentId } = state;
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);

  const agentList = Array.from(agents.values());
  const filteredIds = getFilteredAgents(state);
  const canvasW = layout.canvasWidth;
  const canvasH = layout.canvasHeight;

  const selectAgent = useCallback((id: string | null) => {
    dispatch({ type: "SELECT_AGENT", id });
  }, [dispatch]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.5, Math.min(2, z - e.deltaY * 0.001)));
  }, []);

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-border bg-card" onWheel={handleWheel}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${canvasW} ${canvasH}`}
        className="w-full h-auto"
        style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
      >
        {/* Background */}
        <defs>
          <pattern id="office-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(217, 33%, 14%)" strokeWidth="0.5" />
          </pattern>
          {/* Speech bubble filter for glow */}
          <filter id="bubble-shadow">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.5" />
          </filter>
        </defs>
        <rect width={canvasW} height={canvasH} fill="hsl(222, 84%, 5%)" />
        <rect width={canvasW} height={canvasH} fill="url(#office-grid)" />

        {/* Rooms */}
        {layout.rooms.map((room) => (
          <RoomSvg key={room.id} room={room} />
        ))}

        {/* Collaboration lines */}
        {collaborationLinks.map((link, i) => {
          const source = agents.get(link.sourceId);
          const target = agents.get(link.targetId);
          if (!source || !target) return null;
          return (
            <line
              key={i}
              x1={source.position.x + 40}
              y1={source.position.y + 30}
              x2={target.position.x + 40}
              y2={target.position.y + 30}
              stroke="#3b82f6"
              strokeWidth={1 + link.strength * 2}
              strokeDasharray="6 4"
              opacity={0.4 + link.strength * 0.4}
            />
          );
        })}

        {/* Desks */}
        {layout.desks.map((desk, i) => {
          const agent = agentList[i];
          const dimmed = agent ? !filteredIds.has(agent.id) : false;
          return (
            <DeskSvg
              key={desk.id}
              desk={desk}
              agent={agent || null}
              selected={agent?.id === selectedAgentId}
              hovered={agent?.id === hoveredAgent}
              dimmed={dimmed}
              onHover={(id) => setHoveredAgent(id)}
              onSelect={(id) => selectAgent(id)}
            />
          );
        })}

        {/* Queue zone */}
        <g transform={`translate(30, ${canvasH - 90})`}>
          <rect width="200" height="50" rx="4" fill="hsl(217, 33%, 10%)" stroke="hsl(217, 33%, 18%)" strokeWidth="1" />
          <text x="100" y="18" textAnchor="middle" fill="hsl(215, 20%, 55%)" fontSize="9" fontWeight="500">
            QUEUE / INBOX
          </text>
          <text x="100" y="36" textAnchor="middle" fill="hsl(215, 20%, 45%)" fontSize="11">
            {agentList.filter(a => !a.currentTask && a.status !== "offline").length} idle
          </text>
        </g>
      </svg>

      {/* Hover tooltip */}
      {hoveredAgent && agents.get(hoveredAgent) && (
        <AgentTooltip agent={agents.get(hoveredAgent)!} />
      )}
    </div>
  );
}

function RoomSvg({ room }: { room: RoomConfig }) {
  const colors: Record<string, { bg: string; border: string }> = {
    meeting: { bg: "rgba(59, 130, 246, 0.06)", border: "rgba(59, 130, 246, 0.2)" },
    break: { bg: "rgba(34, 197, 94, 0.04)", border: "rgba(34, 197, 94, 0.15)" },
    server: { bg: "rgba(6, 182, 212, 0.04)", border: "rgba(6, 182, 212, 0.15)" },
    error_bay: { bg: "rgba(239, 68, 68, 0.06)", border: "rgba(239, 68, 68, 0.2)" },
  };
  const c = colors[room.type] || colors.meeting;

  return (
    <g>
      <rect
        x={room.position.x}
        y={room.position.y}
        width={room.width}
        height={room.height}
        rx="4"
        fill={c.bg}
        stroke={c.border}
        strokeWidth="1"
        strokeDasharray={room.type === "error_bay" ? "4 3" : "none"}
      />
      <text
        x={room.position.x + room.width / 2}
        y={room.position.y + 16}
        textAnchor="middle"
        fill="hsl(215, 20%, 50%)"
        fontSize="9"
        fontWeight="500"
      >
        {room.label.toUpperCase()}
      </text>
    </g>
  );
}

function DeskSvg({
  desk,
  agent,
  selected,
  hovered,
  dimmed,
  onHover,
  onSelect,
}: {
  desk: DeskSlot;
  agent: VisualAgent | null;
  selected: boolean;
  hovered: boolean;
  dimmed: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}) {
  const { x, y } = desk.position;
  const statusColor = agent ? STATUS_COLORS[agent.status] : "#374151";
  const icon = agent ? STATUS_ICONS[agent.status] : "";

  return (
    <g
      className="cursor-pointer"
      opacity={dimmed ? 0.2 : 1}
      onMouseEnter={() => agent && onHover(agent.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => agent && !dimmed && onSelect(agent.id)}
    >
      {/* Desk surface */}
      <rect
        x={x}
        y={y}
        width={80}
        height={56}
        rx="4"
        fill={selected ? "rgba(251, 191, 36, 0.08)" : hovered ? "rgba(255, 255, 255, 0.04)" : "hsl(222, 50%, 8%)"}
        stroke={selected ? "#fbbf24" : hovered ? "hsl(217, 33%, 25%)" : "hsl(217, 33%, 15%)"}
        strokeWidth={selected ? 2 : 1}
      />

      {/* Monitor */}
      <rect x={x + 25} y={y + 6} width={30} height={20} rx="2" fill="hsl(222, 50%, 12%)" stroke="hsl(217, 33%, 22%)" strokeWidth="0.5" />

      {/* Status ring */}
      {agent && (
        <circle
          cx={x + 40}
          cy={y + 42}
          r={8}
          fill="none"
          stroke={statusColor}
          strokeWidth={selected ? 2.5 : 1.5}
          opacity={agent.status === "offline" ? 0.3 : 0.8}
        >
          {(agent.status === "active" || agent.status === "thinking") && (
            <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
          )}
          {agent.status === "error" && (
            <animate attributeName="r" values="8;10;8" dur="1s" repeatCount="indefinite" />
          )}
        </circle>
      )}

      {/* Agent avatar indicator */}
      {agent && agent.status !== "offline" && (
        agent.spriteUrl ? (
          <image
            href={agent.spriteUrl}
            x={x + 24}
            y={y + 26}
            width={32}
            height={32}
            style={{ imageRendering: "pixelated" }}
          />
        ) : (
          <text x={x + 40} y={y + 46} textAnchor="middle" fontSize="10">
            {icon}
          </text>
        )
      )}

      {/* Name label */}
      <text
        x={x + 40}
        y={y + 56 + 12}
        textAnchor="middle"
        fill={agent ? "hsl(210, 40%, 85%)" : "hsl(215, 20%, 35%)"}
        fontSize="8"
        fontWeight={agent ? "500" : "400"}
      >
        {agent ? truncate(agent.name, 12) : "Empty"}
      </text>

      {/* Speech bubble */}
      {agent?.speechBubble && !dimmed && (
        <SpeechBubbleSvg x={x + 40} y={y - 8} text={agent.speechBubble} />
      )}
    </g>
  );
}

function SpeechBubbleSvg({ x, y, text }: { x: number; y: number; text: string }) {
  const maxW = 120;
  const truncated = text.length > 30 ? text.slice(0, 27) + "..." : text;
  const w = Math.min(maxW, truncated.length * 5.5 + 16);
  const h = 22;
  const bx = x - w / 2;
  const by = y - h;

  return (
    <g filter="url(#bubble-shadow)">
      {/* Bubble rect */}
      <rect
        x={bx}
        y={by}
        width={w}
        height={h}
        rx="4"
        fill="hsl(222, 50%, 12%)"
        stroke="hsl(48, 100%, 50%)"
        strokeWidth="0.5"
        opacity="0.95"
      >
        <animate attributeName="opacity" values="0;0.95" dur="0.3s" fill="freeze" />
      </rect>
      {/* Tail */}
      <polygon
        points={`${x - 4},${y - 1} ${x},${y + 5} ${x + 4},${y - 1}`}
        fill="hsl(222, 50%, 12%)"
        stroke="hsl(48, 100%, 50%)"
        strokeWidth="0.5"
      />
      {/* Cover tail join */}
      <line x1={x - 5} y1={y - 1} x2={x + 5} y2={y - 1} stroke="hsl(222, 50%, 12%)" strokeWidth="1.5" />
      {/* Text */}
      <text
        x={x}
        y={by + h / 2 + 3.5}
        textAnchor="middle"
        fill="hsl(48, 100%, 85%)"
        fontSize="7"
        fontWeight="500"
      >
        {truncated}
      </text>
    </g>
  );
}

function AgentTooltip({ agent }: { agent: VisualAgent }) {
  const color = STATUS_COLORS[agent.status];
  return (
    <div className="absolute top-2 left-2 bg-popover/95 backdrop-blur border border-border rounded-md p-3 shadow-lg z-20 max-w-[240px] pointer-events-none">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-medium">{agent.name}</span>
      </div>
      <div className="text-xs text-muted-foreground space-y-0.5">
        <p>Status: <span className="capitalize" style={{ color }}>{agent.status}</span></p>
        {agent.currentTask && <p>Task: {truncate(agent.currentTask, 40)}</p>}
        {agent.speechBubble && <p>Says: &quot;{truncate(agent.speechBubble, 40)}&quot;</p>}
        {agent.model && <p>Model: {agent.model}</p>}
        {agent.agentType && <p>Type: {agent.agentType}</p>}
        <p>Zone: {agent.zone.replace("_", " ")}</p>
      </div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "..." : s;
}
