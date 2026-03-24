"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2, AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useOrg } from "@/contexts/OrgContext";
import { CdpPolicyAction, CDP_CAPABILITIES, type CdpPolicyRule } from "@/lib/cdp";

export default function PolicyRulesList() {
    const { currentOrg } = useOrg();
    const orgId = currentOrg?.id;
    const [rules, setRules] = useState<CdpPolicyRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [emergencyPaused, setEmergencyPaused] = useState(false);
    const [togglingPause, setTogglingPause] = useState(false);

    // Create form
    const [name, setName] = useState("");
    const [target, setTarget] = useState("org");
    const [capKey, setCapKey] = useState("*");
    const [action, setAction] = useState<CdpPolicyAction>(CdpPolicyAction.Deny);
    const [dailyCap, setDailyCap] = useState("");
    const [maxPerMin, setMaxPerMin] = useState("");
    const [maxPerHour, setMaxPerHour] = useState("");
    const [maxPerDay, setMaxPerDay] = useState("");

    const fetchRules = useCallback(async () => {
        if (!orgId) return;
        try {
            const res = await fetch(`/api/v1/mods/cdp-addon/policy?orgId=${orgId}`);
            const data = await res.json();
            const fetched = data.rules || [];
            setRules(fetched);
            setEmergencyPaused(fetched.some((r: CdpPolicyRule) => r.emergencyPause && r.enabled));
        } catch (err) {
            console.error("Failed to fetch policy rules:", err);
        } finally {
            setLoading(false);
        }
    }, [orgId]);

    useEffect(() => { fetchRules(); }, [fetchRules]);

    const handleCreate = async () => {
        if (!orgId || !name) return;
        setCreating(true);
        try {
            const body: Record<string, unknown> = {
                orgId,
                name,
                target,
                capabilityKey: capKey,
                action,
            };
            if (dailyCap) body.dailySpendCapUsd = parseFloat(dailyCap);
            if (action === CdpPolicyAction.RateLimit && maxPerMin) {
                body.rateLimit = {
                    maxPerMinute: parseInt(maxPerMin) || 10,
                    maxPerHour: parseInt(maxPerHour) || 100,
                    maxPerDay: parseInt(maxPerDay) || 1000,
                };
            }
            const res = await fetch("/api/v1/mods/cdp-addon/policy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                setShowCreate(false);
                setName("");
                setTarget("org");
                setCapKey("*");
                setAction(CdpPolicyAction.Deny);
                setDailyCap("");
                setMaxPerMin("");
                setMaxPerHour("");
                setMaxPerDay("");
                fetchRules();
            }
        } catch (err) {
            console.error("Create rule error:", err);
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (ruleId: string) => {
        if (!orgId) return;
        await fetch(`/api/v1/mods/cdp-addon/policy/${ruleId}?orgId=${orgId}`, { method: "DELETE" });
        fetchRules();
    };

    const handleToggleEnabled = async (ruleId: string, enabled: boolean) => {
        if (!orgId) return;
        await fetch(`/api/v1/mods/cdp-addon/policy/${ruleId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orgId, enabled }),
        });
        fetchRules();
    };

    const handleEmergencyPause = async () => {
        if (!orgId) return;
        setTogglingPause(true);
        try {
            await fetch("/api/v1/mods/cdp-addon/policy/emergency-pause", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orgId, enabled: !emergencyPaused }),
            });
            fetchRules();
        } finally {
            setTogglingPause(false);
        }
    };

    const actionColor: Record<string, string> = {
        allow: "bg-green-500/10 text-green-500",
        deny: "bg-red-500/10 text-red-500",
        rate_limit: "bg-yellow-500/10 text-yellow-500",
        require_approval: "bg-blue-500/10 text-blue-500",
    };

    const capabilityOptions = [
        { value: "*", label: "All Capabilities" },
        ...Object.entries(CDP_CAPABILITIES).map(([key, val]) => ({ value: val, label: val })),
    ];

    return (
        <div className="space-y-4">
            {/* Emergency Pause */}
            <Card className={emergencyPaused ? "border-destructive" : ""}>
                <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                        <AlertOctagon className={`h-5 w-5 ${emergencyPaused ? "text-destructive" : "text-muted-foreground"}`} />
                        <div>
                            <p className="text-sm font-medium">Emergency Pause</p>
                            <p className="text-xs text-muted-foreground">
                                {emergencyPaused ? "ALL CDP operations are blocked" : "Instantly block all CDP operations"}
                            </p>
                        </div>
                    </div>
                    <Button
                        variant={emergencyPaused ? "destructive" : "outline"}
                        size="sm"
                        onClick={handleEmergencyPause}
                        disabled={togglingPause}
                    >
                        {togglingPause ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                        {emergencyPaused ? "Disable Pause" : "Activate Pause"}
                    </Button>
                </CardContent>
            </Card>

            {/* Rules Table */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-sm">Policy Rules</CardTitle>
                        <CardDescription>Rate limits, spending caps, and access controls</CardDescription>
                    </div>
                    <Button size="sm" onClick={() => setShowCreate(true)}>
                        <Plus className="h-4 w-4 mr-1" /> Add Rule
                    </Button>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...
                        </div>
                    ) : rules.filter(r => !r.emergencyPause).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            No policy rules. All operations are allowed by default.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left text-muted-foreground">
                                        <th className="pb-2 font-medium">Name</th>
                                        <th className="pb-2 font-medium">Target</th>
                                        <th className="pb-2 font-medium">Capability</th>
                                        <th className="pb-2 font-medium">Action</th>
                                        <th className="pb-2 font-medium">Enabled</th>
                                        <th className="pb-2 font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rules.filter(r => !r.emergencyPause).map((r) => (
                                        <tr key={r.id} className="border-b last:border-0">
                                            <td className="py-2 font-medium text-xs">{r.name}</td>
                                            <td className="py-2 text-xs">{r.target}</td>
                                            <td className="py-2 text-xs font-mono">{r.capabilityKey}</td>
                                            <td className="py-2">
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${actionColor[r.action] || ""}`}>
                                                    {r.action}
                                                </span>
                                            </td>
                                            <td className="py-2">
                                                <Switch
                                                    checked={r.enabled}
                                                    onCheckedChange={(v) => handleToggleEnabled(r.id, v)}
                                                />
                                            </td>
                                            <td className="py-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-destructive"
                                                    onClick={() => handleDelete(r.id)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create Rule Dialog */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Policy Rule</DialogTitle>
                        <DialogDescription>
                            Define access controls, rate limits, and spending caps for CDP operations.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Rule Name</label>
                            <Input placeholder="e.g. Swap Rate Limit" value={name} onChange={(e) => setName(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Target</label>
                                <Select value={target} onValueChange={setTarget}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="*">All (global)</SelectItem>
                                        <SelectItem value="org">All org agents</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Capability</label>
                                <Select value={capKey} onValueChange={setCapKey}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {capabilityOptions.map((o) => (
                                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Action</label>
                            <Select value={action} onValueChange={(v) => setAction(v as CdpPolicyAction)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="deny">Deny</SelectItem>
                                    <SelectItem value="rate_limit">Rate Limit</SelectItem>
                                    <SelectItem value="require_approval">Require Approval</SelectItem>
                                    <SelectItem value="allow">Allow</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {action === CdpPolicyAction.RateLimit && (
                            <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium">Per Minute</label>
                                    <Input type="number" min="1" placeholder="10" value={maxPerMin} onChange={(e) => setMaxPerMin(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium">Per Hour</label>
                                    <Input type="number" min="1" placeholder="100" value={maxPerHour} onChange={(e) => setMaxPerHour(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium">Per Day</label>
                                    <Input type="number" min="1" placeholder="1000" value={maxPerDay} onChange={(e) => setMaxPerDay(e.target.value)} />
                                </div>
                            </div>
                        )}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Daily Spend Cap (USD, optional)</label>
                            <Input type="number" min="0" step="1" placeholder="500" value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={creating || !name}>
                            {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                            Create Rule
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
