/** DecisionInboxPanel — CEO decision routing modal
 *
 * Adapted from Claw-Empire's DecisionInboxModal.
 * Three decision kinds:
 *   - project_review_ready: Project has tasks ready for review
 *   - task_timeout_resume: A task timed out and needs CEO action
 *   - review_round_pick: Multi-round review with cherry-pick remediation
 */
"use client";

import { useState, useMemo, useCallback } from "react";
import { Inbox, CheckCircle, Clock, RotateCcw, X, Send, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useOffice } from "../office-store";
import type { Locale } from "../i18n";

/* ═══════════════════════════════════════
   Types
   ═══════════════════════════════════════ */

export type DecisionKind =
  | "project_review_ready"
  | "task_timeout_resume"
  | "review_round_pick";

export interface DecisionOption {
  number: number;
  action: string;
  label: string;
}

export interface DecisionInboxItem {
  id: string;
  kind: DecisionKind;
  title: string;
  description: string;
  agentId?: string;
  agentName?: string;
  projectId?: string;
  taskId?: string;
  meetingId?: string;
  reviewRound?: number;
  options: DecisionOption[];
  createdAt: number;
  /** Planning lead's consolidated summary, if available */
  planningSummary?: string;
  /** Revision notes for review_round_pick */
  revisionNotes?: string[];
}

export interface DecisionReply {
  itemId: string;
  selectedOption: number;
  action: string;
  followUpNote?: string;
  /** For review_round_pick: cherry-picked note indices */
  cherryPickIndices?: number[];
}

/* ═══════════════════════════════════════
   i18n
   ═══════════════════════════════════════ */

const LABELS = {
  en: {
    title: "CEO Decision Inbox",
    empty: "No pending decisions",
    emptyDesc: "All caught up! Decisions will appear here when agents need CEO input.",
    projectReview: "Project Review Ready",
    taskTimeout: "Task Timeout",
    reviewRound: "Review Round",
    followUp: "Add follow-up note (optional)...",
    submit: "Submit Decision",
    submitting: "Submitting...",
    selectNotes: "Select remediation notes:",
    extraNote: "Additional note (optional)...",
  },
  ko: {
    title: "CEO 결정 수신함",
    empty: "대기 중인 결정 없음",
    emptyDesc: "모두 처리됨! 에이전트가 CEO 입력이 필요할 때 여기에 결정이 나타납니다.",
    projectReview: "프로젝트 검토 준비",
    taskTimeout: "작업 시간 초과",
    reviewRound: "검토 라운드",
    followUp: "후속 메모 추가 (선택사항)...",
    submit: "결정 제출",
    submitting: "제출 중...",
    selectNotes: "수정 메모 선택:",
    extraNote: "추가 메모 (선택사항)...",
  },
  ja: {
    title: "CEO 決定受信箱",
    empty: "保留中の決定はありません",
    emptyDesc: "すべて処理済み！エージェントがCEOの入力を必要とすると、ここに決定が表示されます。",
    projectReview: "プロジェクトレビュー準備完了",
    taskTimeout: "タスクタイムアウト",
    reviewRound: "レビューラウンド",
    followUp: "フォローアップメモを追加（任意）...",
    submit: "決定を送信",
    submitting: "送信中...",
    selectNotes: "修正メモを選択:",
    extraNote: "追加メモ（任意）...",
  },
  zh: {
    title: "CEO 决策收件箱",
    empty: "没有待处理的决策",
    emptyDesc: "全部处理完毕！当代理需要CEO输入时，决策将出现在这里。",
    projectReview: "项目审查就绪",
    taskTimeout: "任务超时",
    reviewRound: "审查轮次",
    followUp: "添加后续备注（可选）...",
    submit: "提交决策",
    submitting: "提交中...",
    selectNotes: "选择修正备注：",
    extraNote: "附加备注（可选）...",
  },
} as const;

/* ═══════════════════════════════════════
   Helpers
   ═══════════════════════════════════════ */

function kindIcon(kind: DecisionKind) {
  switch (kind) {
    case "project_review_ready":
      return <CheckCircle className="h-4 w-4 text-emerald-400" />;
    case "task_timeout_resume":
      return <Clock className="h-4 w-4 text-amber-400" />;
    case "review_round_pick":
      return <RotateCcw className="h-4 w-4 text-blue-400" />;
  }
}

function kindColor(kind: DecisionKind): string {
  switch (kind) {
    case "project_review_ready":
      return "border-emerald-500/30";
    case "task_timeout_resume":
      return "border-amber-500/30";
    case "review_round_pick":
      return "border-blue-500/30";
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ═══════════════════════════════════════
   Component
   ═══════════════════════════════════════ */

interface DecisionInboxPanelProps {
  items: DecisionInboxItem[];
  onReply: (reply: DecisionReply) => Promise<void>;
  onClose: () => void;
}

export function DecisionInboxPanel({ items, onReply, onClose }: DecisionInboxPanelProps) {
  const { state } = useOffice();
  const locale = state.locale;
  const t = LABELS[locale] ?? LABELS.en;

  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, number | null>>({});
  const [followUpNotes, setFollowUpNotes] = useState<Record<string, string>>({});
  const [cherryPicks, setCherryPicks] = useState<Record<string, Set<number>>>({});

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => b.createdAt - a.createdAt),
    [items],
  );

  const handleSelectOption = useCallback((itemId: string, optionNumber: number) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [itemId]: prev[itemId] === optionNumber ? null : optionNumber,
    }));
  }, []);

  const handleToggleCherryPick = useCallback((itemId: string, noteIndex: number) => {
    setCherryPicks((prev) => {
      const existing = new Set(prev[itemId] ?? []);
      if (existing.has(noteIndex)) existing.delete(noteIndex);
      else existing.add(noteIndex);
      return { ...prev, [itemId]: existing };
    });
  }, []);

  const handleSubmit = useCallback(async (item: DecisionInboxItem) => {
    const selected = selectedOptions[item.id];
    if (selected == null) return;

    const option = item.options.find((o) => o.number === selected);
    if (!option) return;

    setBusyItemId(item.id);
    try {
      await onReply({
        itemId: item.id,
        selectedOption: selected,
        action: option.action,
        followUpNote: followUpNotes[item.id] || undefined,
        cherryPickIndices: item.kind === "review_round_pick"
          ? Array.from(cherryPicks[item.id] ?? [])
          : undefined,
      });
      // Clear state for this item after success
      setSelectedOptions((prev) => { const n = { ...prev }; delete n[item.id]; return n; });
      setFollowUpNotes((prev) => { const n = { ...prev }; delete n[item.id]; return n; });
      setCherryPicks((prev) => { const n = { ...prev }; delete n[item.id]; return n; });
    } finally {
      setBusyItemId(null);
    }
  }, [selectedOptions, followUpNotes, cherryPicks, onReply]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative mx-4 w-full max-w-2xl rounded-2xl border border-slate-700/50 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <Inbox className="h-5 w-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-white">{t.title}</h2>
            {sortedItems.length > 0 && (
              <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-medium text-cyan-300">
                {sortedItems.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[70vh] overflow-y-auto p-4 space-y-3">
          {sortedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="mb-3 h-8 w-8 text-emerald-400/40" />
              <p className="text-sm font-medium text-slate-400">{t.empty}</p>
              <p className="mt-1 text-xs text-slate-500">{t.emptyDesc}</p>
            </div>
          ) : (
            sortedItems.map((item) => {
              const selected = selectedOptions[item.id] ?? null;
              const isBusy = busyItemId === item.id;

              return (
                <Card key={item.id} className={`border ${kindColor(item.kind)} bg-slate-800/50`}>
                  <CardContent className="p-4">
                    {/* Item header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {kindIcon(item.kind)}
                        <span className="text-xs font-medium text-slate-400">
                          {item.kind === "project_review_ready" ? t.projectReview
                            : item.kind === "task_timeout_resume" ? t.taskTimeout
                            : `${t.reviewRound} #${item.reviewRound ?? 1}`}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">{formatTime(item.createdAt)}</span>
                    </div>

                    {/* Title & description */}
                    <h4 className="text-sm font-semibold text-white mb-1">{item.title}</h4>
                    <p className="text-xs text-slate-400 mb-3">{item.description}</p>

                    {/* Planning summary */}
                    {item.planningSummary && (
                      <div className="mb-3 rounded-lg bg-slate-900/60 p-3 text-xs text-slate-300 border border-slate-700/30">
                        <span className="text-[10px] font-semibold uppercase text-slate-500 block mb-1">
                          Planning Summary
                        </span>
                        {item.planningSummary}
                      </div>
                    )}

                    {/* Revision notes (for review_round_pick) */}
                    {item.kind === "review_round_pick" && item.revisionNotes && item.revisionNotes.length > 0 && (
                      <div className="mb-3">
                        <span className="text-[10px] font-semibold uppercase text-slate-500 block mb-1.5">
                          {t.selectNotes}
                        </span>
                        <div className="space-y-1.5">
                          {item.revisionNotes.map((note, idx) => {
                            const picked = cherryPicks[item.id]?.has(idx) ?? false;
                            return (
                              <button
                                key={idx}
                                onClick={() => handleToggleCherryPick(item.id, idx)}
                                className={`w-full text-left rounded-md px-3 py-1.5 text-xs transition border ${
                                  picked
                                    ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
                                    : "border-slate-700/30 bg-slate-900/40 text-slate-400 hover:border-slate-600"
                                }`}
                              >
                                <span className="mr-2">{picked ? "+" : "-"}</span>
                                {note}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Options */}
                    <div className="space-y-1.5 mb-3">
                      {item.options.map((opt) => (
                        <button
                          key={opt.number}
                          onClick={() => handleSelectOption(item.id, opt.number)}
                          disabled={isBusy}
                          className={`w-full text-left rounded-lg px-3 py-2 text-xs transition border ${
                            selected === opt.number
                              ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                              : "border-slate-700/30 bg-slate-900/40 text-slate-300 hover:border-slate-600"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          <span className="font-mono mr-2 text-slate-500">{opt.number}.</span>
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {/* Follow-up textarea */}
                    <textarea
                      placeholder={t.followUp}
                      value={followUpNotes[item.id] ?? ""}
                      onChange={(e) =>
                        setFollowUpNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      className="w-full rounded-md border border-slate-700/30 bg-slate-900/60 p-2 text-xs text-slate-300 placeholder-slate-500 resize-none focus:outline-none focus:border-cyan-500/40"
                      rows={2}
                    />

                    {/* Submit */}
                    <button
                      onClick={() => handleSubmit(item)}
                      disabled={selected == null || isBusy}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isBusy ? (
                        <>{t.submitting}</>
                      ) : (
                        <>
                          <Send className="h-3 w-3" />
                          {t.submit}
                        </>
                      )}
                    </button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
