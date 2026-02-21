"use client";

import { useState, useEffect } from "react";
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
  getProjectsByOrg,
  getAgentsByOrg,
  createJob,
  claimJob,
  closeJob,
  updateJob,
  type Job,
  type Project,
  type Agent,
} from "@/lib/firestore";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

const columns = [
  { status: "open" as const, label: "Open", icon: "📢", bg: "bg-[#1a1a1a]", border: "border-amber-500/20" },
  { status: "claimed" as const, label: "Claimed", icon: "🔄", bg: "bg-[#1a1a1a]", border: "border-amber-500/30" },
  { status: "closed" as const, label: "Closed", icon: "✅", bg: "bg-[#1a1a1a]", border: "border-amber-500/20" },
];

const priorityColors = {
  low: "bg-gray-800 text-gray-400",
  medium: "bg-amber-900/50 text-amber-400",
  high: "bg-orange-900/50 text-orange-400",
};

const SKILL_OPTIONS = ["Research", "Trading", "Operations", "Support", "Analytics", "Scout"];

export default function JobBoardPage() {
  const { currentOrg } = useOrg();
  const account = useActiveAccount();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Create job form
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobReward, setJobReward] = useState("");
  const [jobSkills, setJobSkills] = useState<string[]>([]);
  const [jobProject, setJobProject] = useState("");
  const [jobPriority, setJobPriority] = useState<Job["priority"]>("medium");
  const [creating, setCreating] = useState(false);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (!currentOrg) return;

    // Load projects and agents
    Promise.all([
      getProjectsByOrg(currentOrg.id),
      getAgentsByOrg(currentOrg.id),
    ]).then(([p, a]) => {
      setProjects(p);
      setAgents(a);
    });

    // Real-time jobs listener
    const q = query(collection(db, "jobs"), where("orgId", "==", currentOrg.id));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Job));
      setJobs(data);
      setLoading(false);
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });

    return () => unsub();
  }, [currentOrg]);

  const filteredJobs = jobs.filter((j) => {
    if (filterProject !== "all" && j.projectId !== filterProject) return false;
    if (filterStatus !== "all" && j.status !== filterStatus) return false;
    return true;
  });

  const getProjectName = (projectId?: string) => {
    if (!projectId) return null;
    return projects.find((p) => p.id === projectId)?.name || "Unknown";
  };

  const getAgentName = (agentId?: string) => {
    if (!agentId) return "Unclaimed";
    return agents.find((a) => a.id === agentId)?.name || "Unknown Agent";
  };

  const getJobsByStatus = (status: Job["status"]) =>
    filteredJobs.filter((job) => job.status === status);

  const toggleSkill = (skill: string) => {
    setJobSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const handleCreateJob = async () => {
    if (!currentOrg || !jobTitle.trim() || !jobProject) return;
    try {
      setCreating(true);
      await createJob({
        orgId: currentOrg.id,
        projectId: jobProject,
        title: jobTitle.trim(),
        description: jobDescription.trim(),
        reward: jobReward.trim() || undefined,
        skillsRequired: jobSkills.length > 0 ? jobSkills : undefined,
        status: "open",
        createdBy: account?.address || "unknown",
        priority: jobPriority,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      setJobTitle("");
      setJobDescription("");
      setJobReward("");
      setJobSkills([]);
      setJobProject("");
      setJobPriority("medium");
      setCreateOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job");
    } finally {
      setCreating(false);
    }
  };

  const handleClaimJob = async (job: Job, agentId: string) => {
    try {
      setClaiming(true);
      await claimJob(job.id, agentId, job.orgId, job.projectId);
      setDetailOpen(false);
      setSelectedJob(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to claim job");
    } finally {
      setClaiming(false);
    }
  };

  const handleCloseJob = async (job: Job) => {
    try {
      await closeJob(job.id);
      setDetailOpen(false);
      setSelectedJob(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close job");
    }
  };

  const formatTime = (timestamp: unknown) => {
    if (!timestamp) return "Unknown";
    let date: Date;
    if (timestamp && typeof timestamp === "object" && "seconds" in timestamp) {
      date = new Date((timestamp as { seconds: number }).seconds * 1000);
    } else {
      date = new Date(timestamp as string);
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

  if (!currentOrg) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-white">💼 Job Board</h1>
        <p className="text-gray-400">No organization selected</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">💼 Job Board</h1>
          <p className="text-gray-400 mt-1">Post and claim jobs for your agent fleet</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
          + Post Job
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-48 bg-[#111] border-amber-500/20 text-white">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 bg-[#111] border-amber-500/20 text-white">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="claimed">Claimed</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-900/30 border border-red-500/30 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400"><p>Loading jobs...</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {columns.map((col) => {
            const colJobs = getJobsByStatus(col.status);
            return (
              <div key={col.status} className="space-y-3">
                <div className={`flex items-center justify-between rounded-lg px-4 py-2 ${col.bg} border ${col.border}`}>
                  <div className="flex items-center gap-2">
                    <span>{col.icon}</span>
                    <h2 className="font-semibold text-sm text-white">{col.label}</h2>
                  </div>
                  <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/30">
                    {colJobs.length}
                  </Badge>
                </div>

                <div className="space-y-3 min-h-[200px]">
                  {colJobs.map((job) => (
                    <Card
                      key={job.id}
                      className="cursor-pointer hover:shadow-md transition-shadow bg-[#111] border-amber-500/20 hover:border-amber-500/40"
                      onClick={() => { setSelectedJob(job); setDetailOpen(true); }}
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <h3 className="text-sm font-semibold leading-tight text-white">{job.title}</h3>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ml-2 ${priorityColors[job.priority]}`}>
                            {job.priority}
                          </Badge>
                        </div>
                        {job.description && (
                          <p className="text-xs text-gray-400 line-clamp-2">{job.description}</p>
                        )}
                        {job.reward && (
                          <div className="text-xs font-medium text-amber-400">💰 {job.reward}</div>
                        )}
                        {job.skillsRequired && job.skillsRequired.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {job.skillsRequired.map((skill) => (
                              <Badge key={skill} variant="outline" className="text-[10px] bg-amber-900/30 text-amber-400 border-amber-500/30">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          {job.projectId && <span>📁 {getProjectName(job.projectId)}</span>}
                          {job.claimedBy ? (
                            <span>🤖 {getAgentName(job.claimedBy)}</span>
                          ) : job.status === "open" ? (
                            <span className="text-amber-400">Open for agents</span>
                          ) : null}
                        </div>
                        <div className="text-xs text-gray-500">Posted {formatTime(job.createdAt)}</div>
                      </CardContent>
                    </Card>
                  ))}
                  {colJobs.length === 0 && (
                    <div className="text-center py-8 text-sm text-gray-500">No jobs</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Job Detail Dialog */}
      {selectedJob && (
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-2xl bg-[#111] border-amber-500/20 text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-white">
                {selectedJob.title}
                <Badge className={`text-xs ${priorityColors[selectedJob.priority]}`}>
                  {selectedJob.priority}
                </Badge>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-400">{selectedJob.description || "No description"}</p>

              {selectedJob.reward && (
                <div className="p-3 rounded-md bg-amber-900/30 border border-amber-500/30">
                  <span className="text-sm font-medium text-amber-400">💰 Reward: {selectedJob.reward}</span>
                </div>
              )}

              {selectedJob.skillsRequired && selectedJob.skillsRequired.length > 0 && (
                <div>
                  <span className="text-sm text-gray-400 block mb-2">Required Skills:</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedJob.skillsRequired.map((skill) => (
                      <Badge key={skill} variant="outline" className="bg-amber-900/30 text-amber-400 border-amber-500/30">{skill}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-400">Project:</span><p className="font-medium text-white">{getProjectName(selectedJob.projectId)}</p></div>
                <div><span className="text-gray-400">Status:</span><p className="font-medium text-white capitalize">{selectedJob.status}</p></div>
                <div><span className="text-gray-400">Claimed by:</span><p className="font-medium text-white">{getAgentName(selectedJob.claimedBy)}</p></div>
                <div><span className="text-gray-400">Posted:</span><p className="font-medium text-white">{formatTime(selectedJob.createdAt)}</p></div>
              </div>

              {/* Claim Job */}
              {selectedJob.status === "open" && agents.length > 0 && (
                <div className="pt-4 border-t border-amber-500/20">
                  <span className="text-sm text-gray-400 block mb-2">Claim on behalf of an agent:</span>
                  <div className="flex flex-wrap gap-2">
                    {agents.map((agent) => (
                      <Button
                        key={agent.id}
                        size="sm"
                        variant="outline"
                        onClick={() => handleClaimJob(selectedJob, agent.id)}
                        disabled={claiming}
                        className="text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                      >
                        🤖 {agent.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Close Job */}
              {selectedJob.status !== "closed" && (
                <div className="pt-4 border-t border-amber-500/20">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCloseJob(selectedJob)}
                    className="text-xs border-red-500/30 text-red-400 hover:bg-red-500/20"
                  >
                    Close Job
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Job Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-[#111] border-amber-500/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Post a New Job</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block text-gray-400">Title *</label>
              <Input placeholder="Job title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="bg-[#0a0a0a] border-amber-500/20 text-white" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block text-gray-400">Description</label>
              <Textarea placeholder="What does this job involve?" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} rows={3} className="bg-[#0a0a0a] border-amber-500/20 text-white" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block text-gray-400">Reward</label>
                <Input placeholder="e.g. 0.5 ETH" value={jobReward} onChange={(e) => setJobReward(e.target.value)} className="bg-[#0a0a0a] border-amber-500/20 text-white" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block text-gray-400">Priority</label>
                <Select value={jobPriority} onValueChange={(v: Job["priority"]) => setJobPriority(v)}>
                  <SelectTrigger className="bg-[#0a0a0a] border-amber-500/20 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block text-gray-400">Project *</label>
              <Select value={jobProject} onValueChange={setJobProject}>
                <SelectTrigger className="bg-[#0a0a0a] border-amber-500/20 text-white"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block text-gray-400">Required Skills</label>
              <div className="flex flex-wrap gap-2">
                {SKILL_OPTIONS.map((skill) => (
                  <Badge
                    key={skill}
                    variant="outline"
                    className={`cursor-pointer transition-colors ${jobSkills.includes(skill) ? "bg-amber-500/20 text-amber-400 border-amber-500/50" : "text-gray-400 border-amber-500/20 hover:bg-amber-500/10"}`}
                    onClick={() => toggleSkill(skill)}
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating} className="border-amber-500/20 text-gray-400">Cancel</Button>
              <Button onClick={handleCreateJob} disabled={creating || !jobTitle.trim() || !jobProject} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
                {creating ? "Posting..." : "Post Job"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
