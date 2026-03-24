/**
 * POST /api/v1/mods/cdp-addon/paymaster/sponsor
 *
 * Proxy endpoint for gas sponsorship via CDP paymaster.
 * CRITICAL: The CDP paymaster URL is NEVER exposed in responses.
 */
import { NextRequest } from "next/server";
import { requireAgentAuth, requireOrgAdmin, forbidden, unauthorized } from "@/lib/auth-guard";
import { getPaymasterConfig, incrementPaymasterSpend, logCdpAudit } from "@/lib/cdp-firestore";
import { getServerWallet } from "@/lib/cdp-firestore";
import { sponsorGas } from "@/lib/cdp-client";
import { evaluateCdpPolicy } from "@/lib/cdp-policy-engine";
import { CDP_CAPABILITIES } from "@/lib/cdp";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { orgId, agentId, walletId, target, calldata, value } = body;

        if (!orgId || !target || !calldata) {
            return Response.json(
                { error: "orgId, target, and calldata are required" },
                { status: 400 },
            );
        }

        // Auth: org admin or agent
        let walletAddress = "";
        if (agentId) {
            const agentAuth = await requireAgentAuth(req, `POST:/v1/mods/cdp-addon/paymaster/sponsor`);
            if (!agentAuth.ok) return unauthorized(agentAuth.error);
            walletAddress = agentAuth.agent?.agentId || "";
        } else {
            const auth = await requireOrgAdmin(req, orgId);
            if (!auth.ok) return forbidden(auth.error);
            walletAddress = auth.walletAddress || "";
        }

        // Load paymaster config
        const config = await getPaymasterConfig(orgId);
        if (!config || !config.enabled) {
            return Response.json({ error: "Paymaster not enabled for this org" }, { status: 403 });
        }

        // Check budget
        if (config.autoPauseOnBudgetExhausted && config.spentThisCycleUsd >= config.monthlyBudgetUsd) {
            return Response.json({ error: "Monthly gas budget exhausted" }, { status: 429 });
        }

        // Check contract allowlist
        if (config.allowedContracts.length > 0) {
            const targetLower = target.toLowerCase();
            const allowed = config.allowedContracts.some((c: string) => c.toLowerCase() === targetLower);
            if (!allowed) {
                return Response.json({ error: "Target contract not in allowlist" }, { status: 403 });
            }
        }

        // Policy engine check
        if (agentId) {
            const policy = await evaluateCdpPolicy({
                orgId,
                agentId,
                capabilityKey: CDP_CAPABILITIES.PAYMASTER_SPONSOR,
                targetContract: target,
            });
            if (!policy.allowed) {
                await logCdpAudit({
                    orgId,
                    agentId,
                    action: "paymaster.sponsor",
                    capabilityKey: CDP_CAPABILITIES.PAYMASTER_SPONSOR,
                    details: { target, reason: policy.reason },
                    outcome: "denied",
                    policyRuleId: policy.matchedRuleId,
                });
                return Response.json({ error: policy.reason || "Denied by policy" }, { status: 403 });
            }
        }

        // Get wallet address for sponsorship
        let senderAddress = walletAddress;
        if (walletId) {
            const wallet = await getServerWallet(walletId);
            if (wallet && wallet.orgId === orgId) {
                senderAddress = wallet.address;
            }
        }

        // Execute sponsorship (paymaster URL never exposed)
        const result = await sponsorGas({
            target,
            calldata,
            value: value || "0",
            walletAddress: senderAddress,
        });

        // Track spending
        if (result.gasCostUsd > 0) {
            await incrementPaymasterSpend(orgId, result.gasCostUsd);
        }

        await logCdpAudit({
            orgId,
            agentId,
            action: "paymaster.sponsor",
            capabilityKey: CDP_CAPABILITIES.PAYMASTER_SPONSOR,
            details: { target, txHash: result.txHash, gasCostUsd: result.gasCostUsd },
            outcome: "success",
        });

        return Response.json({
            txHash: result.txHash,
            gasSponsored: result.gasSponsored,
            gasCostUsd: result.gasCostUsd,
        });
    } catch (err) {
        // CRITICAL: Never include paymaster URL in error responses
        console.error("cdp-addon/paymaster/sponsor error:", err);
        return Response.json({ error: "Gas sponsorship failed" }, { status: 500 });
    }
}
