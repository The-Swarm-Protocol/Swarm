/**
 * BrandMover Swarm Contracts — Hedera Testnet
 *
 * Contract addresses, ABIs, types, and helpers for reading
 * the SwarmTaskBoard and SwarmAgentRegistry from Hedera.
 */

// ============================================================
// Contract Addresses (Hedera Testnet)
// ============================================================

export const HEDERA_RPC_URL = "https://testnet.hashio.io/api";
export const HEDERA_CHAIN_ID = 296;
export const EXPLORER_BASE = "https://hashscan.io/testnet";

export const CONTRACTS = {
  TASK_BOARD: "0x00CBBA3bb2Bd5B860b2D17660F801eA5a2e9a8c9",
  AGENT_REGISTRY: "0x557Ac244E4D73910C89631937699cDb44Fb04cc6",
  BRAND_VAULT: "0x2254185AB8B6AC995F97C769a414A0281B42853b",
  BRAND_REGISTRY: "0x76c00C56A60F0a92ED899246Af76c65D835A8EAA",
  AGENT_TREASURY: "0x1AC9C959459ED904899a1d52f493e9e4A879a9f4",
} as const;

// ============================================================
// ABIs (minimal, read-only)
// ============================================================

export const TASK_BOARD_ABI = [
  "function getAllTasks() view returns (tuple(uint256 taskId, address creator, address vaultAddress, string title, string description, string requiredSkills, uint256 budget, uint256 deadline, uint8 status, address claimedBy, uint256 claimedAt, uint256 completedAt, bytes32 deliveryHash, string disputeReason)[])",
  "function getOpenTasks() view returns (tuple(uint256 taskId, address creator, address vaultAddress, string title, string description, string requiredSkills, uint256 budget, uint256 deadline, uint8 status, address claimedBy, uint256 claimedAt, uint256 completedAt, bytes32 deliveryHash, string disputeReason)[])",
  "function getTotalTasks() view returns (uint256)",
  "function getTask(uint256 taskId) view returns (tuple(uint256 taskId, address creator, address vaultAddress, string title, string description, string requiredSkills, uint256 budget, uint256 deadline, uint8 status, address claimedBy, uint256 claimedAt, uint256 completedAt, bytes32 deliveryHash, string disputeReason))",
];

export const AGENT_REGISTRY_ABI = [
  "function getAllAgents() view returns (tuple(address agentAddress, string name, string skills, uint256 feeRate, uint256 registeredAt, uint256 tasksCompleted, uint256 tasksDisputed, uint256 totalEarned, bool active)[])",
  "function getActiveAgents() view returns (tuple(address agentAddress, string name, string skills, uint256 feeRate, uint256 registeredAt, uint256 tasksCompleted, uint256 tasksDisputed, uint256 totalEarned, bool active)[])",
  "function getTotalAgents() view returns (uint256)",
];

// ============================================================
// Types
// ============================================================

export interface TaskListing {
  taskId: number;
  creator: string;
  vaultAddress: string;
  title: string;
  description: string;
  requiredSkills: string;
  budget: number;
  budgetRaw: bigint;
  deadline: number;
  status: TaskStatus;
  claimedBy: string;
  claimedAt: number;
  completedAt: number;
  deliveryHash: string;
  disputeReason: string;
}

export interface AgentProfile {
  agentAddress: string;
  name: string;
  skills: string;
  feeRate: number;
  registeredAt: number;
  tasksCompleted: number;
  tasksDisputed: number;
  totalEarned: number;
  active: boolean;
}

export enum TaskStatus {
  Open = 0,
  Claimed = 1,
  Completed = 2,
  Expired = 3,
  Disputed = 4,
}

export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  [TaskStatus.Open]:      { label: "Open",      color: "text-green-400",  bg: "bg-green-500/20" },
  [TaskStatus.Claimed]:   { label: "Claimed",   color: "text-yellow-400", bg: "bg-yellow-500/20" },
  [TaskStatus.Completed]: { label: "Completed", color: "text-blue-400",   bg: "bg-blue-500/20" },
  [TaskStatus.Expired]:   { label: "Expired",   color: "text-gray-400",   bg: "bg-gray-500/20" },
  [TaskStatus.Disputed]:  { label: "Disputed",  color: "text-red-400",    bg: "bg-red-500/20" },
};

// ============================================================
// Helpers
// ============================================================

/** Convert tinybars to HBAR (1 HBAR = 10^8 tinybar on Hedera EVM) */
export function toHbar(tinybars: bigint | number): number {
  return Number(tinybars) / 1e8;
}

/** Shorten an address: 0x1234...5678 */
export function shortAddr(addr: string): string {
  if (!addr || addr === "0x0000000000000000000000000000000000000000") return "\u2014";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/** HashScan link for a contract */
export function explorerContract(addr: string): string {
  return `${EXPLORER_BASE}/contract/${addr}`;
}

/** HashScan link for a transaction */
export function explorerTx(hash: string): string {
  return `${EXPLORER_BASE}/transaction/${hash}`;
}

/** Time remaining as human-readable string */
export function timeRemaining(deadline: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = deadline - now;
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
