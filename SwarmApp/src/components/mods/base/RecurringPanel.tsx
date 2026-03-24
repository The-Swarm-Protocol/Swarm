"use client";

import {
    Clock, Plus, Pause, Play, XCircle, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BaseRecurringPayment } from "@/lib/base-accounts";

interface Props {
    payments: BaseRecurringPayment[];
    loading: boolean;
    actionLoading: string | null;
    onCreate: () => void;
    onPause: (id: string) => void;
    onResume: (id: string) => void;
    onCancel: (id: string) => void;
    onRefresh: () => void;
}

const statusStyles: Record<string, string> = {
    active: "bg-green-500/10 text-green-400 border-green-500/20",
    paused: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
    expired: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const typeLabels: Record<string, string> = {
    mod_subscription: "Mod Subscription",
    plan: "Plan",
    agent_budget: "Agent Budget",
    custom: "Custom",
};

function shortAddr(addr: string) {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function RecurringPanel({ payments, loading, actionLoading, onCreate, onPause, onResume, onCancel, onRefresh }: Props) {
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
                    {payments.filter((p) => p.status === "active").length} active recurring payments
                </p>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={onRefresh}>
                        <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={onCreate}>
                        <Plus className="h-4 w-4 mr-1.5" />
                        New Recurring Payment
                    </Button>
                </div>
            </div>

            {payments.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-12 text-center">
                    <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                    <h3 className="text-lg font-medium mb-1">No recurring payments</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Set up subscriptions, agent budgets, or recurring mod payments on Base.
                    </p>
                    <Button variant="outline" size="sm" onClick={onCreate}>
                        <Plus className="h-4 w-4 mr-1.5" />
                        New Recurring Payment
                    </Button>
                </div>
            ) : (
                payments.map((payment) => (
                    <div key={payment.id} className="rounded-lg border border-border bg-card p-4">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10">
                                    <Clock className="h-4 w-4 text-indigo-400" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">{payment.label}</span>
                                        <span className={cn("text-xs px-2 py-0.5 rounded-full border", statusStyles[payment.status])}>
                                            {payment.status.toUpperCase()}
                                        </span>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                            {typeLabels[payment.type] || payment.type}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        To: {shortAddr(payment.recipientAddress)} &middot; {payment.frequency}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-mono font-medium">{payment.amount} USDC</p>
                                <p className="text-xs text-muted-foreground">
                                    {payment.chargeCount} charges &middot; {payment.totalCharged.toFixed(2)} total
                                </p>
                            </div>
                        </div>

                        {payment.maxTotalAmount && (
                            <div className="mt-3">
                                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                    <span>Lifetime: {payment.totalCharged.toFixed(2)} / {payment.maxTotalAmount} USDC</span>
                                    <span>{((payment.totalCharged / payment.maxTotalAmount) * 100).toFixed(0)}%</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-indigo-500 transition-all"
                                        style={{ width: `${Math.min(100, (payment.totalCharged / payment.maxTotalAmount) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="mt-3 flex items-center justify-between">
                            <div className="text-xs text-muted-foreground">
                                {payment.nextChargeAt && (
                                    <span>Next charge: {new Date(payment.nextChargeAt).toLocaleDateString()}</span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5">
                                {payment.status === "active" && (
                                    <>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
                                            onClick={() => onPause(payment.id)}
                                            disabled={actionLoading === `pause-${payment.id}`}
                                        >
                                            <Pause className="h-3.5 w-3.5 mr-1" />
                                            Pause
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                            onClick={() => onCancel(payment.id)}
                                            disabled={actionLoading === `cancel-${payment.id}`}
                                        >
                                            <XCircle className="h-3.5 w-3.5 mr-1" />
                                            Cancel
                                        </Button>
                                    </>
                                )}
                                {payment.status === "paused" && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                                        onClick={() => onResume(payment.id)}
                                        disabled={actionLoading === `resume-${payment.id}`}
                                    >
                                        <Play className="h-3.5 w-3.5 mr-1" />
                                        Resume
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
