"use client";

import { useState } from "react";
import { CreditCard, XCircle, RefreshCw, CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BaseSubAccount } from "@/lib/base-accounts";

interface Props {
    open: boolean;
    onClose: () => void;
    orgId: string;
    walletAddress: string | null;
    subAccounts: BaseSubAccount[];
    onSend: (data: {
        toAddress: string;
        amount: number;
        memo: string;
        subAccountId: string | null;
    }) => Promise<{ txHash?: string; error?: string }>;
}

export default function SendPaymentDialog({ open, onClose, walletAddress, subAccounts, onSend }: Props) {
    const [toAddress, setToAddress] = useState("");
    const [amount, setAmount] = useState("");
    const [memo, setMemo] = useState("");
    const [subAccountId, setSubAccountId] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<{ txHash?: string; error?: string } | null>(null);

    const handleSend = async () => {
        if (!toAddress || !amount) return;
        setSending(true);
        try {
            const res = await onSend({
                toAddress,
                amount: parseFloat(amount),
                memo,
                subAccountId,
            });
            setResult(res);
        } catch {
            setResult({ error: "Transaction failed" });
        } finally {
            setSending(false);
        }
    };

    const reset = () => {
        setToAddress("");
        setAmount("");
        setMemo("");
        setSubAccountId(null);
        setResult(null);
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-blue-400" />
                        <h2 className="text-lg font-semibold">Send USDC on Base</h2>
                    </div>
                    <button className="text-muted-foreground hover:text-foreground" onClick={() => { reset(); onClose(); }}>
                        <XCircle className="h-5 w-5" />
                    </button>
                </div>

                {!result ? (
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium mb-1 block">From</label>
                            <select
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                value={subAccountId || ""}
                                onChange={(e) => setSubAccountId(e.target.value || null)}
                            >
                                <option value="">Org Wallet ({walletAddress?.slice(0, 8)}...)</option>
                                {subAccounts.filter((a) => a.status === "active").map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.label} ({a.balance.toFixed(2)} USDC)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1 block">Recipient Address</label>
                            <input
                                type="text"
                                placeholder="0x..."
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
                                value={toAddress}
                                onChange={(e) => setToAddress(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1 block">Amount (USDC)</label>
                            <input
                                type="number"
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1 block">Memo (optional)</label>
                            <input
                                type="text"
                                placeholder="e.g. Agent top-up, mod purchase..."
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                value={memo}
                                onChange={(e) => setMemo(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                            <Button
                                className="flex-1"
                                onClick={handleSend}
                                disabled={sending || !toAddress || !amount || parseFloat(amount) <= 0}
                            >
                                {sending ? (
                                    <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                                ) : (
                                    <CreditCard className="h-4 w-4 mr-1.5" />
                                )}
                                {sending ? "Sending..." : `Send ${amount || "0"} USDC`}
                            </Button>
                            <Button variant="outline" onClick={() => { reset(); onClose(); }}>
                                Cancel
                            </Button>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            USDC on Base Mainnet (Chain ID 8453). Gas fees paid in ETH.
                        </p>
                    </div>
                ) : result.txHash ? (
                    <div className="flex flex-col items-center py-8">
                        <CheckCircle2 className="h-10 w-10 text-green-400 mb-3" />
                        <h3 className="text-lg font-medium mb-1">Payment Sent</h3>
                        <p className="text-sm text-muted-foreground mb-2">
                            {amount} USDC sent to {toAddress.slice(0, 8)}...{toAddress.slice(-4)}
                        </p>
                        <a
                            href={`https://basescan.org/tx/${result.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 mb-4"
                        >
                            View on BaseScan <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <Button variant="outline" onClick={() => { reset(); onClose(); }}>Close</Button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center py-8">
                        <XCircle className="h-10 w-10 text-red-400 mb-3" />
                        <h3 className="text-lg font-medium mb-1">Payment Failed</h3>
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
