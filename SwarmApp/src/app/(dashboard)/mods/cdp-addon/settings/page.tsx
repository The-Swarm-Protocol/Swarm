"use client";

import { useState } from "react";
import { Shield, Wallet, Fuel, ShieldCheck, ArrowLeftRight, CreditCard, Scale, RotateCw, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ServerWalletList from "@/components/mods/cdp/ServerWalletList";
import PaymasterConsole from "@/components/mods/cdp/PaymasterConsole";
import SpendPermissionsList from "@/components/mods/cdp/SpendPermissionsList";
import TradeHistory from "@/components/mods/cdp/TradeHistory";
import BillingPanel from "@/components/mods/cdp/BillingPanel";
import PolicyRulesList from "@/components/mods/cdp/PolicyRulesList";
import SecretRotationPanel from "@/components/mods/cdp/SecretRotationPanel";
import AuditLogViewer from "@/components/mods/cdp/AuditLogViewer";

type Tab = "wallets" | "paymaster" | "permissions" | "trades" | "billing" | "policy" | "secrets" | "audit";

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "wallets", label: "Wallets", icon: Wallet },
    { key: "paymaster", label: "Paymaster", icon: Fuel },
    { key: "permissions", label: "Permissions", icon: ShieldCheck },
    { key: "trades", label: "Trades", icon: ArrowLeftRight },
    { key: "billing", label: "Billing", icon: CreditCard },
    { key: "policy", label: "Policy", icon: Scale },
    { key: "secrets", label: "Secrets", icon: RotateCw },
    { key: "audit", label: "Audit Log", icon: ScrollText },
];

export default function CdpAddonSettingsPage() {
    const [tab, setTab] = useState<Tab>("wallets");

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Shield className="h-6 w-6 text-blue-500" />
                <div>
                    <h1 className="text-xl font-semibold flex items-center gap-2">
                        CDP Add-On
                        <Badge variant="secondary" className="text-xs">Premium</Badge>
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Coinbase Developer Platform — server wallets, gas sponsorship, billing, and policy engine
                    </p>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 border-b overflow-x-auto pb-px">
                {TABS.map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t transition-colors whitespace-nowrap ${
                            tab === key
                                ? "border-b-2 border-primary text-primary"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <Icon className="h-4 w-4" />
                        {label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {tab === "wallets" && <ServerWalletList />}
            {tab === "paymaster" && <PaymasterConsole />}
            {tab === "permissions" && <SpendPermissionsList />}
            {tab === "trades" && <TradeHistory />}
            {tab === "billing" && <BillingPanel />}
            {tab === "policy" && <PolicyRulesList />}
            {tab === "secrets" && <SecretRotationPanel />}
            {tab === "audit" && <AuditLogViewer />}
        </div>
    );
}
