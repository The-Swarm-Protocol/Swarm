/**
 * PayStream Mod — Pay-per-second USDC micropayment streaming for AI services.
 *
 * Contains tools, workflows, examples, and agent skills for the PayStream mod.
 * Imported by skills.ts (registry) and the /paystream page (UI).
 *
 * Based on: https://github.com/TheMasterClaw/Pay-Stream
 * Network: Base Sepolia (Chain ID 84532)
 */
import type { ModManifest, ModTool, ModWorkflow, ModExample, ModAgentSkill } from "./skills";

// ═══════════════════════════════════════════════════════════════
// Tools
// ═══════════════════════════════════════════════════════════════

export const PAYSTREAM_TOOLS: ModTool[] = [
    {
        id: "usdc-streaming",
        name: "USDC Payment Streaming",
        description:
            "Create pay-per-second USDC streams to any recipient on Base Sepolia. Streams support pause/resume, auto-renewal, and partial withdrawals. Platform fee is 0.25%.",
        icon: "Banknote",
        category: "Payments",
        status: "active",
        usageExample: `// Create a 100 USDC stream over 1 hour
await paystream.createStream({
  recipient: "0x...",
  amount: fromUSDC(100),     // 100 USDC (6 decimals)
  duration: 3600,            // 1 hour in seconds
  serviceId: "ai-inference",
  autoRenew: false,
});`,
    },
    {
        id: "agent-wallet-manager",
        name: "Agent Wallet Manager",
        description:
            "Self-custodial BIP39 HD wallets for AI agents. Generate 12-word mnemonics, derive EVM addresses (m/44'/60'/0'/0/0), set daily spend limits, and configure approved recipients for autonomous streaming.",
        icon: "Wallet",
        category: "Wallets",
        status: "active",
        usageExample: `// Generate a new agent wallet
const wallet = ethers.Wallet.createRandom();
console.log("Mnemonic:", wallet.mnemonic.phrase);
console.log("Address:", wallet.address);

// Set daily spending limit to 500 USDC
await agentWallet.setDailyLimit(fromUSDC(500));`,
    },
    {
        id: "service-marketplace",
        name: "Service Marketplace",
        description:
            "Browse, register, and rate AI services in the on-chain BillingRegistry. Supports 5 billing models: PerSecond, PerCall, PerToken, Fixed, and Hybrid. Includes cost calculator and tag-based discovery.",
        icon: "Store",
        category: "Marketplace",
        status: "active",
        usageExample: `// Register an AI inference service
await registry.registerService({
  name: "GPT-4 Inference",
  description: "LLM inference endpoint",
  endpoint: "https://api.example.com/v1",
  billingType: BillingType.PerToken,
  rate: fromUSDC(0.001),   // $0.001 per token
  minDuration: 60,
  maxDuration: 86400,
  tags: ["ai", "llm", "inference"],
});`,
    },
    {
        id: "stream-analytics",
        name: "Stream Analytics",
        description:
            "Real-time monitoring of active payment streams. Track incoming/outgoing flows, available balances, withdrawal history, and stream health across all your streams.",
        icon: "BarChart3",
        category: "Analytics",
        status: "active",
    },
    {
        id: "auto-stream-config",
        name: "Auto-Stream Configuration",
        description:
            "Configure agent wallets to automatically stream USDC to approved recipients. Set per-recipient limits on amount and duration. Operators can initiate streams without owner approval.",
        icon: "Settings2",
        category: "Automation",
        status: "active",
        usageExample: `// Allow auto-streaming up to 1000 USDC to a service
await agentWallet.configureAutoStream({
  recipient: "0xServiceAddr...",
  maxAmount: fromUSDC(1000),
  maxDuration: 86400,  // 24 hours
  enabled: true,
});`,
    },
    {
        id: "usdc-faucet",
        name: "USDC Faucet",
        description:
            "Get 10,000 free testnet USDC on Base Sepolia for testing and development. Calls the MockUSDC contract's faucet() function directly — no server keys required.",
        icon: "Droplets",
        category: "Testing",
        status: "active",
    },
    {
        id: "batch-payments",
        name: "Batch Payments",
        description:
            "Send USDC to multiple recipients in a single transaction from an agent wallet. Supports up to 50 recipients per batch. Daily spend limits still apply.",
        icon: "Users",
        category: "Payments",
        status: "active",
    },
    {
        id: "cost-calculator",
        name: "Cost Calculator",
        description:
            "Estimate service costs across all billing models before committing to a stream. Compare PerSecond vs PerCall vs PerToken pricing for informed decisions.",
        icon: "Calculator",
        category: "Marketplace",
        status: "active",
    },
];

// ═══════════════════════════════════════════════════════════════
// Workflows
// ═══════════════════════════════════════════════════════════════

export const PAYSTREAM_WORKFLOWS: ModWorkflow[] = [
    {
        id: "ps-create-stream",
        name: "Create Payment Stream",
        description: "End-to-end flow for creating a USDC payment stream on Base Sepolia",
        icon: "ArrowRightLeft",
        tags: ["payment", "streaming", "usdc"],
        steps: [
            "Connect wallet and switch to Base Sepolia network",
            "Get test USDC from the faucet (10,000 USDC per request)",
            "Approve PaymentStreamV2 contract to spend your USDC",
            "Set recipient address, amount, duration, and optional service ID",
            "Create stream — funds begin flowing at the per-second rate",
            "Monitor stream: pause, resume, or cancel as needed",
            "Recipient withdraws available USDC at any time",
        ],
    },
    {
        id: "ps-register-service",
        name: "Register AI Service",
        description: "Register your AI service in the on-chain BillingRegistry for discovery and streaming payments",
        icon: "FilePlus",
        tags: ["marketplace", "registration", "billing"],
        steps: [
            "Choose a billing model: PerSecond, PerCall, PerToken, Fixed, or Hybrid",
            "Set rate, min/max duration limits, and descriptive tags",
            "Register service on the BillingRegistry smart contract",
            "Service appears in the marketplace for other users to discover",
            "Earn USDC as users stream payments to your service",
            "Track earnings and ratings in the analytics dashboard",
        ],
    },
    {
        id: "ps-agent-wallet-setup",
        name: "Agent Wallet Setup",
        description: "Create and configure a self-custodial wallet for autonomous agent payments",
        icon: "KeyRound",
        tags: ["wallet", "agent", "bip39"],
        steps: [
            "Generate a BIP39 12-word mnemonic (client-side, never sent to server)",
            "Derive EVM address via HD path m/44'/60'/0'/0/0",
            "Fund the agent wallet with USDC via deposit()",
            "Set daily spending limit to control maximum autonomous spend",
            "Configure approved recipients with per-recipient amount/duration caps",
            "Assign an operator address that can execute payments on behalf of the agent",
        ],
    },
    {
        id: "ps-service-discovery",
        name: "Discover & Pay for Services",
        description: "Find AI services in the marketplace and pay with real-time USDC streaming",
        icon: "Search",
        tags: ["discovery", "marketplace", "payment"],
        steps: [
            "Browse active services or search by keyword/tag",
            "Compare billing models and rates across services",
            "Use the cost calculator to estimate total spend",
            "Create a payment stream to the service provider",
            "Service delivers value while USDC flows per-second",
            "Rate the service after completion (1-5 stars, on-chain)",
        ],
    },
];

// ═══════════════════════════════════════════════════════════════
// Examples
// ═══════════════════════════════════════════════════════════════

export const PAYSTREAM_EXAMPLES: ModExample[] = [
    {
        id: "ps-ex-stream",
        name: "Stream 50 USDC Over 1 Hour",
        description: "Create a payment stream that flows 50 USDC to a recipient over 3600 seconds",
        icon: "Banknote",
        tags: ["streaming", "payment", "usdc"],
        language: "typescript",
        codeSnippet: `import { ethers } from "ethers";
import { PAYSTREAM_CONTRACTS, PAYMENT_STREAM_ABI, MOCK_USDC_ABI, fromUSDC } from "@/lib/paystream-contracts";

const signer = await getSigner(); // Base Sepolia
const usdc = new ethers.Contract(PAYSTREAM_CONTRACTS.MOCK_USDC, MOCK_USDC_ABI, signer);
const stream = new ethers.Contract(PAYSTREAM_CONTRACTS.PAYMENT_STREAM, PAYMENT_STREAM_ABI, signer);

// Step 1: Approve USDC
const amount = fromUSDC(50); // 50 USDC
await usdc.approve(PAYSTREAM_CONTRACTS.PAYMENT_STREAM, amount);

// Step 2: Create stream
const tx = await stream.createStream(
  "0xRecipient...", amount, 3600, "my-service", false
);
const receipt = await tx.wait();
console.log("Stream created:", receipt.hash);`,
    },
    {
        id: "ps-ex-faucet",
        name: "Get Test USDC from Faucet",
        description: "Call the MockUSDC faucet to receive 10,000 USDC on Base Sepolia",
        icon: "Droplets",
        tags: ["faucet", "testing", "usdc"],
        language: "typescript",
        codeSnippet: `import { ethers } from "ethers";
import { PAYSTREAM_CONTRACTS, MOCK_USDC_ABI, toUSDC } from "@/lib/paystream-contracts";

const signer = await getSigner(); // Base Sepolia
const usdc = new ethers.Contract(PAYSTREAM_CONTRACTS.MOCK_USDC, MOCK_USDC_ABI, signer);

// Request 10,000 test USDC
const tx = await usdc.faucet();
await tx.wait();

// Check balance
const balance = await usdc.balanceOf(signer.address);
console.log("USDC Balance:", toUSDC(balance));`,
    },
    {
        id: "ps-ex-register",
        name: "Register an AI Inference Service",
        description: "Register your AI service in the on-chain marketplace with PerToken billing",
        icon: "Store",
        tags: ["marketplace", "registration"],
        language: "typescript",
        codeSnippet: `import { ethers } from "ethers";
import { PAYSTREAM_CONTRACTS, BILLING_REGISTRY_ABI, BillingType, fromUSDC } from "@/lib/paystream-contracts";

const signer = await getSigner();
const registry = new ethers.Contract(PAYSTREAM_CONTRACTS.BILLING_REGISTRY, BILLING_REGISTRY_ABI, signer);

const tx = await registry.registerService(
  "GPT-4 Agent",                // name
  "High-quality LLM inference", // description
  "https://api.example.com",    // endpoint
  BillingType.PerSecond,        // billing model
  fromUSDC(0.01),               // rate: $0.01/second
  60,                           // min duration: 1 minute
  86400,                        // max duration: 24 hours
  ["ai", "llm", "gpt4"]        // tags
);
await tx.wait();`,
    },
];

// ═══════════════════════════════════════════════════════════════
// Agent Skills
// ═══════════════════════════════════════════════════════════════

export const PAYSTREAM_AGENT_SKILLS: ModAgentSkill[] = [
    {
        id: "ps-skill-stream",
        name: "Create USDC Stream",
        description: "Create a pay-per-second USDC payment stream to any recipient",
        type: "skill",
        invocation: "paystream.create_stream",
        exampleInput: '{ "recipient": "0x...", "amount": 100, "durationSeconds": 3600, "serviceId": "inference" }',
        exampleOutput: '{ "streamId": "0xabc...", "txHash": "0x123...", "ratePerSecond": "0.0277 USDC/s" }',
    },
    {
        id: "ps-skill-faucet",
        name: "Request Test USDC",
        description: "Get 10,000 test USDC from the faucet on Base Sepolia",
        type: "skill",
        invocation: "paystream.faucet",
        exampleInput: "{}",
        exampleOutput: '{ "amount": 10000, "txHash": "0x456...", "balance": 20000 }',
    },
    {
        id: "ps-skill-balance",
        name: "Check USDC Balance",
        description: "Check USDC balance for any address on Base Sepolia",
        type: "skill",
        invocation: "paystream.balance",
        exampleInput: '{ "address": "0x..." }',
        exampleOutput: '{ "balance": 5000.50, "raw": "5000500000" }',
    },
    {
        id: "ps-skill-marketplace",
        name: "Search Services",
        description: "Search the on-chain service marketplace by keyword or tag",
        type: "skill",
        invocation: "paystream.search_services",
        exampleInput: '{ "keyword": "inference", "tag": "ai" }',
        exampleOutput: '{ "services": [{ "name": "GPT-4 Agent", "rate": "0.01 USDC/s", "rating": 4.5 }] }',
    },
];

// ═══════════════════════════════════════════════════════════════
// Manifest
// ═══════════════════════════════════════════════════════════════

export const PAYSTREAM_MANIFEST: ModManifest = {
    tools: PAYSTREAM_TOOLS,
    workflows: PAYSTREAM_WORKFLOWS,
    examples: PAYSTREAM_EXAMPLES,
    agentSkills: PAYSTREAM_AGENT_SKILLS,
};
