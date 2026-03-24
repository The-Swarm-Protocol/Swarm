"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Coins, ShieldCheck, CreditCard, Users, KeyRound, Clock,
    FileSignature, Activity, Globe, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOrg } from "@/contexts/OrgContext";
import { useSession } from "@/contexts/SessionContext";
import type {
    BaseSubAccount,
    BaseSpendPermission,
    BaseRecurringPayment,
    BaseSignatureRequest,
    BasePayment,
    BaseAuditEntry,
} from "@/lib/base-accounts";

import PaymentsPanel from "@/components/mods/base/PaymentsPanel";
import SubAccountsPanel from "@/components/mods/base/SubAccountsPanel";
import PermissionsPanel from "@/components/mods/base/PermissionsPanel";
import RecurringPanel from "@/components/mods/base/RecurringPanel";
import SignaturesPanel from "@/components/mods/base/SignaturesPanel";
import AuditPanel from "@/components/mods/base/AuditPanel";
import AccountSurface from "@/components/mods/base/AccountSurface";
import SignInDialog from "@/components/mods/base/SignInDialog";
import SendPaymentDialog from "@/components/mods/base/SendPaymentDialog";
import CreateSubAccountDialog from "@/components/mods/base/CreateSubAccountDialog";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

type Tab = "payments" | "sub-accounts" | "permissions" | "recurring" | "signatures" | "audit" | "account";

const TABS: { id: Tab; label: string; icon: typeof Coins }[] = [
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "sub-accounts", label: "Sub-Accounts", icon: Users },
    { id: "permissions", label: "Permissions", icon: KeyRound },
    { id: "recurring", label: "Recurring", icon: Clock },
    { id: "signatures", label: "Signatures", icon: FileSignature },
    { id: "audit", label: "Audit", icon: Activity },
    { id: "account", label: "Account", icon: Globe },
];

// ═══════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════

export default function BaseModPage() {
    const { currentOrg: org } = useOrg();
    const { address: wallet } = useSession();
    const orgId = org?.id;

    const [tab, setTab] = useState<Tab>("payments");
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Data
    const [payments, setPayments] = useState<BasePayment[]>([]);
    const [subAccounts, setSubAccounts] = useState<BaseSubAccount[]>([]);
    const [permissions, setPermissions] = useState<BaseSpendPermission[]>([]);
    const [recurring, setRecurring] = useState<BaseRecurringPayment[]>([]);
    const [signatures, setSignatures] = useState<BaseSignatureRequest[]>([]);
    const [auditLog, setAuditLog] = useState<BaseAuditEntry[]>([]);

    // Dialogs
    const [showSignIn, setShowSignIn] = useState(false);
    const [showSendPayment, setShowSendPayment] = useState(false);
    const [showCreateSubAccount, setShowCreateSubAccount] = useState(false);

    // ── Fetchers ──

    const headers = useCallback(() => ({
        "x-wallet-address": wallet || "",
    }), [wallet]);

    const fetchPayments = useCallback(async () => {
        if (!orgId) return;
        try {
            const res = await fetch(`/api/v1/base/payments?orgId=${orgId}`, { headers: headers() });
            if (res.ok) { const data = await res.json(); setPayments(data.payments || []); }
        } catch (err) { console.error("Failed to fetch payments:", err); }
    }, [orgId, headers]);

    const fetchSubAccounts = useCallback(async () => {
        if (!orgId) return;
        try {
            const res = await fetch(`/api/v1/base/sub-accounts?orgId=${orgId}`, { headers: headers() });
            if (res.ok) { const data = await res.json(); setSubAccounts(data.accounts || []); }
        } catch (err) { console.error("Failed to fetch sub-accounts:", err); }
    }, [orgId, headers]);

    const fetchPermissions = useCallback(async () => {
        if (!orgId) return;
        try {
            const res = await fetch(`/api/v1/base/permissions?orgId=${orgId}`, { headers: headers() });
            if (res.ok) { const data = await res.json(); setPermissions(data.permissions || []); }
        } catch (err) { console.error("Failed to fetch permissions:", err); }
    }, [orgId, headers]);

    const fetchRecurring = useCallback(async () => {
        if (!orgId) return;
        try {
            const res = await fetch(`/api/v1/base/recurring?orgId=${orgId}`, { headers: headers() });
            if (res.ok) { const data = await res.json(); setRecurring(data.payments || []); }
        } catch (err) { console.error("Failed to fetch recurring:", err); }
    }, [orgId, headers]);

    const fetchSignatures = useCallback(async () => {
        if (!orgId) return;
        try {
            const res = await fetch(`/api/v1/base/signatures?orgId=${orgId}`, { headers: headers() });
            if (res.ok) { const data = await res.json(); setSignatures(data.requests || []); }
        } catch (err) { console.error("Failed to fetch signatures:", err); }
    }, [orgId, headers]);

    const fetchAudit = useCallback(async () => {
        if (!orgId) return;
        try {
            const res = await fetch(`/api/v1/base/audit?orgId=${orgId}&limit=100`, { headers: headers() });
            if (res.ok) { const data = await res.json(); setAuditLog(data.entries || []); }
        } catch (err) { console.error("Failed to fetch audit:", err); }
    }, [orgId, headers]);

    useEffect(() => {
        if (!orgId) return;
        setLoading(true);
        Promise.all([
            fetchPayments(),
            fetchSubAccounts(),
            fetchPermissions(),
            fetchRecurring(),
            fetchSignatures(),
            fetchAudit(),
        ]).finally(() => setLoading(false));
    }, [orgId, fetchPayments, fetchSubAccounts, fetchPermissions, fetchRecurring, fetchSignatures, fetchAudit]);

    // ── Actions ──

    const handlePermissionAction = async (id: string, action: "approve" | "deny" | "revoke") => {
        if (!orgId || !wallet) return;
        setActionLoading(`${action}-${id}`);
        try {
            await fetch(`/api/v1/base/permissions/${id}`, {
                method: "PATCH",
                headers: { ...headers(), "Content-Type": "application/json" },
                body: JSON.stringify({ action, orgId }),
            });
            await fetchPermissions();
            await fetchAudit();
        } finally { setActionLoading(null); }
    };

    const handleRecurringAction = async (id: string, status: "paused" | "active" | "cancelled") => {
        if (!orgId || !wallet) return;
        const actionKey = status === "active" ? "resume" : status === "paused" ? "pause" : "cancel";
        setActionLoading(`${actionKey}-${id}`);
        try {
            await fetch(`/api/v1/base/recurring/${id}`, {
                method: "PATCH",
                headers: { ...headers(), "Content-Type": "application/json" },
                body: JSON.stringify({ status, orgId }),
            });
            await fetchRecurring();
            await fetchAudit();
        } finally { setActionLoading(null); }
    };

    const handleSignatureAction = async (id: string, action: "sign" | "reject") => {
        if (!orgId || !wallet) return;
        setActionLoading(`${action}-${id}`);
        try {
            // TODO: For "sign", trigger wallet signTypedData and include the signature
            const body: Record<string, string> = { action, orgId };
            if (action === "sign") body.signature = "0x_placeholder_signature";
            await fetch(`/api/v1/base/signatures/${id}`, {
                method: "PATCH",
                headers: { ...headers(), "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            await fetchSignatures();
            await fetchAudit();
        } finally { setActionLoading(null); }
    };

    const handleSubAccountFreeze = async (id: string) => {
        if (!wallet) return;
        setActionLoading(`freeze-${id}`);
        try {
            await fetch(`/api/v1/base/sub-accounts/${id}`, {
                method: "PATCH",
                headers: { ...headers(), "Content-Type": "application/json" },
                body: JSON.stringify({ status: "frozen" }),
            });
            await fetchSubAccounts();
            await fetchAudit();
        } finally { setActionLoading(null); }
    };

    const handleSubAccountClose = async (id: string) => {
        if (!wallet) return;
        setActionLoading(`close-${id}`);
        try {
            await fetch(`/api/v1/base/sub-accounts/${id}`, {
                method: "DELETE",
                headers: headers(),
            });
            await fetchSubAccounts();
            await fetchAudit();
        } finally { setActionLoading(null); }
    };

    const handleSendPayment = async (data: { toAddress: string; amount: number; memo: string; subAccountId: string | null }) => {
        if (!orgId || !wallet) return { error: "Not connected" };
        try {
            // TODO: Execute actual thirdweb USDC transfer here and get txHash
            const res = await fetch("/api/v1/base/payments", {
                method: "POST",
                headers: { ...headers(), "Content-Type": "application/json" },
                body: JSON.stringify({
                    orgId,
                    fromAddress: wallet,
                    toAddress: data.toAddress,
                    amount: data.amount,
                    memo: data.memo,
                    txHash: null, // Will be populated after on-chain tx
                    chainId: 8453,
                    subAccountId: data.subAccountId,
                }),
            });
            const result = await res.json();
            if (res.ok) {
                await fetchPayments();
                await fetchAudit();
                return { txHash: result.txHash || result.id };
            }
            return { error: result.error || "Failed to send" };
        } catch {
            return { error: "Transaction failed" };
        }
    };

    const handleCreateSubAccount = async (data: { label: string; agentId: string | null; address: string; dailyLimit: number; monthlyLimit: number }) => {
        if (!orgId || !wallet) return { error: "Not connected" };
        try {
            const res = await fetch("/api/v1/base/sub-accounts", {
                method: "POST",
                headers: { ...headers(), "Content-Type": "application/json" },
                body: JSON.stringify({ orgId, ...data }),
            });
            const result = await res.json();
            if (res.ok) {
                await fetchSubAccounts();
                await fetchAudit();
                return { id: result.id };
            }
            return { error: result.error || "Failed to create" };
        } catch {
            return { error: "Failed to create sub-account" };
        }
    };

    // ── Stats ──

    const pendingPermissions = permissions.filter((p) => p.status === "pending").length;
    const activeSubAccounts = subAccounts.filter((a) => a.status === "active").length;
    const activePermissions = permissions.filter((p) => p.status === "approved").length;

    // ═══════════════════════════════════════════════════════════════
    // Render
    // ═══════════════════════════════════════════════════════════════

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <Coins className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold">Base</h1>
                        <p className="text-sm text-muted-foreground">
                            USDC payments, agent sub-accounts, spend permissions, and Base-native auth
                        </p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowSignIn(true)}>
                    <ShieldCheck className="h-4 w-4 mr-1.5" />
                    Sign in with Base
                </Button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: "Payments", value: payments.length, icon: CreditCard, color: "text-blue-400" },
                    { label: "Sub-Accounts", value: activeSubAccounts, icon: Users, color: "text-green-400" },
                    { label: "Active Permissions", value: activePermissions, icon: KeyRound, color: pendingPermissions > 0 ? "text-yellow-400" : "text-purple-400" },
                    { label: "Audit Events", value: auditLog.length, icon: Activity, color: "text-indigo-400" },
                ].map((stat) => (
                    <div key={stat.label} className="rounded-lg border border-border bg-card p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <stat.icon className={cn("h-4 w-4", stat.color)} />
                            <span className="text-xs text-muted-foreground">{stat.label}</span>
                        </div>
                        <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit border border-border overflow-x-auto">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={cn(
                            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all whitespace-nowrap",
                            tab === t.id
                                ? "bg-background text-foreground shadow-sm border border-border"
                                : "text-muted-foreground hover:text-foreground",
                        )}
                    >
                        <t.icon className="h-3.5 w-3.5" />
                        {t.label}
                        {t.id === "permissions" && pendingPermissions > 0 && (
                            <span className="ml-1 text-xs bg-yellow-500/20 text-yellow-400 px-1.5 rounded-full">
                                {pendingPermissions}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <>
                    {tab === "payments" && (
                        <PaymentsPanel
                            payments={payments}
                            walletAddress={wallet}
                            loading={false}
                            onSendPayment={() => setShowSendPayment(true)}
                            onRefresh={fetchPayments}
                        />
                    )}
                    {tab === "sub-accounts" && (
                        <SubAccountsPanel
                            accounts={subAccounts}
                            loading={false}
                            actionLoading={actionLoading}
                            onCreate={() => setShowCreateSubAccount(true)}
                            onFreeze={handleSubAccountFreeze}
                            onClose={handleSubAccountClose}
                            onRefresh={fetchSubAccounts}
                        />
                    )}
                    {tab === "permissions" && (
                        <PermissionsPanel
                            permissions={permissions}
                            loading={false}
                            actionLoading={actionLoading}
                            onApprove={(id) => handlePermissionAction(id, "approve")}
                            onDeny={(id) => handlePermissionAction(id, "deny")}
                            onRevoke={(id) => handlePermissionAction(id, "revoke")}
                            onRefresh={fetchPermissions}
                        />
                    )}
                    {tab === "recurring" && (
                        <RecurringPanel
                            payments={recurring}
                            loading={false}
                            actionLoading={actionLoading}
                            onCreate={() => { /* TODO: recurring payment dialog */ }}
                            onPause={(id) => handleRecurringAction(id, "paused")}
                            onResume={(id) => handleRecurringAction(id, "active")}
                            onCancel={(id) => handleRecurringAction(id, "cancelled")}
                            onRefresh={fetchRecurring}
                        />
                    )}
                    {tab === "signatures" && (
                        <SignaturesPanel
                            requests={signatures}
                            loading={false}
                            actionLoading={actionLoading}
                            onSign={(id) => handleSignatureAction(id, "sign")}
                            onReject={(id) => handleSignatureAction(id, "reject")}
                            onRefresh={fetchSignatures}
                        />
                    )}
                    {tab === "audit" && (
                        <AuditPanel
                            entries={auditLog}
                            loading={false}
                            onRefresh={fetchAudit}
                        />
                    )}
                    {tab === "account" && (
                        <AccountSurface walletAddress={wallet} />
                    )}
                </>
            )}

            {/* Dialogs */}
            <SignInDialog
                open={showSignIn}
                onClose={() => setShowSignIn(false)}
                walletAddress={wallet}
                onSignIn={async () => {
                    // TODO: Wire to actual wallet signMessage + verify flow
                    setShowSignIn(false);
                }}
            />
            <SendPaymentDialog
                open={showSendPayment}
                onClose={() => setShowSendPayment(false)}
                orgId={orgId || ""}
                walletAddress={wallet}
                subAccounts={subAccounts}
                onSend={handleSendPayment}
            />
            <CreateSubAccountDialog
                open={showCreateSubAccount}
                onClose={() => setShowCreateSubAccount(false)}
                orgId={orgId || ""}
                walletAddress={wallet}
                onCreate={handleCreateSubAccount}
            />
        </div>
    );
}
