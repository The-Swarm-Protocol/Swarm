/**
 * Base Accounts — Sub-accounts, Spend Permissions, Recurring Payments, Audit
 *
 * Firestore collections:
 *   baseSubAccounts        — per-agent/workspace sub-accounts on Base
 *   baseSpendPermissions   — granted, pending, or revoked agent spend permissions
 *   baseRecurringPayments  — recurring payment configurations (setup only)
 *   baseSignatureRequests  — EIP-712 typed-data signing requests
 *   basePayments           — one-tap USDC payment records
 *   baseAuditLog           — immutable audit trail for all Base operations
 */

import { db } from "./firebase";
import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    updateDoc,
    query,
    where,
    orderBy,
    limit as firestoreLimit,
    serverTimestamp,
    Timestamp,
} from "firebase/firestore";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface BaseSubAccount {
    id: string;
    orgId: string;
    agentId: string | null;
    label: string;
    address: string;
    balance: number;
    dailyLimit: number;
    monthlyLimit: number;
    totalSpent: number;
    status: "active" | "frozen" | "closed";
    createdBy: string;
    createdAt: Date | null;
    updatedAt: Date | null;
}

export type PermissionStatus = "pending" | "approved" | "denied" | "revoked" | "expired";
export type PermissionPeriod = "one-time" | "daily" | "weekly" | "monthly" | "unlimited";

export interface BaseSpendPermission {
    id: string;
    orgId: string;
    agentId: string;
    agentName: string;
    subAccountId: string | null;
    amount: number;
    period: PermissionPeriod;
    reason: string;
    status: PermissionStatus;
    usedAmount: number;
    grantedBy: string | null;
    grantedAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date | null;
    revokedAt: Date | null;
    revokedBy: string | null;
}

export type RecurringType = "mod_subscription" | "plan" | "agent_budget" | "custom";
export type RecurringFrequency = "weekly" | "monthly" | "quarterly" | "yearly";
export type RecurringStatus = "active" | "paused" | "cancelled" | "expired";

export interface BaseRecurringPayment {
    id: string;
    orgId: string;
    label: string;
    type: RecurringType;
    recipientAddress: string;
    amount: number;
    frequency: RecurringFrequency;
    subAccountId: string | null;
    maxTotalAmount: number | null;
    totalCharged: number;
    chargeCount: number;
    status: RecurringStatus;
    nextChargeAt: Date | null;
    lastChargedAt: Date | null;
    consentSignature: string | null;
    createdBy: string;
    createdAt: Date | null;
}

export type SignatureRequestType = "auth_challenge" | "approval_prompt" | "attestation" | "mod_consent" | "spend_approval";
export type SignatureStatus = "pending" | "signed" | "rejected" | "expired";

export interface BaseSignatureRequest {
    id: string;
    orgId: string;
    type: SignatureRequestType;
    requesterType: "system" | "agent" | "mod";
    requesterId: string;
    requesterName: string;
    typedData: Record<string, unknown>;
    message: string;
    signerAddress: string;
    signature: string | null;
    status: SignatureStatus;
    expiresAt: Date | null;
    createdAt: Date | null;
    signedAt: Date | null;
}

export type AuditAction =
    | "siwe_login" | "siwe_verify"
    | "payment_sent" | "payment_received"
    | "subaccount_created" | "subaccount_funded" | "subaccount_frozen" | "subaccount_closed"
    | "permission_requested" | "permission_approved" | "permission_denied" | "permission_revoked"
    | "recurring_created" | "recurring_paused" | "recurring_cancelled" | "recurring_charged"
    | "signature_requested" | "signature_signed" | "signature_rejected";

export interface BaseAuditEntry {
    id: string;
    orgId: string;
    action: AuditAction;
    actorType: "user" | "agent" | "system";
    actorId: string;
    description: string;
    metadata: Record<string, unknown>;
    timestamp: Date | null;
}

export interface BasePayment {
    id: string;
    orgId: string;
    fromAddress: string;
    toAddress: string;
    amount: number;
    memo: string;
    txHash: string | null;
    chainId: number;
    status: "pending" | "confirmed" | "failed";
    subAccountId: string | null;
    createdBy: string;
    createdAt: Date | null;
    confirmedAt: Date | null;
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function tsToDate(ts: unknown): Date | null {
    if (ts instanceof Timestamp) return ts.toDate();
    if (ts instanceof Date) return ts;
    return null;
}

// ═══════════════════════════════════════════════════════════════
// Sub-Accounts
// ═══════════════════════════════════════════════════════════════

const subAccountsCol = () => collection(db, "baseSubAccounts");

export async function createSubAccount(data: {
    orgId: string;
    agentId: string | null;
    label: string;
    address: string;
    dailyLimit: number;
    monthlyLimit: number;
    createdBy: string;
}): Promise<string> {
    const ref = await addDoc(subAccountsCol(), {
        ...data,
        balance: 0,
        totalSpent: 0,
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
}

export async function getSubAccounts(orgId: string): Promise<BaseSubAccount[]> {
    const q = query(subAccountsCol(), where("orgId", "==", orgId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
        const data = d.data();
        return {
            id: d.id,
            orgId: data.orgId,
            agentId: data.agentId ?? null,
            label: data.label,
            address: data.address,
            balance: data.balance ?? 0,
            dailyLimit: data.dailyLimit ?? 0,
            monthlyLimit: data.monthlyLimit ?? 0,
            totalSpent: data.totalSpent ?? 0,
            status: data.status ?? "active",
            createdBy: data.createdBy,
            createdAt: tsToDate(data.createdAt),
            updatedAt: tsToDate(data.updatedAt),
        };
    });
}

export async function getSubAccount(id: string): Promise<BaseSubAccount | null> {
    const snap = await getDoc(doc(subAccountsCol(), id));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
        id: snap.id,
        orgId: data.orgId,
        agentId: data.agentId ?? null,
        label: data.label,
        address: data.address,
        balance: data.balance ?? 0,
        dailyLimit: data.dailyLimit ?? 0,
        monthlyLimit: data.monthlyLimit ?? 0,
        totalSpent: data.totalSpent ?? 0,
        status: data.status ?? "active",
        createdBy: data.createdBy,
        createdAt: tsToDate(data.createdAt),
        updatedAt: tsToDate(data.updatedAt),
    };
}

export async function updateSubAccount(id: string, updates: Partial<Pick<BaseSubAccount, "label" | "dailyLimit" | "monthlyLimit" | "balance" | "totalSpent" | "status">>): Promise<void> {
    await updateDoc(doc(subAccountsCol(), id), { ...updates, updatedAt: serverTimestamp() });
}

// ═══════════════════════════════════════════════════════════════
// Spend Permissions
// ═══════════════════════════════════════════════════════════════

const permissionsCol = () => collection(db, "baseSpendPermissions");

export async function createSpendPermission(data: {
    orgId: string;
    agentId: string;
    agentName: string;
    subAccountId: string | null;
    amount: number;
    period: PermissionPeriod;
    reason: string;
}): Promise<string> {
    const ref = await addDoc(permissionsCol(), {
        ...data,
        status: "pending",
        usedAmount: 0,
        grantedBy: null,
        grantedAt: null,
        expiresAt: null,
        createdAt: serverTimestamp(),
        revokedAt: null,
        revokedBy: null,
    });
    return ref.id;
}

export async function getSpendPermissions(orgId: string, status?: PermissionStatus): Promise<BaseSpendPermission[]> {
    let q = query(permissionsCol(), where("orgId", "==", orgId));
    if (status) q = query(q, where("status", "==", status));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
        const data = d.data();
        return {
            id: d.id,
            orgId: data.orgId,
            agentId: data.agentId,
            agentName: data.agentName,
            subAccountId: data.subAccountId ?? null,
            amount: data.amount,
            period: data.period,
            reason: data.reason,
            status: data.status,
            usedAmount: data.usedAmount ?? 0,
            grantedBy: data.grantedBy ?? null,
            grantedAt: tsToDate(data.grantedAt),
            expiresAt: tsToDate(data.expiresAt),
            createdAt: tsToDate(data.createdAt),
            revokedAt: tsToDate(data.revokedAt),
            revokedBy: data.revokedBy ?? null,
        };
    });
}

export async function approveSpendPermission(id: string, grantedBy: string): Promise<void> {
    await updateDoc(doc(permissionsCol(), id), {
        status: "approved",
        grantedBy,
        grantedAt: serverTimestamp(),
    });
}

export async function denySpendPermission(id: string): Promise<void> {
    await updateDoc(doc(permissionsCol(), id), { status: "denied" });
}

export async function revokeSpendPermission(id: string, revokedBy: string): Promise<void> {
    await updateDoc(doc(permissionsCol(), id), {
        status: "revoked",
        revokedBy,
        revokedAt: serverTimestamp(),
    });
}

// ═══════════════════════════════════════════════════════════════
// Recurring Payments
// ═══════════════════════════════════════════════════════════════

const recurringCol = () => collection(db, "baseRecurringPayments");

export async function createRecurringPayment(data: {
    orgId: string;
    label: string;
    type: RecurringType;
    recipientAddress: string;
    amount: number;
    frequency: RecurringFrequency;
    subAccountId: string | null;
    maxTotalAmount: number | null;
    consentSignature: string | null;
    createdBy: string;
}): Promise<string> {
    const ref = await addDoc(recurringCol(), {
        ...data,
        totalCharged: 0,
        chargeCount: 0,
        status: "active",
        nextChargeAt: serverTimestamp(),
        lastChargedAt: null,
        createdAt: serverTimestamp(),
    });
    return ref.id;
}

export async function getRecurringPayments(orgId: string): Promise<BaseRecurringPayment[]> {
    const q = query(recurringCol(), where("orgId", "==", orgId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
        const data = d.data();
        return {
            id: d.id,
            orgId: data.orgId,
            label: data.label,
            type: data.type,
            recipientAddress: data.recipientAddress,
            amount: data.amount,
            frequency: data.frequency,
            subAccountId: data.subAccountId ?? null,
            maxTotalAmount: data.maxTotalAmount ?? null,
            totalCharged: data.totalCharged ?? 0,
            chargeCount: data.chargeCount ?? 0,
            status: data.status,
            nextChargeAt: tsToDate(data.nextChargeAt),
            lastChargedAt: tsToDate(data.lastChargedAt),
            consentSignature: data.consentSignature ?? null,
            createdBy: data.createdBy,
            createdAt: tsToDate(data.createdAt),
        };
    });
}

export async function updateRecurringPayment(id: string, updates: Partial<Pick<BaseRecurringPayment, "status" | "amount" | "frequency">>): Promise<void> {
    await updateDoc(doc(recurringCol(), id), updates);
}

// ═══════════════════════════════════════════════════════════════
// Signature Requests
// ═══════════════════════════════════════════════════════════════

const signaturesCol = () => collection(db, "baseSignatureRequests");

export async function createSignatureRequest(data: {
    orgId: string;
    type: SignatureRequestType;
    requesterType: "system" | "agent" | "mod";
    requesterId: string;
    requesterName: string;
    typedData: Record<string, unknown>;
    message: string;
    signerAddress: string;
}): Promise<string> {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min
    const ref = await addDoc(signaturesCol(), {
        ...data,
        signature: null,
        status: "pending",
        expiresAt: Timestamp.fromDate(expiresAt),
        createdAt: serverTimestamp(),
        signedAt: null,
    });
    return ref.id;
}

export async function getSignatureRequests(orgId: string, status?: SignatureStatus): Promise<BaseSignatureRequest[]> {
    let q = query(signaturesCol(), where("orgId", "==", orgId));
    if (status) q = query(q, where("status", "==", status));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
        const data = d.data();
        return {
            id: d.id,
            orgId: data.orgId,
            type: data.type,
            requesterType: data.requesterType,
            requesterId: data.requesterId,
            requesterName: data.requesterName,
            typedData: data.typedData ?? {},
            message: data.message,
            signerAddress: data.signerAddress,
            signature: data.signature ?? null,
            status: data.status,
            expiresAt: tsToDate(data.expiresAt),
            createdAt: tsToDate(data.createdAt),
            signedAt: tsToDate(data.signedAt),
        };
    });
}

export async function submitSignature(id: string, signature: string): Promise<void> {
    await updateDoc(doc(signaturesCol(), id), {
        signature,
        status: "signed",
        signedAt: serverTimestamp(),
    });
}

export async function rejectSignatureRequest(id: string): Promise<void> {
    await updateDoc(doc(signaturesCol(), id), { status: "rejected" });
}

// ═══════════════════════════════════════════════════════════════
// Payments
// ═══════════════════════════════════════════════════════════════

const paymentsCol = () => collection(db, "basePayments");

export async function recordPayment(data: {
    orgId: string;
    fromAddress: string;
    toAddress: string;
    amount: number;
    memo: string;
    txHash: string | null;
    chainId: number;
    subAccountId: string | null;
    createdBy: string;
}): Promise<string> {
    const ref = await addDoc(paymentsCol(), {
        ...data,
        status: data.txHash ? "confirmed" : "pending",
        createdAt: serverTimestamp(),
        confirmedAt: data.txHash ? serverTimestamp() : null,
    });
    return ref.id;
}

export async function getPayments(orgId: string, max = 50): Promise<BasePayment[]> {
    const q = query(paymentsCol(), where("orgId", "==", orgId), orderBy("createdAt", "desc"), firestoreLimit(max));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
        const data = d.data();
        return {
            id: d.id,
            orgId: data.orgId,
            fromAddress: data.fromAddress,
            toAddress: data.toAddress,
            amount: data.amount,
            memo: data.memo ?? "",
            txHash: data.txHash ?? null,
            chainId: data.chainId,
            status: data.status,
            subAccountId: data.subAccountId ?? null,
            createdBy: data.createdBy,
            createdAt: tsToDate(data.createdAt),
            confirmedAt: tsToDate(data.confirmedAt),
        };
    });
}

export async function confirmPayment(id: string, txHash: string): Promise<void> {
    await updateDoc(doc(paymentsCol(), id), {
        txHash,
        status: "confirmed",
        confirmedAt: serverTimestamp(),
    });
}

// ═══════════════════════════════════════════════════════════════
// Audit Log
// ═══════════════════════════════════════════════════════════════

const auditCol = () => collection(db, "baseAuditLog");

export async function appendAuditLog(data: {
    orgId: string;
    action: AuditAction;
    actorType: "user" | "agent" | "system";
    actorId: string;
    description: string;
    metadata?: Record<string, unknown>;
}): Promise<string> {
    const ref = await addDoc(auditCol(), {
        ...data,
        metadata: data.metadata ?? {},
        timestamp: serverTimestamp(),
    });
    return ref.id;
}

export async function getAuditLog(orgId: string, max = 100, action?: AuditAction): Promise<BaseAuditEntry[]> {
    let q = query(auditCol(), where("orgId", "==", orgId), orderBy("timestamp", "desc"), firestoreLimit(max));
    if (action) q = query(auditCol(), where("orgId", "==", orgId), where("action", "==", action), orderBy("timestamp", "desc"), firestoreLimit(max));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
        const data = d.data();
        return {
            id: d.id,
            orgId: data.orgId,
            action: data.action,
            actorType: data.actorType,
            actorId: data.actorId,
            description: data.description,
            metadata: data.metadata ?? {},
            timestamp: tsToDate(data.timestamp),
        };
    });
}
