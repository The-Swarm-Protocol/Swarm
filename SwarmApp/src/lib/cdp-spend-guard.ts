/**
 * CDP Spend Guard — Permission check before wallet operations
 *
 * Validates that an agent has an active spend permission
 * with sufficient remaining allowance before executing a
 * wallet operation (paymaster, trade, transfer).
 */

import { getSpendPermissions, deductSpendPermission } from "./cdp-firestore";
import { SpendPermissionStatus, isSpendPermissionActive, type CdpSpendPermission } from "./cdp";

export interface SpendCheckResult {
    allowed: boolean;
    reason?: string;
    permissionId?: string;
    remaining?: string;
}

/**
 * Check if an agent has permission to spend the given amount from a wallet.
 * Does NOT deduct — call deductSpendPermission separately after successful operation.
 */
export async function checkSpendPermission(
    agentId: string,
    walletId: string,
    tokenAddress: string,
    amount: string,
): Promise<SpendCheckResult> {
    const permissions = await getSpendPermissions("", agentId);

    // Find matching active permission
    const matching = permissions.filter(
        (p) =>
            p.walletId === walletId &&
            p.tokenAddress.toLowerCase() === tokenAddress.toLowerCase() &&
            isSpendPermissionActive(p),
    );

    if (matching.length === 0) {
        return {
            allowed: false,
            reason: "No active spend permission for this wallet/token",
        };
    }

    // Find one with sufficient remaining allowance
    const amountBig = BigInt(amount);
    for (const perm of matching) {
        const remaining = BigInt(perm.allowanceAmount) - BigInt(perm.spentAmount);
        if (remaining >= amountBig) {
            return {
                allowed: true,
                permissionId: perm.id,
                remaining: remaining.toString(),
            };
        }
    }

    return {
        allowed: false,
        reason: "Insufficient remaining allowance across all permissions",
    };
}

/**
 * Check permission AND atomically deduct the amount.
 * Returns true if the deduction was successful.
 */
export async function checkAndDeductSpend(
    agentId: string,
    walletId: string,
    tokenAddress: string,
    amount: string,
): Promise<SpendCheckResult> {
    const check = await checkSpendPermission(agentId, walletId, tokenAddress, amount);
    if (!check.allowed || !check.permissionId) return check;

    const deducted = await deductSpendPermission(check.permissionId, amount);
    if (!deducted) {
        return {
            allowed: false,
            reason: "Race condition — allowance was consumed by another operation",
        };
    }

    return check;
}
