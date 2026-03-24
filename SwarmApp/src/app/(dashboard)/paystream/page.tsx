/** PayStream — USDC micropayment streaming for AI services on Base Sepolia. */
"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { DollarSign, BarChart3, Waves, Store, Wallet, Droplet, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useActiveAccount } from "thirdweb/react";
import { useAuthAddress } from "@/hooks/useAuthAddress";
import { PayStreamDashboard } from "@/components/mods/paystream/PayStreamDashboard";
import { PayStreamStreams } from "@/components/mods/paystream/PayStreamStreams";
import { PayStreamServices } from "@/components/mods/paystream/PayStreamServices";
import { PayStreamWallets } from "@/components/mods/paystream/PayStreamWallets";
import { USDCFaucetPanel } from "@/components/mods/paystream/USDCFaucetPanel";
import { explorerAddr } from "@/lib/paystream-contracts";

type PayStreamTab = "dashboard" | "streams" | "services" | "wallets" | "faucet";

const TABS: { id: PayStreamTab; label: string; icon: typeof BarChart3 }[] = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "streams", label: "Streams", icon: Waves },
    { id: "services", label: "Services", icon: Store },
    { id: "wallets", label: "Agent Wallets", icon: Wallet },
    { id: "faucet", label: "Faucet", icon: Droplet },
];

export default function PayStreamPage() {
    const searchParams = useSearchParams();
    const initialTab = (searchParams.get("tab") as PayStreamTab) || "dashboard";
    const [tab, setTab] = useState<PayStreamTab>(initialTab);
    const account = useActiveAccount();
    const authAddress = useAuthAddress();
    const address = account?.address || authAddress || undefined;

    // Sync tab from URL
    useEffect(() => {
        const urlTab = searchParams.get("tab") as PayStreamTab;
        if (urlTab && urlTab !== tab) setTab(urlTab);
    }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <DollarSign className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold">PayStream</h1>
                        <p className="text-sm text-muted-foreground">
                            Pay-per-second USDC streaming for AI services on Base Sepolia
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {address && (
                        <a href={explorerAddr(address)} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm">
                                <ExternalLink className="h-4 w-4 mr-1.5" />
                                BaseScan
                            </Button>
                        </a>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit border border-border overflow-x-auto">
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setTab(id)}
                        className={cn(
                            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all whitespace-nowrap",
                            tab === id
                                ? "bg-background text-foreground shadow-sm border border-border"
                                : "text-muted-foreground hover:text-foreground",
                        )}
                    >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {tab === "dashboard" && <PayStreamDashboard address={address} />}
            {tab === "streams" && <PayStreamStreams address={address} />}
            {tab === "services" && <PayStreamServices address={address} />}
            {tab === "wallets" && <PayStreamWallets />}
            {tab === "faucet" && <USDCFaucetPanel />}
        </div>
    );
}
