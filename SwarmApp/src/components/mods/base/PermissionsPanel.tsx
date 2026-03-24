"use client";

import {
    KeyRound, Bot, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BaseSpendPermission } from "@/lib/base-accounts";

interface Props {
    permissions: BaseSpendPermission[];
    loading: boolean;
    actionLoading: string | null;
    onApprove: (id: string) => void;
    onDeny: (id: string) => void;
    onRevoke: (id: string) => void;
    onRefresh: () => void;
}

const statusStyles: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    approved: "bg-green-500/10 text-green-400 border-green-500/20",
    denied: "bg-red-500/10 text-red-400 border-red-500/20",
    revoked: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    expired: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

export default function PermissionsPanel({ permissions, loading, actionLoading, onApprove, onDeny, onRevoke, onRefresh }: Props) {
    const pending = permissions.filter((p) => p.status === "pending");
    const active = permissions.filter((p) => p.status === "approved");
    const inactive = permissions.filter((p) => p.status !== "pending" && p.status !== "approved");

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (permissions.length === 0) {
        return (
            <div className="rounded-lg border border-dashed border-border p-12 text-center">
                <Bot className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <h3 className="text-lg font-medium mb-1">No spend permissions</h3>
                <p className="text-sm text-muted-foreground">
                    When agents request spending authorization, their requests will appear here.
                </p>
            </div>
        );
    }

    const renderPermission = (perm: BaseSpendPermission) => (
        <div key={perm.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                        <Bot className="h-4 w-4 text-purple-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-medium">{perm.agentName}</span>
                            <span className={cn("text-xs px-2 py-0.5 rounded-full border", statusStyles[perm.status])}>
                                {perm.status.toUpperCase()}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{perm.reason}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="font-mono font-medium">{perm.amount} USDC</p>
                    <p className="text-xs text-muted-foreground">{perm.period}</p>
                </div>
            </div>

            {perm.status === "approved" && (
                <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Used: {perm.usedAmount.toFixed(2)} / {perm.amount} USDC</span>
                        <span>{((perm.usedAmount / perm.amount) * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                            className="h-full rounded-full bg-blue-500 transition-all"
                            style={{ width: `${Math.min(100, (perm.usedAmount / perm.amount) * 100)}%` }}
                        />
                    </div>
                </div>
            )}

            <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                    {perm.createdAt && <span>Requested: {new Date(perm.createdAt).toLocaleDateString()}</span>}
                    {perm.grantedBy && (
                        <span className="ml-3">
                            Approved by {perm.grantedBy.slice(0, 6)}...{perm.grantedBy.slice(-4)}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    {perm.status === "pending" && (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                                onClick={() => onApprove(perm.id)}
                                disabled={actionLoading === `approve-${perm.id}`}
                            >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Approve
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                onClick={() => onDeny(perm.id)}
                                disabled={actionLoading === `deny-${perm.id}`}
                            >
                                <XCircle className="h-4 w-4 mr-1" />
                                Deny
                            </Button>
                        </>
                    )}
                    {perm.status === "approved" && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                            onClick={() => onRevoke(perm.id)}
                            disabled={actionLoading === `revoke-${perm.id}`}
                        >
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            Revoke
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    {pending.length} pending, {active.length} active
                </p>
                <Button variant="ghost" size="sm" onClick={onRefresh}>
                    <RefreshCw className="h-3.5 w-3.5" />
                </Button>
            </div>

            {pending.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-sm font-medium text-yellow-400 flex items-center gap-1.5">
                        <KeyRound className="h-3.5 w-3.5" />
                        Pending Requests ({pending.length})
                    </h3>
                    {pending.map(renderPermission)}
                </div>
            )}

            {active.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-sm font-medium text-green-400 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Active Permissions ({active.length})
                    </h3>
                    {active.map(renderPermission)}
                </div>
            )}

            {inactive.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">History ({inactive.length})</h3>
                    {inactive.map(renderPermission)}
                </div>
            )}
        </div>
    );
}
