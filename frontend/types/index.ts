export interface VaultData {
  brandName: string;
  encryptedGuidelines: string; // hex string
  guidelinesHash: string;
  owner: string;
  agentAddress: string;
  campaignCount: number;
  lastUpdated: number;
  growthWalletBalance: bigint;
  hssEnabled: boolean;
  initialized: boolean;
}

export interface Campaign {
  id: number;
  contentHash: string;
  platforms: string;
  name: string;
  campaignType: string;
  contentTypes: string;
  createdBy: string;
  createdAt: number;
  status: number; // 0=draft, 1=active, 2=complete, 3=scheduled
}

export interface ScheduleEntry {
  campaignId: number;
  contentHash: string;
  platforms: string;
  scheduleType: string;
  scheduledFor: number;
  createdAt: number;
  executed: boolean;
}

export interface ActivityEntry {
  actionType: string;
  description: string;
  dataHash: string;
  timestamp: number;
}

export interface TaskAccessEvent {
  taskId: number;
  workerAgent: string;
  expiresAt: number;
  revoked: boolean;
  delivered: boolean;
  guidelinesMatch: boolean;
}

export interface BrandEntry {
  owner: string;
  vaultAddress: string;
  createdAt: number;
  totalSpent: bigint;
}

export interface TreasuryPnL {
  totalRevenue: bigint;
  computeBalance: bigint;
  growthBalance: bigint;
  reserveBalance: bigint;
  growthThreshold: bigint;
  agentAddress: string;
}

export interface DashboardData {
  vault: VaultData | null;
  campaigns: Campaign[];
  scheduled: ScheduleEntry[];
  activity: ActivityEntry[];
  taskAccess: TaskAccessEvent[];
  brands: BrandEntry[];
  registryTotalBrands: number;
  registryTotalRevenue: bigint;
  treasury: TreasuryPnL | null;
}
