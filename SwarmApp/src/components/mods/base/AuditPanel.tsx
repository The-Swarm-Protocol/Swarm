"use client";

import {
    Activity, Eye, RefreshCw, User, Bot, Info,
    Plus, Trash2, CheckCircle2, XCircle, AlertTriangle, KeyRound,
    CreditCard, Clock, FileSignature, ShieldCheck, Snowflake,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BaseAuditEntry, AuditAction } from "@/lib/base-accounts";

interface Props {
    entries: BaseAuditEntry[];
    loading: boolean;
    onRefresh: () => void;
}

function actionIcon(action: AuditAction) {
    switch (action) {
        case "siwe_login":
        case "siwe_verify":
            return <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />;
        case "payment_sent":
            return <CreditCard className="h-3.5 w-3.5 text-red-400" />;
        case "payment_received":
            return <CreditCard className="h-3.5 w-3.5 text-green-400" />;
        case "subaccount_created":
            return <Plus className="h-3.5 w-3.5 text-green-400" />;
        case "subaccount_funded":
            return <CreditCard className="h-3.5 w-3.5 text-blue-400" />;
        case "subaccount_frozen":
            return <Snowflake className="h-3.5 w-3.5 text-yellow-400" />;
        case "subaccount_closed":
            return <Trash2 className="h-3.5 w-3.5 text-red-400" />;
        case "permission_requested":
            return <KeyRound className="h-3.5 w-3.5 text-yellow-400" />;
        case "permission_approved":
            return <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />;
        case "permission_denied":
            return <XCircle className="h-3.5 w-3.5 text-red-400" />;
        case "permission_revoked":
            return <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />;
        case "recurring_created":
            return <Clock className="h-3.5 w-3.5 text-green-400" />;
        case "recurring_paused":
            return <Clock className="h-3.5 w-3.5 text-yellow-400" />;
        case "recurring_cancelled":
            return <Clock className="h-3.5 w-3.5 text-red-400" />;
        case "recurring_charged":
            return <Clock className="h-3.5 w-3.5 text-blue-400" />;
        case "signature_requested":
            return <FileSignature className="h-3.5 w-3.5 text-yellow-400" />;
        case "signature_signed":
            return <FileSignature className="h-3.5 w-3.5 text-green-400" />;
        case "signature_rejected":
            return <FileSignature className="h-3.5 w-3.5 text-red-400" />;
        default:
            return <Activity className="h-3.5 w-3.5 text-gray-400" />;
    }
}

export default function AuditPanel({ entries, loading, onRefresh }: Props) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (entries.length === 0) {
        return (
            <div className="rounded-lg border border-dashed border-border p-12 text-center">
                <Eye className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <h3 className="text-lg font-medium mb-1">No audit events</h3>
                <p className="text-sm text-muted-foreground">
                    All Base operations will be logged here.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{entries.length} events</p>
                <Button variant="ghost" size="sm" onClick={onRefresh}>
                    <RefreshCw className="h-3.5 w-3.5" />
                </Button>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-0 text-xs">
                    {entries.map((entry, i) => (
                        <div
                            key={entry.id}
                            className={cn("contents", i % 2 === 0 ? "" : "[&>*]:bg-muted/30")}
                        >
                            <div className="flex items-center gap-2 pl-3 py-2">
                                {actionIcon(entry.action)}
                                {entry.actorType === "agent"
                                    ? <Bot className="h-3 w-3 text-blue-400" />
                                    : entry.actorType === "system"
                                    ? <Info className="h-3 w-3 text-gray-400" />
                                    : <User className="h-3 w-3 text-green-400" />
                                }
                            </div>
                            <div className="py-2 truncate">
                                <span className="text-foreground">{entry.description}</span>
                            </div>
                            <div className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                                {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : "\u2014"}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
