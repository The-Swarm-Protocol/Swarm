/**
 * CDP Add-On — Types, Constants, and Helpers
 *
 * Coinbase Developer Platform integration for the Swarm platform.
 * Server wallets, paymaster gas sponsorship, spend permissions,
 * trade execution, recurring billing, policy enforcement, and
 * secret rotation on Base (Chain ID 8453).
 */

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

export const CDP_CHAIN_ID = 8453; // Base mainnet
export const CDP_TESTNET_CHAIN_ID = 84532; // Base Sepolia
export const CDP_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base mainnet USDC
export const CDP_USDC_DECIMALS = 6;

// ═══════════════════════════════════════════════════════════════
// Enums
// ═══════════════════════════════════════════════════════════════

export enum CdpWalletType {
    SmartAccount = "smart_account",
    EOA = "eoa",
}

export enum CdpWalletStatus {
    Active = "active",
    Frozen = "frozen",
    Rotating = "rotating",
    Archived = "archived",
}

export enum SpendPermissionStatus {
    Active = "active",
    Revoked = "revoked",
    Expired = "expired",
    Exhausted = "exhausted",
}

export enum CdpTradeStatus {
    Pending = "pending",
    Submitted = "submitted",
    Confirmed = "confirmed",
    Failed = "failed",
}

export enum CdpBillingCycleStatus {
    Active = "active",
    PastDue = "past_due",
    Cancelled = "cancelled",
    Completed = "completed",
}

export enum CdpPolicyAction {
    Allow = "allow",
    Deny = "deny",
    RateLimit = "rate_limit",
    RequireApproval = "require_approval",
}

// ═══════════════════════════════════════════════════════════════
// Core Interfaces
// ═══════════════════════════════════════════════════════════════

/** CDP Server Wallet — managed by backend, never exposed to client */
export interface CdpServerWallet {
    id: string;
    orgId: string;
    agentId?: string;
    walletType: CdpWalletType;
    address: string;
    label: string;
    chainId: number;
    status: CdpWalletStatus;
    cdpWalletId: string;
    createdBy: string;
    createdAt: Date | null;
    lastUsedAt: Date | null;
    rotatedAt: Date | null;
    metadata?: Record<string, unknown>;
}

/** Paymaster sponsorship config per org */
export interface CdpPaymasterConfig {
    id: string;
    orgId: string;
    enabled: boolean;
    monthlyBudgetUsd: number;
    spentThisCycleUsd: number;
    currentCycleStart: Date | null;
    allowedContracts: string[];
    allowedSelectors?: string[];
    perTxGasLimitEth: number;
    autoPauseOnBudgetExhausted: boolean;
    updatedAt: Date | null;
    updatedBy: string;
}

/** Spend permission granted to an agent */
export interface CdpSpendPermission {
    id: string;
    orgId: string;
    agentId: string;
    walletId: string;
    tokenAddress: string;
    /** Max allowed spend (raw token units as string for Firestore compat) */
    allowanceAmount: string;
    /** Already spent (raw token units as string) */
    spentAmount: string;
    expiresAt: Date | null;
    status: SpendPermissionStatus;
    allowedRecipients?: string[];
    description: string;
    createdBy: string;
    createdAt: Date | null;
    revokedAt: Date | null;
    revokedBy?: string;
}

/** Trade execution record */
export interface CdpTradeRecord {
    id: string;
    orgId: string;
    agentId: string;
    walletId: string;
    fromToken: string;
    toToken: string;
    fromAmount: string;
    toAmount?: string;
    slippageBps: number;
    status: CdpTradeStatus;
    cdpTradeId?: string;
    txHash?: string;
    errorMessage?: string;
    executedAt: Date | null;
    createdAt: Date | null;
}

/** Recurring billing subscription charged via server wallet */
export interface CdpBillingCycle {
    id: string;
    orgId: string;
    subscriptionId: string;
    walletId: string;
    amountUsd: number;
    tokenAddress: string;
    intervalDays: number;
    nextChargeAt: Date | null;
    lastChargedAt: Date | null;
    lastChargeTxHash?: string;
    status: CdpBillingCycleStatus;
    failureCount: number;
    createdAt: Date | null;
}

/** CDP policy rule — controls agent/org behavior */
export interface CdpPolicyRule {
    id: string;
    orgId: string;
    name: string;
    description: string;
    /** Target: specific agentId, "org" (all agents), or "*" (global) */
    target: string;
    capabilityKey: string;
    action: CdpPolicyAction;
    rateLimit?: {
        maxPerMinute: number;
        maxPerHour: number;
        maxPerDay: number;
    };
    dailySpendCapUsd?: number;
    allowedTokens?: string[];
    allowedContracts?: string[];
    emergencyPause: boolean;
    enabled: boolean;
    createdBy: string;
    createdAt: Date | null;
    updatedAt: Date | null;
}

/** Audit log entry for CDP operations */
export interface CdpAuditEntry {
    id: string;
    orgId: string;
    agentId?: string;
    walletId?: string;
    action: string;
    capabilityKey?: string;
    details: Record<string, unknown>;
    outcome: "success" | "denied" | "error";
    policyRuleId?: string;
    timestamp: Date | null;
}

// ═══════════════════════════════════════════════════════════════
// Firestore Collection Names
// ═══════════════════════════════════════════════════════════════

export const CDP_COLLECTIONS = {
    SERVER_WALLETS: "cdpServerWallets",
    PAYMASTER_CONFIGS: "cdpPaymasterConfigs",
    SPEND_PERMISSIONS: "cdpSpendPermissions",
    TRADE_RECORDS: "cdpTradeRecords",
    BILLING_CYCLES: "cdpBillingCycles",
    POLICY_RULES: "cdpPolicyRules",
    AUDIT_LOG: "cdpAuditLog",
} as const;

// ═══════════════════════════════════════════════════════════════
// Capability Keys
// ═══════════════════════════════════════════════════════════════

export const CDP_CAPABILITIES = {
    PAYMASTER_SPONSOR: "cdp.paymaster.sponsor",
    SERVER_WALLET_SIGN: "cdp.server_wallet.sign",
    SUBSCRIPTION_CHARGE: "cdp.subscription.charge",
    TRADE_SWAP: "cdp.trade.swap",
    SECRET_ROTATE: "cdp.secret.rotate",
} as const;

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

export function shortCdpAddr(addr: string): string {
    if (!addr || addr.length < 10) return addr || "--";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function isSpendPermissionActive(p: CdpSpendPermission): boolean {
    if (p.status !== SpendPermissionStatus.Active) return false;
    if (p.expiresAt && p.expiresAt.getTime() < Date.now()) return false;
    if (BigInt(p.spentAmount) >= BigInt(p.allowanceAmount)) return false;
    return true;
}

export function remainingAllowance(p: CdpSpendPermission): bigint {
    const allowance = BigInt(p.allowanceAmount);
    const spent = BigInt(p.spentAmount);
    return allowance > spent ? allowance - spent : 0n;
}

export function formatUsdcAmount(rawAmount: string): string {
    const val = Number(BigInt(rawAmount)) / 10 ** CDP_USDC_DECIMALS;
    return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}
