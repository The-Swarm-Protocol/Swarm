/**
 * CDP Add-On — Firestore CRUD
 *
 * Data access layer for all CDP collections:
 * server wallets, paymaster config, spend permissions,
 * trade records, billing cycles, policy rules, audit log.
 */

import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit as firestoreLimit,
    serverTimestamp,
    Timestamp,
    runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";
import {
    CDP_COLLECTIONS,
    CdpWalletStatus,
    SpendPermissionStatus,
    type CdpServerWallet,
    type CdpPaymasterConfig,
    type CdpSpendPermission,
    type CdpTradeRecord,
    type CdpBillingCycle,
    type CdpPolicyRule,
    type CdpAuditEntry,
} from "./cdp";

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function toDate(val: unknown): Date | null {
    if (val instanceof Timestamp) return val.toDate();
    if (val instanceof Date) return val;
    return null;
}

// ═══════════════════════════════════════════════════════════════
// Server Wallets
// ═══════════════════════════════════════════════════════════════

export async function createServerWallet(
    data: Omit<CdpServerWallet, "id" | "createdAt" | "lastUsedAt" | "rotatedAt">,
): Promise<string> {
    const ref = await addDoc(collection(db, CDP_COLLECTIONS.SERVER_WALLETS), {
        ...data,
        createdAt: serverTimestamp(),
        lastUsedAt: null,
        rotatedAt: null,
    });
    return ref.id;
}

export async function getServerWallets(orgId: string): Promise<CdpServerWallet[]> {
    const q = query(
        collection(db, CDP_COLLECTIONS.SERVER_WALLETS),
        where("orgId", "==", orgId),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
        const data = d.data();
        return {
            id: d.id,
            orgId: data.orgId,
            agentId: data.agentId,
            walletType: data.walletType,
            address: data.address,
            label: data.label,
            chainId: data.chainId,
            status: data.status,
            cdpWalletId: data.cdpWalletId,
            createdBy: data.createdBy,
            createdAt: toDate(data.createdAt),
            lastUsedAt: toDate(data.lastUsedAt),
            rotatedAt: toDate(data.rotatedAt),
            metadata: data.metadata,
        } as CdpServerWallet;
    });
}

export async function getServerWallet(walletId: string): Promise<CdpServerWallet | null> {
    const snap = await getDoc(doc(db, CDP_COLLECTIONS.SERVER_WALLETS, walletId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
        id: snap.id,
        orgId: data.orgId,
        agentId: data.agentId,
        walletType: data.walletType,
        address: data.address,
        label: data.label,
        chainId: data.chainId,
        status: data.status,
        cdpWalletId: data.cdpWalletId,
        createdBy: data.createdBy,
        createdAt: toDate(data.createdAt),
        lastUsedAt: toDate(data.lastUsedAt),
        rotatedAt: toDate(data.rotatedAt),
        metadata: data.metadata,
    } as CdpServerWallet;
}

export async function updateServerWallet(
    walletId: string,
    data: Partial<Pick<CdpServerWallet, "label" | "agentId" | "status" | "metadata">>,
): Promise<void> {
    await updateDoc(doc(db, CDP_COLLECTIONS.SERVER_WALLETS, walletId), data);
}

export async function archiveServerWallet(walletId: string): Promise<void> {
    await updateDoc(doc(db, CDP_COLLECTIONS.SERVER_WALLETS, walletId), {
        status: CdpWalletStatus.Archived,
    });
}

// ═══════════════════════════════════════════════════════════════
// Paymaster Config
// ═══════════════════════════════════════════════════════════════

export async function getPaymasterConfig(orgId: string): Promise<CdpPaymasterConfig | null> {
    const q = query(
        collection(db, CDP_COLLECTIONS.PAYMASTER_CONFIGS),
        where("orgId", "==", orgId),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    const data = d.data();
    return {
        id: d.id,
        orgId: data.orgId,
        enabled: data.enabled ?? false,
        monthlyBudgetUsd: data.monthlyBudgetUsd ?? 0,
        spentThisCycleUsd: data.spentThisCycleUsd ?? 0,
        currentCycleStart: toDate(data.currentCycleStart),
        allowedContracts: data.allowedContracts ?? [],
        allowedSelectors: data.allowedSelectors,
        perTxGasLimitEth: data.perTxGasLimitEth ?? 0.01,
        autoPauseOnBudgetExhausted: data.autoPauseOnBudgetExhausted ?? true,
        updatedAt: toDate(data.updatedAt),
        updatedBy: data.updatedBy ?? "",
    } as CdpPaymasterConfig;
}

export async function upsertPaymasterConfig(
    orgId: string,
    data: Omit<CdpPaymasterConfig, "id" | "orgId" | "updatedAt">,
): Promise<string> {
    const existing = await getPaymasterConfig(orgId);
    if (existing) {
        await updateDoc(doc(db, CDP_COLLECTIONS.PAYMASTER_CONFIGS, existing.id), {
            ...data,
            updatedAt: serverTimestamp(),
        });
        return existing.id;
    }
    const ref = await addDoc(collection(db, CDP_COLLECTIONS.PAYMASTER_CONFIGS), {
        orgId,
        ...data,
        updatedAt: serverTimestamp(),
    });
    return ref.id;
}

export async function incrementPaymasterSpend(orgId: string, amountUsd: number): Promise<void> {
    const config = await getPaymasterConfig(orgId);
    if (!config) return;
    await updateDoc(doc(db, CDP_COLLECTIONS.PAYMASTER_CONFIGS, config.id), {
        spentThisCycleUsd: (config.spentThisCycleUsd || 0) + amountUsd,
        updatedAt: serverTimestamp(),
    });
}

// ═══════════════════════════════════════════════════════════════
// Spend Permissions
// ═══════════════════════════════════════════════════════════════

export async function createSpendPermission(
    data: Omit<CdpSpendPermission, "id" | "createdAt" | "revokedAt" | "revokedBy">,
): Promise<string> {
    const ref = await addDoc(collection(db, CDP_COLLECTIONS.SPEND_PERMISSIONS), {
        ...data,
        createdAt: serverTimestamp(),
        revokedAt: null,
        revokedBy: null,
    });
    return ref.id;
}

export async function getSpendPermissions(
    orgId: string,
    agentId?: string,
): Promise<CdpSpendPermission[]> {
    const constraints = [where("orgId", "==", orgId)];
    if (agentId) constraints.push(where("agentId", "==", agentId));
    const q = query(collection(db, CDP_COLLECTIONS.SPEND_PERMISSIONS), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
        const data = d.data();
        return {
            id: d.id,
            orgId: data.orgId,
            agentId: data.agentId,
            walletId: data.walletId,
            tokenAddress: data.tokenAddress,
            allowanceAmount: data.allowanceAmount ?? "0",
            spentAmount: data.spentAmount ?? "0",
            expiresAt: toDate(data.expiresAt),
            status: data.status,
            allowedRecipients: data.allowedRecipients,
            description: data.description ?? "",
            createdBy: data.createdBy,
            createdAt: toDate(data.createdAt),
            revokedAt: toDate(data.revokedAt),
            revokedBy: data.revokedBy,
        } as CdpSpendPermission;
    });
}

export async function getSpendPermission(permissionId: string): Promise<CdpSpendPermission | null> {
    const snap = await getDoc(doc(db, CDP_COLLECTIONS.SPEND_PERMISSIONS, permissionId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
        id: snap.id,
        orgId: data.orgId,
        agentId: data.agentId,
        walletId: data.walletId,
        tokenAddress: data.tokenAddress,
        allowanceAmount: data.allowanceAmount ?? "0",
        spentAmount: data.spentAmount ?? "0",
        expiresAt: toDate(data.expiresAt),
        status: data.status,
        allowedRecipients: data.allowedRecipients,
        description: data.description ?? "",
        createdBy: data.createdBy,
        createdAt: toDate(data.createdAt),
        revokedAt: toDate(data.revokedAt),
        revokedBy: data.revokedBy,
    } as CdpSpendPermission;
}

export async function revokeSpendPermission(permissionId: string, revokedBy: string): Promise<void> {
    await updateDoc(doc(db, CDP_COLLECTIONS.SPEND_PERMISSIONS, permissionId), {
        status: SpendPermissionStatus.Revoked,
        revokedAt: serverTimestamp(),
        revokedBy,
    });
}

/** Atomically deduct from a spend permission. Returns true if successful. */
export async function deductSpendPermission(
    permissionId: string,
    amount: string,
): Promise<boolean> {
    const docRef = doc(db, CDP_COLLECTIONS.SPEND_PERMISSIONS, permissionId);
    try {
        await runTransaction(db, async (tx) => {
            const snap = await tx.get(docRef);
            if (!snap.exists()) throw new Error("Permission not found");
            const data = snap.data();
            const spent = BigInt(data.spentAmount ?? "0");
            const allowance = BigInt(data.allowanceAmount ?? "0");
            const deduction = BigInt(amount);
            if (spent + deduction > allowance) throw new Error("Exceeds allowance");
            tx.update(docRef, { spentAmount: (spent + deduction).toString() });
        });
        return true;
    } catch {
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════
// Trade Records
// ═══════════════════════════════════════════════════════════════

export async function createTradeRecord(
    data: Omit<CdpTradeRecord, "id" | "createdAt">,
): Promise<string> {
    const ref = await addDoc(collection(db, CDP_COLLECTIONS.TRADE_RECORDS), {
        ...data,
        createdAt: serverTimestamp(),
    });
    return ref.id;
}

export async function getTradeRecords(
    orgId: string,
    agentId?: string,
): Promise<CdpTradeRecord[]> {
    const constraints = [where("orgId", "==", orgId)];
    if (agentId) constraints.push(where("agentId", "==", agentId));
    const q = query(collection(db, CDP_COLLECTIONS.TRADE_RECORDS), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
        const data = d.data();
        return {
            id: d.id,
            orgId: data.orgId,
            agentId: data.agentId,
            walletId: data.walletId,
            fromToken: data.fromToken,
            toToken: data.toToken,
            fromAmount: data.fromAmount,
            toAmount: data.toAmount,
            slippageBps: data.slippageBps,
            status: data.status,
            cdpTradeId: data.cdpTradeId,
            txHash: data.txHash,
            errorMessage: data.errorMessage,
            executedAt: toDate(data.executedAt),
            createdAt: toDate(data.createdAt),
        } as CdpTradeRecord;
    });
}

export async function updateTradeRecord(
    tradeId: string,
    data: Partial<Pick<CdpTradeRecord, "status" | "toAmount" | "txHash" | "cdpTradeId" | "errorMessage" | "executedAt">>,
): Promise<void> {
    await updateDoc(doc(db, CDP_COLLECTIONS.TRADE_RECORDS, tradeId), data);
}

// ═══════════════════════════════════════════════════════════════
// Billing Cycles
// ═══════════════════════════════════════════════════════════════

export async function createBillingCycle(
    data: Omit<CdpBillingCycle, "id" | "createdAt">,
): Promise<string> {
    const ref = await addDoc(collection(db, CDP_COLLECTIONS.BILLING_CYCLES), {
        ...data,
        createdAt: serverTimestamp(),
    });
    return ref.id;
}

export async function getBillingCycles(orgId: string): Promise<CdpBillingCycle[]> {
    const q = query(
        collection(db, CDP_COLLECTIONS.BILLING_CYCLES),
        where("orgId", "==", orgId),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
        const data = d.data();
        return {
            id: d.id,
            orgId: data.orgId,
            subscriptionId: data.subscriptionId,
            walletId: data.walletId,
            amountUsd: data.amountUsd,
            tokenAddress: data.tokenAddress,
            intervalDays: data.intervalDays,
            nextChargeAt: toDate(data.nextChargeAt),
            lastChargedAt: toDate(data.lastChargedAt),
            lastChargeTxHash: data.lastChargeTxHash,
            status: data.status,
            failureCount: data.failureCount ?? 0,
            createdAt: toDate(data.createdAt),
        } as CdpBillingCycle;
    });
}

export async function updateBillingCycle(
    cycleId: string,
    data: Partial<Pick<CdpBillingCycle, "status" | "nextChargeAt" | "lastChargedAt" | "lastChargeTxHash" | "failureCount">>,
): Promise<void> {
    await updateDoc(doc(db, CDP_COLLECTIONS.BILLING_CYCLES, cycleId), data);
}

export async function getBillingCycle(cycleId: string): Promise<CdpBillingCycle | null> {
    const snap = await getDoc(doc(db, CDP_COLLECTIONS.BILLING_CYCLES, cycleId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
        id: snap.id,
        orgId: data.orgId,
        subscriptionId: data.subscriptionId,
        walletId: data.walletId,
        amountUsd: data.amountUsd,
        tokenAddress: data.tokenAddress,
        intervalDays: data.intervalDays,
        nextChargeAt: toDate(data.nextChargeAt),
        lastChargedAt: toDate(data.lastChargedAt),
        lastChargeTxHash: data.lastChargeTxHash,
        status: data.status,
        failureCount: data.failureCount ?? 0,
        createdAt: toDate(data.createdAt),
    } as CdpBillingCycle;
}

// ═══════════════════════════════════════════════════════════════
// Policy Rules
// ═══════════════════════════════════════════════════════════════

export async function createPolicyRule(
    data: Omit<CdpPolicyRule, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
    const ref = await addDoc(collection(db, CDP_COLLECTIONS.POLICY_RULES), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
}

export async function getPolicyRules(orgId: string): Promise<CdpPolicyRule[]> {
    const q = query(
        collection(db, CDP_COLLECTIONS.POLICY_RULES),
        where("orgId", "==", orgId),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
        const data = d.data();
        return {
            id: d.id,
            orgId: data.orgId,
            name: data.name,
            description: data.description ?? "",
            target: data.target,
            capabilityKey: data.capabilityKey,
            action: data.action,
            rateLimit: data.rateLimit,
            dailySpendCapUsd: data.dailySpendCapUsd,
            allowedTokens: data.allowedTokens,
            allowedContracts: data.allowedContracts,
            emergencyPause: data.emergencyPause ?? false,
            enabled: data.enabled ?? true,
            createdBy: data.createdBy,
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt),
        } as CdpPolicyRule;
    });
}

export async function updatePolicyRule(
    ruleId: string,
    data: Partial<Omit<CdpPolicyRule, "id" | "orgId" | "createdBy" | "createdAt">>,
): Promise<void> {
    await updateDoc(doc(db, CDP_COLLECTIONS.POLICY_RULES, ruleId), {
        ...data,
        updatedAt: serverTimestamp(),
    });
}

export async function deletePolicyRule(ruleId: string): Promise<void> {
    await deleteDoc(doc(db, CDP_COLLECTIONS.POLICY_RULES, ruleId));
}

// ═══════════════════════════════════════════════════════════════
// Audit Log
// ═══════════════════════════════════════════════════════════════

export async function logCdpAudit(
    entry: Omit<CdpAuditEntry, "id" | "timestamp">,
): Promise<string> {
    const ref = await addDoc(collection(db, CDP_COLLECTIONS.AUDIT_LOG), {
        ...entry,
        timestamp: serverTimestamp(),
    });
    return ref.id;
}

export async function getCdpAuditLog(
    orgId: string,
    options?: { agentId?: string; action?: string; limit?: number },
): Promise<CdpAuditEntry[]> {
    const constraints = [where("orgId", "==", orgId)];
    if (options?.agentId) constraints.push(where("agentId", "==", options.agentId));
    if (options?.action) constraints.push(where("action", "==", options.action));
    const q = query(
        collection(db, CDP_COLLECTIONS.AUDIT_LOG),
        ...constraints,
        firestoreLimit(options?.limit ?? 100),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
        const data = d.data();
        return {
            id: d.id,
            orgId: data.orgId,
            agentId: data.agentId,
            walletId: data.walletId,
            action: data.action,
            capabilityKey: data.capabilityKey,
            details: data.details ?? {},
            outcome: data.outcome,
            policyRuleId: data.policyRuleId,
            timestamp: toDate(data.timestamp),
        } as CdpAuditEntry;
    });
}
