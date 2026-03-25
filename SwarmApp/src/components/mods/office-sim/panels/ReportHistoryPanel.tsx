/** ReportHistoryPanel — Completed task reports grouped by project
 *
 * Adapted from Claw-Empire's ReportHistory.
 * Shows completed task reports with project grouping,
 * agent avatars, pagination, and detail drill-down.
 */
"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  BarChart3, X, ChevronLeft, ChevronRight, FileText, Clock,
  User, CheckCircle, Folder, ArrowLeft,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useOffice } from "../office-store";
import type { Locale } from "../i18n";

/* ═══════════════════════════════════════
   Types
   ═══════════════════════════════════════ */

export interface TaskReportSummary {
  id: string;
  title: string;
  description: string | null;
  departmentId: string | null;
  assignedAgentId: string | null;
  status: string;
  projectId: string | null;
  projectPath: string | null;
  projectName: string | null;
  agentName: string | null;
  agentRole: string | null;
  deptName: string | null;
  createdAt: number;
  completedAt: number | null;
}

export interface TaskReportDetail {
  id: string;
  title: string;
  description: string | null;
  result: string | null;
  agentName: string | null;
  deptName: string | null;
  projectName: string | null;
  createdAt: number;
  completedAt: number | null;
  /** Planning lead's consolidated summary */
  planningSummary: string | null;
  /** Team section reports */
  teamReports: TaskReportTeamSection[];
  /** Attached documents */
  documents: TaskReportDocument[];
  /** Progress log entries */
  progressLog: string[];
}

export interface TaskReportTeamSection {
  departmentName: string;
  agentName: string;
  role: string;
  summary: string;
}

export interface TaskReportDocument {
  title: string;
  content: string;
  type: "markdown" | "code" | "text";
}

/* ═══════════════════════════════════════
   i18n
   ═══════════════════════════════════════ */

const LABELS = {
  en: {
    title: "Report History",
    empty: "No completed reports",
    emptyDesc: "Completed task reports will appear here.",
    loading: "Loading...",
    total: (n: number) => `${n} reports`,
    prev: "Prev",
    next: "Next",
    close: "Close",
    back: "Back to list",
    planningSummary: "Planning Summary",
    teamReports: "Team Reports",
    documents: "Documents",
    progressLog: "Progress Log",
  },
  ko: {
    title: "보고서 이력",
    empty: "완료된 보고서 없음",
    emptyDesc: "완료된 작업 보고서가 여기에 표시됩니다.",
    loading: "로딩 중...",
    total: (n: number) => `총 ${n}건`,
    prev: "이전",
    next: "다음",
    close: "닫기",
    back: "목록으로",
    planningSummary: "계획 요약",
    teamReports: "팀 보고서",
    documents: "문서",
    progressLog: "진행 로그",
  },
  ja: {
    title: "レポート履歴",
    empty: "完了レポートなし",
    emptyDesc: "完了したタスクレポートがここに表示されます。",
    loading: "読み込み中...",
    total: (n: number) => `全${n}件`,
    prev: "前へ",
    next: "次へ",
    close: "閉じる",
    back: "一覧に戻る",
    planningSummary: "計画サマリー",
    teamReports: "チームレポート",
    documents: "ドキュメント",
    progressLog: "進捗ログ",
  },
  zh: {
    title: "报告历史",
    empty: "没有已完成的报告",
    emptyDesc: "已完成的任务报告将显示在这里。",
    loading: "加载中...",
    total: (n: number) => `共${n}条`,
    prev: "上一页",
    next: "下一页",
    close: "关闭",
    back: "返回列表",
    planningSummary: "规划摘要",
    teamReports: "团队报告",
    documents: "文档",
    progressLog: "进度日志",
  },
} as const;

/* ═══════════════════════════════════════
   Helpers
   ═══════════════════════════════════════ */

const PAGE_SIZE = 5;
const GROUP_ITEMS_PER_PAGE = 3;

function fmtDate(ts: number | null | undefined): string {
  if (!ts) return "-";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function projectNameFromSummary(report: TaskReportSummary): string {
  if (report.projectName?.trim()) return report.projectName.trim();
  if (!report.projectPath) return "General";
  const trimmed = report.projectPath.replace(/[\\/]+$/, "");
  const seg = trimmed.split(/[\\/]/).pop();
  return seg || "General";
}

/* ═══════════════════════════════════════
   Component
   ═══════════════════════════════════════ */

interface ReportHistoryPanelProps {
  reports: TaskReportSummary[];
  loading?: boolean;
  onLoadDetail?: (taskId: string) => Promise<TaskReportDetail>;
  onClose: () => void;
}

export function ReportHistoryPanel({
  reports,
  loading = false,
  onLoadDetail,
  onClose,
}: ReportHistoryPanelProps) {
  const { state } = useOffice();
  const locale = state.locale;
  const t = LABELS[locale] ?? LABELS.en;

  const [page, setPage] = useState(0);
  const [groupPages, setGroupPages] = useState<Record<string, number>>({});
  const [detail, setDetail] = useState<TaskReportDetail | null>(null);
  const [docPage, setDocPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(reports.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(page, 0), totalPages - 1);
  const pageStart = currentPage * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, reports.length);
  const pageReports = reports.slice(pageStart, pageEnd);

  const groupedPageReports = useMemo(() => {
    const groups = new Map<string, TaskReportSummary[]>();
    for (const report of pageReports) {
      const key = projectNameFromSummary(report);
      const bucket = groups.get(key) ?? [];
      bucket.push(report);
      groups.set(key, bucket);
    }
    return [...groups.entries()];
  }, [pageReports]);

  useEffect(() => { setPage(0); setGroupPages({}); }, [reports]);
  useEffect(() => { setGroupPages({}); }, [page]);

  const handleGroupPage = useCallback((key: string, next: number, total: number) => {
    setGroupPages((prev) => ({ ...prev, [key]: Math.min(Math.max(next, 0), total - 1) }));
  }, []);

  const handleOpenDetail = useCallback(async (taskId: string) => {
    if (!onLoadDetail) return;
    try {
      const d = await onLoadDetail(taskId);
      setDetail(d);
      setDocPage(0);
    } catch (e) {
      console.error("Failed to load report detail:", e);
    }
  }, [onLoadDetail]);

  /* ─── Detail View ─── */
  if (detail) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <div
          className="relative mx-4 w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-700/50 bg-slate-900 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700/50 bg-slate-900 px-6 py-4">
            <button
              onClick={() => setDetail(null)}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"
            >
              <ArrowLeft className="h-4 w-4" />
              {t.back}
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Title */}
            <div>
              <h3 className="text-lg font-bold text-white">{detail.title}</h3>
              <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                {detail.agentName && <span>{detail.agentName}</span>}
                {detail.deptName && <span className="rounded bg-slate-700/80 px-1.5 py-0.5">{detail.deptName}</span>}
                <span>{fmtDate(detail.completedAt)}</span>
              </div>
            </div>

            {/* Result */}
            {detail.result && (
              <div className="rounded-lg bg-slate-800/60 p-4 text-sm text-slate-300 whitespace-pre-wrap">
                {detail.result}
              </div>
            )}

            {/* Planning Summary */}
            {detail.planningSummary && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2">{t.planningSummary}</h4>
                <div className="rounded-lg bg-emerald-900/20 border border-emerald-500/20 p-4 text-sm text-slate-300">
                  {detail.planningSummary}
                </div>
              </div>
            )}

            {/* Team Reports */}
            {detail.teamReports.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2">{t.teamReports}</h4>
                <div className="space-y-2">
                  {detail.teamReports.map((tr, i) => (
                    <div key={i} className="rounded-lg border border-slate-700/30 bg-slate-800/40 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-3 w-3 text-slate-500" />
                        <span className="text-xs font-medium text-white">{tr.agentName}</span>
                        <span className="rounded bg-slate-700/60 px-1 py-0.5 text-[9px] text-slate-400">{tr.role}</span>
                        <span className="text-[10px] text-slate-500">{tr.departmentName}</span>
                      </div>
                      <p className="text-xs text-slate-400">{tr.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Documents */}
            {detail.documents.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2">
                  {t.documents} ({docPage + 1}/{detail.documents.length})
                </h4>
                <div className="rounded-lg border border-slate-700/30 bg-slate-800/40 p-4">
                  <h5 className="text-sm font-medium text-white mb-2">{detail.documents[docPage].title}</h5>
                  <pre className="text-xs text-slate-400 whitespace-pre-wrap overflow-auto max-h-60">
                    {detail.documents[docPage].content}
                  </pre>
                </div>
                {detail.documents.length > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <button
                      onClick={() => setDocPage(Math.max(0, docPage - 1))}
                      disabled={docPage <= 0}
                      className="rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300 disabled:opacity-40"
                    >
                      {t.prev}
                    </button>
                    <button
                      onClick={() => setDocPage(Math.min(detail.documents.length - 1, docPage + 1))}
                      disabled={docPage >= detail.documents.length - 1}
                      className="rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300 disabled:opacity-40"
                    >
                      {t.next}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Progress Log */}
            {detail.progressLog.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2">{t.progressLog}</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {detail.progressLog.map((entry, i) => (
                    <p key={i} className="text-[10px] font-mono text-slate-500">{entry}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ─── List View ─── */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative mx-4 w-full max-w-2xl rounded-2xl border border-emerald-500/30 bg-slate-900 shadow-2xl shadow-emerald-500/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">{t.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-slate-500">{t.loading}</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="mb-2 h-8 w-8 text-slate-600" />
              <p className="text-sm text-slate-400">{t.empty}</p>
              <p className="mt-1 text-xs text-slate-500">{t.emptyDesc}</p>
            </div>
          ) : (
            <div className="space-y-4 px-4 py-3">
              {groupedPageReports.map(([projectName, rows]) => {
                const groupTotal = Math.max(1, Math.ceil(rows.length / GROUP_ITEMS_PER_PAGE));
                const groupCurrent = Math.min(Math.max(groupPages[projectName] ?? 0, 0), groupTotal - 1);
                const gStart = groupCurrent * GROUP_ITEMS_PER_PAGE;
                const gEnd = Math.min(gStart + GROUP_ITEMS_PER_PAGE, rows.length);
                const visibleRows = rows.slice(gStart, gEnd);

                return (
                  <div key={projectName} className="overflow-hidden rounded-xl border border-slate-700/50">
                    <div className="flex items-center justify-between bg-slate-800/70 px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Folder className="h-3 w-3 text-emerald-400" />
                        <p className="truncate text-xs font-semibold uppercase tracking-wider text-emerald-300">
                          {projectName}
                        </p>
                      </div>
                      <span className="text-[11px] text-slate-500">{rows.length}</span>
                    </div>
                    <div className="divide-y divide-slate-700/30">
                      {visibleRows.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => handleOpenDetail(r.id)}
                          disabled={!onLoadDetail}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-800/50 disabled:cursor-default"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700/50 text-sm">
                            <User className="h-4 w-4 text-slate-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-white">{r.title}</p>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                              {r.deptName && (
                                <span className="rounded bg-slate-700/80 px-1.5 py-0.5">{r.deptName}</span>
                              )}
                              {r.agentName && <span>{r.agentName}</span>}
                              <span className="text-slate-600">&middot;</span>
                              <span>{fmtDate(r.completedAt)}</span>
                            </div>
                          </div>
                          <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
                        </button>
                      ))}
                    </div>
                    {groupTotal > 1 && (
                      <div className="flex items-center justify-between border-t border-slate-700/40 bg-slate-900/40 px-3 py-2">
                        <span className="text-[11px] text-slate-500">
                          {gStart + 1}-{gEnd} / {rows.length}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleGroupPage(projectName, groupCurrent - 1, groupTotal)}
                            disabled={groupCurrent <= 0}
                            className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 disabled:opacity-40"
                          >
                            {t.prev}
                          </button>
                          <span className="text-[11px] text-slate-400">{groupCurrent + 1}/{groupTotal}</span>
                          <button
                            onClick={() => handleGroupPage(projectName, groupCurrent + 1, groupTotal)}
                            disabled={groupCurrent >= groupTotal - 1}
                            className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 disabled:opacity-40"
                          >
                            {t.next}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700/50 px-6 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">{t.total(reports.length)}</span>
            <div className="flex items-center gap-3">
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage(currentPage - 1)}
                    disabled={currentPage <= 0}
                    className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 disabled:opacity-40"
                  >
                    {t.prev}
                  </button>
                  <span className="text-[11px] text-slate-400">{currentPage + 1}/{totalPages}</span>
                  <button
                    onClick={() => setPage(currentPage + 1)}
                    disabled={currentPage >= totalPages - 1}
                    className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 disabled:opacity-40"
                  >
                    {t.next}
                  </button>
                </div>
              )}
              <button
                onClick={onClose}
                className="rounded-lg bg-slate-700 px-4 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-slate-600"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
