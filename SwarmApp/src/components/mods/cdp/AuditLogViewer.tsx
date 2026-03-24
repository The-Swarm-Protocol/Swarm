"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useOrg } from "@/contexts/OrgContext";
import type { CdpAuditEntry } from "@/lib/cdp";

export default function AuditLogViewer() {
    const { currentOrg } = useOrg();
    const orgId = currentOrg?.id;
    const [entries, setEntries] = useState<CdpAuditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [agentFilter, setAgentFilter] = useState("");
    const [actionFilter, setActionFilter] = useState("");

    const fetchLog = useCallback(async () => {
        if (!orgId) return;
        setLoading(true);
        try {
            const params = new URLSearchParams({ orgId, limit: "100" });
            if (agentFilter) params.set("agentId", agentFilter);
            if (actionFilter) params.set("action", actionFilter);
            const res = await fetch(`/api/v1/mods/cdp-addon/audit?${params}`);
            const data = await res.json();
            setEntries(data.entries || []);
        } catch (err) {
            console.error("Failed to fetch audit log:", err);
        } finally {
            setLoading(false);
        }
    }, [orgId, agentFilter, actionFilter]);

    useEffect(() => { fetchLog(); }, [fetchLog]);

    const outcomeColor: Record<string, "default" | "secondary" | "destructive"> = {
        success: "default",
        denied: "secondary",
        error: "destructive",
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-sm">Audit Log</CardTitle>
                    <CardDescription>All CDP operations with outcomes and policy matches</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchLog}>
                    <RefreshCw className="h-4 w-4 mr-1" /> Refresh
                </Button>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Filters */}
                <div className="flex gap-2">
                    <div className="flex-1">
                        <Input
                            placeholder="Filter by agent ID..."
                            value={agentFilter}
                            onChange={(e) => setAgentFilter(e.target.value)}
                            className="text-xs"
                        />
                    </div>
                    <div className="flex-1">
                        <Input
                            placeholder="Filter by action (e.g. paymaster.sponsor)..."
                            value={actionFilter}
                            onChange={(e) => setActionFilter(e.target.value)}
                            className="text-xs"
                        />
                    </div>
                </div>

                {/* Log */}
                {loading ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...
                    </div>
                ) : entries.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                        No audit entries found.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left text-muted-foreground">
                                    <th className="pb-2 font-medium">Time</th>
                                    <th className="pb-2 font-medium">Action</th>
                                    <th className="pb-2 font-medium">Agent</th>
                                    <th className="pb-2 font-medium">Outcome</th>
                                    <th className="pb-2 font-medium">Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map((e) => (
                                    <tr key={e.id} className="border-b last:border-0">
                                        <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">
                                            {e.timestamp ? new Date(e.timestamp).toLocaleString() : "—"}
                                        </td>
                                        <td className="py-2">
                                            <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                                                {e.action}
                                            </span>
                                        </td>
                                        <td className="py-2 text-xs">{e.agentId || "—"}</td>
                                        <td className="py-2">
                                            <Badge variant={outcomeColor[e.outcome] || "outline"} className="text-xs">
                                                {e.outcome}
                                            </Badge>
                                        </td>
                                        <td className="py-2 text-xs text-muted-foreground max-w-xs truncate">
                                            {Object.entries(e.details || {})
                                                .slice(0, 3)
                                                .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
                                                .join(" | ")}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
