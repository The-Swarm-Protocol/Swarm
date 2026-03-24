/**
 * CDP Billing Service — Recurring charge processing
 *
 * Queries billing cycles due for charge and executes them
 * via server wallet transfers. Designed to be called by a
 * cron job or internal service endpoint.
 */

import { getBillingCycles, getBillingCycle, updateBillingCycle, getServerWallet, logCdpAudit } from "./cdp-firestore";
import { executeTransfer } from "./cdp-client";
import { CdpBillingCycleStatus } from "./cdp";

export interface ChargeResult {
    billingCycleId: string;
    orgId: string;
    success: boolean;
    txHash?: string;
    error?: string;
}

/**
 * Execute a single billing charge for a given cycle.
 */
export async function executeCharge(billingCycleId: string): Promise<ChargeResult> {
    const cycle = await getBillingCycle(billingCycleId);
    if (!cycle) {
        return { billingCycleId, orgId: "", success: false, error: "Cycle not found" };
    }

    if (cycle.status !== CdpBillingCycleStatus.Active) {
        return { billingCycleId, orgId: cycle.orgId, success: false, error: `Cycle is ${cycle.status}` };
    }

    const wallet = await getServerWallet(cycle.walletId);
    if (!wallet) {
        return { billingCycleId, orgId: cycle.orgId, success: false, error: "Wallet not found" };
    }

    const treasuryAddress = process.env.BASE_TREASURY_ADDRESS || process.env.EVM_TREASURY_ADDRESS;
    if (!treasuryAddress) {
        return { billingCycleId, orgId: cycle.orgId, success: false, error: "Treasury address not configured" };
    }

    try {
        const result = await executeTransfer({
            cdpWalletId: wallet.cdpWalletId,
            addressId: wallet.address,
            toAddress: treasuryAddress,
            tokenAddress: cycle.tokenAddress,
            amount: cycle.amountUsd.toString(),
        });

        const nextChargeAt = new Date();
        nextChargeAt.setDate(nextChargeAt.getDate() + cycle.intervalDays);

        await updateBillingCycle(billingCycleId, {
            lastChargedAt: new Date(),
            lastChargeTxHash: result.txHash,
            nextChargeAt,
            failureCount: 0,
        });

        await logCdpAudit({
            orgId: cycle.orgId,
            walletId: cycle.walletId,
            action: "billing.charge",
            details: { billingCycleId, amountUsd: cycle.amountUsd, txHash: result.txHash },
            outcome: "success",
        });

        return { billingCycleId, orgId: cycle.orgId, success: true, txHash: result.txHash };
    } catch (err) {
        const newFailureCount = (cycle.failureCount || 0) + 1;
        const newStatus = newFailureCount > 3 ? CdpBillingCycleStatus.PastDue : CdpBillingCycleStatus.Active;

        await updateBillingCycle(billingCycleId, {
            failureCount: newFailureCount,
            status: newStatus,
        });

        const errorMsg = err instanceof Error ? err.message : "unknown error";

        await logCdpAudit({
            orgId: cycle.orgId,
            walletId: cycle.walletId,
            action: "billing.charge",
            details: { billingCycleId, failureCount: newFailureCount, error: errorMsg },
            outcome: "error",
        });

        return { billingCycleId, orgId: cycle.orgId, success: false, error: errorMsg };
    }
}

/**
 * Process all due billing charges across all orgs.
 * Intended to be called by a cron job or scheduled function.
 */
export async function processDueCharges(orgIds: string[]): Promise<ChargeResult[]> {
    const results: ChargeResult[] = [];
    const now = new Date();

    for (const orgId of orgIds) {
        const cycles = await getBillingCycles(orgId);
        const due = cycles.filter(
            (c) =>
                c.status === CdpBillingCycleStatus.Active &&
                c.nextChargeAt &&
                c.nextChargeAt.getTime() <= now.getTime(),
        );

        for (const cycle of due) {
            const result = await executeCharge(cycle.id);
            results.push(result);
        }
    }

    return results;
}
