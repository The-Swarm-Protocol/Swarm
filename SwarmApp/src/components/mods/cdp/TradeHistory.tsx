"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOrg } from "@/contexts/OrgContext";
import { shortCdpAddr, type CdpTradeRecord } from "@/lib/cdp";

export default function TradeHistory() {
    const { currentOrg } = useOrg();
    const orgId = currentOrg?.id;
    const [trades, setTrades] = useState<CdpTradeRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTrades = useCallback(async () => {
        if (!orgId) return;
        try {
            const res = await fetch(`/api/v1/mods/cdp-addon/trade?orgId=${orgId}`);
            const data = await res.json();
            setTrades(data.trades || []);
        } catch (err) {
            console.error("Failed to fetch trades:", err);
        } finally {
            setLoading(false);
        }
    }, [orgId]);

    useEffect(() => { fetchTrades(); }, [fetchTrades]);

    const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
        pending: "outline",
        submitted: "secondary",
        confirmed: "default",
        failed: "destructive",
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm">Trade History</CardTitle>
                <CardDescription>Token swaps executed via CDP Trade API</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...
                    </div>
                ) : trades.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                        No trades yet.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left text-muted-foreground">
                                    <th className="pb-2 font-medium">Agent</th>
                                    <th className="pb-2 font-medium">From</th>
                                    <th className="pb-2 font-medium">To</th>
                                    <th className="pb-2 font-medium">Amount</th>
                                    <th className="pb-2 font-medium">Status</th>
                                    <th className="pb-2 font-medium">Tx</th>
                                    <th className="pb-2 font-medium">Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {trades.map((t) => (
                                    <tr key={t.id} className="border-b last:border-0">
                                        <td className="py-2 text-xs">{t.agentId || "—"}</td>
                                        <td className="py-2 text-xs font-medium">{t.fromToken}</td>
                                        <td className="py-2 text-xs font-medium">{t.toToken}</td>
                                        <td className="py-2 text-xs">{t.fromAmount}{t.toAmount ? ` → ${t.toAmount}` : ""}</td>
                                        <td className="py-2">
                                            <Badge variant={statusVariant[t.status] || "outline"} className="text-xs">
                                                {t.status}
                                            </Badge>
                                        </td>
                                        <td className="py-2">
                                            {t.txHash ? (
                                                <a
                                                    href={`https://basescan.org/tx/${t.txHash}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-blue-500 hover:underline inline-flex items-center gap-1"
                                                >
                                                    {shortCdpAddr(t.txHash)}
                                                    <ExternalLink className="h-3 w-3" />
                                                </a>
                                            ) : "—"}
                                        </td>
                                        <td className="py-2 text-xs text-muted-foreground">
                                            {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "—"}
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
