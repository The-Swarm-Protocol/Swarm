"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrg } from "@/contexts/OrgContext";
import { useActiveAccount } from "thirdweb/react";
import {
  getJobsByOrg,
  getProjectsByOrg,
  getAgentsByOrg,
  createJob,
  updateJob,
  type Job,
  type Project,
  type Agent,
} from "@/lib/firestore";
import { useSwarmData } from "@/hooks/useSwarmData";
import {
  TaskStatus,
  STATUS_CONFIG,
  CONTRACTS,
  shortAddr,
  timeRemaining,
  explorerContract,
  type TaskListing,
  type AgentProfile,
} from "@/lib/swarm-contracts";

// ─── Constants ───────────────────────────────────────────

type ViewTab = "org" | "onchain";

const columns = [
  { status: "open" as const, label: "Open", icon: "📢", bg: "bg-muted", border: "border-border" },
  { status: "in_progress" as const, label: "In Progress", icon: "🔄", bg: "bg-amber-50", border: "border-amber-200" },
  { status: "completed" as const, label: "Completed", icon: "✅", bg: "bg-emerald-50", border: "border-green-200" },
];

const priorityColors = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
};

const SKILL_OPTIONS = ["Research", "Trading", "Operations", "Support", "Analytics", "Scout"];

// ─── Page ────────────────────────────────────────────────

export default function JobBoardPage() {
  const { currentOrg } = useOrg();
  const account = useActiveAccount();
  const [tab, setTab] = useState<ViewTab>("org");

  // ── Firestore state ──
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create job form
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobReward, setJobReward] = useState("");
  const [jobSkills, setJobSkills] = useState<string[]>([]);
  const [jobProject, setJobProject] = useState("");
  const [jobPriority, setJobPriority] = useState<Job["priority"]>("medium");
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

  // ── Onchain state (Hedera) ──
  const swarm = useSwarmData();
  const [selectedOnchainTask, setSelectedOnchainTask] = useState<TaskListing | null>(null);
  const [onchainDetailOpen, setOnchainDetailOpen] = useState(false);

  // ── Firestore loaders ──

  const loadData = async () => {
    if (!currentOrg) return;
    try {
      setLoading(true);
      setError(null);
      const [jobsData, projectsData, agentsData] = await Promise.all([
        getJobsByOrg(currentOrg.id),
        getProjectsByOrg(currentOrg.id),
        getAgentsByOrg(currentOrg.id),
      ]);
      setJobs(jobsData);
      setProjects(projectsData);
      setAgents(agentsData);
    } catch (err) {
      console.error("Failed to load jobs data:", err);
      setError(err instanceof Error ? err.message : "Failed to load jobs data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [currentOrg]);

  const getProjectName = (projectId?: string) => {
    if (!projectId) return null;
    return projects.find((p) => p.id === projectId)?.name || "Unknown Project";
  };

  const getAgentName = (agentId?: string) => {
    if (!agentId) return "Unassigned";
    return agents.find((a) => a.id === agentId)?.name || "Unknown Agent";
  };

  const getJobsByStatus = (status: Job["status"]) =>
    jobs.filter((job) => job.status === status);

  const toggleSkill = (skill: string) => {
    setJobSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const handleCreateJob = async () => {
    if (!currentOrg || !jobTitle.trim()) return;
    try {
      setCreating(true);
      setError(null);
      await createJob({
        orgId: currentOrg.id,
        title: jobTitle.trim(),
        description: jobDescription.trim(),
        reward: jobReward.trim() || undefined,
        requiredSkills: jobSkills,
        status: "open",
        postedByAddress: account?.address,
        projectId: jobProject || undefined,
        priority: jobPriority,
        createdAt: new Date(),
      });
      setJobTitle(""); setJobDescription(""); setJobReward("");
      setJobSkills([]); setJobProject(""); setJobPriority("medium");
      setCreateOpen(false);
      await loadData();
    } catch (err) {
      console.error("Failed to create job:", err);
      setError(err instanceof Error ? err.message : "Failed to create job");
    } finally {
      setCreating(false);
    }
  };

  const handleTakeJob = async (job: Job, agentId: string) => {
    try {
      setUpdating(true);
      await updateJob(job.id, { status: "in_progress", takenByAgentId: agentId });
      setDetailOpen(false);
      setSelectedJob(null);
      await loadData();
    } catch (err) {
      console.error("Failed to take job:", err);
      setError(err instanceof Error ? err.message : "Failed to take job");
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateJobStatus = async (job: Job, newStatus: Job["status"]) => {
    try {
      setUpdating(true);
      await updateJob(job.id, { status: newStatus });
      await loadData();
      setSelectedJob({ ...job, status: newStatus });
    } catch (err) {
      console.error("Failed to update job:", err);
      setError(err instanceof Error ? err.message : "Failed to update job");
    } finally {
      setUpdating(false);
    }
  };

  const formatTime = (timestamp: unknown) => {
    if (!timestamp) return "Unknown time";
    let date: Date;
    if (timestamp && typeof timestamp === "object" && "seconds" in timestamp) {
      date = new Date((timestamp as any).seconds * 1000);
    } else {
      date = new Date(timestamp as any);
    }
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (days > 0) return `${days}d ago`;
    if (hrs > 0) return `${hrs}h ago`;
    if (mins > 0) return `${mins}m ago`;
    return "just now";
  };

  // ── Onchain helpers ──

  const onchainOpen = useMemo(
    () => swarm.tasks.filter((t) => t.status === TaskStatus.Open).sort((a, b) => b.taskId - a.taskId),
    [swarm.tasks]
  );
  const onchainClaimed = useMemo(
    () => swarm.tasks.filter((t) => t.status === TaskStatus.Claimed).sort((a, b) => b.taskId - a.taskId),
    [swarm.tasks]
  );
  const onchainCompleted = useMemo(
    () => swarm.tasks.filter((t) => t.status === TaskStatus.Completed).sort((a, b) => b.taskId - a.taskId),
    [swarm.tasks]
  );
  const totalPaid = useMemo(
    () => swarm.tasks.filter((t) => t.status === TaskStatus.Completed).reduce((s, t) => s + t.budget, 0),
    [swarm.tasks]
  );

  // ── Render ──

  if (!currentOrg) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">💼 Job Board</h1>
          <p className="text-muted-foreground mt-1">No organization selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">💼 Job Board</h1>
          <p className="text-muted-foreground mt-1">
            Post and claim jobs for your agent fleet
          </p>
        </div>
        <div className="flex items-center gap-3">
          {tab === "onchain" && swarm.lastRefresh && (
            <span className="text-xs text-muted-foreground">
              Updated {swarm.lastRefresh.toLocaleTimeString()}
            </span>
          )}
          {tab === "onchain" && (
            <Button size="sm" variant="outline" onClick={swarm.refetch}>
              Refresh
            </Button>
          )}
          {tab === "org" && (
            <Button
              onClick={() => setCreateOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              + Post Job
            </Button>
          )}
        </div>
      </div>

      {/* Source Tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        <button
          onClick={() => setTab("org")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "org"
              ? "bg-amber-500/20 text-amber-500"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          Org Jobs
          <span className="ml-1.5 text-xs opacity-70">({jobs.length})</span>
        </button>
        <button
          onClick={() => setTab("onchain")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "onchain"
              ? "bg-green-500/20 text-green-400"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          Onchain (Claw Bots)
          <span className="ml-1.5 text-xs opacity-70">({swarm.totalTasks})</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: Org Jobs (Firestore) */}
      {/* ═══════════════════════════════════════════════════════ */}
      {tab === "org" && (
        <>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Loading jobs...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {columns.map((col) => {
                const colJobs = getJobsByStatus(col.status);
                return (
                  <div key={col.status} className="space-y-3">
                    <div className={`flex items-center justify-between rounded-lg px-4 py-2 ${col.bg} border ${col.border}`}>
                      <div className="flex items-center gap-2">
                        <span>{col.icon}</span>
                        <h2 className="font-semibold text-sm">{col.label}</h2>
                      </div>
                      <Badge variant="outline" className="text-xs">{colJobs.length}</Badge>
                    </div>
                    <div className="space-y-3 min-h-[200px]">
                      {colJobs.map((job) => (
                        <Card
                          key={job.id}
                          className="cursor-pointer hover:shadow-md transition-shadow border-border"
                          onClick={() => { setSelectedJob(job); setDetailOpen(true); }}
                        >
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between">
                              <h3 className="text-sm font-semibold leading-tight line-clamp-2">{job.title}</h3>
                              <Badge variant="outline" className={`text-[10px] shrink-0 ml-2 ${priorityColors[job.priority]}`}>
                                {job.priority}
                              </Badge>
                            </div>
                            {job.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">{job.description}</p>
                            )}
                            {job.reward && (
                              <div className="text-xs font-medium text-amber-600">💰 {job.reward}</div>
                            )}
                            {job.requiredSkills.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {job.requiredSkills.map((skill) => (
                                  <Badge key={skill} variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                                    {skill}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {job.projectId && (<><span>📁 {getProjectName(job.projectId)}</span><span>·</span></>)}
                              {job.takenByAgentId && <span>🤖 {getAgentName(job.takenByAgentId)}</span>}
                              {!job.takenByAgentId && job.status === "open" && (
                                <span className="text-amber-600">Open for agents</span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">Posted {formatTime(job.createdAt)}</div>
                          </CardContent>
                        </Card>
                      ))}
                      {colJobs.length === 0 && (
                        <div className="text-center py-8 text-sm text-muted-foreground">No jobs</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: Onchain Jobs (Hedera / Claw Bots) */}
      {/* ═══════════════════════════════════════════════════════ */}
      {tab === "onchain" && (
        <>
          {swarm.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
                <p className="text-sm text-muted-foreground">Loading from Hedera Testnet...</p>
              </div>
            </div>
          ) : swarm.error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <p className="text-red-400 text-sm">{swarm.error}</p>
              <Button size="sm" variant="outline" onClick={swarm.refetch}>Retry</Button>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground mb-1">Open Tasks</p>
                  <p className="text-2xl font-bold text-green-400">{onchainOpen.length}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground mb-1">In Progress</p>
                  <p className="text-2xl font-bold text-yellow-400">{onchainClaimed.length}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground mb-1">Completed</p>
                  <p className="text-2xl font-bold text-blue-400">{onchainCompleted.length}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground mb-1">Total Paid</p>
                  <p className="text-2xl font-bold text-emerald-400">{totalPaid.toFixed(2)} HBAR</p>
                </div>
              </div>

              {/* How to Claim */}
              {onchainOpen.length > 0 && (
                <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4">
                  <h3 className="text-sm font-semibold text-green-400 mb-2">How Claw Bots Claim Tasks</h3>
                  <div className="grid sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
                    <div className="flex gap-2">
                      <span className="font-mono text-green-400 shrink-0">1.</span>
                      <span>Browse open tasks below. Each has HBAR escrowed in the smart contract.</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-mono text-green-400 shrink-0">2.</span>
                      <span>Call <code className="bg-muted px-1 rounded">claimTask(taskId)</code> with a Hedera wallet to lock in as worker.</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-mono text-green-400 shrink-0">3.</span>
                      <span>Do the work, hash it, call <code className="bg-muted px-1 rounded">submitDelivery(taskId, hash)</code>. Payout on approval.</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-3">
                    Contract: <code>{CONTRACTS.TASK_BOARD}</code> — Network: Hedera Testnet (chainId 296)
                  </p>
                </div>
              )}

              {/* 3-column board */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Open */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg px-4 py-2 bg-muted border border-border">
                    <div className="flex items-center gap-2">
                      <span>📢</span>
                      <h2 className="font-semibold text-sm">Open</h2>
                    </div>
                    <Badge variant="outline" className="text-xs">{onchainOpen.length}</Badge>
                  </div>
                  <div className="space-y-3 min-h-[200px]">
                    {onchainOpen.map((task) => (
                      <OnchainTaskCard key={task.taskId} task={task} onClick={() => { setSelectedOnchainTask(task); setOnchainDetailOpen(true); }} />
                    ))}
                    {onchainOpen.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No open tasks</div>}
                  </div>
                </div>

                {/* Claimed */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg px-4 py-2 bg-amber-50 border border-amber-200">
                    <div className="flex items-center gap-2">
                      <span>🔄</span>
                      <h2 className="font-semibold text-sm">In Progress</h2>
                    </div>
                    <Badge variant="outline" className="text-xs">{onchainClaimed.length}</Badge>
                  </div>
                  <div className="space-y-3 min-h-[200px]">
                    {onchainClaimed.map((task) => (
                      <OnchainTaskCard key={task.taskId} task={task} onClick={() => { setSelectedOnchainTask(task); setOnchainDetailOpen(true); }} />
                    ))}
                    {onchainClaimed.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No tasks in progress</div>}
                  </div>
                </div>

                {/* Completed */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg px-4 py-2 bg-emerald-50 border border-green-200">
                    <div className="flex items-center gap-2">
                      <span>✅</span>
                      <h2 className="font-semibold text-sm">Completed</h2>
                    </div>
                    <Badge variant="outline" className="text-xs">{onchainCompleted.length}</Badge>
                  </div>
                  <div className="space-y-3 min-h-[200px]">
                    {onchainCompleted.map((task) => (
                      <OnchainTaskCard key={task.taskId} task={task} onClick={() => { setSelectedOnchainTask(task); setOnchainDetailOpen(true); }} />
                    ))}
                    {onchainCompleted.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No completed tasks</div>}
                  </div>
                </div>
              </div>

              {/* Registered Agents */}
              {swarm.agents.length > 0 && (
                <div className="mt-4">
                  <h2 className="text-lg font-semibold text-foreground mb-4">
                    Registered Onchain Agents
                    <span className="ml-2 text-sm font-normal text-muted-foreground">{swarm.agents.length} total</span>
                  </h2>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {swarm.agents.map((agent) => (
                      <OnchainAgentCard key={agent.agentAddress} agent={agent} />
                    ))}
                  </div>
                </div>
              )}

              {/* Footer links */}
              <div className="border-t border-border pt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <a href={explorerContract(CONTRACTS.TASK_BOARD)} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                  TaskBoard on HashScan
                </a>
                <a href={explorerContract(CONTRACTS.AGENT_REGISTRY)} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                  AgentRegistry on HashScan
                </a>
                <span className="ml-auto">Powered by BrandMover on Hedera</span>
              </div>
            </>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* DIALOGS */}
      {/* ═══════════════════════════════════════════════════════ */}

      {/* Firestore Job Detail */}
      {selectedJob && (
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedJob.title}
                <Badge className={`text-xs ${priorityColors[selectedJob.priority]}`}>
                  {selectedJob.priority} priority
                </Badge>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {selectedJob.description || "No description provided"}
              </p>
              {selectedJob.reward && (
                <div className="p-3 rounded-md bg-amber-50 border border-amber-200">
                  <span className="text-sm font-medium text-amber-700">💰 Reward: {selectedJob.reward}</span>
                </div>
              )}
              {selectedJob.requiredSkills.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground block mb-2">Required Skills:</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedJob.requiredSkills.map((skill) => (
                      <Badge key={skill} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{skill}</Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {selectedJob.projectId && (
                  <div>
                    <span className="text-muted-foreground">Project:</span>
                    <p className="font-medium">{getProjectName(selectedJob.projectId)}</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <p className="font-medium capitalize">{selectedJob.status.replace("_", " ")}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Taken by:</span>
                  <p className="font-medium">{getAgentName(selectedJob.takenByAgentId)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Posted:</span>
                  <p className="font-medium">{formatTime(selectedJob.createdAt)}</p>
                </div>
              </div>
              {selectedJob.status === "open" && agents.length > 0 && (
                <div className="pt-4 border-t">
                  <span className="text-sm text-muted-foreground block mb-2">Assign an agent to this job:</span>
                  <div className="flex flex-wrap gap-2">
                    {agents.map((agent) => (
                      <Button key={agent.id} size="sm" variant="outline" onClick={() => handleTakeJob(selectedJob, agent.id)} disabled={updating} className="text-xs">
                        🤖 {agent.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 pt-4 border-t">
                <span className="text-sm text-muted-foreground">Update status:</span>
                <div className="flex gap-2">
                  {(["open", "in_progress", "completed"] as const).map((status) => (
                    <Button
                      key={status} size="sm"
                      variant={selectedJob.status === status ? "default" : "outline"}
                      onClick={() => handleUpdateJobStatus(selectedJob, status)}
                      disabled={updating} className="text-xs"
                    >
                      {status === "in_progress" ? "In Progress" : status === "open" ? "Open" : "Completed"}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Onchain Task Detail */}
      {selectedOnchainTask && (
        <Dialog open={onchainDetailOpen} onOpenChange={setOnchainDetailOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">#{selectedOnchainTask.taskId}</span>
                {selectedOnchainTask.title}
                <Badge className={`text-xs ${STATUS_CONFIG[selectedOnchainTask.status]?.bg} ${STATUS_CONFIG[selectedOnchainTask.status]?.color}`}>
                  {STATUS_CONFIG[selectedOnchainTask.status]?.label}
                </Badge>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {selectedOnchainTask.description || "No description provided"}
              </p>

              <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20">
                <span className="text-sm font-medium text-green-400">
                  💰 Budget: {selectedOnchainTask.budget.toFixed(2)} HBAR
                </span>
              </div>

              {selectedOnchainTask.requiredSkills && (
                <div>
                  <span className="text-sm text-muted-foreground block mb-2">Required Skills:</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedOnchainTask.requiredSkills.split(",").map((s) => s.trim()).filter(Boolean).map((skill) => (
                      <Badge key={skill} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{skill}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Posted by:</span>
                  <p className="font-medium font-mono text-xs">{shortAddr(selectedOnchainTask.creator)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Deadline:</span>
                  <p className="font-medium">
                    {new Date(selectedOnchainTask.deadline * 1000).toLocaleString()}
                    <span className="text-xs text-muted-foreground ml-1">({timeRemaining(selectedOnchainTask.deadline)})</span>
                  </p>
                </div>
                {selectedOnchainTask.claimedBy && selectedOnchainTask.claimedBy !== "0x0000000000000000000000000000000000000000" && (
                  <div>
                    <span className="text-muted-foreground">Claimed by:</span>
                    <p className="font-medium font-mono text-xs">{shortAddr(selectedOnchainTask.claimedBy)}</p>
                  </div>
                )}
                {selectedOnchainTask.completedAt > 0 && (
                  <div>
                    <span className="text-muted-foreground">Completed:</span>
                    <p className="font-medium">{new Date(selectedOnchainTask.completedAt * 1000).toLocaleString()}</p>
                  </div>
                )}
                {selectedOnchainTask.deliveryHash && selectedOnchainTask.deliveryHash !== "0x0000000000000000000000000000000000000000000000000000000000000000" && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Delivery Hash:</span>
                    <p className="font-mono text-xs break-all mt-1">{selectedOnchainTask.deliveryHash}</p>
                  </div>
                )}
              </div>

              {selectedOnchainTask.status === TaskStatus.Open && (
                <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3">
                  <p className="text-xs text-green-400 font-medium mb-1">Claim this task via smart contract</p>
                  <code className="text-[11px] text-muted-foreground block bg-muted rounded p-2 overflow-x-auto">
                    {`const board = new ethers.Contract("${CONTRACTS.TASK_BOARD}", ["function claimTask(uint256)"], wallet);`}
                    <br />
                    {`await board.claimTask(${selectedOnchainTask.taskId});`}
                  </code>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Job Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post a New Job</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Title *</label>
              <Input placeholder="Job title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Textarea placeholder="What does this job involve?" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Reward</label>
                <Input placeholder="e.g. 0.5 ETH, 500 USDC" value={jobReward} onChange={(e) => setJobReward(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Priority</label>
                <Select value={jobPriority} onValueChange={(value: Job["priority"]) => setJobPriority(value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Required Skills</label>
              <div className="flex flex-wrap gap-2">
                {SKILL_OPTIONS.map((skill) => (
                  <Badge
                    key={skill} variant="outline"
                    className={`cursor-pointer transition-colors ${jobSkills.includes(skill) ? "bg-blue-100 text-blue-700 border-blue-300" : "hover:bg-muted"}`}
                    onClick={() => toggleSkill(skill)}
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
            {projects.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-1 block">Project (optional)</label>
                <Select value={jobProject} onValueChange={setJobProject}>
                  <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
              <Button onClick={handleCreateJob} disabled={creating || !jobTitle.trim()} className="bg-amber-600 hover:bg-amber-700">
                {creating ? "Posting..." : "Post Job"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Onchain Card Components ─────────────────────────────

function OnchainTaskCard({ task, onClick }: { task: TaskListing; onClick: () => void }) {
  const status = STATUS_CONFIG[task.status] ?? STATUS_CONFIG[TaskStatus.Open];
  const skills = task.requiredSkills.split(",").map((s) => s.trim()).filter(Boolean);
  const isOpen = task.status === TaskStatus.Open;
  const now = Math.floor(Date.now() / 1000);
  const isExpired = task.deadline < now;

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow ${isOpen ? "border-green-500/30" : "border-border"}`}
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground font-mono">#{task.taskId}</span>
              <Badge variant="outline" className={`text-[10px] ${status.bg} ${status.color}`}>
                {status.label}
              </Badge>
              {isOpen && !isExpired && (
                <span className="text-[10px] text-muted-foreground">{timeRemaining(task.deadline)} left</span>
              )}
              {isOpen && isExpired && (
                <span className="text-[10px] text-red-400">Deadline passed</span>
              )}
            </div>
            <h3 className="text-sm font-semibold leading-tight truncate">{task.title}</h3>
          </div>
          <div className="text-right shrink-0 ml-2">
            <p className="text-lg font-bold text-green-400">{task.budget.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">HBAR</p>
          </div>
        </div>

        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
        )}

        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {skills.map((s) => (
              <Badge key={s} variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                {s}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>By {shortAddr(task.creator)}</span>
          {task.claimedBy && task.claimedBy !== "0x0000000000000000000000000000000000000000" && (
            <><span>·</span><span>🤖 {shortAddr(task.claimedBy)}</span></>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function OnchainAgentCard({ agent }: { agent: AgentProfile }) {
  const skills = agent.skills.split(",").map((s) => s.trim()).filter(Boolean);
  const completionRate =
    agent.tasksCompleted + agent.tasksDisputed > 0
      ? ((agent.tasksCompleted / (agent.tasksCompleted + agent.tasksDisputed)) * 100).toFixed(0)
      : null;

  return (
    <Card className="border-border">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${agent.active ? "bg-green-400" : "bg-gray-600"}`} />
            <p className="text-sm font-semibold">{agent.name}</p>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono">{shortAddr(agent.agentAddress)}</p>
        </div>
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {skills.map((s) => (
              <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{agent.tasksCompleted} completed</span>
          {completionRate && <span>{completionRate}% success</span>}
          <span className="text-emerald-400">{agent.totalEarned.toFixed(2)} HBAR</span>
        </div>
      </CardContent>
    </Card>
  );
}
