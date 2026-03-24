/**
 * CDP Add-On Mod — Manifest
 *
 * Tools, workflows, examples, and agent skills for the CDP Add-On.
 * Imported by skills.ts for the registry and by the CDP settings UI.
 */
import type { ModManifest, ModTool, ModWorkflow, ModExample, ModAgentSkill } from "./skills";

// ═══════════════════════════════════════════════════════════════
// Tools
// ═══════════════════════════════════════════════════════════════

export const CDP_TOOLS: ModTool[] = [
    {
        id: "cdp-server-wallet",
        name: "Server Wallet Manager",
        description:
            "Create and manage CDP server wallets (smart accounts or EOAs) for backend agent operations. Never exposes private keys.",
        icon: "Wallet",
        category: "Wallets",
        status: "active",
    },
    {
        id: "cdp-paymaster",
        name: "Gas Sponsorship Console",
        description:
            "Admin paymaster controls — set monthly gas budgets, contract allowlists, per-tx limits, and auto-pause rules. Proxy architecture never exposes paymaster URL.",
        icon: "Fuel",
        category: "Gas",
        status: "active",
    },
    {
        id: "cdp-spend-permissions",
        name: "Spend Permission Manager",
        description:
            "Create, inspect, and revoke agent spend permissions. Set allowances, expiry, and recipient restrictions on server wallets.",
        icon: "ShieldCheck",
        category: "Permissions",
        status: "active",
    },
    {
        id: "cdp-trade",
        name: "Trade / Swap Executor",
        description:
            "Execute token swaps via CDP Trade API using server wallets. Configurable slippage, supported pairs, and trade history.",
        icon: "ArrowLeftRight",
        category: "Trading",
        status: "active",
    },
    {
        id: "cdp-billing",
        name: "Backend Billing Engine",
        description:
            "Recurring subscription charges via backend-only server wallet operations. Automatic retry on failure, audit trail.",
        icon: "CreditCard",
        category: "Billing",
        status: "active",
    },
    {
        id: "cdp-policy-engine",
        name: "Policy Engine",
        description:
            "Rate limits, per-agent spending caps, allowed tokens/contracts, and emergency pause. Enforced on every CDP operation.",
        icon: "Scale",
        category: "Policy",
        status: "active",
    },
    {
        id: "cdp-secrets",
        name: "Secret Rotation",
        description:
            "Admin UI for rotating wallet secrets and CDP API keys. Env-based storage with zero-downtime rotation.",
        icon: "RotateCw",
        category: "Security",
        status: "active",
    },
];

// ═══════════════════════════════════════════════════════════════
// Workflows
// ═══════════════════════════════════════════════════════════════

export const CDP_WORKFLOWS: ModWorkflow[] = [
    {
        id: "cdp-wf-gasless-tx",
        name: "Gasless Transaction",
        description: "Execute a gasless agent transaction via CDP paymaster proxy",
        icon: "Fuel",
        tags: ["gas", "paymaster", "gasless"],
        steps: [
            "Agent requests transaction execution via capability",
            "Policy engine checks rate limits, spend caps, allowed contracts",
            "Paymaster proxy sponsors gas (never exposes paymaster URL)",
            "Server wallet signs and submits transaction",
            "Audit log records the operation",
        ],
    },
    {
        id: "cdp-wf-agent-swap",
        name: "Agent Token Swap",
        description: "Execute a token swap on behalf of an agent via CDP Trade API",
        icon: "ArrowLeftRight",
        tags: ["trade", "swap", "agent"],
        steps: [
            "Agent requests swap via cdp.trade.swap capability",
            "Policy engine validates: allowed tokens, daily cap, rate limit",
            "Spend permission checked for source token allowance",
            "CDP Trade API executes swap via server wallet",
            "Trade record and audit log written",
        ],
    },
    {
        id: "cdp-wf-billing-cycle",
        name: "Recurring Billing Charge",
        description: "Charge a subscription via server wallet on a recurring schedule",
        icon: "CreditCard",
        tags: ["billing", "subscription", "charge"],
        steps: [
            "Cron job triggers at nextChargeAt",
            "Verify billing cycle is active and not past-due",
            "Server wallet executes USDC transfer",
            "Update lastChargedAt and nextChargeAt",
            "On failure: increment failureCount, retry with backoff",
        ],
    },
];

// ═══════════════════════════════════════════════════════════════
// Examples
// ═══════════════════════════════════════════════════════════════

export const CDP_EXAMPLES: ModExample[] = [
    {
        id: "cdp-ex-create-wallet",
        name: "Create Server Wallet",
        description: "Create a new CDP smart account wallet for an agent",
        icon: "Wallet",
        tags: ["wallet", "server"],
        language: "typescript",
        codeSnippet: `const res = await fetch("/api/v1/mods/cdp-addon/wallets", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    label: "Trading Agent Wallet",
    walletType: "smart_account",
    agentId: "agent-123",
  }),
});
const { wallet } = await res.json();
// wallet.address = "0x..."`,
    },
    {
        id: "cdp-ex-sponsor-gas",
        name: "Sponsor Gas via Paymaster",
        description: "Submit a gasless transaction through the paymaster proxy",
        icon: "Fuel",
        tags: ["gas", "paymaster"],
        language: "typescript",
        codeSnippet: `const res = await fetch("/api/v1/mods/cdp-addon/paymaster/sponsor", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    agentId: "agent-123",
    target: "0xContractAddress",
    calldata: "0x...",
    value: "0",
  }),
});
const { txHash, gasSponsored } = await res.json();`,
    },
];

// ═══════════════════════════════════════════════════════════════
// Agent Skills
// ═══════════════════════════════════════════════════════════════

export const CDP_AGENT_SKILLS: ModAgentSkill[] = [
    {
        id: "cdp-skill-sponsor",
        name: "Sponsor Gas",
        description: "Request gas sponsorship for a transaction via CDP paymaster",
        type: "skill",
        invocation: "cdp.paymaster.sponsor",
        exampleInput: '{ "target": "0x...", "calldata": "0x...", "value": "0" }',
        exampleOutput: '{ "txHash": "0x...", "gasSponsored": true, "gasCostUsd": "0.002" }',
    },
    {
        id: "cdp-skill-sign",
        name: "Server Wallet Sign",
        description: "Sign a transaction or message using an assigned CDP server wallet",
        type: "skill",
        invocation: "cdp.server_wallet.sign",
        exampleInput: '{ "message": "0x...", "walletId": "wallet-abc" }',
        exampleOutput: '{ "signature": "0x...", "walletAddress": "0x..." }',
    },
    {
        id: "cdp-skill-charge",
        name: "Charge Subscription",
        description: "Trigger a one-off or recurring charge via server wallet",
        type: "skill",
        invocation: "cdp.subscription.charge",
        exampleInput: '{ "billingCycleId": "cycle-123" }',
        exampleOutput: '{ "txHash": "0x...", "amountUsd": 9.99, "nextChargeAt": "2026-04-24" }',
    },
    {
        id: "cdp-skill-swap",
        name: "Execute Trade",
        description: "Swap tokens via CDP Trade API using a server wallet",
        type: "skill",
        invocation: "cdp.trade.swap",
        exampleInput: '{ "fromToken": "ETH", "toToken": "USDC", "fromAmount": "0.1", "slippageBps": 50 }',
        exampleOutput: '{ "tradeId": "trade-xyz", "txHash": "0x...", "toAmount": "250.50" }',
    },
    {
        id: "cdp-skill-rotate",
        name: "Rotate Secrets",
        description: "Rotate CDP API keys or wallet secrets (admin only)",
        type: "skill",
        invocation: "cdp.secret.rotate",
        exampleInput: '{ "secretType": "cdp_api_key" }',
        exampleOutput: '{ "rotated": true, "newKeyPrefix": "cdp_..." }',
    },
];

// ═══════════════════════════════════════════════════════════════
// Manifest Export
// ═══════════════════════════════════════════════════════════════

export const CDP_MANIFEST: ModManifest = {
    tools: CDP_TOOLS,
    workflows: CDP_WORKFLOWS,
    examples: CDP_EXAMPLES,
    agentSkills: CDP_AGENT_SKILLS,
};
