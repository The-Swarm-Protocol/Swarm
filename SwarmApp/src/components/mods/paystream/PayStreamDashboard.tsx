"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, ArrowDownRight, ArrowUpRight, Banknote, Store, Waves } from "lucide-react";
import { usePayStreamData } from "@/hooks/usePayStreamData";
import {
    type PayStream,
    StreamStatus,
    toUSDC,
    streamTimeRemaining,
    shortAddr,
    streamStatusLabel,
} from "@/lib/paystream-contracts";

interface PayStreamDashboardProps {
    address?: string;
}

function StatCard({ label, value, sub, icon: Icon, color }: {
    label: string; value: string; sub?: string;
    icon: typeof Activity; color: string;
}) {
    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-xs text-muted-foreground">{label}</div>
                        <div className="text-2xl font-bold mt-1">{value}</div>
                        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
                    </div>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function RecentStreamRow({ stream, role }: { stream: PayStream; role: "sent" | "received" }) {
    const counterparty = role === "sent" ? stream.recipient : stream.sender;
    return (
        <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
            <div className="flex items-center gap-2">
                {role === "sent"
                    ? <ArrowUpRight className="h-4 w-4 text-red-400" />
                    : <ArrowDownRight className="h-4 w-4 text-green-400" />}
                <div>
                    <div className="text-sm font-medium">
                        {role === "sent" ? "To" : "From"} {shortAddr(counterparty)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {stream.serviceId || "Direct stream"} · {streamTimeRemaining(stream.endTime)}
                    </div>
                </div>
            </div>
            <div className="text-right">
                <div className="text-sm font-medium">
                    {toUSDC(stream.depositAmount).toLocaleString()} USDC
                </div>
                <Badge variant="outline" className="text-[10px]">
                    {streamStatusLabel(stream.status)}
                </Badge>
            </div>
        </div>
    );
}

export function PayStreamDashboard({ address }: PayStreamDashboardProps) {
    const {
        senderStreams, recipientStreams, marketplaceStats,
        usdcBalance, streamCount, isLoading,
    } = usePayStreamData(address);

    const activeSent = senderStreams.filter((s) => s.status === StreamStatus.Active);
    const activeReceived = recipientStreams.filter((s) => s.status === StreamStatus.Active);
    const totalStreamedOut = senderStreams.reduce((sum, s) => sum + s.withdrawnAmount, BigInt(0));

    // Combine and sort recent streams
    const recentStreams = [
        ...senderStreams.map((s) => ({ stream: s, role: "sent" as const })),
        ...recipientStreams.map((s) => ({ stream: s, role: "received" as const })),
    ]
        .sort((a, b) => b.stream.startTime - a.stream.startTime)
        .slice(0, 8);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Waves className="h-6 w-6 animate-pulse text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                    label="USDC Balance"
                    value={toUSDC(usdcBalance).toLocaleString()}
                    sub="Base Sepolia"
                    icon={Banknote}
                    color="bg-blue-500/10 text-blue-400"
                />
                <StatCard
                    label="Active Streams (Sent)"
                    value={String(activeSent.length)}
                    sub={`${senderStreams.length} total`}
                    icon={ArrowUpRight}
                    color="bg-red-500/10 text-red-400"
                />
                <StatCard
                    label="Active Streams (Received)"
                    value={String(activeReceived.length)}
                    sub={`${recipientStreams.length} total`}
                    icon={ArrowDownRight}
                    color="bg-green-500/10 text-green-400"
                />
                <StatCard
                    label="Marketplace Services"
                    value={String(marketplaceStats?.totalServices ?? 0)}
                    sub={`${streamCount} total streams`}
                    icon={Store}
                    color="bg-purple-500/10 text-purple-400"
                />
            </div>

            {/* Volume card */}
            {totalStreamedOut > BigInt(0) && (
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Total USDC Streamed Out:</span>
                            <span className="text-sm font-bold text-blue-400">
                                {toUSDC(totalStreamedOut).toLocaleString()} USDC
                            </span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Recent Streams */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Recent Streams</CardTitle>
                </CardHeader>
                <CardContent>
                    {recentStreams.length === 0 ? (
                        <div className="text-sm text-muted-foreground py-4 text-center">
                            No streams yet. Create your first stream or get test USDC from the faucet.
                        </div>
                    ) : (
                        <div className="divide-y divide-border/50">
                            {recentStreams.map(({ stream, role }) => (
                                <RecentStreamRow key={stream.streamId} stream={stream} role={role} />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
