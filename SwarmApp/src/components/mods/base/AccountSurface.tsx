"use client";

import { Globe, ExternalLink, Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
    walletAddress: string | null;
}

const SUPPORTED_NETWORKS = [
    { name: "Base", chainId: 8453, color: "text-blue-400", bg: "bg-blue-500/10", explorer: "https://basescan.org" },
    { name: "Ethereum", chainId: 1, color: "text-gray-400", bg: "bg-gray-500/10", explorer: "https://etherscan.io" },
    { name: "Avalanche", chainId: 43114, color: "text-red-400", bg: "bg-red-500/10", explorer: "https://snowtrace.io" },
    { name: "Base Sepolia", chainId: 84532, color: "text-blue-300", bg: "bg-blue-400/10", explorer: "https://sepolia.basescan.org" },
];

export default function AccountSurface({ walletAddress }: Props) {
    const [copied, setCopied] = useState(false);

    const copyAddress = () => {
        if (!walletAddress) return;
        navigator.clipboard.writeText(walletAddress);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!walletAddress) {
        return (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <Globe className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <h3 className="text-lg font-medium mb-1">No wallet connected</h3>
                <p className="text-sm text-muted-foreground">
                    Connect your wallet and sign in with Base to view your account surface.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Account address card */}
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">Base Account Address</p>
                        <code className="text-sm font-mono text-blue-400">{walletAddress}</code>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={copyAddress}
                            className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
                            title="Copy address"
                        >
                            {copied
                                ? <CheckCircle2 className="h-4 w-4 text-green-400" />
                                : <Copy className="h-4 w-4 text-muted-foreground" />
                            }
                        </button>
                        <a
                            href={`https://basescan.org/address/${walletAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
                            title="View on BaseScan"
                        >
                            <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </a>
                    </div>
                </div>
            </div>

            {/* Supported networks grid */}
            <div>
                <h3 className="text-sm font-medium mb-2">Supported EVM Networks</h3>
                <div className="grid grid-cols-2 gap-3">
                    {SUPPORTED_NETWORKS.map((network) => (
                        <div key={network.chainId} className="rounded-lg border border-border bg-card p-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className={cn("h-2 w-2 rounded-full", network.bg)}>
                                        <div className={cn("h-2 w-2 rounded-full", network.color.replace("text-", "bg-"))} />
                                    </div>
                                    <span className="text-sm font-medium">{network.name}</span>
                                </div>
                                <a
                                    href={`${network.explorer}/address/${walletAddress}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-muted-foreground hover:text-foreground"
                                >
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Chain ID: {network.chainId}</p>
                        </div>
                    ))}
                </div>
            </div>

            <p className="text-xs text-muted-foreground">
                Your Base Account address works across all supported EVM networks.
                Balances and transactions are chain-specific.
            </p>
        </div>
    );
}
