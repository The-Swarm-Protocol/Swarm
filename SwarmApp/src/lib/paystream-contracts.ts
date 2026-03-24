/**
 * PayStream Contracts — Base Sepolia
 *
 * Contract addresses, ABIs, types, and helpers for interacting with
 * PaymentStreamV2, AgentWallet, BillingRegistry, and MockUSDC.
 *
 * Based on: https://github.com/TheMasterClaw/Pay-Stream
 * Network: Base Sepolia (Chain ID 84532)
 */

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

export const BASE_SEPOLIA_RPC = "https://sepolia.base.org";
export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const USDC_DECIMALS = 6;
export const PLATFORM_FEE_BPS = 25; // 0.25%

// ═══════════════════════════════════════════════════════════════
// Contract Addresses
// ═══════════════════════════════════════════════════════════════

export const PAYSTREAM_CONTRACTS = {
    PAYMENT_STREAM: process.env.NEXT_PUBLIC_PAYSTREAM_PAYMENT_STREAM || "0xc3E0869913FCdbeB59934FfC92C74269c428C834",
    AGENT_WALLET: process.env.NEXT_PUBLIC_PAYSTREAM_AGENT_WALLET || "0x8F44610D43Db6775e351F22F43bDF0ba7F8D0CEa",
    BILLING_REGISTRY: process.env.NEXT_PUBLIC_PAYSTREAM_BILLING_REGISTRY || "0x9C34200882C37344A098E0e8B84a533DFB80e552",
    MOCK_USDC: process.env.NEXT_PUBLIC_PAYSTREAM_MOCK_USDC || "0xEf70C6e8D49DC21b96b02854089B26df9BECE227",
} as const;

// ═══════════════════════════════════════════════════════════════
// Enums
// ═══════════════════════════════════════════════════════════════

export enum StreamStatus {
    Active = 0,
    Paused = 1,
    Cancelled = 2,
    Completed = 3,
}

export enum BillingType {
    PerSecond = 0,
    PerCall = 1,
    PerToken = 2,
    Fixed = 3,
    Hybrid = 4,
}

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface PayStream {
    streamId: string; // bytes32
    sender: string;
    recipient: string;
    depositAmount: bigint;
    withdrawnAmount: bigint;
    startTime: number;
    endTime: number;
    ratePerSecond: bigint;
    status: StreamStatus;
    serviceId: string;
    autoRenew: boolean;
    remainingTime: number;
    availableNow: bigint;
}

export interface BillingService {
    serviceId: string; // bytes32
    provider: string;
    name: string;
    description: string;
    endpoint: string;
    billingType: BillingType;
    rate: bigint;
    minDuration: number;
    maxDuration: number;
    isActive: boolean;
    totalEarned: bigint;
    totalRequests: number;
    ratingSum: number;
    ratingCount: number;
    tags: string[];
}

export interface MarketplaceStats {
    totalServices: number;
    totalVolume: bigint;
    totalProviders: number;
}

export interface AgentWalletStats {
    balance: bigint;
    received: bigint;
    sent: bigint;
    remainingDaily: bigint;
}

// ═══════════════════════════════════════════════════════════════
// ABIs — from deployed contracts on Base Sepolia
// ═══════════════════════════════════════════════════════════════

export const PAYMENT_STREAM_ABI = [
    // Constructor
    "constructor(address _usdt, address _feeRecipient)",
    // Read
    "function availableBalance(bytes32 streamId) view returns (uint256)",
    "function getStream(bytes32 streamId) view returns (address sender, address recipient, uint256 depositAmount, uint256 withdrawnAmount, uint256 startTime, uint256 endTime, uint256 ratePerSecond, uint8 status, string serviceId, bool autoRenew, uint256 remainingTime, uint256 availableNow)",
    "function getSenderStreams(address sender) view returns (bytes32[])",
    "function getRecipientStreams(address recipient) view returns (bytes32[])",
    "function getAllStreamsForAddress(address user) view returns (bytes32[])",
    "function getStreamsByStatus(address user, uint8 _status) view returns (bytes32[])",
    "function streamCount() view returns (uint256)",
    "function platformFeeBps() view returns (uint256)",
    // Write
    "function createStream(address recipient, uint256 amount, uint256 duration, string serviceId, bool _autoRenew) returns (bytes32 streamId)",
    "function withdraw(bytes32 streamId)",
    "function cancelStream(bytes32 streamId)",
    "function pauseStream(bytes32 streamId)",
    "function resumeStream(bytes32 streamId)",
    "function setAutoRenewal(address recipient, bool enabled)",
    // Events
    "event StreamCreated(bytes32 indexed streamId, address indexed sender, address indexed recipient, uint256 amount, uint256 startTime, uint256 endTime, string serviceId, bool autoRenew)",
    "event StreamWithdrawn(bytes32 indexed streamId, address indexed recipient, uint256 amount)",
    "event StreamCancelled(bytes32 indexed streamId, address indexed sender, uint256 remainingAmount)",
    "event StreamCompleted(bytes32 indexed streamId, bool autoRenewed)",
    "event StreamPaused(bytes32 indexed streamId, uint256 pausedAt, uint256 remainingTime)",
    "event StreamResumed(bytes32 indexed streamId, uint256 resumedAt, uint256 newEndTime)",
];

export const AGENT_WALLET_ABI = [
    // Constructor
    "constructor(address _owner, address _operator, address _usdt, address _paymentStream)",
    // Read
    "function getBalance() view returns (uint256)",
    "function getStats() view returns (uint256 balance, uint256 received, uint256 sent, uint256 remainingDaily)",
    "function getApprovedRecipients() view returns (address[])",
    // Write
    "function configureAutoStream(address recipient, uint256 maxAmount, uint256 maxDuration, bool enabled)",
    "function initiateStream(address recipient, uint256 amount, uint256 duration) returns (bytes32)",
    "function sendPayment(address recipient, uint256 amount)",
    "function batchSend(address[] recipients, uint256[] amounts)",
    "function deposit(uint256 amount)",
    "function withdraw(uint256 amount)",
    "function withdrawAll()",
    "function setDailyLimit(uint256 newLimit)",
    "function setOperator(address newOperator)",
];

export const BILLING_REGISTRY_ABI = [
    // Read
    "function getService(bytes32 serviceId) view returns (tuple(bytes32 serviceId, address provider, string name, string description, string endpoint, uint8 billingType, uint256 rate, uint256 minDuration, uint256 maxDuration, bool isActive, uint256 totalEarned, uint256 totalRequests, uint256 ratingSum, uint256 ratingCount, string[] tags))",
    "function getProviderServices(address provider) view returns (bytes32[])",
    "function searchServices(string keyword) view returns (bytes32[])",
    "function getServicesByTag(string tag) view returns (bytes32[])",
    "function getActiveServices(uint256 offset, uint256 limit) view returns (bytes32[])",
    "function getMarketplaceStats() view returns (uint256 totalServices, uint256 totalVolume, uint256 totalProviders)",
    "function calculateCost(bytes32 serviceId, uint256 durationOrQuantity) view returns (uint256)",
    "function getAverageRating(bytes32 serviceId) view returns (uint256)",
    "function totalServices() view returns (uint256)",
    // Write
    "function registerService(string name, string description, string endpoint, uint8 billingType, uint256 rate, uint256 minDuration, uint256 maxDuration, string[] tags) returns (bytes32 serviceId)",
    "function updateService(bytes32 serviceId, uint256 newRate, bool isActive, string newDescription, string newEndpoint)",
    "function rateService(bytes32 serviceId, uint8 rating)",
];

export const MOCK_USDC_ABI = [
    // Read
    "function balanceOf(address account) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    // Write
    "function approve(address spender, uint256 amount) returns (bool)",
    "function transfer(address recipient, uint256 amount) returns (bool)",
    "function transferFrom(address sender, address recipient, uint256 amount) returns (bool)",
    "function faucet()",
    "function mint(address to, uint256 amount)",
];

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

/** Convert raw 6-decimal amount to human-readable USDC */
export function toUSDC(raw: bigint | number): number {
    return Number(raw) / 1e6;
}

/** Convert human-readable USDC to raw 6-decimal amount */
export function fromUSDC(amount: number): bigint {
    return BigInt(Math.round(amount * 1e6));
}

/** BaseScan Sepolia transaction URL */
export function explorerTx(hash: string): string {
    return `https://sepolia.basescan.org/tx/${hash}`;
}

/** BaseScan Sepolia address URL */
export function explorerAddr(addr: string): string {
    return `https://sepolia.basescan.org/address/${addr}`;
}

/** Human-readable billing type label */
export function billingLabel(t: BillingType): string {
    switch (t) {
        case BillingType.PerSecond: return "Per Second";
        case BillingType.PerCall: return "Per Call";
        case BillingType.PerToken: return "Per Token";
        case BillingType.Fixed: return "Fixed";
        case BillingType.Hybrid: return "Hybrid";
        default: return "Unknown";
    }
}

/** Human-readable stream status label */
export function streamStatusLabel(s: StreamStatus): string {
    switch (s) {
        case StreamStatus.Active: return "Active";
        case StreamStatus.Paused: return "Paused";
        case StreamStatus.Cancelled: return "Cancelled";
        case StreamStatus.Completed: return "Completed";
        default: return "Unknown";
    }
}

/** Format remaining time for a stream */
export function streamTimeRemaining(endTime: number): string {
    const now = Math.floor(Date.now() / 1000);
    const diff = endTime - now;
    if (diff <= 0) return "Ended";
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
    return `${Math.floor(diff / 86400)}d ${Math.floor((diff % 86400) / 3600)}h`;
}

/** Shorten an address: 0x1234...5678 */
export function shortAddr(addr: string): string {
    if (!addr || addr.length < 10) return addr || "—";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/** Parse a raw stream tuple from getStream() into a typed PayStream */
export function parseStream(streamId: string, raw: any[]): PayStream {
    return {
        streamId,
        sender: raw[0],
        recipient: raw[1],
        depositAmount: BigInt(raw[2]),
        withdrawnAmount: BigInt(raw[3]),
        startTime: Number(raw[4]),
        endTime: Number(raw[5]),
        ratePerSecond: BigInt(raw[6]),
        status: Number(raw[7]) as StreamStatus,
        serviceId: raw[8],
        autoRenew: raw[9],
        remainingTime: Number(raw[10]),
        availableNow: BigInt(raw[11]),
    };
}

/** Parse a raw service tuple from getService() into a typed BillingService */
export function parseService(raw: any): BillingService {
    return {
        serviceId: raw.serviceId || raw[0],
        provider: raw.provider || raw[1],
        name: raw.name || raw[2],
        description: raw.description || raw[3],
        endpoint: raw.endpoint || raw[4],
        billingType: Number(raw.billingType ?? raw[5]) as BillingType,
        rate: BigInt(raw.rate ?? raw[6]),
        minDuration: Number(raw.minDuration ?? raw[7]),
        maxDuration: Number(raw.maxDuration ?? raw[8]),
        isActive: raw.isActive ?? raw[9],
        totalEarned: BigInt(raw.totalEarned ?? raw[10]),
        totalRequests: Number(raw.totalRequests ?? raw[11]),
        ratingSum: Number(raw.ratingSum ?? raw[12]),
        ratingCount: Number(raw.ratingCount ?? raw[13]),
        tags: raw.tags ?? raw[14] ?? [],
    };
}
