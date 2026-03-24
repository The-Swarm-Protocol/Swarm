/**
 * CDP Policy Engine — Evaluation functions
 *
 * Evaluates org policy rules against a proposed CDP operation.
 * Called before every paymaster, trade, and spend operation.
 *
 * Priority order:
 * 1. Emergency pause (highest — blocks everything)
 * 2. Deny rules
 * 3. Rate limit rules
 * 4. Require approval rules
 * 5. Allow rules
 * 6. Default: allow (no matching deny)
 */

import { getPolicyRules } from "./cdp-firestore";
import { CdpPolicyAction, type CdpPolicyRule } from "./cdp";
import { checkRateLimit, recordUsage } from "./cdp-rate-limiter";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface PolicyEvalContext {
    orgId: string;
    agentId: string;
    capabilityKey: string;
    amountUsd?: number;
    targetContract?: string;
    tokenAddress?: string;
}

export interface PolicyEvalResult {
    allowed: boolean;
    action: CdpPolicyAction;
    reason?: string;
    matchedRuleId?: string;
    rateLimit?: { remaining: number; resetAt: number };
}

// ═══════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════

export async function evaluateCdpPolicy(ctx: PolicyEvalContext): Promise<PolicyEvalResult> {
    const rules = await getPolicyRules(ctx.orgId);
    const enabled = rules.filter((r) => r.enabled);

    // 1. Emergency pause — blocks everything
    const paused = enabled.find((r) => r.emergencyPause);
    if (paused) {
        return {
            allowed: false,
            action: CdpPolicyAction.Deny,
            reason: "Emergency pause is active",
            matchedRuleId: paused.id,
        };
    }

    // Filter rules that match this context
    const matching = enabled.filter((r) => matchesContext(r, ctx));

    // 2. Deny rules
    const denyRule = matching.find((r) => r.action === CdpPolicyAction.Deny);
    if (denyRule) {
        return {
            allowed: false,
            action: CdpPolicyAction.Deny,
            reason: denyRule.description || `Denied by rule: ${denyRule.name}`,
            matchedRuleId: denyRule.id,
        };
    }

    // 3. Rate limit rules
    for (const rule of matching.filter((r) => r.action === CdpPolicyAction.RateLimit)) {
        if (rule.rateLimit) {
            const check = checkRateLimit(ctx.agentId, ctx.capabilityKey, rule.rateLimit);
            if (!check.allowed) {
                return {
                    allowed: false,
                    action: CdpPolicyAction.RateLimit,
                    reason: `Rate limit exceeded (resets at ${new Date(check.resetAt).toISOString()})`,
                    matchedRuleId: rule.id,
                    rateLimit: { remaining: check.remaining, resetAt: check.resetAt },
                };
            }
        }

        // Daily spend cap
        if (rule.dailySpendCapUsd !== undefined && ctx.amountUsd !== undefined) {
            if (ctx.amountUsd > rule.dailySpendCapUsd) {
                return {
                    allowed: false,
                    action: CdpPolicyAction.RateLimit,
                    reason: `Exceeds daily spend cap of $${rule.dailySpendCapUsd}`,
                    matchedRuleId: rule.id,
                };
            }
        }
    }

    // 4. Contract / token allowlist checks
    for (const rule of matching) {
        if (rule.allowedContracts && rule.allowedContracts.length > 0 && ctx.targetContract) {
            const allowed = rule.allowedContracts.some(
                (c) => c.toLowerCase() === ctx.targetContract!.toLowerCase(),
            );
            if (!allowed) {
                return {
                    allowed: false,
                    action: CdpPolicyAction.Deny,
                    reason: `Contract ${ctx.targetContract} not in allowlist`,
                    matchedRuleId: rule.id,
                };
            }
        }

        if (rule.allowedTokens && rule.allowedTokens.length > 0 && ctx.tokenAddress) {
            const allowed = rule.allowedTokens.some(
                (t) => t.toLowerCase() === ctx.tokenAddress!.toLowerCase(),
            );
            if (!allowed) {
                return {
                    allowed: false,
                    action: CdpPolicyAction.Deny,
                    reason: `Token ${ctx.tokenAddress} not in allowlist`,
                    matchedRuleId: rule.id,
                };
            }
        }
    }

    // 5. Require approval rules
    const approvalRule = matching.find((r) => r.action === CdpPolicyAction.RequireApproval);
    if (approvalRule) {
        return {
            allowed: false,
            action: CdpPolicyAction.RequireApproval,
            reason: `Requires admin approval: ${approvalRule.name}`,
            matchedRuleId: approvalRule.id,
        };
    }

    // 6. Default: allow — record usage for rate limiting
    recordUsage(ctx.agentId, ctx.capabilityKey);
    return { allowed: true, action: CdpPolicyAction.Allow };
}

// ═══════════════════════════════════════════════════════════════
// Matching
// ═══════════════════════════════════════════════════════════════

function matchesContext(rule: CdpPolicyRule, ctx: PolicyEvalContext): boolean {
    // Target match: "*" = all, "org" = all in org, or specific agentId
    if (rule.target !== "*" && rule.target !== "org" && rule.target !== ctx.agentId) {
        return false;
    }

    // Capability match: "*" = all capabilities, or specific key
    if (rule.capabilityKey !== "*" && rule.capabilityKey !== ctx.capabilityKey) {
        return false;
    }

    return true;
}
