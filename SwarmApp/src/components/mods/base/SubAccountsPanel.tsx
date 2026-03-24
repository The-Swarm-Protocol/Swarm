"use client";

import {
    Users, Plus, Snowflake, XCircle, Wallet, RefreshCw, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BaseSubAccount } from "@/lib/base-accounts";

interface Props {
    accounts: BaseSubAccount[];
    loading: boolean;
    actionLoading: string | null;
    onCreate: () => void;
    onFreeze: (id: string) => void;
    onClose: (id: string) => void;
    onRefresh: () => void;
}

function shortAddr(addr: string) {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const statusStyles: Record<string, string> = {
    active: "bg-green-500/10 text-green-400 border-green-500/20",
    frozen: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    closed: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

export default function SubAccountsPanel({ accounts, loading, actionLoading, onCreate, onFreeze, onClose, onRefresh }: Props) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    {accounts.length} sub-account{accounts.length !== 1 ? "s" : ""}
                </p>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={onRefresh}>
                        <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={onCreate}>
                        <Plus className="h-4 w-4 mr-1.5" />
                        Create Sub-Account
                    </Button>
                </div>
            </div>

            {accounts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-12 text-center">
                    <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                    <h3 className="text-lg font-medium mb-1">No sub-accounts</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Create agent-specific sub-accounts to isolate spending on Base.
                    </p>
                    <Button variant="outline" size="sm" onClick={onCreate}>
                        <Plus className="h-4 w-4 mr-1.5" />
                        Create Sub-Account
                    </Button>
                </div>
            ) : (
                accounts.map((acct) => (
                    <div key={acct.id} className="rounded-lg border border-border bg-card p-4">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                                    <Wallet className="h-4 w-4 text-blue-400" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">{acct.label}</span>
                                        <span className={cn("text-xs px-2 py-0.5 rounded-full border", statusStyles[acct.status])}>
                                            {acct.status.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <code className="text-xs text-muted-foreground bg-muted px-1 rounded">
                                            {shortAddr(acct.address)}
                                        </code>
                                        <a
                                            href={`https://basescan.org/address/${acct.address}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-400 hover:text-blue-300"
                                        >
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                        {acct.agentId && (
                                            <span className="text-xs text-muted-foreground">Agent: {acct.agentId}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-mono font-medium text-blue-400">{acct.balance.toFixed(2)} USDC</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Spent: {acct.totalSpent.toFixed(2)} USDC
                                </p>
                            </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                            <div className="flex gap-4 text-xs text-muted-foreground">
                                <span>Daily limit: {acct.dailyLimit > 0 ? `${acct.dailyLimit} USDC` : "None"}</span>
                                <span>Monthly limit: {acct.monthlyLimit > 0 ? `${acct.monthlyLimit} USDC` : "None"}</span>
                            </div>
                            {acct.status === "active" && (
                                <div className="flex items-center gap-1.5">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
                                        onClick={() => onFreeze(acct.id)}
                                        disabled={actionLoading === `freeze-${acct.id}`}
                                    >
                                        <Snowflake className="h-3.5 w-3.5 mr-1" />
                                        Freeze
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                        onClick={() => onClose(acct.id)}
                                        disabled={actionLoading === `close-${acct.id}`}
                                    >
                                        <XCircle className="h-3.5 w-3.5 mr-1" />
                                        Close
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
