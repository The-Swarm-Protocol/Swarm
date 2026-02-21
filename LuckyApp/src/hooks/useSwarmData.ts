/**
 * React hook that polls the SwarmTaskBoard + AgentRegistry
 * on Hedera Testnet every 12 seconds.
 *
 * Usage:
 *   const { tasks, agents, isLoading, error } = useSwarmData();
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import {
  HEDERA_RPC_URL,
  CONTRACTS,
  TASK_BOARD_ABI,
  AGENT_REGISTRY_ABI,
  toHbar,
  type TaskListing,
  type AgentProfile,
} from "@/lib/swarm-contracts";

const POLL_INTERVAL = 12_000;

interface SwarmData {
  tasks: TaskListing[];
  agents: AgentProfile[];
  totalTasks: number;
  totalAgents: number;
  isLoading: boolean;
  error: string | null;
  lastRefresh: Date | null;
  refetch: () => Promise<void>;
}

export function useSwarmData(): SwarmData {
  const [tasks, setTasks] = useState<TaskListing[]>([]);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [totalAgents, setTotalAgents] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const providerRef = useRef<ethers.JsonRpcProvider | null>(null);

  const getProvider = useCallback(() => {
    if (!providerRef.current) {
      providerRef.current = new ethers.JsonRpcProvider(HEDERA_RPC_URL);
    }
    return providerRef.current;
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const provider = getProvider();
      const board = new ethers.Contract(CONTRACTS.TASK_BOARD, TASK_BOARD_ABI, provider);
      const registry = new ethers.Contract(CONTRACTS.AGENT_REGISTRY, AGENT_REGISTRY_ABI, provider);

      const [rawTasks, rawAgents, taskCount, agentCount] = await Promise.all([
        board.getAllTasks().catch(() => []),
        registry.getAllAgents().catch(() => []),
        board.getTotalTasks().catch(() => BigInt(0)),
        registry.getTotalAgents().catch(() => BigInt(0)),
      ]);

      const parsedTasks: TaskListing[] = (rawTasks as unknown[]).map((t: unknown) => {
        const a = t as [bigint, string, string, string, string, string, bigint, bigint, number, string, bigint, bigint, string, string];
        return {
          taskId: Number(a[0]),
          creator: a[1],
          vaultAddress: a[2],
          title: a[3],
          description: a[4],
          requiredSkills: a[5],
          budgetRaw: BigInt(a[6]),
          budget: toHbar(a[6]),
          deadline: Number(a[7]),
          status: Number(a[8]),
          claimedBy: a[9],
          claimedAt: Number(a[10]),
          completedAt: Number(a[11]),
          deliveryHash: a[12],
          disputeReason: a[13],
        };
      });

      const parsedAgents: AgentProfile[] = (rawAgents as unknown[]).map((a: unknown) => {
        const r = a as [string, string, string, bigint, bigint, bigint, bigint, bigint, boolean];
        return {
          agentAddress: r[0],
          name: r[1],
          skills: r[2],
          feeRate: toHbar(r[3]),
          registeredAt: Number(r[4]),
          tasksCompleted: Number(r[5]),
          tasksDisputed: Number(r[6]),
          totalEarned: toHbar(r[7]),
          active: Boolean(r[8]),
        };
      });

      setTasks(parsedTasks);
      setAgents(parsedAgents);
      setTotalTasks(Number(taskCount));
      setTotalAgents(Number(agentCount));
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch Swarm data");
    } finally {
      setIsLoading(false);
    }
  }, [getProvider]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { tasks, agents, totalTasks, totalAgents, isLoading, error, lastRefresh, refetch: fetchData };
}
