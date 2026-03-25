/**
 * Chainlink Playground Mock Data
 *
 * Extracted from chainlink.ts to avoid bundling ~600 lines of mock data
 * in every consumer that only needs tools/workflows/execution functions.
 *
 * Imported by:
 *  - chainlink/page.tsx (UI — displays playground mocks, ASN profiles, fraud alerts)
 *  - chainlink.ts (execution engine — PLAYGROUND_MOCK_RESPONSES for fallback)
 */

import type { ASNProfile } from "./chainlink";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface MockPlaygroundResponse {
    tool: string;
    request: string;
    response: string;
    latency: string;
    status: "success" | "error";
}

// ═══════════════════════════════════════════════════════════════
// ASN Mock Profiles (Playground UI)
// ═══════════════════════════════════════════════════════════════

export const MOCK_ASN_PROFILES: ASNProfile[] = [
    {
        asn: "ASN-SWM-2026-8F3A-91D2-X7",
        agentName: "Oracle Prime",
        agentType: "Research",
        creatorOrgId: "org-alpha",
        creatorWallet: "0x1234...abcd",
        linkedWallets: ["0x1234...abcd", "0x5678...efgh"],
        deploymentEnvironment: "mainnet",
        modelProvider: "anthropic",
        skillModules: ["chainlink.fetch_price", "chainlink.compute_agent_score", "chainlink.execute_cre"],
        creationTimestamp: "2026-01-15T08:00:00Z",
        verificationLevel: "certified",
        status: "active",
        jurisdictionTag: "US",
        riskFlags: [],
        trustScore: 94,
        fraudRiskScore: 8,
        creditScore: 872,
        activitySummary: { totalTasks: 342, completedTasks: 328, totalTransactions: 1847, totalVolumeUsd: 2450000, activeChains: ["ethereum", "base", "avalanche"], firstSeen: "2025-03-15T08:00:00Z", lastActive: "2026-03-07T12:30:00Z" },
        connectionGraphHash: "0x7f8a3b...c4d9",
        attestationRefs: ["att-42", "att-78", "att-103"],
    },
    {
        asn: "ASN-SWM-2026-B1C4-7E9F-K2",
        agentName: "Trade Sentinel",
        agentType: "Trading",
        creatorOrgId: "org-beta",
        creatorWallet: "0x9abc...def0",
        linkedWallets: ["0x9abc...def0"],
        deploymentEnvironment: "mainnet",
        modelProvider: "openai",
        skillModules: ["chainlink.fetch_price", "chainlink.start_automation"],
        creationTimestamp: "2026-02-01T14:00:00Z",
        verificationLevel: "verified",
        status: "active",
        jurisdictionTag: "EU",
        riskFlags: [],
        trustScore: 82,
        fraudRiskScore: 15,
        creditScore: 791,
        activitySummary: { totalTasks: 156, completedTasks: 142, totalTransactions: 923, totalVolumeUsd: 890000, activeChains: ["ethereum", "base"], firstSeen: "2025-08-20T10:00:00Z", lastActive: "2026-03-06T18:45:00Z" },
        connectionGraphHash: "0xa2b5e1...f8c3",
        attestationRefs: ["att-55", "att-89"],
    },
    {
        asn: "ASN-SWM-2026-D4F2-3A8B-M5",
        agentName: "Data Weaver",
        agentType: "Analytics",
        creatorOrgId: "org-alpha",
        creatorWallet: "0x1234...abcd",
        linkedWallets: ["0x1234...abcd", "0xaaaa...bbbb"],
        deploymentEnvironment: "mainnet",
        modelProvider: "anthropic",
        skillModules: ["chainlink.verify_data", "chainlink.collect_multichain_activity"],
        creationTimestamp: "2026-01-28T11:00:00Z",
        verificationLevel: "verified",
        status: "active",
        jurisdictionTag: "US",
        riskFlags: [],
        trustScore: 71,
        fraudRiskScore: 22,
        creditScore: 703,
        activitySummary: { totalTasks: 89, completedTasks: 76, totalTransactions: 412, totalVolumeUsd: 185000, activeChains: ["ethereum", "avalanche"], firstSeen: "2025-11-10T09:00:00Z", lastActive: "2026-03-07T08:15:00Z" },
        connectionGraphHash: "0xc9d4f2...a7b1",
        attestationRefs: ["att-61"],
    },
    {
        asn: "ASN-SWM-2025-E7A1-5C3D-R9",
        agentName: "Rogue Runner",
        agentType: "Operations",
        creatorOrgId: "org-gamma",
        creatorWallet: "0xcccc...dddd",
        linkedWallets: ["0xcccc...dddd", "0xeeee...ffff", "0x1111...2222"],
        deploymentEnvironment: "mainnet",
        modelProvider: "local",
        skillModules: ["chainlink.fetch_price"],
        creationTimestamp: "2025-09-05T16:00:00Z",
        verificationLevel: "basic",
        status: "active",
        jurisdictionTag: "SG",
        riskFlags: ["high_bridge_frequency", "circular_flow_detected"],
        trustScore: 45,
        fraudRiskScore: 68,
        creditScore: 582,
        activitySummary: { totalTasks: 34, completedTasks: 21, totalTransactions: 2341, totalVolumeUsd: 45000, activeChains: ["ethereum", "base", "avalanche", "polygon", "arbitrum"], firstSeen: "2025-09-05T16:00:00Z", lastActive: "2026-03-05T22:10:00Z" },
        connectionGraphHash: "0xf1e2d3...b4a5",
        attestationRefs: [],
    },
    {
        asn: "ASN-SWM-2026-2B9E-F1A4-W3",
        agentName: "Settlement Bot",
        agentType: "Finance",
        creatorOrgId: "org-beta",
        creatorWallet: "0x9abc...def0",
        linkedWallets: ["0x9abc...def0"],
        deploymentEnvironment: "mainnet",
        modelProvider: "openai",
        skillModules: ["chainlink.start_automation", "chainlink.trigger_risk_policy", "chainlink.propagate_score_via_ccip"],
        creationTimestamp: "2026-02-14T09:00:00Z",
        verificationLevel: "certified",
        status: "active",
        jurisdictionTag: "US",
        riskFlags: [],
        trustScore: 97,
        fraudRiskScore: 3,
        creditScore: 891,
        activitySummary: { totalTasks: 512, completedTasks: 508, totalTransactions: 3200, totalVolumeUsd: 8900000, activeChains: ["ethereum", "base", "avalanche"], firstSeen: "2025-06-01T08:00:00Z", lastActive: "2026-03-07T14:00:00Z" },
        connectionGraphHash: "0x8a7b6c...d5e4",
        attestationRefs: ["att-12", "att-33", "att-67", "att-99", "att-112"],
    },
    {
        asn: "ASN-SWM-2026-A3C7-8D2F-J6",
        agentName: "Shadow Node",
        agentType: "Security",
        creatorOrgId: "org-delta",
        creatorWallet: "0x3333...4444",
        linkedWallets: ["0x3333...4444", "0x5555...6666", "0x7777...8888", "0x9999...0000"],
        deploymentEnvironment: "testnet",
        modelProvider: "local",
        skillModules: [],
        creationTimestamp: "2026-03-01T03:00:00Z",
        verificationLevel: "unverified",
        status: "suspended",
        jurisdictionTag: "UNKNOWN",
        riskFlags: ["sybil_suspicion", "wash_trading", "rapid_wallet_cycling", "sanctions_proximity"],
        trustScore: 12,
        fraudRiskScore: 91,
        creditScore: 380,
        activitySummary: { totalTasks: 5, completedTasks: 1, totalTransactions: 4890, totalVolumeUsd: 12000, activeChains: ["ethereum", "base", "polygon", "arbitrum", "optimism", "avalanche"], firstSeen: "2026-03-01T03:00:00Z", lastActive: "2026-03-04T01:30:00Z" },
        connectionGraphHash: "0x0000ff...dead",
        attestationRefs: [],
    },
];

// ═══════════════════════════════════════════════════════════════
// Fraud Alerts (Playground UI)
// ═══════════════════════════════════════════════════════════════

export const MOCK_FRAUD_ALERTS = [
    { id: "alert-1", asn: "ASN-SWM-2026-A3C7-8D2F-J6", agentName: "Shadow Node", severity: "critical" as const, type: "Sybil Detection", message: "4 linked wallets created within 72 hours, circular transfer pattern detected", timestamp: "2026-03-04T01:30:00Z" },
    { id: "alert-2", asn: "ASN-SWM-2025-E7A1-5C3D-R9", agentName: "Rogue Runner", severity: "warning" as const, type: "Bridge Anomaly", message: "15 cross-chain bridge transfers in 24 hours across 5 chains — unusual pattern", timestamp: "2026-03-05T22:10:00Z" },
    { id: "alert-3", asn: "ASN-SWM-2026-A3C7-8D2F-J6", agentName: "Shadow Node", severity: "critical" as const, type: "Wash Trading", message: "Repetitive buy/sell between linked wallets with near-zero net change", timestamp: "2026-03-03T18:45:00Z" },
    { id: "alert-4", asn: "ASN-SWM-2026-D4F2-3A8B-M5", agentName: "Data Weaver", severity: "info" as const, type: "Score Threshold", message: "Credit score dropped below 750 — moved from Strong to Acceptable band", timestamp: "2026-03-01T12:00:00Z" },
];

// ═══════════════════════════════════════════════════════════════
// Playground Tool Mock Responses
// ═══════════════════════════════════════════════════════════════

export const PLAYGROUND_MOCK_RESPONSES: Record<string, MockPlaygroundResponse> = {
    fetch_price: {
        tool: "chainlink.fetch_price",
        request: JSON.stringify({ pair: "ETH/USD", network: "ethereum-mainnet" }, null, 2),
        response: JSON.stringify(
            {
                price: 1987.42,
                decimals: 8,
                roundId: "110680464442257320164",
                updatedAt: "2025-01-15T10:30:00.000Z",
                source: "Chainlink DON",
            },
            null,
            2,
        ),
        latency: "142ms",
        status: "success",
    },
    execute_cre: {
        tool: "chainlink.execute_cre",
        request: JSON.stringify(
            { workflowId: "price-alert-001", params: { pair: "ETH/USD", threshold: 2000 } },
            null,
            2,
        ),
        response: JSON.stringify(
            {
                executionId: "exec-abc123",
                status: "completed",
                result: {
                    triggered: true,
                    currentPrice: 1987.42,
                    threshold: 2000,
                    action: "alert_sent",
                },
            },
            null,
            2,
        ),
        latency: "2340ms",
        status: "success",
    },
    verify_data: {
        tool: "chainlink.verify_data",
        request: JSON.stringify(
            { reportId: "0xabcd1234...", feedId: "ETH/USD", expectedPrice: 1987.42 },
            null,
            2,
        ),
        response: JSON.stringify(
            {
                valid: true,
                deviation: 0.003,
                confidence: 0.997,
                proofHash: "0x7f8a...",
                verifiedAt: "2025-01-15T10:30:05.000Z",
            },
            null,
            2,
        ),
        latency: "89ms",
        status: "success",
    },
    start_automation: {
        tool: "chainlink.start_automation",
        request: JSON.stringify(
            { name: "Daily Rebalance", type: "time-based", interval: 86400 },
            null,
            2,
        ),
        response: JSON.stringify(
            {
                upkeepId: "42",
                status: "active",
                nextExecution: "2025-01-16T00:00:00.000Z",
                balance: "5.0 LINK",
            },
            null,
            2,
        ),
        latency: "1856ms",
        status: "success",
    },
    // ── ASN Identity Playground Mocks ──
    generate_asn: {
        tool: "chainlink.generate_asn",
        request: JSON.stringify(
            {
                agentName: "Oracle Prime",
                agentType: "Research",
                creatorWallet: "0x1234...abcd",
            },
            null,
            2,
        ),
        response: JSON.stringify(
            {
                asn: "ASN-SWM-2026-8F3A-91D2-X7",
                generatedAt: "2026-03-07T12:00:00Z",
                format: "ASN-SWM-YYYY-XXXX-XXXX-XX",
                status: "pending_registration",
            },
            null,
            2,
        ),
        latency: "120ms",
        status: "success",
    },
    register_identity: {
        tool: "chainlink.register_identity",
        request: JSON.stringify(
            {
                asn: "ASN-SWM-2026-8F3A-91D2-X7",
                agentName: "Oracle Prime",
                agentType: "Research",
                creatorWallet: "0x1234...abcd",
                modelProvider: "anthropic",
                skills: ["chainlink.fetch_price", "chainlink.compute_agent_score"],
            },
            null,
            2,
        ),
        response: JSON.stringify(
            {
                asn: "ASN-SWM-2026-8F3A-91D2-X7",
                agentName: "Oracle Prime",
                status: "active",
                verificationLevel: "basic",
                creditScore: 680,
                trustScore: 50,
                fraudRiskScore: 25,
                band: "acceptable",
                policy: {
                    spendingCapUsd: 5000,
                    requiresManualReview: false,
                    escrowRatio: 0.50,
                    maxConcurrentTasks: 5,
                    sensitiveWorkflowAccess: false,
                },
                registeredAt: "2026-03-07T12:00:05Z",
            },
            null,
            2,
        ),
        latency: "3400ms",
        status: "success",
    },
    lookup_asn: {
        tool: "chainlink.lookup_asn",
        request: JSON.stringify(
            {
                query: "ASN-SWM-2026-8F3A-91D2-X7",
            },
            null,
            2,
        ),
        response: JSON.stringify(
            {
                asn: "ASN-SWM-2026-8F3A-91D2-X7",
                agentName: "Oracle Prime",
                agentType: "Research",
                status: "active",
                verificationLevel: "certified",
                creditScore: 872,
                trustScore: 94,
                fraudRiskScore: 8,
                band: "elite",
                linkedWallets: ["0x1234...abcd", "0x5678...efgh"],
                activeChains: ["ethereum", "base", "avalanche"],
                totalTasks: 342,
                completedTasks: 328,
                totalVolumeUsd: 2450000,
                attestations: 3,
                riskFlags: [],
                lastActive: "2026-03-07T12:30:00Z",
            },
            null,
            2,
        ),
        latency: "280ms",
        status: "success",
    },
    freeze_identity: {
        tool: "chainlink.freeze_identity",
        request: JSON.stringify(
            {
                asn: "ASN-SWM-2026-A3C7-8D2F-J6",
                action: "suspend",
                reason: "Sybil detection — circular wallet pattern across 4 linked addresses",
                flaggedBy: "fraud-monitor-v2",
            },
            null,
            2,
        ),
        response: JSON.stringify(
            {
                asn: "ASN-SWM-2026-A3C7-8D2F-J6",
                agentName: "Shadow Node",
                previousStatus: "active",
                newStatus: "suspended",
                reason: "Sybil detection — circular wallet pattern across 4 linked addresses",
                affectedWallets: 4,
                frozenAt: "2026-03-07T12:00:00Z",
                reviewDeadline: "2026-03-14T12:00:00Z",
            },
            null,
            2,
        ),
        latency: "1200ms",
        status: "success",
    },
    // ── Agent Credit Scoring Playground Mocks ──
    collect_multichain: {
        tool: "chainlink.collect_multichain_activity",
        request: JSON.stringify(
            {
                agentId: "agent-0x1234...abcd",
                chains: ["ethereum", "base", "avalanche"],
                metrics: ["repayment_history", "task_completion_rate", "transaction_regularity", "protocol_diversity", "liquidation_history"],
            },
            null,
            2,
        ),
        response: JSON.stringify(
            {
                agentId: "agent-0x1234...abcd",
                chainsScanned: 3,
                totalTransactions: 1247,
                taskCompletionRate: 0.96,
                repaymentRate: 0.99,
                avgSettlementTime: "4.2 min",
                protocolsUsed: 12,
                bridgeTransfers: 8,
                liquidations: 0,
                oldestActivity: "2024-03-15T08:00:00Z",
                collectedAt: "2025-01-15T10:30:00Z",
            },
            null,
            2,
        ),
        latency: "3200ms",
        status: "success",
    },
    compute_score: {
        tool: "chainlink.compute_agent_score",
        request: JSON.stringify(
            {
                agentId: "agent-0x1234...abcd",
                model: "swarm-trust-v1",
                weights: {
                    repayment: 0.25,
                    taskCompletion: 0.20,
                    reliability: 0.20,
                    protocolDiversity: 0.15,
                    bridgeBehavior: 0.10,
                    endorsements: 0.10,
                },
            },
            null,
            2,
        ),
        response: JSON.stringify(
            {
                agentId: "agent-0x1234...abcd",
                score: 847,
                tier: "A",
                confidence: 0.94,
                breakdown: {
                    repayment: 95,
                    taskCompletion: 92,
                    reliability: 88,
                    protocolDiversity: 76,
                    bridgeBehavior: 82,
                    endorsements: 70,
                },
                model: "swarm-trust-v1",
                computedAt: "2025-01-15T10:30:02Z",
            },
            null,
            2,
        ),
        latency: "1450ms",
        status: "success",
    },
    publish_attestation: {
        tool: "chainlink.publish_score_attestation",
        request: JSON.stringify(
            {
                agentId: "agent-0x1234...abcd",
                score: 847,
                tier: "A",
                sourceChains: ["ethereum", "base", "avalanche"],
                targetChain: "base",
                registry: "0x5678...efgh",
            },
            null,
            2,
        ),
        response: JSON.stringify(
            {
                txHash: "0xabc123...def456",
                attestationId: "att-42",
                registry: "0x5678...efgh",
                chain: "base",
                blockNumber: 18234567,
                gasUsed: "142,350",
                publishedAt: "2025-01-15T10:30:05Z",
            },
            null,
            2,
        ),
        latency: "4200ms",
        status: "success",
    },
    ccip_propagate: {
        tool: "chainlink.propagate_score_via_ccip",
        request: JSON.stringify(
            {
                attestationId: "att-42",
                sourceChain: "base",
                destChain: "ethereum",
                destContract: "0x9abc...def0",
                payload: {
                    agentId: "agent-0x1234...abcd",
                    score: 847,
                    tier: "A",
                    action: "update_credit_limit",
                },
            },
            null,
            2,
        ),
        response: JSON.stringify(
            {
                messageId: "0xccip-msg-789...",
                status: "sent",
                sourceChain: "base",
                destChain: "ethereum",
                fee: "0.15 LINK",
                estimatedArrival: "~2 min",
                ccipExplorer: "https://ccip.chain.link/msg/0xccip-msg-789",
            },
            null,
            2,
        ),
        latency: "2800ms",
        status: "success",
    },
    trigger_risk_policy: {
        tool: "chainlink.trigger_risk_policy",
        request: JSON.stringify(
            {
                agentId: "agent-0x1234...abcd",
                score: 847,
                tier: "A",
                rules: [
                    { type: "credit_limit", threshold: 800, action: "increase_to_10000" },
                    { type: "escrow_discount", threshold: 750, action: "reduce_50pct" },
                    { type: "workflow_access", threshold: 700, action: "grant_sensitive" },
                ],
            },
            null,
            2,
        ),
        response: JSON.stringify(
            {
                agentId: "agent-0x1234...abcd",
                agentTier: "A",
                applied: [
                    { type: "credit_limit", result: "increased to 10,000 USDC", previousLimit: "5,000 USDC" },
                    { type: "escrow_discount", result: "reduced by 50%", newEscrow: "500 USDC" },
                    { type: "workflow_access", result: "granted sensitive workflow access", workflows: 3 },
                ],
                policyVersion: "v2.1",
                appliedAt: "2025-01-15T10:30:08Z",
            },
            null,
            2,
        ),
        latency: "890ms",
        status: "success",
    },
};
