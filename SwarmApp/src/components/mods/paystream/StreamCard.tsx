"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pause, Play, X, ArrowDownToLine, ExternalLink } from "lucide-react";
import {
    type PayStream,
    StreamStatus,
    streamStatusLabel,
    streamTimeRemaining,
    toUSDC,
    shortAddr,
    explorerAddr,
} from "@/lib/paystream-contracts";

const STATUS_COLORS: Record<StreamStatus, string> = {
    [StreamStatus.Active]: "bg-green-500/10 text-green-400 border-green-500/20",
    [StreamStatus.Paused]: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    [StreamStatus.Cancelled]: "bg-red-500/10 text-red-400 border-red-500/20",
    [StreamStatus.Completed]: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

interface StreamCardProps {
    stream: PayStream;
    role: "sender" | "recipient";
    onPause?: (id: string) => void;
    onResume?: (id: string) => void;
    onCancel?: (id: string) => void;
    onWithdraw?: (id: string) => void;
    isLoading?: boolean;
}

export function StreamCard({ stream, role, onPause, onResume, onCancel, onWithdraw, isLoading }: StreamCardProps) {
    const counterparty = role === "sender" ? stream.recipient : stream.sender;
    const ratePerHour = toUSDC(stream.ratePerSecond * BigInt(3600));
    const deposited = toUSDC(stream.depositAmount);
    const withdrawn = toUSDC(stream.withdrawnAmount);
    const available = toUSDC(stream.availableNow);

    return (
        <Card className="border-border/50">
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                        {/* Header */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={STATUS_COLORS[stream.status]}>
                                {streamStatusLabel(stream.status)}
                            </Badge>
                            <span className="text-xs text-muted-foreground font-mono">
                                {stream.streamId.slice(0, 10)}...
                            </span>
                            {stream.serviceId && (
                                <Badge variant="secondary" className="text-xs">
                                    {stream.serviceId}
                                </Badge>
                            )}
                            {stream.autoRenew && (
                                <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-400">
                                    Auto-Renew
                                </Badge>
                            )}
                        </div>

                        {/* Details */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            <div>
                                <div className="text-muted-foreground text-xs">{role === "sender" ? "To" : "From"}</div>
                                <a
                                    href={explorerAddr(counterparty)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-mono text-xs hover:underline flex items-center gap-1"
                                >
                                    {shortAddr(counterparty)}
                                    <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                            </div>
                            <div>
                                <div className="text-muted-foreground text-xs">Deposited</div>
                                <div className="font-medium">{deposited.toLocaleString()} USDC</div>
                            </div>
                            <div>
                                <div className="text-muted-foreground text-xs">Rate</div>
                                <div className="font-medium">{ratePerHour.toFixed(2)} USDC/hr</div>
                            </div>
                            <div>
                                <div className="text-muted-foreground text-xs">
                                    {stream.status === StreamStatus.Active ? "Time Left" : "Status"}
                                </div>
                                <div className="font-medium">
                                    {stream.status === StreamStatus.Active
                                        ? streamTimeRemaining(stream.endTime)
                                        : streamStatusLabel(stream.status)}
                                </div>
                            </div>
                        </div>

                        {/* Progress bar */}
                        {stream.status === StreamStatus.Active && deposited > 0 && (
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Withdrawn: {withdrawn.toLocaleString()} USDC</span>
                                    <span>Available: {available.toLocaleString()} USDC</span>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 rounded-full transition-all"
                                        style={{ width: `${Math.min(100, (withdrawn / deposited) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1.5 shrink-0">
                        {role === "sender" && stream.status === StreamStatus.Active && onPause && (
                            <Button size="sm" variant="outline" onClick={() => onPause(stream.streamId)} disabled={isLoading}>
                                <Pause className="h-3.5 w-3.5 mr-1" /> Pause
                            </Button>
                        )}
                        {role === "sender" && stream.status === StreamStatus.Paused && onResume && (
                            <Button size="sm" variant="outline" onClick={() => onResume(stream.streamId)} disabled={isLoading}>
                                <Play className="h-3.5 w-3.5 mr-1" /> Resume
                            </Button>
                        )}
                        {role === "sender" && (stream.status === StreamStatus.Active || stream.status === StreamStatus.Paused) && onCancel && (
                            <Button size="sm" variant="destructive" onClick={() => onCancel(stream.streamId)} disabled={isLoading}>
                                <X className="h-3.5 w-3.5 mr-1" /> Cancel
                            </Button>
                        )}
                        {role === "recipient" && available > 0 && onWithdraw && (
                            <Button size="sm" onClick={() => onWithdraw(stream.streamId)} disabled={isLoading}>
                                <ArrowDownToLine className="h-3.5 w-3.5 mr-1" /> Withdraw
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
