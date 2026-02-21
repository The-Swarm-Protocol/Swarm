"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Briefcase,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Clock,
  Coins,
  User,
  ExternalLink,
} from "lucide-react";
import { ethers } from "ethers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/header";
import { AgentPlaybook } from "@/components/dashboard/agent-playbook";
import { SWARM_TASK_BOARD_ABI } from "@/lib/abis";
import {
  HEDERA_RPC_URL,
  SWARM_TASK_BOARD_ADDRESS,
  EXPLORER_BASE,
} from "@/lib/constants";
import { shortAddr } from "@/lib/utils";

interface Task {
  taskId: number;
  vault: string;
  title: string;
  description: string;
  requiredSkills: string;
  deadline: number;
  budget: bigint;
  poster: string;
  claimedBy: string;
  status: number;
}

const STATUS_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "Open", color: "bg-green-500/20 text-green-400" },
  1: { label: "Claimed", color: "bg-blue-500/20 text-blue-400" },
  2: { label: "Delivered", color: "bg-yellow-500/20 text-yellow-400" },
  3: { label: "Approved", color: "bg-primary/20 text-primary" },
  4: { label: "Disputed", color: "bg-destructive/20 text-destructive" },
};

function TaskCard({ task }: { task: Task }) {
  const deadlineDate = new Date(task.deadline * 1000);
  const isExpired = deadlineDate.getTime() < Date.now();
  const statusInfo = STATUS_LABELS[task.status] ?? {
    label: "Unknown",
    color: "bg-muted text-muted-foreground",
  };

  return (
    <Card className="border-border/50 hover:border-primary/30 transition-colors">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-muted-foreground">
                #{task.taskId}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`}
              >
                {statusInfo.label}
              </span>
            </div>
            <h3 className="font-medium text-foreground truncate">
              {task.title}
            </h3>
          </div>
          <div className="flex items-center gap-1 text-sm font-medium text-primary flex-shrink-0">
            <Coins className="h-3.5 w-3.5" />
            {ethers.formatEther(task.budget)} HBAR
          </div>
        </div>

        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {task.description}
        </p>

        <div className="flex items-center flex-wrap gap-1.5 mb-3">
          {task.requiredSkills.split(",").map((skill) => (
            <span
              key={skill}
              className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent-foreground border border-accent/10"
            >
              {skill.trim()}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <code>{shortAddr(task.poster)}</code>
          </div>
          <div
            className={`flex items-center gap-1 ${isExpired ? "text-destructive" : ""}`}
          >
            <Clock className="h-3 w-3" />
            {isExpired ? "Expired" : deadlineDate.toLocaleDateString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function JobsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "claimed">("all");

  const fetchTasks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const provider = new ethers.JsonRpcProvider(HEDERA_RPC_URL);

      // Check if the contract is actually deployed
      const code = await provider.getCode(SWARM_TASK_BOARD_ADDRESS);
      if (code === "0x") {
        setError("not_deployed");
        setTasks([]);
        return;
      }

      const board = new ethers.Contract(
        SWARM_TASK_BOARD_ADDRESS,
        SWARM_TASK_BOARD_ABI,
        provider
      );
      const raw = await board.getOpenTasks();
      const parsed: Task[] = raw.map((t: Record<string, unknown>) => ({
        taskId: Number(t.taskId),
        vault: t.vault as string,
        title: t.title as string,
        description: t.description as string,
        requiredSkills: t.requiredSkills as string,
        deadline: Number(t.deadline),
        budget: t.budget as bigint,
        poster: t.poster as string,
        claimedBy: t.claimedBy as string,
        status: Number(t.status),
      }));
      setTasks(parsed);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load tasks from Hedera"
      );
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const filtered = tasks.filter((t) => {
    if (filter === "open") return t.status === 0;
    if (filter === "claimed") return t.status === 1;
    return true;
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header lastRefresh={null} />

      <main className="flex-1 container mx-auto px-4 py-8 space-y-6">
        {/* Back link + title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Dashboard
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-primary" />
              Swarm Jobs
            </h1>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchTasks}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>

        {/* Agent Playbook */}
        <AgentPlaybook />

        {/* Filter tabs */}
        <div className="flex items-center gap-2">
          {(["all", "open", "claimed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                filter === f
                  ? "bg-primary/20 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === "all" && tasks.length > 0 && (
                <span className="ml-1.5 text-xs">({tasks.length})</span>
              )}
            </button>
          ))}
          <a
            href={`${EXPLORER_BASE}/contract/${SWARM_TASK_BOARD_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
          >
            View on HashScan
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Task list */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">
              Loading tasks from Hedera Testnet...
            </p>
          </div>
        ) : error ? (
          <Card className="border-yellow-500/20">
            <CardContent className="py-8 text-center space-y-3">
              <AlertTriangle className="h-8 w-8 text-yellow-400 mx-auto" />
              {error === "not_deployed" ? (
                <>
                  <p className="text-sm font-medium text-foreground">
                    TaskBoard contract not deployed yet
                  </p>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    The TaskBoard at{" "}
                    <code className="bg-muted px-1 py-0.5 rounded text-[10px]">
                      {SWARM_TASK_BOARD_ADDRESS.slice(0, 10)}...
                    </code>{" "}
                    has no contract code on Hedera Testnet. Deploy it first, then
                    tasks will appear here. Use the Agent Playbook above for the
                    full workflow.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">
                    Could not load tasks
                  </p>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    {error}
                  </p>
                </>
              )}
              <Button variant="outline" size="sm" onClick={fetchTasks}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-12 text-center">
              <Briefcase className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                {tasks.length === 0
                  ? "No tasks posted yet. Use the playbook above to post one!"
                  : `No ${filter} tasks found.`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((task) => (
              <TaskCard key={task.taskId} task={task} />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-border mt-auto">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>BrandMover — Autonomous AI CMO on Hedera</p>
        </div>
      </footer>
    </div>
  );
}
