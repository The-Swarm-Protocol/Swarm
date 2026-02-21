"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import {
  HEDERA_RPC_URL,
  BRAND_VAULT_ADDRESS,
  BRAND_REGISTRY_ADDRESS,
  AGENT_TREASURY_ADDRESS,
} from "@/lib/constants";
import {
  BRAND_VAULT_ABI,
  BRAND_REGISTRY_ABI,
  AGENT_TREASURY_ABI,
} from "@/lib/abis";
import type {
  DashboardData,
  VaultData,
  Campaign,
  ScheduleEntry,
  ActivityEntry,
  TaskAccessEvent,
  BrandEntry,
  TreasuryPnL,
} from "@/types";

const EMPTY: DashboardData = {
  vault: null,
  campaigns: [],
  scheduled: [],
  activity: [],
  taskAccess: [],
  brands: [],
  registryTotalBrands: 0,
  registryTotalRevenue: 0n,
  treasury: null,
};

interface UseDashboardDataReturn {
  data: DashboardData;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastRefresh: Date | null;
}

export function useDashboardData(): UseDashboardDataReturn {
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const getProvider = useCallback(() => {
    // Create a fresh provider each fetch to avoid stale RPC cache
    return new ethers.JsonRpcProvider(HEDERA_RPC_URL);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const provider = getProvider();
      const vaultContract = new ethers.Contract(BRAND_VAULT_ADDRESS, BRAND_VAULT_ABI, provider);
      const registryContract = new ethers.Contract(BRAND_REGISTRY_ADDRESS, BRAND_REGISTRY_ABI, provider);
      const treasuryContract = new ethers.Contract(AGENT_TREASURY_ADDRESS, AGENT_TREASURY_ABI, provider);

      // Fetch all data in parallel
      const [
        vaultTuple,
        initialized,
        growthWalletBalance,
        hssEnabled,
        allCampaigns,
        allSchedule,
        allActivity,
        totalBrands,
        registryRevenue,
        allBrands,
        pnl,
        growthThreshold,
        treasuryAgent,
      ] = await Promise.all([
        vaultContract.vault().catch(() => null),
        vaultContract.initialized().catch(() => false),
        vaultContract.growthWalletBalance().catch(() => 0n),
        vaultContract.hssEnabled().catch(() => false),
        vaultContract.getAllCampaigns().catch(() => []),
        vaultContract.getAllScheduleEntries().catch(() => []),
        vaultContract.getAllActivityEntries().catch(() => []),
        registryContract.getTotalBrands().catch(() => 0n),
        registryContract.getTotalRevenue().catch(() => 0n),
        registryContract.getAllBrands().catch(() => []),
        treasuryContract.getPnL().catch(() => [0n, 0n, 0n, 0n]),
        treasuryContract.growthThreshold().catch(() => 0n),
        treasuryContract.agentAddress().catch(() => "0x0"),
      ]);

      // Parse vault data
      let vault: VaultData | null = null;
      if (vaultTuple && initialized) {
        vault = {
          encryptedGuidelines: vaultTuple[0],
          guidelinesHash: vaultTuple[1],
          brandName: vaultTuple[2],
          owner: vaultTuple[3],
          agentAddress: vaultTuple[4],
          campaignCount: Number(vaultTuple[5]),
          lastUpdated: Number(vaultTuple[6]),
          growthWalletBalance: BigInt(growthWalletBalance),
          hssEnabled: Boolean(hssEnabled),
          initialized: Boolean(initialized),
        };
      }

      // Parse campaigns
      const campaigns: Campaign[] = (allCampaigns as unknown[]).map((c: unknown) => {
        const arr = c as [bigint, string, string, string, string, string, string, bigint, number];
        return {
          id: Number(arr[0]),
          contentHash: arr[1],
          platforms: arr[2],
          name: arr[3],
          campaignType: arr[4],
          contentTypes: arr[5],
          createdBy: arr[6],
          createdAt: Number(arr[7]),
          status: Number(arr[8]),
        };
      });

      // Parse schedule entries
      const scheduled: ScheduleEntry[] = (allSchedule as unknown[]).map((s: unknown) => {
        const arr = s as [bigint, string, string, string, bigint, bigint, boolean];
        return {
          campaignId: Number(arr[0]),
          contentHash: arr[1],
          platforms: arr[2],
          scheduleType: arr[3],
          scheduledFor: Number(arr[4]),
          createdAt: Number(arr[5]),
          executed: Boolean(arr[6]),
        };
      });

      // Parse activity entries
      const activity: ActivityEntry[] = (allActivity as unknown[]).map((a: unknown) => {
        const arr = a as [string, string, string, bigint];
        return {
          actionType: arr[0],
          description: arr[1],
          dataHash: arr[2],
          timestamp: Number(arr[3]),
        };
      });

      // Fetch task access events (last 500 blocks)
      let taskAccess: TaskAccessEvent[] = [];
      try {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 500);

        const [grantedLogs, revokedLogs, deliveredLogs] = await Promise.all([
          vaultContract.queryFilter(vaultContract.filters.AccessGranted(), fromBlock),
          vaultContract.queryFilter(vaultContract.filters.AccessRevoked(), fromBlock),
          vaultContract.queryFilter(vaultContract.filters.TaskDelivered(), fromBlock),
        ]);

        const revokedSet = new Set(
          revokedLogs.map((l) => {
            const parsed = vaultContract.interface.parseLog({ topics: l.topics as string[], data: l.data });
            return Number(parsed?.args[0]);
          })
        );

        const deliveredMap = new Map<number, { match: boolean }>();
        for (const l of deliveredLogs) {
          const parsed = vaultContract.interface.parseLog({ topics: l.topics as string[], data: l.data });
          if (parsed) {
            deliveredMap.set(Number(parsed.args[0]), { match: Boolean(parsed.args[4]) });
          }
        }

        taskAccess = grantedLogs.map((l) => {
          const parsed = vaultContract.interface.parseLog({ topics: l.topics as string[], data: l.data });
          const taskId = Number(parsed?.args[0]);
          const delivery = deliveredMap.get(taskId);
          return {
            taskId,
            workerAgent: parsed?.args[1] as string,
            expiresAt: Number(parsed?.args[2]),
            revoked: revokedSet.has(taskId),
            delivered: !!delivery,
            guidelinesMatch: delivery?.match ?? false,
          };
        });
      } catch {
        // Event queries may fail on some RPC endpoints; non-critical
      }

      // Parse brands
      const brands: BrandEntry[] = (allBrands as unknown[]).map((b: unknown) => {
        const arr = b as [string, string, bigint, bigint];
        return {
          owner: arr[0],
          vaultAddress: arr[1],
          createdAt: Number(arr[2]),
          totalSpent: BigInt(arr[3]),
        };
      });

      // Parse treasury P&L
      const treasury: TreasuryPnL = {
        totalRevenue: BigInt(pnl[0]),
        computeBalance: BigInt(pnl[1]),
        growthBalance: BigInt(pnl[2]),
        reserveBalance: BigInt(pnl[3]),
        growthThreshold: BigInt(growthThreshold),
        agentAddress: String(treasuryAgent),
      };

      setData({
        vault,
        campaigns,
        scheduled,
        activity,
        taskAccess,
        brands,
        registryTotalBrands: Number(totalBrands),
        registryTotalRevenue: BigInt(registryRevenue),
        treasury,
      });
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  }, [getProvider]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData, lastRefresh };
}
