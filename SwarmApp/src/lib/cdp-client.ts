/**
 * CDP SDK Client — Server-side only
 *
 * Wraps the Coinbase CDP SDK for server wallet operations,
 * paymaster proxy, and trade execution.
 *
 * NEVER import this file from client components.
 * All functions are called exclusively from API routes.
 */

import { CDP_CHAIN_ID, CDP_TESTNET_CHAIN_ID, CdpWalletType } from "./cdp";

// ═══════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════

interface CdpConfig {
    apiKeyName: string;
    apiKeySecret: string;
    paymasterUrl: string;
    network: "base" | "base-sepolia";
}

function getCdpConfig(): CdpConfig | null {
    const apiKeyName = process.env.CDP_API_KEY_NAME;
    const apiKeySecret = process.env.CDP_API_KEY_SECRET;
    const paymasterUrl = process.env.CDP_PAYMASTER_URL || "";
    const network = (process.env.CDP_NETWORK as "base" | "base-sepolia") || "base-sepolia";

    if (!apiKeyName || !apiKeySecret) {
        console.warn("[CDP] CDP_API_KEY_NAME and CDP_API_KEY_SECRET not configured — CDP operations will fail");
        return null;
    }

    return { apiKeyName, apiKeySecret, paymasterUrl, network };
}

function getChainId(): number {
    const config = getCdpConfig();
    return config?.network === "base" ? CDP_CHAIN_ID : CDP_TESTNET_CHAIN_ID;
}

// ═══════════════════════════════════════════════════════════════
// Server Wallet Operations
// ═══════════════════════════════════════════════════════════════

export interface CreateWalletResult {
    cdpWalletId: string;
    address: string;
    chainId: number;
}

/**
 * Create a new CDP server wallet (smart account or EOA).
 * Calls the CDP API server-side — private keys never leave CDP infrastructure.
 */
export async function createCdpWallet(options: {
    walletType: CdpWalletType;
    label: string;
}): Promise<CreateWalletResult> {
    const config = getCdpConfig();
    if (!config) throw new Error("CDP not configured");

    const chainId = getChainId();
    const networkId = config.network === "base" ? "base-mainnet" : "base-sepolia";

    // CDP Server Wallet v2 API call
    const res = await fetch("https://api.developer.coinbase.com/platform/v1/wallets", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.apiKeyName}:${config.apiKeySecret}`,
        },
        body: JSON.stringify({
            wallet: {
                network_id: networkId,
                use_server_signer: true,
            },
        }),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`CDP wallet creation failed (${res.status}): ${body}`);
    }

    const result = await res.json();
    const walletId = result.id || result.wallet?.id;

    // Create default address for the wallet
    const addrRes = await fetch(
        `https://api.developer.coinbase.com/platform/v1/wallets/${walletId}/addresses`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.apiKeyName}:${config.apiKeySecret}`,
            },
        },
    );

    if (!addrRes.ok) {
        const body = await addrRes.text();
        throw new Error(`CDP address creation failed (${addrRes.status}): ${body}`);
    }

    const addrResult = await addrRes.json();

    return {
        cdpWalletId: walletId,
        address: addrResult.address_id || addrResult.address || "",
        chainId,
    };
}

// ═══════════════════════════════════════════════════════════════
// Signing
// ═══════════════════════════════════════════════════════════════

export interface SignResult {
    signature: string;
    walletAddress: string;
}

/**
 * Sign arbitrary data using a CDP server wallet.
 */
export async function signWithWallet(
    cdpWalletId: string,
    addressId: string,
    message: string,
): Promise<SignResult> {
    const config = getCdpConfig();
    if (!config) throw new Error("CDP not configured");

    const res = await fetch(
        `https://api.developer.coinbase.com/platform/v1/wallets/${cdpWalletId}/addresses/${addressId}/sign_message`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.apiKeyName}:${config.apiKeySecret}`,
            },
            body: JSON.stringify({ message }),
        },
    );

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`CDP signing failed (${res.status}): ${body}`);
    }

    const result = await res.json();
    return {
        signature: result.signature || "",
        walletAddress: addressId,
    };
}

// ═══════════════════════════════════════════════════════════════
// Paymaster Proxy
// ═══════════════════════════════════════════════════════════════

export interface SponsorGasParams {
    target: string;
    calldata: string;
    value: string;
    walletAddress: string;
}

export interface SponsorGasResult {
    txHash: string;
    gasSponsored: boolean;
    gasCostUsd: number;
}

/**
 * Sponsor gas for a transaction via the CDP paymaster.
 * The paymaster URL is NEVER returned or exposed to the caller.
 */
export async function sponsorGas(params: SponsorGasParams): Promise<SponsorGasResult> {
    const config = getCdpConfig();
    if (!config) throw new Error("CDP not configured");
    if (!config.paymasterUrl) throw new Error("CDP paymaster URL not configured");

    // Call paymaster endpoint server-side
    const res = await fetch(config.paymasterUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "pm_sponsorUserOperation",
            params: [
                {
                    sender: params.walletAddress,
                    callData: params.calldata,
                    callGasLimit: "0x0",
                    verificationGasLimit: "0x0",
                    preVerificationGas: "0x0",
                    maxFeePerGas: "0x0",
                    maxPriorityFeePerGas: "0x0",
                },
                getChainId().toString(),
            ],
        }),
    });

    if (!res.ok) {
        const body = await res.text();
        // CRITICAL: Never include the paymaster URL in error messages
        throw new Error(`Gas sponsorship failed (${res.status})`);
    }

    const result = await res.json();
    if (result.error) {
        throw new Error(`Gas sponsorship error: ${result.error.message || "unknown"}`);
    }

    return {
        txHash: result.result?.txHash || "",
        gasSponsored: true,
        gasCostUsd: 0, // Will be calculated from gas receipt
    };
}

// ═══════════════════════════════════════════════════════════════
// Trade / Swap Execution
// ═══════════════════════════════════════════════════════════════

export interface ExecuteTradeParams {
    cdpWalletId: string;
    addressId: string;
    fromToken: string;
    toToken: string;
    fromAmount: string;
    slippageBps: number;
}

export interface ExecuteTradeResult {
    cdpTradeId: string;
    txHash: string;
    toAmount: string;
    status: "submitted" | "confirmed" | "failed";
}

/**
 * Execute a token swap via CDP Trade API using a server wallet.
 */
export async function executeTrade(params: ExecuteTradeParams): Promise<ExecuteTradeResult> {
    const config = getCdpConfig();
    if (!config) throw new Error("CDP not configured");

    const networkId = config.network === "base" ? "base-mainnet" : "base-sepolia";

    const res = await fetch(
        `https://api.developer.coinbase.com/platform/v1/wallets/${params.cdpWalletId}/addresses/${params.addressId}/trades`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.apiKeyName}:${config.apiKeySecret}`,
            },
            body: JSON.stringify({
                amount: params.fromAmount,
                from_asset_id: params.fromToken,
                to_asset_id: params.toToken,
                network_id: networkId,
            }),
        },
    );

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`CDP trade failed (${res.status}): ${body}`);
    }

    const result = await res.json();
    return {
        cdpTradeId: result.trade_id || result.id || "",
        txHash: result.transaction?.transaction_hash || "",
        toAmount: result.to_amount || "0",
        status: result.status === "complete" ? "confirmed" : "submitted",
    };
}

// ═══════════════════════════════════════════════════════════════
// Transfer (for billing)
// ═══════════════════════════════════════════════════════════════

export interface TransferParams {
    cdpWalletId: string;
    addressId: string;
    toAddress: string;
    tokenAddress: string;
    amount: string;
}

export interface TransferResult {
    txHash: string;
    status: "submitted" | "confirmed" | "failed";
}

/**
 * Execute a token transfer from a server wallet (used for billing charges).
 */
export async function executeTransfer(params: TransferParams): Promise<TransferResult> {
    const config = getCdpConfig();
    if (!config) throw new Error("CDP not configured");

    const networkId = config.network === "base" ? "base-mainnet" : "base-sepolia";

    const res = await fetch(
        `https://api.developer.coinbase.com/platform/v1/wallets/${params.cdpWalletId}/addresses/${params.addressId}/transfers`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.apiKeyName}:${config.apiKeySecret}`,
            },
            body: JSON.stringify({
                amount: params.amount,
                asset_id: params.tokenAddress,
                destination: params.toAddress,
                network_id: networkId,
            }),
        },
    );

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`CDP transfer failed (${res.status}): ${body}`);
    }

    const result = await res.json();
    return {
        txHash: result.transaction?.transaction_hash || "",
        status: result.status === "complete" ? "confirmed" : "submitted",
    };
}

// ═══════════════════════════════════════════════════════════════
// Secret Rotation
// ═══════════════════════════════════════════════════════════════

export interface RotateSecretResult {
    rotated: boolean;
    secretType: string;
    newKeyPrefix: string;
}

/**
 * Rotate a CDP secret. The actual rotation depends on the secret type:
 * - cdp_api_key: Calls CDP to regenerate API key
 * - wallet_secret: Rotates server-signer key for a wallet
 */
export async function rotateSecret(secretType: "cdp_api_key" | "wallet_secret"): Promise<RotateSecretResult> {
    const config = getCdpConfig();
    if (!config) throw new Error("CDP not configured");

    // For CDP API key rotation, the admin must update env vars after rotation.
    // This endpoint initiates the rotation on the CDP side.
    if (secretType === "cdp_api_key") {
        // In production, this would call CDP's key rotation API
        // For now, we return guidance that the admin must rotate via CDP dashboard
        return {
            rotated: false,
            secretType,
            newKeyPrefix: "Rotate via CDP Dashboard → API Keys",
        };
    }

    return {
        rotated: false,
        secretType,
        newKeyPrefix: "Rotate via CDP Dashboard → Wallet Settings",
    };
}
