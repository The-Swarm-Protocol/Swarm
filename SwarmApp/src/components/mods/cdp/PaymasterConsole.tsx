"use client";

import { useState, useEffect, useCallback } from "react";
import { Save, Fuel, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useOrg } from "@/contexts/OrgContext";
import type { CdpPaymasterConfig } from "@/lib/cdp";

export default function PaymasterConsole() {
    const { currentOrg } = useOrg();
    const orgId = currentOrg?.id;
    const [config, setConfig] = useState<CdpPaymasterConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Editable fields
    const [enabled, setEnabled] = useState(false);
    const [budget, setBudget] = useState("100");
    const [gasLimit, setGasLimit] = useState("0.01");
    const [autoPause, setAutoPause] = useState(true);
    const [contracts, setContracts] = useState<string[]>([]);
    const [newContract, setNewContract] = useState("");

    const fetchConfig = useCallback(async () => {
        if (!orgId) return;
        try {
            const res = await fetch(`/api/v1/mods/cdp-addon/paymaster/config?orgId=${orgId}`);
            const data = await res.json();
            if (data.config) {
                const c = data.config;
                setConfig(c);
                setEnabled(c.enabled);
                setBudget(c.monthlyBudgetUsd?.toString() || "100");
                setGasLimit(c.perTxGasLimitEth?.toString() || "0.01");
                setAutoPause(c.autoPauseOnBudgetExhausted ?? true);
                setContracts(c.allowedContracts || []);
            }
        } catch (err) {
            console.error("Failed to fetch paymaster config:", err);
        } finally {
            setLoading(false);
        }
    }, [orgId]);

    useEffect(() => { fetchConfig(); }, [fetchConfig]);

    const handleSave = async () => {
        if (!orgId) return;
        setSaving(true);
        try {
            await fetch("/api/v1/mods/cdp-addon/paymaster/config", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    orgId,
                    enabled,
                    monthlyBudgetUsd: parseFloat(budget) || 100,
                    allowedContracts: contracts,
                    perTxGasLimitEth: parseFloat(gasLimit) || 0.01,
                    autoPauseOnBudgetExhausted: autoPause,
                }),
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
            fetchConfig();
        } catch (err) {
            console.error("Save config error:", err);
        } finally {
            setSaving(false);
        }
    };

    const addContract = () => {
        const addr = newContract.trim();
        if (addr && addr.startsWith("0x") && !contracts.includes(addr)) {
            setContracts([...contracts, addr]);
            setNewContract("");
        }
    };

    const spentPct = config
        ? Math.min(100, ((config.spentThisCycleUsd || 0) / (config.monthlyBudgetUsd || 1)) * 100)
        : 0;

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading paymaster config...
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Fuel className="h-4 w-4" /> Gas Sponsorship
                    </CardTitle>
                    <CardDescription>
                        Sponsor gas for approved agent workflows. The paymaster URL is never exposed to clients.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Enable Toggle */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium">Enable Paymaster</p>
                            <p className="text-xs text-muted-foreground">
                                Sponsor gas for agent transactions on Base
                            </p>
                        </div>
                        <Switch checked={enabled} onCheckedChange={setEnabled} />
                    </div>

                    {/* Budget */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Monthly Budget (USD)</label>
                        <Input
                            type="number"
                            min="0"
                            step="10"
                            value={budget}
                            onChange={(e) => setBudget(e.target.value)}
                        />
                        {config && (
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>${(config.spentThisCycleUsd || 0).toFixed(2)} spent</span>
                                    <span>${(config.monthlyBudgetUsd || 0).toFixed(2)} budget</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${spentPct > 90 ? "bg-destructive" : spentPct > 70 ? "bg-yellow-500" : "bg-green-500"}`}
                                        style={{ width: `${spentPct}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Per-tx Gas Limit */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Per-Transaction Gas Limit (ETH)</label>
                        <Input
                            type="number"
                            min="0"
                            step="0.001"
                            value={gasLimit}
                            onChange={(e) => setGasLimit(e.target.value)}
                        />
                    </div>

                    {/* Auto-pause */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium">Auto-Pause on Budget Exhaustion</p>
                            <p className="text-xs text-muted-foreground">
                                Stop sponsoring when monthly budget is reached
                            </p>
                        </div>
                        <Switch checked={autoPause} onCheckedChange={setAutoPause} />
                    </div>
                </CardContent>
            </Card>

            {/* Contract Allowlist */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Contract Allowlist</CardTitle>
                    <CardDescription>
                        Only sponsor gas for transactions targeting these contracts. Leave empty to allow all.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex gap-2">
                        <Input
                            placeholder="0x..."
                            value={newContract}
                            onChange={(e) => setNewContract(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addContract()}
                            className="font-mono text-xs"
                        />
                        <Button variant="outline" size="sm" onClick={addContract}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                    {contracts.length > 0 ? (
                        <div className="space-y-1">
                            {contracts.map((addr) => (
                                <div key={addr} className="flex items-center justify-between bg-muted rounded px-3 py-1.5">
                                    <span className="font-mono text-xs">{addr}</span>
                                    <button
                                        onClick={() => setContracts(contracts.filter((c) => c !== addr))}
                                        className="text-muted-foreground hover:text-destructive"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground">No contracts — all are allowed</p>
                    )}
                </CardContent>
            </Card>

            {/* Save */}
            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                    {saved ? "Saved!" : "Save Configuration"}
                </Button>
            </div>
        </div>
    );
}
