"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Loader2, CreditCard, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useOrg } from "@/contexts/OrgContext";
import { CdpBillingCycleStatus, type CdpBillingCycle } from "@/lib/cdp";

export default function BillingPanel() {
    const { currentOrg } = useOrg();
    const orgId = currentOrg?.id;
    const [cycles, setCycles] = useState<CdpBillingCycle[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);

    // Create form
    const [subscriptionId, setSubscriptionId] = useState("");
    const [walletId, setWalletId] = useState("");
    const [amountUsd, setAmountUsd] = useState("");
    const [intervalDays, setIntervalDays] = useState("30");

    const fetchCycles = useCallback(async () => {
        if (!orgId) return;
        try {
            const res = await fetch(`/api/v1/mods/cdp-addon/billing?orgId=${orgId}`);
            const data = await res.json();
            setCycles(data.billingCycles || []);
        } catch (err) {
            console.error("Failed to fetch billing cycles:", err);
        } finally {
            setLoading(false);
        }
    }, [orgId]);

    useEffect(() => { fetchCycles(); }, [fetchCycles]);

    const handleCreate = async () => {
        if (!orgId || !subscriptionId || !walletId || !amountUsd) return;
        setCreating(true);
        try {
            const res = await fetch("/api/v1/mods/cdp-addon/billing", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    orgId,
                    subscriptionId,
                    walletId,
                    amountUsd: parseFloat(amountUsd),
                    intervalDays: parseInt(intervalDays) || 30,
                }),
            });
            if (res.ok) {
                setShowCreate(false);
                setSubscriptionId("");
                setWalletId("");
                setAmountUsd("");
                setIntervalDays("30");
                fetchCycles();
            }
        } catch (err) {
            console.error("Create billing cycle error:", err);
        } finally {
            setCreating(false);
        }
    };

    const handleCharge = async (cycleId: string) => {
        if (!orgId) return;
        await fetch("/api/v1/mods/cdp-addon/billing/charge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ billingCycleId: cycleId, orgId }),
        });
        fetchCycles();
    };

    const statusColor: Record<string, string> = {
        active: "bg-green-500/10 text-green-500",
        past_due: "bg-red-500/10 text-red-500",
        cancelled: "bg-muted text-muted-foreground",
        completed: "bg-blue-500/10 text-blue-500",
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-sm">Billing Cycles</CardTitle>
                    <CardDescription>Recurring subscription charges via server wallets</CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowCreate(true)}>
                    <Plus className="h-4 w-4 mr-1" /> New Cycle
                </Button>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...
                    </div>
                ) : cycles.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                        No billing cycles configured.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left text-muted-foreground">
                                    <th className="pb-2 font-medium">Subscription</th>
                                    <th className="pb-2 font-medium">Amount</th>
                                    <th className="pb-2 font-medium">Interval</th>
                                    <th className="pb-2 font-medium">Next Charge</th>
                                    <th className="pb-2 font-medium">Status</th>
                                    <th className="pb-2 font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cycles.map((c) => (
                                    <tr key={c.id} className="border-b last:border-0">
                                        <td className="py-2 text-xs">{c.subscriptionId}</td>
                                        <td className="py-2 text-xs font-medium">${c.amountUsd}</td>
                                        <td className="py-2 text-xs">{c.intervalDays}d</td>
                                        <td className="py-2 text-xs">
                                            {c.nextChargeAt ? new Date(c.nextChargeAt).toLocaleDateString() : "—"}
                                        </td>
                                        <td className="py-2">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[c.status] || ""}`}>
                                                {c.status}
                                                {c.failureCount > 0 && ` (${c.failureCount} failures)`}
                                            </span>
                                        </td>
                                        <td className="py-2">
                                            {c.status === CdpBillingCycleStatus.Active && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-xs h-7"
                                                    onClick={() => handleCharge(c.id)}
                                                >
                                                    <CreditCard className="h-3 w-3 mr-1" /> Charge Now
                                                </Button>
                                            )}
                                            {c.status === CdpBillingCycleStatus.PastDue && (
                                                <span className="text-xs text-destructive flex items-center gap-1">
                                                    <AlertTriangle className="h-3 w-3" /> Past due
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>

            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New Billing Cycle</DialogTitle>
                        <DialogDescription>
                            Set up recurring charges for a subscription via a server wallet.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Subscription ID</label>
                            <Input placeholder="sub-123" value={subscriptionId} onChange={(e) => setSubscriptionId(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Server Wallet ID</label>
                            <Input placeholder="Wallet to charge from" value={walletId} onChange={(e) => setWalletId(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Amount (USD)</label>
                            <Input type="number" min="0" step="0.01" value={amountUsd} onChange={(e) => setAmountUsd(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Interval (days)</label>
                            <Input type="number" min="1" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={creating || !subscriptionId || !walletId || !amountUsd}>
                            {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                            Create
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
