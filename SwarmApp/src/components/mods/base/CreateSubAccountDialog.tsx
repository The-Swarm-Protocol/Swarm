"use client";

import { useState } from "react";
import { Users, XCircle, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
    open: boolean;
    onClose: () => void;
    orgId: string;
    walletAddress: string | null;
    onCreate: (data: {
        label: string;
        agentId: string | null;
        address: string;
        dailyLimit: number;
        monthlyLimit: number;
    }) => Promise<{ id?: string; error?: string }>;
}

export default function CreateSubAccountDialog({ open, onClose, walletAddress, onCreate }: Props) {
    const [label, setLabel] = useState("");
    const [agentId, setAgentId] = useState("");
    const [address, setAddress] = useState("");
    const [dailyLimit, setDailyLimit] = useState("100");
    const [monthlyLimit, setMonthlyLimit] = useState("1000");
    const [creating, setCreating] = useState(false);
    const [result, setResult] = useState<{ id?: string; error?: string } | null>(null);

    const handleCreate = async () => {
        if (!label || !address) return;
        setCreating(true);
        try {
            const res = await onCreate({
                label,
                agentId: agentId || null,
                address,
                dailyLimit: parseFloat(dailyLimit) || 0,
                monthlyLimit: parseFloat(monthlyLimit) || 0,
            });
            setResult(res);
        } catch {
            setResult({ error: "Failed to create sub-account" });
        } finally {
            setCreating(false);
        }
    };

    const reset = () => {
        setLabel("");
        setAgentId("");
        setAddress("");
        setDailyLimit("100");
        setMonthlyLimit("1000");
        setResult(null);
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-400" />
                        <h2 className="text-lg font-semibold">Create Sub-Account</h2>
                    </div>
                    <button className="text-muted-foreground hover:text-foreground" onClick={() => { reset(); onClose(); }}>
                        <XCircle className="h-5 w-5" />
                    </button>
                </div>

                {!result ? (
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium mb-1 block">Label</label>
                            <input
                                type="text"
                                placeholder="e.g. Research Agent Budget"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1 block">Agent ID (optional)</label>
                            <input
                                type="text"
                                placeholder="Leave blank for org-level account"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
                                value={agentId}
                                onChange={(e) => setAgentId(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1 block">Sub-Account Address</label>
                            <input
                                type="text"
                                placeholder="0x..."
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                            />
                            {/* TODO: Replace with CDP SDK sub-account creation when available */}
                            <p className="text-xs text-muted-foreground mt-1">
                                Enter an existing wallet address or smart wallet sub-account address.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-medium mb-1 block">Daily Limit (USDC)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
                                    value={dailyLimit}
                                    onChange={(e) => setDailyLimit(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Monthly Limit (USDC)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
                                    value={monthlyLimit}
                                    onChange={(e) => setMonthlyLimit(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                            <Button
                                className="flex-1"
                                onClick={handleCreate}
                                disabled={creating || !label || !address}
                            >
                                {creating ? (
                                    <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                                ) : (
                                    <Users className="h-4 w-4 mr-1.5" />
                                )}
                                {creating ? "Creating..." : "Create Sub-Account"}
                            </Button>
                            <Button variant="outline" onClick={() => { reset(); onClose(); }}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : result.id ? (
                    <div className="flex flex-col items-center py-8">
                        <CheckCircle2 className="h-10 w-10 text-green-400 mb-3" />
                        <h3 className="text-lg font-medium mb-1">Sub-Account Created</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            &quot;{label}&quot; is ready for funding.
                        </p>
                        <Button variant="outline" onClick={() => { reset(); onClose(); }}>Close</Button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center py-8">
                        <XCircle className="h-10 w-10 text-red-400 mb-3" />
                        <h3 className="text-lg font-medium mb-1">Creation Failed</h3>
                        <p className="text-sm text-muted-foreground mb-4">{result.error}</p>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => setResult(null)}>Try Again</Button>
                            <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancel</Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
