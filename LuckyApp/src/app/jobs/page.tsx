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
  getJobsByOrg,
  getProjectsByOrg,
  getAgentsByOrg,
  createJob,
  updateJob,
  type Job,
  type Project,
  type Agent,
} from "@/lib/firestore";

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

  // Create job form state
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobReward, setJobReward] = useState("");
  const [jobSkills, setJobSkills] = useState<string[]>([]);
  const [jobProject, setJobProject] = useState("");
  const [jobPriority, setJobPriority] = useState<Job["priority"]>("medium");
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

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

  useEffect(() => {
    loadData();
  }, [currentOrg]);

  const getProjectName = (projectId?: string) => {
    if (!projectId) return null;
    const project = projects.find((p) => p.id === projectId);
    return project?.name || "Unknown Project";
  };

  const getAgentName = (agentId?: string) => {
    if (!agentId) return "Unassigned";
    const agent = agents.find((a) => a.id === agentId);
    return agent?.name || "Unknown Agent";
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

      // Reset form
      setJobTitle("");
      setJobDescription("");
      setJobReward("");
      setJobSkills([]);
      setJobProject("");
      setJobPriority("medium");
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">💼 Job Board</h1>
          <p className="text-muted-foreground mt-1">
            Post and claim jobs for your agent fleet
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-amber-600 hover:bg-amber-600 text-white"
        >
          + Post Job
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-600">
          {error}
        </div>
      )}

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
                <div
                  className={`flex items-center justify-between rounded-lg px-4 py-2 ${col.bg} border ${col.border}`}
                >
                  <div className="flex items-center gap-2">
                    <span>{col.icon}</span>
                    <h2 className="font-semibold text-sm">{col.label}</h2>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {colJobs.length}
                  </Badge>
                </div>

                <div className="space-y-3 min-h-[200px]">
                  {colJobs.map((job) => (
                    <Card
                      key={job.id}
                      className="cursor-pointer hover:shadow-md transition-shadow border-border"
                      onClick={() => {
                        setSelectedJob(job);
                        setDetailOpen(true);
                      }}
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <h3 className="text-sm font-semibold leading-tight">
                            {job.title}
                          </h3>
                          <Badge
                            variant="outline"
                            className={`text-[10px] shrink-0 ml-2 ${priorityColors[job.priority]}`}
                          >
                            {job.priority}
                          </Badge>
                        </div>

                        {job.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {job.description}
                          </p>
                        )}

                        {job.reward && (
                          <div className="text-xs font-medium text-amber-600">
                            💰 {job.reward}
                          </div>
                        )}

                        {job.requiredSkills.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {job.requiredSkills.map((skill) => (
                              <Badge
                                key={skill}
                                variant="outline"
                                className="text-[10px] bg-blue-50 text-blue-700 border-blue-200"
                              >
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {job.projectId && (
                            <>
                              <span>📁 {getProjectName(job.projectId)}</span>
                              <span>·</span>
                            </>
                          )}
                          {job.takenByAgentId && (
                            <span>🤖 {getAgentName(job.takenByAgentId)}</span>
                          )}
                          {!job.takenByAgentId && job.status === "open" && (
                            <span className="text-amber-600">Open for agents</span>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          Posted {formatTime(job.createdAt)}
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {colJobs.length === 0 && (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No jobs
                    </div>
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedJob.title}
                <Badge
                  className={`text-xs ${priorityColors[selectedJob.priority]}`}
                >
                  {selectedJob.priority} priority
                </Badge>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  {selectedJob.description || "No description provided"}
                </p>
              </div>

              {selectedJob.reward && (
                <div className="p-3 rounded-md bg-amber-50 border border-amber-200">
                  <span className="text-sm font-medium text-amber-700">
                    💰 Reward: {selectedJob.reward}
                  </span>
                </div>
              )}

              {selectedJob.requiredSkills.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground block mb-2">
                    Required Skills:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {selectedJob.requiredSkills.map((skill) => (
                      <Badge
                        key={skill}
                        variant="outline"
                        className="bg-blue-50 text-blue-700 border-blue-200"
                      >
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                {selectedJob.projectId && (
                  <div>
                    <span className="text-muted-foreground">Project:</span>
                    <p className="font-medium">
                      {getProjectName(selectedJob.projectId)}
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <p className="font-medium capitalize">
                    {selectedJob.status.replace("_", " ")}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Taken by:</span>
                  <p className="font-medium">
                    {getAgentName(selectedJob.takenByAgentId)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Posted:</span>
                  <p className="font-medium">
                    {formatTime(selectedJob.createdAt)}
                  </p>
                </div>
              </div>

              {/* Take Job */}
              {selectedJob.status === "open" && agents.length > 0 && (
                <div className="pt-4 border-t">
                  <span className="text-sm text-muted-foreground block mb-2">
                    Assign an agent to this job:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {agents.map((agent) => (
                      <Button
                        key={agent.id}
                        size="sm"
                        variant="outline"
                        onClick={() => handleTakeJob(selectedJob, agent.id)}
                        disabled={updating}
                        className="text-xs"
                      >
                        🤖 {agent.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Update Status */}
              <div className="flex items-center gap-2 pt-4 border-t">
                <span className="text-sm text-muted-foreground">
                  Update status:
                </span>
                <div className="flex gap-2">
                  {(["open", "in_progress", "completed"] as const).map(
                    (status) => (
                      <Button
                        key={status}
                        size="sm"
                        variant={
                          selectedJob.status === status ? "default" : "outline"
                        }
                        onClick={() =>
                          handleUpdateJobStatus(selectedJob, status)
                        }
                        disabled={updating}
                        className="text-xs"
                      >
                        {status === "in_progress"
                          ? "In Progress"
                          : status === "open"
                            ? "Open"
                            : "Completed"}
                      </Button>
                    )
                  )}
                </div>
              </div>
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
              <Input
                placeholder="Job title"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                Description
              </label>
              <Textarea
                placeholder="What does this job involve?"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Reward</label>
                <Input
                  placeholder="e.g. 0.5 ETH, 500 USDC"
                  value={jobReward}
                  onChange={(e) => setJobReward(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">
                  Priority
                </label>
                <Select
                  value={jobPriority}
                  onValueChange={(value: Job["priority"]) =>
                    setJobPriority(value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                Required Skills
              </label>
              <div className="flex flex-wrap gap-2">
                {SKILL_OPTIONS.map((skill) => (
                  <Badge
                    key={skill}
                    variant="outline"
                    className={`cursor-pointer transition-colors ${
                      jobSkills.includes(skill)
                        ? "bg-blue-100 text-blue-700 border-blue-300"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => toggleSkill(skill)}
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>

            {projects.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Project (optional)
                </label>
                <Select value={jobProject} onValueChange={setJobProject}>
                  <SelectTrigger>
                    <SelectValue placeholder="No project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateJob}
                disabled={creating || !jobTitle.trim()}
                className="bg-amber-600 hover:bg-amber-600"
              >
                {creating ? "Posting..." : "Post Job"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
