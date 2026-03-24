"use client";

import {
    FileSignature, CheckCircle2, XCircle, RefreshCw, Bot, ShieldCheck, Puzzle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BaseSignatureRequest } from "@/lib/base-accounts";

interface Props {
    requests: BaseSignatureRequest[];
    loading: boolean;
    actionLoading: string | null;
    onSign: (id: string) => void;
    onReject: (id: string) => void;
    onRefresh: () => void;
}

const statusStyles: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    signed: "bg-green-500/10 text-green-400 border-green-500/20",
    rejected: "bg-red-500/10 text-red-400 border-red-500/20",
    expired: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const typeLabels: Record<string, { label: string; icon: typeof ShieldCheck }> = {
    auth_challenge: { label: "Auth Challenge", icon: ShieldCheck },
    approval_prompt: { label: "Approval", icon: CheckCircle2 },
    attestation: { label: "Attestation", icon: FileSignature },
    mod_consent: { label: "Mod Consent", icon: Puzzle },
    spend_approval: { label: "Spend Approval", icon: Bot },
};

export default function SignaturesPanel({ requests, loading, actionLoading, onSign, onReject, onRefresh }: Props) {
    const pending = requests.filter((r) => r.status === "pending");
    const completed = requests.filter((r) => r.status !== "pending");

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (requests.length === 0) {
        return (
            <div className="rounded-lg border border-dashed border-border p-12 text-center">
                <FileSignature className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <h3 className="text-lg font-medium mb-1">No signature requests</h3>
                <p className="text-sm text-muted-foreground">
                    EIP-712 typed-data signing requests from agents and mods will appear here.
                </p>
            </div>
        );
    }

    const renderRequest = (req: BaseSignatureRequest) => {
        const typeConfig = typeLabels[req.type] || { label: req.type, icon: FileSignature };
        const TypeIcon = typeConfig.icon;

        return (
            <div key={req.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                            <TypeIcon className="h-4 w-4 text-violet-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-medium">{req.requesterName}</span>
                                <span className={cn("text-xs px-2 py-0.5 rounded-full border", statusStyles[req.status])}>
                                    {req.status.toUpperCase()}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                    {typeConfig.label}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{req.message}</p>
                        </div>
                    </div>
                    {req.status === "pending" && (
                        <div className="flex items-center gap-1.5">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                                onClick={() => onSign(req.id)}
                                disabled={actionLoading === `sign-${req.id}`}
                            >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Sign
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                onClick={() => onReject(req.id)}
                                disabled={actionLoading === `reject-${req.id}`}
                            >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                            </Button>
                        </div>
                    )}
                </div>

                {req.signature && (
                    <div className="mt-2">
                        <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded block truncate">
                            {req.signature}
                        </code>
                    </div>
                )}

                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Signer: {req.signerAddress.slice(0, 6)}...{req.signerAddress.slice(-4)}</span>
                    {req.createdAt && <span>{new Date(req.createdAt).toLocaleString()}</span>}
                    {req.expiresAt && req.status === "pending" && (
                        <span>Expires: {new Date(req.expiresAt).toLocaleString()}</span>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    {pending.length} pending, {completed.length} completed
                </p>
                <Button variant="ghost" size="sm" onClick={onRefresh}>
                    <RefreshCw className="h-3.5 w-3.5" />
                </Button>
            </div>

            {pending.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-sm font-medium text-yellow-400 flex items-center gap-1.5">
                        <FileSignature className="h-3.5 w-3.5" />
                        Pending ({pending.length})
                    </h3>
                    {pending.map(renderRequest)}
                </div>
            )}

            {completed.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">History ({completed.length})</h3>
                    {completed.map(renderRequest)}
                </div>
            )}
        </div>
    );
}
