/**
 * GET  /api/v1/mods/cdp-addon/trade?orgId=...&agentId=...
 * POST /api/v1/mods/cdp-addon/trade
 *
 * Trade history and swap execution via CDP Trade API.
 */
import { NextRequest } from "next/server";
import { requireOrgAdmin, requireAgentAuth, forbidden, unauthorized } from "@/lib/auth-guard";
import { createTradeRecord, getTradeRecords, updateTradeRecord, getServerWallet, logCdpAudit } from "@/lib/cdp-firestore";
import { deductSpendPermission, getSpendPermissions } from "@/lib/cdp-firestore";
import { executeTrade } from "@/lib/cdp-client";
import { evaluateCdpPolicy } from "@/lib/cdp-policy-engine";
import { CdpTradeStatus, CDP_CAPABILITIES, SpendPermissionStatus } from "@/lib/cdp";

export async function GET(req: NextRequest) {
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return Response.json({ error: "orgId required" }, { status: 400 });

    const auth = await requireOrgAdmin(req, orgId);
    if (!auth.ok) return forbidden(auth.error);

    const agentId = req.nextUrl.searchParams.get("agentId") || undefined;
    const records = await getTradeRecords(orgId, agentId);
    return Response.json({ trades: records });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { orgId, agentId, walletId, fromToken, toToken, fromAmount, slippageBps } = body;

        if (!orgId || !walletId || !fromToken || !toToken || !fromAmount) {
            return Response.json(
                { error: "orgId, walletId, fromToken, toToken, and fromAmount are required" },
                { status: 400 },
            );
        }

        // Auth: agent or org admin
        if (agentId) {
            const agentAuth = await requireAgentAuth(req, `POST:/v1/mods/cdp-addon/trade`);
            if (!agentAuth.ok) return unauthorized(agentAuth.error);
        } else {
            const auth = await requireOrgAdmin(req, orgId);
            if (!auth.ok) return forbidden(auth.error);
        }

        // Validate wallet
        const wallet = await getServerWallet(walletId);
        if (!wallet || wallet.orgId !== orgId) {
            return Response.json({ error: "Wallet not found" }, { status: 404 });
        }

        // Policy check
        if (agentId) {
            const policy = await evaluateCdpPolicy({
                orgId,
                agentId,
                capabilityKey: CDP_CAPABILITIES.TRADE_SWAP,
                tokenAddress: fromToken,
            });
            if (!policy.allowed) {
                await logCdpAudit({
                    orgId,
                    agentId,
                    walletId,
                    action: "trade.execute",
                    capabilityKey: CDP_CAPABILITIES.TRADE_SWAP,
                    details: { fromToken, toToken, reason: policy.reason },
                    outcome: "denied",
                    policyRuleId: policy.matchedRuleId,
                });
                return Response.json({ error: policy.reason || "Denied by policy" }, { status: 403 });
            }
        }

        // Check spend permission for agent
        if (agentId) {
            const permissions = await getSpendPermissions(orgId, agentId);
            const matching = permissions.find(
                (p) =>
                    p.walletId === walletId &&
                    p.tokenAddress.toLowerCase() === fromToken.toLowerCase() &&
                    p.status === SpendPermissionStatus.Active,
            );
            if (matching) {
                const deducted = await deductSpendPermission(matching.id, fromAmount);
                if (!deducted) {
                    return Response.json({ error: "Exceeds spend permission allowance" }, { status: 403 });
                }
            }
        }

        // Create pending record
        const tradeId = await createTradeRecord({
            orgId,
            agentId: agentId || "",
            walletId,
            fromToken,
            toToken,
            fromAmount,
            slippageBps: slippageBps || 50,
            status: CdpTradeStatus.Pending,
            executedAt: null,
        });

        // Execute trade
        try {
            const result = await executeTrade({
                cdpWalletId: wallet.cdpWalletId,
                addressId: wallet.address,
                fromToken,
                toToken,
                fromAmount,
                slippageBps: slippageBps || 50,
            });

            await updateTradeRecord(tradeId, {
                status: result.status === "confirmed" ? CdpTradeStatus.Confirmed : CdpTradeStatus.Submitted,
                toAmount: result.toAmount,
                txHash: result.txHash,
                cdpTradeId: result.cdpTradeId,
                executedAt: new Date(),
            });

            await logCdpAudit({
                orgId,
                agentId,
                walletId,
                action: "trade.execute",
                capabilityKey: CDP_CAPABILITIES.TRADE_SWAP,
                details: { tradeId, fromToken, toToken, fromAmount, toAmount: result.toAmount, txHash: result.txHash },
                outcome: "success",
            });

            return Response.json({
                trade: {
                    id: tradeId,
                    txHash: result.txHash,
                    toAmount: result.toAmount,
                    status: result.status,
                },
            });
        } catch (tradeErr) {
            const errorMessage = tradeErr instanceof Error ? tradeErr.message : "Trade execution failed";
            await updateTradeRecord(tradeId, {
                status: CdpTradeStatus.Failed,
                errorMessage,
            });
            throw tradeErr;
        }
    } catch (err) {
        console.error("cdp-addon/trade POST error:", err);
        const message = err instanceof Error ? err.message : "Internal server error";
        return Response.json({ error: message }, { status: 500 });
    }
}
