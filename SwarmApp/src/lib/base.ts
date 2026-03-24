/**
 * Base Mod — Native Base chain integration for Swarm.
 *
 * Sign in with Base (SIWE + passkeys), one-tap USDC payments,
 * agent sub-accounts, spend permissions, recurring payment setup,
 * typed-data signing, and multi-chain account surface.
 *
 * Network: Base Mainnet (Chain ID 8453) + Base Sepolia (Chain ID 84532)
 */
import type { ModManifest, ModTool, ModWorkflow, ModExample, ModAgentSkill } from "./skills";

// ═══════════════════════════════════════════════════════════════
// Tools
// ═══════════════════════════════════════════════════════════════

export const BASE_TOOLS: ModTool[] = [
    {
        id: "base-auth",
        name: "Sign in with Base",
        description:
            "SIWE-compatible wallet authentication with passkey and smart-wallet support on Base. Generates EIP-4361 messages, verifies signatures, and issues session tokens.",
        icon: "ShieldCheck",
        category: "Auth",
        status: "active",
        usageExample: `// 1. Get SIWE payload
const { payload } = await fetch("/api/v1/base/auth/payload", {
  method: "POST",
  body: JSON.stringify({ address, chainId: 8453 }),
}).then(r => r.json());

// 2. Sign the message
const signature = await wallet.signMessage(payload.message);

// 3. Verify
await fetch("/api/v1/base/auth/verify", {
  method: "POST",
  body: JSON.stringify({ payload, signature }),
});`,
    },
    {
        id: "base-pay",
        name: "Base Pay (USDC)",
        description:
            "One-tap USDC payments on Base mainnet for mod purchases, agent top-ups, marketplace transactions, and task execution funding. 6-decimal precision via ERC-20 transfer.",
        icon: "CreditCard",
        category: "Payments",
        status: "active",
        usageExample: `// Send 50 USDC on Base
import { transfer } from "thirdweb/extensions/erc20";
const tx = transfer({ contract: usdcContract, to: treasury, amount: 50 });
await sendTransaction(tx);`,
    },
    {
        id: "base-subaccount",
        name: "Agent Sub-Accounts",
        description:
            "App-specific sub-accounts per agent or workspace on Base, isolating spending from the org master wallet. Each sub-account has its own address, balance tracking, and spend limits.",
        icon: "Users",
        category: "Accounts",
        status: "active",
    },
    {
        id: "base-spend-permissions",
        name: "Spend Permissions",
        description:
            "Grant, view, and revoke spend permissions for agents including recurring allowances and bounded budgets. Supports per-agent caps with period-based limits.",
        icon: "KeyRound",
        category: "Permissions",
        status: "active",
    },
    {
        id: "base-recurring-payments",
        name: "Recurring Payments",
        description:
            "Configure subscription payments for plans, premium mods, and agent budgets on Base. Setup and consent only — backend charge execution is handled by CDP.",
        icon: "Clock",
        category: "Payments",
        status: "active",
    },
    {
        id: "base-typed-data-signing",
        name: "Typed-Data Signing",
        description:
            "EIP-712 typed-data signing and verification for auth challenges, approval prompts, offchain attestations, and mod consent flows on Base.",
        icon: "FileSignature",
        category: "Auth",
        status: "active",
    },
    {
        id: "base-multi-chain",
        name: "Multi-Chain Account Surface",
        description:
            "View your Base Account address alongside supported EVM network posture. Shows balances, chain status, and account configuration across all connected networks.",
        icon: "Globe",
        category: "Accounts",
        status: "active",
    },
];

// ═══════════════════════════════════════════════════════════════
// Workflows
// ═══════════════════════════════════════════════════════════════

export const BASE_WORKFLOWS: ModWorkflow[] = [
    {
        id: "base-onboard",
        name: "Base Account Onboarding",
        description: "Connect wallet, sign in with Base, set up USDC payments, and configure agent sub-accounts",
        icon: "Rocket",
        tags: ["auth", "onboarding", "base"],
        steps: [
            "Connect wallet (MetaMask, Coinbase Wallet, passkey, or smart wallet)",
            "Sign SIWE message on Base network",
            "Session created and org linked",
            "Enable USDC payments on Base mainnet",
            "Optionally create agent sub-accounts for spending isolation",
            "Set spend permission budgets per agent",
        ],
    },
    {
        id: "base-agent-funding",
        name: "Fund Agent Sub-Account",
        description: "Create a sub-account for an agent, fund it with USDC, and set spend limits",
        icon: "Wallet",
        tags: ["agent", "funding", "subaccount"],
        steps: [
            "Navigate to Sub-Accounts tab",
            "Create new sub-account for target agent or workspace",
            "Transfer USDC from org wallet to sub-account",
            "Set daily and monthly spend limits",
            "Configure approved recipients or categories",
            "Agent can now execute funded tasks autonomously",
        ],
    },
    {
        id: "base-recurring-setup",
        name: "Set Up Recurring Payment",
        description: "Configure a subscription or recurring agent budget funded by USDC on Base",
        icon: "RefreshCw",
        tags: ["recurring", "subscription", "payments"],
        steps: [
            "Select payment type: mod subscription, plan, or agent budget",
            "Choose frequency: weekly, monthly, quarterly, or yearly",
            "Set USDC amount and optional lifetime cap",
            "Approve EIP-712 typed-data consent signature",
            "Recurring config stored — charge execution handled by CDP backend",
        ],
    },
];

// ═══════════════════════════════════════════════════════════════
// Examples
// ═══════════════════════════════════════════════════════════════

export const BASE_EXAMPLES: ModExample[] = [
    {
        id: "base-ex-pay",
        name: "One-Tap USDC Payment",
        description: "Send USDC on Base mainnet to purchase a marketplace item",
        icon: "CreditCard",
        tags: ["payment", "usdc", "base"],
        language: "typescript",
        codeSnippet: `import { getContract, sendTransaction } from "thirdweb";
import { transfer } from "thirdweb/extensions/erc20";
import { base } from "thirdweb/chains";
import { thirdwebClient } from "@/lib/thirdweb-client";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const usdcContract = getContract({ client: thirdwebClient, chain: base, address: USDC_BASE });

// Send 50 USDC
const tx = transfer({ contract: usdcContract, to: treasuryAddress, amount: 50 });
const result = await sendTransaction({ transaction: tx, account });
console.log("Tx hash:", result.transactionHash);`,
    },
    {
        id: "base-ex-siwe",
        name: "Sign In with Base (SIWE)",
        description: "Generate and verify a SIWE message for Base-native authentication",
        icon: "ShieldCheck",
        tags: ["auth", "siwe", "base"],
        language: "typescript",
        codeSnippet: `// 1. Generate SIWE payload
const { payload } = await fetch("/api/v1/base/auth/payload", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ address: "0x...", chainId: 8453 }),
}).then(r => r.json());

// 2. User signs the message
const signature = await account.signMessage({ message: payload.message });

// 3. Server verifies signature and creates session
const { verified, session } = await fetch("/api/v1/base/auth/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ payload, signature }),
}).then(r => r.json());`,
    },
];

// ═══════════════════════════════════════════════════════════════
// Agent Skills
// ═══════════════════════════════════════════════════════════════

export const BASE_AGENT_SKILLS: ModAgentSkill[] = [
    {
        id: "base-skill-auth",
        name: "Base Auth Verify",
        description: "Verify a SIWE signature and return session status for Base wallet authentication",
        type: "skill",
        invocation: "base.auth.verify",
        exampleInput: '{ "address": "0x...", "signature": "0x...", "message": "..." }',
        exampleOutput: '{ "valid": true, "address": "0x...", "chainId": 8453 }',
    },
    {
        id: "base-skill-pay",
        name: "Base USDC Payment",
        description: "Execute a one-tap USDC payment on Base mainnet via ERC-20 transfer",
        type: "skill",
        invocation: "base.pay.send",
        exampleInput: '{ "to": "0x...", "amount": 50, "memo": "task-funding" }',
        exampleOutput: '{ "txHash": "0x...", "amount": 50, "chain": "base" }',
    },
    {
        id: "base-skill-subaccount-create",
        name: "Create Sub-Account",
        description: "Create a new Base sub-account for an agent or workspace with wallet access",
        type: "skill",
        invocation: "base.subaccount.create",
        exampleInput: '{ "agentId": "agent-123", "label": "Research Budget" }',
        exampleOutput: '{ "subAccountId": "...", "address": "0x...", "balance": 0 }',
    },
    {
        id: "base-skill-permission-request",
        name: "Request Spend Permission",
        description: "Agent requests a spend permission from the org owner on Base",
        type: "skill",
        invocation: "base.permission.request",
        exampleInput: '{ "agentId": "agent-123", "amount": 100, "period": "monthly", "reason": "API calls" }',
        exampleOutput: '{ "permissionId": "...", "status": "pending" }',
    },
    {
        id: "base-skill-signature-verify",
        name: "Verify Typed Signature",
        description: "Verify an EIP-712 typed-data signature for auth or consent on Base",
        type: "skill",
        invocation: "base.signature.verify",
        exampleInput: '{ "typedData": {}, "signature": "0x...", "expectedSigner": "0x..." }',
        exampleOutput: '{ "valid": true, "recoveredAddress": "0x..." }',
    },
];

// ═══════════════════════════════════════════════════════════════
// Manifest
// ═══════════════════════════════════════════════════════════════

export const BASE_MANIFEST: ModManifest = {
    tools: BASE_TOOLS,
    workflows: BASE_WORKFLOWS,
    examples: BASE_EXAMPLES,
    agentSkills: BASE_AGENT_SKILLS,
};
