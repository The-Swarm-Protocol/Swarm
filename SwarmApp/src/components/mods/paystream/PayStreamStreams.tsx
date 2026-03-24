"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Plus, ArrowUpRight, ArrowDownRight, Loader2, CheckCircle2, ExternalLink, RefreshCw, Bot,
} from "lucide-react";
import { useOrg } from "@/contexts/OrgContext";
import { getAgentsByOrg, type Agent } from "@/lib/firestore";
import { usePayStreamData } from "@/hooks/usePayStreamData";
import { usePayStreamWrite } from "@/hooks/usePayStreamWrite";
import { StreamCard } from "./StreamCard";
import {
    PAYSTREAM_CONTRACTS,
    fromUSDC,
    toUSDC,
    shortAddr,
    explorerTx,
} from "@/lib/paystream-contracts";

interface PayStreamStreamsProps {
    address?: string;
}

export function PayStreamStreams({ address }: PayStreamStreamsProps) {
    const { senderStreams, recipientStreams, usdcBalance, isLoading: dataLoading, refetch } = usePayStreamData(address);
    const write = usePayStreamWrite();
    const { currentOrg } = useOrg();

    // Agents from org (for recipient picker)
    const [agents, setAgents] = useState<Agent[]>([]);
    useEffect(() => {
        if (!currentOrg?.id) return;
        getAgentsByOrg(currentOrg.id).then((all) => {
            setAgents(all.filter((a) => a.walletAddress));
        }).catch(() => {});
    }, [currentOrg?.id]);

    // Create stream form
    const [createOpen, setCreateOpen] = useState(false);
    const [recipientMode, setRecipientMode] = useState<"agent" | "custom">("agent");
    const [selectedAgentId, setSelectedAgentId] = useState("");
    const [customRecipient, setCustomRecipient] = useState("");
    const [amount, setAmount] = useState("");
    const [durationHours, setDurationHours] = useState("1");
    const [serviceId, setServiceId] = useState("");
    const [autoRenew, setAutoRenew] = useState(false);
    const [step, setStep] = useState<"form" | "approving" | "creating" | "done">("form");
    const [createTxHash, setCreateTxHash] = useState<string | null>(null);

    const selectedAgent = agents.find((a) => a.id === selectedAgentId);
    const recipient = recipientMode === "agent"
        ? selectedAgent?.walletAddress || ""
        : customRecipient;

    const handleCreate = async () => {
        if (!recipient || !amount || !durationHours) return;
        const amountRaw = fromUSDC(parseFloat(amount));
        const durationSec = Math.round(parseFloat(durationHours) * 3600);

        // Step 1: Approve USDC spend
        setStep("approving");
        const approveHash = await write.approveUSDC(PAYSTREAM_CONTRACTS.PAYMENT_STREAM, amountRaw);
        if (!approveHash) {
            setStep("form");
            return;
        }

        // Step 2: Create Stream on-chain
        setStep("creating");
        write.reset();
        const txHash = await write.createStream(recipient, amountRaw, durationSec, serviceId, autoRenew);
        if (txHash) {
            setCreateTxHash(txHash);
            setStep("done");
            refetch();
        } else {
            setStep("form");
        }
    };

    const resetForm = () => {
        setSelectedAgentId("");
        setCustomRecipient("");
        setAmount("");
        setDurationHours("1");
        setServiceId("");
        setAutoRenew(false);
        setStep("form");
        setCreateTxHash(null);
        write.reset();
        setCreateOpen(false);
    };

    const ratePreview = amount && durationHours
        ? (parseFloat(amount) / (parseFloat(durationHours) * 3600)).toFixed(6)
        : null;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    Balance: <span className="font-mono font-medium text-foreground">{toUSDC(usdcBalance).toLocaleString()} USDC</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => refetch()} disabled={dataLoading}>
                        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${dataLoading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Button size="sm" onClick={() => setCreateOpen(true)}>
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        Create Stream
                    </Button>
                    <Dialog open={createOpen} onOpenChange={(open) => { if (!open) resetForm(); }}>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Create Payment Stream</DialogTitle>
                            </DialogHeader>
                            {step === "done" ? (
                                <div className="space-y-4 py-2">
                                    <Alert className="bg-green-500/10 border-green-500/20">
                                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                                        <AlertDescription className="space-y-2">
                                            <div className="text-green-400 font-medium">
                                                Stream created! USDC is now flowing to {selectedAgent?.name || shortAddr(recipient)}.
                                            </div>
                                            {createTxHash && (
                                                <a href={explorerTx(createTxHash)} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-center gap-1 text-sm text-green-400 hover:underline">
                                                    View on BaseScan <ExternalLink className="h-3 w-3" />
                                                </a>
                                            )}
                                        </AlertDescription>
                                    </Alert>
                                    <Button onClick={resetForm} className="w-full">Close</Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="text-sm text-muted-foreground">
                                        Balance: <span className="font-mono font-medium text-foreground">{toUSDC(usdcBalance).toLocaleString()} USDC</span>
                                        <span className="text-xs ml-1">(Base Sepolia)</span>
                                    </div>

                                    {/* Recipient Mode Toggle */}
                                    <div className="space-y-2">
                                        <Label>Send To</Label>
                                        <div className="flex gap-1 rounded-lg bg-muted/50 p-1 border border-border">
                                            <button
                                                onClick={() => setRecipientMode("agent")}
                                                className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                                                    recipientMode === "agent"
                                                        ? "bg-background text-foreground shadow-sm border border-border"
                                                        : "text-muted-foreground hover:text-foreground"
                                                }`}
                                                disabled={step !== "form"}
                                            >
                                                <Bot className="h-3.5 w-3.5" />
                                                Agent
                                            </button>
                                            <button
                                                onClick={() => setRecipientMode("custom")}
                                                className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                                                    recipientMode === "custom"
                                                        ? "bg-background text-foreground shadow-sm border border-border"
                                                        : "text-muted-foreground hover:text-foreground"
                                                }`}
                                                disabled={step !== "form"}
                                            >
                                                Address
                                            </button>
                                        </div>
                                    </div>

                                    {/* Agent Selector */}
                                    {recipientMode === "agent" ? (
                                        <div className="space-y-2">
                                            <Label>Select Agent</Label>
                                            {agents.length === 0 ? (
                                                <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 border border-border text-center">
                                                    No agents with wallet addresses found in your org.
                                                    Use &quot;Address&quot; mode to enter manually.
                                                </div>
                                            ) : (
                                                <Select value={selectedAgentId} onValueChange={setSelectedAgentId} disabled={step !== "form"}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Choose an agent..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {agents.map((a) => (
                                                            <SelectItem key={a.id} value={a.id}>
                                                                <div className="flex items-center gap-2">
                                                                    <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                                                                    <span>{a.name}</span>
                                                                    <span className="text-xs text-muted-foreground font-mono">
                                                                        {shortAddr(a.walletAddress || "")}
                                                                    </span>
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                            {selectedAgent?.walletAddress && (
                                                <div className="text-xs text-muted-foreground font-mono">
                                                    {selectedAgent.walletAddress}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <Label>Recipient Address</Label>
                                            <Input
                                                placeholder="0x..."
                                                value={customRecipient}
                                                onChange={(e) => setCustomRecipient(e.target.value)}
                                                disabled={step !== "form"}
                                                className="font-mono text-sm"
                                            />
                                        </div>
                                    )}

                                    {/* Amount + Duration */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label>Amount (USDC)</Label>
                                            <Input type="number" placeholder="100" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={step !== "form"} min="0" step="0.01" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Duration (hours)</Label>
                                            <Input type="number" placeholder="1" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} disabled={step !== "form"} min="0.01" step="0.01" />
                                        </div>
                                    </div>

                                    {/* Rate preview */}
                                    {ratePreview && (
                                        <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 border border-border">
                                            Rate: <span className="font-mono font-medium text-foreground">{ratePreview} USDC/sec</span>
                                            {" · "}
                                            Fee: <span className="font-mono">{(parseFloat(amount) * 0.0025).toFixed(4)} USDC</span> (0.25%)
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label>Service ID (optional)</Label>
                                        <Input placeholder="ai-inference" value={serviceId} onChange={(e) => setServiceId(e.target.value)} disabled={step !== "form"} />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label>Auto-Renew</Label>
                                        <Switch checked={autoRenew} onCheckedChange={setAutoRenew} disabled={step !== "form"} />
                                    </div>

                                    {write.state.error && (
                                        <Alert className="bg-red-500/10 border-red-500/20">
                                            <AlertDescription className="text-red-400 text-sm">{write.state.error}</AlertDescription>
                                        </Alert>
                                    )}

                                    <Button onClick={handleCreate} disabled={step !== "form" || !recipient || !amount} className="w-full">
                                        {step === "approving" ? (
                                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Approving USDC...</>
                                        ) : step === "creating" ? (
                                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Stream...</>
                                        ) : (
                                            <>Approve &amp; Create Stream</>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Outgoing Streams */}
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                        <ArrowUpRight className="h-4 w-4 text-red-400" />
                        <CardTitle className="text-base">Outgoing Streams</CardTitle>
                    </div>
                    <CardDescription>Streams where you are sending USDC</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    {senderStreams.length === 0 ? (
                        <div className="text-sm text-muted-foreground py-4 text-center">No outgoing streams</div>
                    ) : (
                        senderStreams.map((s) => (
                            <StreamCard
                                key={s.streamId}
                                stream={s}
                                role="sender"
                                onPause={(id) => write.pauseStream(id).then(() => refetch())}
                                onResume={(id) => write.resumeStream(id).then(() => refetch())}
                                onCancel={(id) => write.cancelStream(id).then(() => refetch())}
                                isLoading={write.state.isLoading}
                            />
                        ))
                    )}
                </CardContent>
            </Card>

            {/* Incoming Streams */}
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                        <ArrowDownRight className="h-4 w-4 text-green-400" />
                        <CardTitle className="text-base">Incoming Streams</CardTitle>
                    </div>
                    <CardDescription>Streams where you are receiving USDC</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    {recipientStreams.length === 0 ? (
                        <div className="text-sm text-muted-foreground py-4 text-center">No incoming streams</div>
                    ) : (
                        recipientStreams.map((s) => (
                            <StreamCard
                                key={s.streamId}
                                stream={s}
                                role="recipient"
                                onWithdraw={(id) => write.withdrawStream(id).then(() => refetch())}
                                isLoading={write.state.isLoading}
                            />
                        ))
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
