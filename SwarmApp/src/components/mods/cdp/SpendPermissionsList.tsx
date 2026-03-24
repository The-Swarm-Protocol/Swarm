"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useOrg } from "@/contexts/OrgContext";
import { shortCdpAddr, formatUsdcAmount, SpendPermissionStatus, type CdpSpendPermission } from "@/lib/cdp";

export default function SpendPermissionsList() {
    const { currentOrg } = useOrg();
    const orgId = currentOrg?.id;
    const [permissions, setPermissions] = useState<CdpSpendPermission[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);

    // Create form
    const [agentId, setAgentId] = useState("");
    const [walletId, setWalletId] = useState("");
    const [tokenAddress, setTokenAddress] = useState("");
    const [allowance, setAllowance] = useState("");
    const [description, setDescription] = useState("");

    const fetchPermissions = useCallback(async () => {
        if (!orgId) return;
        try {
            const res = await fetch(`/api/v1/mods/cdp-addon/spend-permissions?orgId=${orgId}`);
            const data = await res.json();
            setPermissions(data.permissions || []);
        } catch (err) {
            console.error("Failed to fetch permissions:", err);
        } finally {
            setLoading(false);
        }
    }, [orgId]);

    useEffect(() => { fetchPermissions(); }, [fetchPermissions]);

    const handleCreate = async () => {
        if (!orgId || !agentId || !walletId || !tokenAddress || !allowance) return;
        setCreating(true);
        try {
            const res = await fetch("/api/v1/mods/cdp-addon/spend-permissions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    orgId,
                    agentId,
                    walletId,
                    tokenAddress,
                    allowanceAmount: allowance,
                    description,
                }),
            });
            if (res.ok) {
                setShowCreate(false);
                setAgentId("");
                setWalletId("");
                setTokenAddress("");
                setAllowance("");
                setDescription("");
                fetchPermissions();
            }
        } catch (err) {
            console.error("Create permission error:", err);
        } finally {
            setCreating(false);
        }
    };

    const handleRevoke = async (permissionId: string) => {
        if (!orgId) return;
        await fetch(`/api/v1/mods/cdp-addon/spend-permissions/${permissionId}?orgId=${orgId}`, {
            method: "DELETE",
        });
        fetchPermissions();
    };

    const statusColor: Record<string, string> = {
        active: "bg-green-500/10 text-green-500",
        revoked: "bg-red-500/10 text-red-500",
        expired: "bg-yellow-500/10 text-yellow-500",
        exhausted: "bg-muted text-muted-foreground",
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-sm">Spend Permissions</CardTitle>
                    <CardDescription>Agent spending allowances on server wallets</CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowCreate(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Grant Permission
                </Button>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...
                    </div>
                ) : permissions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                        No spend permissions configured.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left text-muted-foreground">
                                    <th className="pb-2 font-medium">Agent</th>
                                    <th className="pb-2 font-medium">Token</th>
                                    <th className="pb-2 font-medium">Allowance</th>
                                    <th className="pb-2 font-medium">Spent</th>
                                    <th className="pb-2 font-medium">Status</th>
                                    <th className="pb-2 font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {permissions.map((p) => (
                                    <tr key={p.id} className="border-b last:border-0">
                                        <td className="py-2 text-xs">{p.agentId}</td>
                                        <td className="py-2 font-mono text-xs">{shortCdpAddr(p.tokenAddress)}</td>
                                        <td className="py-2 text-xs">{formatUsdcAmount(p.allowanceAmount)}</td>
                                        <td className="py-2 text-xs">{formatUsdcAmount(p.spentAmount)}</td>
                                        <td className="py-2">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[p.status] || ""}`}>
                                                {p.status}
                                            </span>
                                        </td>
                                        <td className="py-2">
                                            {p.status === SpendPermissionStatus.Active && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-destructive"
                                                    onClick={() => handleRevoke(p.id)}
                                                    title="Revoke"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
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
                        <DialogTitle>Grant Spend Permission</DialogTitle>
                        <DialogDescription>
                            Allow an agent to spend from a server wallet up to the specified allowance.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Agent ID</label>
                            <Input placeholder="agent-123" value={agentId} onChange={(e) => setAgentId(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Wallet ID</label>
                            <Input placeholder="Wallet Firestore ID" value={walletId} onChange={(e) => setWalletId(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Token Address</label>
                            <Input placeholder="0x..." className="font-mono text-xs" value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Allowance (raw units)</label>
                            <Input type="number" placeholder="1000000" value={allowance} onChange={(e) => setAllowance(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Description</label>
                            <Input placeholder="Purpose of this permission" value={description} onChange={(e) => setDescription(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={creating || !agentId || !walletId || !tokenAddress || !allowance}>
                            {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                            Grant
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
