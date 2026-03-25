/** TaskBoardPanel — Kanban-style task board
 *
 * Adapted from Claw-Empire's TaskBoard with 8 status columns.
 * Designed for CEO oversight of agent task pipeline.
 */
"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Inbox, ListTodo, Users, Play, Eye, CheckCircle2, Pause, XCircle,
  Plus, Search, Filter, Trash2, SquareTerminal, FileText, GitMerge,
  StopCircle, RotateCcw, EyeOff,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useOffice } from "../office-store";
import type { Locale } from "../i18n";

/* ═══════════════════════════════════════
   Types
   ═══════════════════════════════════════ */

export type TaskStatus =
  | "inbox"
  | "planned"
  | "collaborating"
  | "in_progress"
  | "review"
  | "done"
  | "pending"
  | "cancelled";

export type TaskType =
  | "general"
  | "development"
  | "design"
  | "analysis"
  | "presentation"
  | "documentation";

export type TaskPriority = 1 | 2 | 3 | 4 | 5;

export interface BoardTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  taskType: TaskType;
  departmentId: string | null;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  projectId: string | null;
  projectPath: string | null;
  result: string | null;
  subtaskTotal: number;
  subtaskDone: number;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  hidden: boolean;
}

export interface SubTask {
  id: string;
  taskId: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "done" | "blocked";
  assignedAgentId: string | null;
  blockedReason: string | null;
  createdAt: number;
  completedAt: number | null;
}

/* ═══════════════════════════════════════
   Column Config
   ═══════════════════════════════════════ */

interface ColumnDef {
  status: TaskStatus;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const COLUMNS: ColumnDef[] = [
  { status: "inbox", label: "Inbox", icon: <Inbox className="h-3.5 w-3.5" />, color: "text-slate-400", bgColor: "bg-slate-800/60" },
  { status: "planned", label: "Planned", icon: <ListTodo className="h-3.5 w-3.5" />, color: "text-blue-400", bgColor: "bg-blue-900/20" },
  { status: "collaborating", label: "Collab", icon: <Users className="h-3.5 w-3.5" />, color: "text-purple-400", bgColor: "bg-purple-900/20" },
  { status: "in_progress", label: "In Progress", icon: <Play className="h-3.5 w-3.5" />, color: "text-cyan-400", bgColor: "bg-cyan-900/20" },
  { status: "review", label: "Review", icon: <Eye className="h-3.5 w-3.5" />, color: "text-amber-400", bgColor: "bg-amber-900/20" },
  { status: "done", label: "Done", icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "text-emerald-400", bgColor: "bg-emerald-900/20" },
  { status: "pending", label: "Pending", icon: <Pause className="h-3.5 w-3.5" />, color: "text-orange-400", bgColor: "bg-orange-900/20" },
  { status: "cancelled", label: "Cancelled", icon: <XCircle className="h-3.5 w-3.5" />, color: "text-red-400", bgColor: "bg-red-900/20" },
];

const HIDEABLE_STATUSES = new Set<TaskStatus>(["done", "pending", "cancelled"]);

/* ═══════════════════════════════════════
   Helpers
   ═══════════════════════════════════════ */

function priorityIcon(p: TaskPriority): string {
  switch (p) {
    case 5: return "!!!";
    case 4: return "!!";
    case 3: return "!";
    default: return "";
  }
}

function priorityColor(p: TaskPriority): string {
  if (p >= 4) return "text-red-400";
  if (p === 3) return "text-amber-400";
  return "text-slate-500";
}

function taskTypeLabel(tt: TaskType): string {
  switch (tt) {
    case "development": return "Dev";
    case "design": return "Design";
    case "analysis": return "Analysis";
    case "presentation": return "Pres";
    case "documentation": return "Docs";
    default: return "General";
  }
}

function fmtDate(ts: number | null): string {
  if (!ts) return "-";
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ═══════════════════════════════════════
   Component
   ═══════════════════════════════════════ */

interface TaskBoardPanelProps {
  tasks: BoardTask[];
  subtasks?: SubTask[];
  onCreateTask?: (input: { title: string; description?: string; taskType?: TaskType; priority?: TaskPriority }) => void;
  onUpdateTask?: (id: string, patch: Partial<BoardTask>) => void;
  onDeleteTask?: (id: string) => void;
  onRunTask?: (id: string) => void;
  onStopTask?: (id: string) => void;
  onPauseTask?: (id: string) => void;
  onResumeTask?: (id: string) => void;
  onOpenTerminal?: (taskId: string) => void;
  onOpenMeetingMinutes?: (taskId: string) => void;
  onMergeTask?: (id: string) => void;
  onDiscardTask?: (id: string) => void;
  onClose: () => void;
}

export function TaskBoardPanel({
  tasks,
  subtasks = [],
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onRunTask,
  onStopTask,
  onPauseTask,
  onResumeTask,
  onOpenTerminal,
  onOpenMeetingMinutes,
  onMergeTask,
  onDiscardTask,
  onClose,
}: TaskBoardPanelProps) {
  const { state } = useOffice();
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterAgent, setFilterAgent] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Create task form state
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<TaskType>("general");
  const [newPriority, setNewPriority] = useState<TaskPriority>(3);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!showHidden && task.hidden) return false;
      if (filterDept && task.departmentId !== filterDept) return false;
      if (filterAgent && task.assignedAgentId !== filterAgent) return false;
      if (search && !task.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tasks, search, filterDept, filterAgent, showHidden]);

  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, BoardTask[]> = {};
    for (const col of COLUMNS) {
      grouped[col.status] = filteredTasks
        .filter((t) => t.status === col.status)
        .sort((a, b) => b.priority - a.priority || b.createdAt - a.createdAt);
    }
    return grouped;
  }, [filteredTasks]);

  const subtasksByTask = useMemo(() => {
    const grouped: Record<string, SubTask[]> = {};
    for (const st of subtasks) {
      if (!grouped[st.taskId]) grouped[st.taskId] = [];
      grouped[st.taskId].push(st);
    }
    return grouped;
  }, [subtasks]);

  const handleCreate = useCallback(() => {
    if (!newTitle.trim() || !onCreateTask) return;
    onCreateTask({
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      taskType: newType,
      priority: newPriority,
    });
    setNewTitle("");
    setNewDesc("");
    setNewType("general");
    setNewPriority(3);
    setShowCreate(false);
  }, [newTitle, newDesc, newType, newPriority, onCreateTask]);

  const hiddenCount = tasks.filter((t) => t.hidden && HIDEABLE_STATUSES.has(t.status)).length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-slate-700/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <ListTodo className="h-5 w-5 text-cyan-400" />
          <h2 className="text-lg font-bold text-white">Task Board</h2>
          <span className="text-xs text-slate-500">{filteredTasks.length} tasks</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="w-48 rounded-md border border-slate-700 bg-slate-800 py-1.5 pl-7 pr-3 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500/40"
            />
          </div>
          {/* Hidden toggle */}
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowHidden(!showHidden)}
              className={`flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs transition ${
                showHidden
                  ? "border-amber-500/30 text-amber-300"
                  : "border-slate-700 text-slate-400 hover:text-slate-300"
              }`}
            >
              <EyeOff className="h-3 w-3" />
              {hiddenCount}
            </button>
          )}
          {/* Create */}
          {onCreateTask && (
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-1 rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-cyan-500"
            >
              <Plus className="h-3.5 w-3.5" />
              New Task
            </button>
          )}
          {/* Close */}
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="border-b border-slate-700/50 bg-slate-900/80 px-4 py-3">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-[10px] text-slate-500 mb-1">Title</label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Task title..."
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/40"
              />
            </div>
            <div className="w-48">
              <label className="block text-[10px] text-slate-500 mb-1">Description</label>
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Optional..."
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/40"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as TaskType)}
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-300"
              >
                <option value="general">General</option>
                <option value="development">Dev</option>
                <option value="design">Design</option>
                <option value="analysis">Analysis</option>
                <option value="documentation">Docs</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">Priority</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(Number(e.target.value) as TaskPriority)}
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-300"
              >
                <option value={1}>Low</option>
                <option value={2}>Normal</option>
                <option value={3}>Medium</option>
                <option value={4}>High</option>
                <option value={5}>Critical</option>
              </select>
            </div>
            <button
              onClick={handleCreate}
              disabled={!newTitle.trim()}
              className="rounded-md bg-cyan-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-cyan-500 disabled:opacity-40"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Kanban columns */}
      <div className="flex flex-1 gap-3 overflow-x-auto p-3">
        {COLUMNS.map((col) => {
          const colTasks = tasksByStatus[col.status] ?? [];
          return (
            <div
              key={col.status}
              className={`flex w-56 min-w-[14rem] flex-shrink-0 flex-col rounded-xl border border-slate-700/30 ${col.bgColor}`}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/20">
                <div className={`flex items-center gap-1.5 ${col.color}`}>
                  {col.icon}
                  <span className="text-xs font-semibold">{col.label}</span>
                </div>
                <span className="rounded-full bg-slate-700/50 px-1.5 py-0.5 text-[10px] text-slate-400">
                  {colTasks.length}
                </span>
              </div>

              {/* Column content */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    subtasks={subtasksByTask[task.id]}
                    onRun={onRunTask}
                    onStop={onStopTask}
                    onPause={onPauseTask}
                    onResume={onResumeTask}
                    onDelete={onDeleteTask}
                    onHide={onUpdateTask ? (id) => onUpdateTask(id, { hidden: true }) : undefined}
                    onUnhide={onUpdateTask ? (id) => onUpdateTask(id, { hidden: false }) : undefined}
                    onOpenTerminal={onOpenTerminal}
                    onOpenMeetingMinutes={onOpenMeetingMinutes}
                    onMerge={onMergeTask}
                    onDiscard={onDiscardTask}
                  />
                ))}
                {colTasks.length === 0 && (
                  <div className="py-8 text-center text-[10px] text-slate-600">Empty</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   Task Card
   ═══════════════════════════════════════ */

interface TaskCardProps {
  task: BoardTask;
  subtasks?: SubTask[];
  onRun?: (id: string) => void;
  onStop?: (id: string) => void;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onDelete?: (id: string) => void;
  onHide?: (id: string) => void;
  onUnhide?: (id: string) => void;
  onOpenTerminal?: (id: string) => void;
  onOpenMeetingMinutes?: (id: string) => void;
  onMerge?: (id: string) => void;
  onDiscard?: (id: string) => void;
}

function TaskCard({
  task,
  subtasks,
  onRun,
  onStop,
  onPause,
  onResume,
  onDelete,
  onHide,
  onUnhide,
  onOpenTerminal,
  onOpenMeetingMinutes,
  onMerge,
  onDiscard,
}: TaskCardProps) {
  const hasSubtasks = task.subtaskTotal > 0;
  const subtaskProgress = hasSubtasks ? task.subtaskDone / task.subtaskTotal : 0;

  return (
    <div
      className={`rounded-lg border border-slate-700/30 bg-slate-900/60 p-2.5 transition hover:border-slate-600/50 ${
        task.hidden ? "opacity-50" : ""
      }`}
    >
      {/* Priority + type badges */}
      <div className="flex items-center gap-1.5 mb-1">
        {task.priority >= 3 && (
          <span className={`text-[10px] font-bold ${priorityColor(task.priority)}`}>
            {priorityIcon(task.priority)}
          </span>
        )}
        <span className="rounded bg-slate-700/60 px-1 py-0.5 text-[9px] text-slate-400">
          {taskTypeLabel(task.taskType)}
        </span>
      </div>

      {/* Title */}
      <p className="text-xs font-medium text-white truncate mb-1">{task.title}</p>

      {/* Agent assignment */}
      {task.assignedAgentName && (
        <p className="text-[10px] text-slate-500 truncate mb-1">
          {task.assignedAgentName}
        </p>
      )}

      {/* Subtask progress */}
      {hasSubtasks && (
        <div className="mb-1.5">
          <div className="flex justify-between text-[9px] text-slate-500 mb-0.5">
            <span>Subtasks</span>
            <span>{task.subtaskDone}/{task.subtaskTotal}</span>
          </div>
          <div className="h-1 w-full rounded-full bg-slate-700/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-cyan-500 transition-all"
              style={{ width: `${subtaskProgress * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Date */}
      <p className="text-[9px] text-slate-600 mb-1.5">{fmtDate(task.createdAt)}</p>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-wrap">
        {task.status === "inbox" && onRun && (
          <ActionBtn icon={<Play className="h-2.5 w-2.5" />} label="Run" onClick={() => onRun(task.id)} color="text-emerald-400" />
        )}
        {task.status === "in_progress" && onStop && (
          <ActionBtn icon={<StopCircle className="h-2.5 w-2.5" />} label="Stop" onClick={() => onStop(task.id)} color="text-red-400" />
        )}
        {task.status === "in_progress" && onPause && (
          <ActionBtn icon={<Pause className="h-2.5 w-2.5" />} label="Pause" onClick={() => onPause(task.id)} color="text-amber-400" />
        )}
        {task.status === "pending" && onResume && (
          <ActionBtn icon={<RotateCcw className="h-2.5 w-2.5" />} label="Resume" onClick={() => onResume(task.id)} color="text-cyan-400" />
        )}
        {onOpenTerminal && (task.status === "in_progress" || task.status === "review") && (
          <ActionBtn icon={<SquareTerminal className="h-2.5 w-2.5" />} label="Term" onClick={() => onOpenTerminal(task.id)} color="text-slate-400" />
        )}
        {onOpenMeetingMinutes && task.status === "review" && (
          <ActionBtn icon={<FileText className="h-2.5 w-2.5" />} label="Minutes" onClick={() => onOpenMeetingMinutes(task.id)} color="text-slate-400" />
        )}
        {onMerge && task.status === "review" && (
          <ActionBtn icon={<GitMerge className="h-2.5 w-2.5" />} label="Merge" onClick={() => onMerge(task.id)} color="text-emerald-400" />
        )}
        {task.hidden && onUnhide ? (
          <ActionBtn icon={<Eye className="h-2.5 w-2.5" />} label="Show" onClick={() => onUnhide(task.id)} color="text-slate-400" />
        ) : !task.hidden && onHide && HIDEABLE_STATUSES.has(task.status) ? (
          <ActionBtn icon={<EyeOff className="h-2.5 w-2.5" />} label="Hide" onClick={() => onHide(task.id)} color="text-slate-500" />
        ) : null}
        {onDelete && (
          <ActionBtn icon={<Trash2 className="h-2.5 w-2.5" />} label="Del" onClick={() => onDelete(task.id)} color="text-red-400/60" />
        )}
      </div>
    </div>
  );
}

function ActionBtn({
  icon,
  label,
  onClick,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] ${color} transition hover:bg-slate-700/50`}
    >
      {icon}
    </button>
  );
}
