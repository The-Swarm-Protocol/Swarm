/**
 * Token Gate — Multichain token/NFT-gated access for marketplace items
 *
 * Verifies that a wallet holds sufficient tokens or NFTs on any
 * supported chain to grant access to premium marketplace items.
 * Supports EVM (ERC-20, ERC-721, ERC-1155), Solana (SPL, NFT),
 * and Hedera (HBAR native, HTS tokens).
 */

import { CHAIN_CONFIGS, type ChainKey } from "./chains";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type TokenStandard = "native" | "erc20" | "erc721" | "erc1155" | "spl" | "spl-nft" | "hts";

export interface TokenGateConfig {
    /** Which chain to check */
    chain: ChainKey;
    /** Token standard to check */
    standard: TokenStandard;
    /** Contract/mint address (null for native currency checks) */
    contractAddress?: string;
    /** Minimum balance required (human-readable, e.g. "100" for 100 USDC) */
    minBalance: string;
    /** The marketplace item ID this gate grants access to */
    grantedItemId: string;
    /** Human-readable description shown in UI */
    description?: string;
}

export interface TokenGateResult {
    passed: boolean;
    chain: string;
    standard: TokenStandard;
    currentBalance: string;
    requiredBalance: string;
    contractAddress?: string;
    checkedAt: number;
    error?: string;
}

// ═══════════════════════════════════════════════════════════════
// In-memory cache (60s TTL) to avoid RPC spam
// ═══════════════════════════════════════════════════════════════

const cache = new Map<string, { result: TokenGateResult; expiresAt: number }>();

function cacheKey(wallet: string, config: TokenGateConfig): string {
    return `${wallet}:${config.chain}:${config.standard}:${config.contractAddress || "native"}:${config.minBalance}`;
}

function getCached(wallet: string, config: TokenGateConfig): TokenGateResult | null {
    const key = cacheKey(wallet, config);
    const entry = cache.get(key);
    if (entry && entry.expiresAt > Date.now()) return entry.result;
    if (entry) cache.delete(key);
    return null;
}

function setCache(wallet: string, config: TokenGateConfig, result: TokenGateResult): void {
    cache.set(cacheKey(wallet, config), { result, expiresAt: Date.now() + 60_000 });
}

// ═══════════════════════════════════════════════════════════════
// ABI fragments for EVM balance checks
// ═══════════════════════════════════════════════════════════════

const ERC20_ABI = ["function balanceOf(address owner) view returns (uint256)", "function decimals() view returns (uint8)"];
const ERC721_ABI = ["function balanceOf(address owner) view returns (uint256)"];
const ERC1155_ABI = ["function balanceOf(address account, uint256 id) view returns (uint256)"];

// ═══════════════════════════════════════════════════════════════
// EVM Chain Verifier (ETH, Base, Avalanche, Sepolia, etc.)
// ═══════════════════════════════════════════════════════════════

async function verifyEvmTokenGate(wallet: string, config: TokenGateConfig): Promise<TokenGateResult> {
    const chainConfig = CHAIN_CONFIGS[config.chain];
    if (!chainConfig) {
        return { passed: false, chain: config.chain, standard: config.standard, currentBalance: "0", requiredBalance: config.minBalance, checkedAt: Date.now(), error: `Unknown chain: ${config.chain}` };
    }

    try {
        const { JsonRpcProvider, Contract, formatUnits } = await import("ethers");
        const provider = new JsonRpcProvider(chainConfig.rpc);

        let currentBalance: string;

        if (config.standard === "native") {
            const balance = await provider.getBalance(wallet);
            currentBalance = formatUnits(balance, chainConfig.nativeCurrency.decimals);
        } else if (config.standard === "erc20") {
            if (!config.contractAddress) {
                return { passed: false, chain: config.chain, standard: config.standard, currentBalance: "0", requiredBalance: config.minBalance, checkedAt: Date.now(), error: "contractAddress required for erc20" };
            }
            const contract = new Contract(config.contractAddress, ERC20_ABI, provider);
            const [balance, decimals] = await Promise.all([
                contract.balanceOf(wallet) as Promise<bigint>,
                contract.decimals().catch(() => 18) as Promise<number>,
            ]);
            currentBalance = formatUnits(balance, decimals);
        } else if (config.standard === "erc721") {
            if (!config.contractAddress) {
                return { passed: false, chain: config.chain, standard: config.standard, currentBalance: "0", requiredBalance: config.minBalance, checkedAt: Date.now(), error: "contractAddress required for erc721" };
            }
            const contract = new Contract(config.contractAddress, ERC721_ABI, provider);
            const balance = await contract.balanceOf(wallet) as bigint;
            currentBalance = balance.toString();
        } else if (config.standard === "erc1155") {
            if (!config.contractAddress) {
                return { passed: false, chain: config.chain, standard: config.standard, currentBalance: "0", requiredBalance: config.minBalance, checkedAt: Date.now(), error: "contractAddress required for erc1155" };
            }
            const contract = new Contract(config.contractAddress, ERC1155_ABI, provider);
            // For ERC-1155, minBalance format is "tokenId:amount" or just "amount" (tokenId=0)
            const [tokenId] = config.minBalance.includes(":") ? config.minBalance.split(":") : ["0"];
            const balance = await contract.balanceOf(wallet, tokenId) as bigint;
            currentBalance = balance.toString();
        } else {
            return { passed: false, chain: config.chain, standard: config.standard, currentBalance: "0", requiredBalance: config.minBalance, checkedAt: Date.now(), error: `Unsupported standard for EVM: ${config.standard}` };
        }

        const required = config.standard === "erc1155" && config.minBalance.includes(":")
            ? config.minBalance.split(":")[1]
            : config.minBalance;
        const passed = parseFloat(currentBalance) >= parseFloat(required);

        return { passed, chain: config.chain, standard: config.standard, currentBalance, requiredBalance: config.minBalance, contractAddress: config.contractAddress, checkedAt: Date.now() };
    } catch (err) {
        return { passed: false, chain: config.chain, standard: config.standard, currentBalance: "0", requiredBalance: config.minBalance, checkedAt: Date.now(), error: err instanceof Error ? err.message : "EVM verification failed" };
    }
}

// ═══════════════════════════════════════════════════════════════
// Solana Verifier
// ═══════════════════════════════════════════════════════════════

async function verifySolanaTokenGate(wallet: string, config: TokenGateConfig): Promise<TokenGateResult> {
    try {
        const { Connection, PublicKey } = await import("@solana/web3.js");
        const rpcUrl = CHAIN_CONFIGS.solana?.rpc || process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
        const connection = new Connection(rpcUrl);

        let currentBalance: string;

        if (config.standard === "native") {
            const lamports = await connection.getBalance(new PublicKey(wallet));
            currentBalance = (lamports / 1_000_000_000).toString();
        } else if (config.standard === "spl" || config.standard === "spl-nft") {
            if (!config.contractAddress) {
                return { passed: false, chain: "solana", standard: config.standard, currentBalance: "0", requiredBalance: config.minBalance, checkedAt: Date.now(), error: "contractAddress (mint) required for SPL tokens" };
            }
            const accounts = await connection.getParsedTokenAccountsByOwner(
                new PublicKey(wallet),
                { mint: new PublicKey(config.contractAddress) },
            );
            if (accounts.value.length === 0) {
                currentBalance = "0";
            } else {
                const info = accounts.value[0].account.data.parsed?.info;
                currentBalance = info?.tokenAmount?.uiAmountString || "0";
            }
        } else {
            return { passed: false, chain: "solana", standard: config.standard, currentBalance: "0", requiredBalance: config.minBalance, checkedAt: Date.now(), error: `Unsupported standard for Solana: ${config.standard}` };
        }

        const passed = parseFloat(currentBalance) >= parseFloat(config.minBalance);
        return { passed, chain: "solana", standard: config.standard, currentBalance, requiredBalance: config.minBalance, contractAddress: config.contractAddress, checkedAt: Date.now() };
    } catch (err) {
        return { passed: false, chain: "solana", standard: config.standard, currentBalance: "0", requiredBalance: config.minBalance, checkedAt: Date.now(), error: err instanceof Error ? err.message : "Solana verification failed" };
    }
}

// ═══════════════════════════════════════════════════════════════
// Hedera Verifier (via Mirror Node REST API)
// ═══════════════════════════════════════════════════════════════

async function verifyHederaTokenGate(wallet: string, config: TokenGateConfig): Promise<TokenGateResult> {
    const mirrorUrl = process.env.HEDERA_MIRROR_URL || "https://testnet.mirrornode.hedera.com";

    try {
        let currentBalance: string;

        if (config.standard === "native") {
            const res = await fetch(`${mirrorUrl}/api/v1/balances?account.id=${wallet}&limit=1`);
            if (!res.ok) {
                return { passed: false, chain: "hedera", standard: "native", currentBalance: "0", requiredBalance: config.minBalance, checkedAt: Date.now(), error: `Mirror Node returned ${res.status}` };
            }
            const data = await res.json();
            const entry = data.balances?.[0];
            // Mirror Node returns tinybars (1 HBAR = 100_000_000 tinybars)
            const hbar = entry ? entry.balance / 100_000_000 : 0;
            currentBalance = hbar.toString();
        } else if (config.standard === "hts") {
            if (!config.contractAddress) {
                return { passed: false, chain: "hedera", standard: "hts", currentBalance: "0", requiredBalance: config.minBalance, checkedAt: Date.now(), error: "contractAddress (token ID) required for HTS" };
            }
            const res = await fetch(`${mirrorUrl}/api/v1/tokens/${config.contractAddress}/balances?account.id=${wallet}&limit=1`);
            if (!res.ok) {
                return { passed: false, chain: "hedera", standard: "hts", currentBalance: "0", requiredBalance: config.minBalance, checkedAt: Date.now(), error: `Mirror Node returned ${res.status}` };
            }
            const data = await res.json();
            const entry = data.balances?.[0];
            currentBalance = entry ? entry.balance.toString() : "0";
        } else {
            return { passed: false, chain: "hedera", standard: config.standard, currentBalance: "0", requiredBalance: config.minBalance, checkedAt: Date.now(), error: `Unsupported standard for Hedera: ${config.standard}` };
        }

        const passed = parseFloat(currentBalance) >= parseFloat(config.minBalance);
        return { passed, chain: "hedera", standard: config.standard, currentBalance, requiredBalance: config.minBalance, contractAddress: config.contractAddress, checkedAt: Date.now() };
    } catch (err) {
        return { passed: false, chain: "hedera", standard: config.standard, currentBalance: "0", requiredBalance: config.minBalance, checkedAt: Date.now(), error: err instanceof Error ? err.message : "Hedera verification failed" };
    }
}

// ═══════════════════════════════════════════════════════════════
// Router — dispatches to the correct chain verifier
// ═══════════════════════════════════════════════════════════════

const EVM_CHAINS = new Set<string>(["ethereum", "avalanche", "base", "sepolia", "filecoin"]);

export async function verifyTokenGate(wallet: string, config: TokenGateConfig): Promise<TokenGateResult> {
    // Check cache first
    const cached = getCached(wallet, config);
    if (cached) return cached;

    let result: TokenGateResult;

    if (config.chain === "solana") {
        result = await verifySolanaTokenGate(wallet, config);
    } else if (config.chain === "hedera") {
        result = await verifyHederaTokenGate(wallet, config);
    } else if (EVM_CHAINS.has(config.chain)) {
        result = await verifyEvmTokenGate(wallet, config);
    } else {
        result = {
            passed: false,
            chain: config.chain,
            standard: config.standard,
            currentBalance: "0",
            requiredBalance: config.minBalance,
            checkedAt: Date.now(),
            error: `Unsupported chain: ${config.chain}`,
        };
    }

    setCache(wallet, config, result);
    return result;
}

// ═══════════════════════════════════════════════════════════════
// Unified Access Resolution
// ═══════════════════════════════════════════════════════════════

export type AccessType = "subscription" | "token_gate" | "free" | "none";

export interface AccessResult {
    hasAccess: boolean;
    accessType: AccessType;
    tokenGateResult?: TokenGateResult;
}

/**
 * Check if an org/wallet has access to a marketplace item via:
 * 1. Free tier (pricing.model === "free")
 * 2. Active Firestore subscription (Stripe or crypto one-time purchase)
 * 3. Token gate (wallet holds required tokens/NFTs)
 *
 * This runs server-side only (uses Firestore + RPC calls).
 */
export async function resolveAccess(
    orgId: string,
    itemId: string,
    wallet: string,
    item?: { pricing?: { model?: string }; tokenGate?: TokenGateConfig },
): Promise<AccessResult> {
    // 1. Check if item is free
    if (item?.pricing?.model === "free") {
        return { hasAccess: true, accessType: "free" };
    }

    // 2. Check for active subscription in Firestore
    try {
        const { collection, query, where, getDocs } = await import("firebase/firestore");
        const { db } = await import("./firebase");

        const q = query(
            collection(db, "marketSubscriptions"),
            where("orgId", "==", orgId),
            where("itemId", "==", itemId),
            where("status", "==", "active"),
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
            return { hasAccess: true, accessType: "subscription" };
        }
    } catch {
        // Firestore may not be available in some contexts — continue to token gate check
    }

    // 3. Check token gate
    if (item?.tokenGate && wallet) {
        const result = await verifyTokenGate(wallet, item.tokenGate);
        if (result.passed) {
            return { hasAccess: true, accessType: "token_gate", tokenGateResult: result };
        }
        return { hasAccess: false, accessType: "none", tokenGateResult: result };
    }

    return { hasAccess: false, accessType: "none" };
}
