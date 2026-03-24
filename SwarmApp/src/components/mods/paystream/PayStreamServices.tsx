"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Store, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { usePayStreamData } from "@/hooks/usePayStreamData";
import { usePayStreamWrite } from "@/hooks/usePayStreamWrite";
import { ServiceCard } from "./ServiceCard";
import { BillingType, billingLabel, fromUSDC, explorerTx } from "@/lib/paystream-contracts";

interface PayStreamServicesProps {
    address?: string;
}

export function PayStreamServices({ address }: PayStreamServicesProps) {
    const { services, marketplaceStats, isLoading } = usePayStreamData(address);
    const write = usePayStreamWrite();

    const [search, setSearch] = useState("");
    const [registerOpen, setRegisterOpen] = useState(false);

    // Register form state
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [endpoint, setEndpoint] = useState("");
    const [billingType, setBillingType] = useState<string>("0");
    const [rate, setRate] = useState("");
    const [minDuration, setMinDuration] = useState("60");
    const [maxDuration, setMaxDuration] = useState("86400");
    const [tags, setTags] = useState("");
    const [registerTxHash, setRegisterTxHash] = useState<string | null>(null);

    const filteredServices = search
        ? services.filter((s) =>
            s.name.toLowerCase().includes(search.toLowerCase()) ||
            s.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
        )
        : services;

    const handleRegister = async () => {
        if (!name || !rate) return;
        const tagsArr = tags.split(",").map((t) => t.trim()).filter(Boolean);
        const txHash = await write.registerService(
            name, description, endpoint,
            parseInt(billingType), fromUSDC(parseFloat(rate)),
            parseInt(minDuration), parseInt(maxDuration), tagsArr,
        );
        if (txHash) setRegisterTxHash(txHash);
    };

    const resetForm = () => {
        setName(""); setDescription(""); setEndpoint("");
        setBillingType("0"); setRate(""); setMinDuration("60");
        setMaxDuration("86400"); setTags(""); setRegisterTxHash(null);
        write.reset(); setRegisterOpen(false);
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex-1 max-w-sm relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search services..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Button size="sm" onClick={() => setRegisterOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Register Service
                </Button>
                <Dialog open={registerOpen} onOpenChange={(open) => { if (!open) resetForm(); }}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Register AI Service</DialogTitle>
                        </DialogHeader>
                        {registerTxHash ? (
                            <div className="space-y-4 py-2">
                                <Alert className="bg-green-500/10 border-green-500/20">
                                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                                    <AlertDescription className="space-y-2">
                                        <div className="text-green-400 font-medium">Service registered!</div>
                                        <a href={explorerTx(registerTxHash)} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-sm text-green-400 hover:underline">
                                            View transaction <ExternalLink className="h-3 w-3" />
                                        </a>
                                    </AlertDescription>
                                </Alert>
                                <Button onClick={resetForm} className="w-full">Close</Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="space-y-1.5">
                                    <Label>Service Name</Label>
                                    <Input placeholder="GPT-4 Inference" value={name} onChange={(e) => setName(e.target.value)} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Description</Label>
                                    <Textarea placeholder="High-quality LLM inference..." value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Endpoint URL</Label>
                                    <Input placeholder="https://api.example.com/v1" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label>Billing Model</Label>
                                        <Select value={billingType} onValueChange={setBillingType}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {[0, 1, 2, 3, 4].map((t) => (
                                                    <SelectItem key={t} value={String(t)}>{billingLabel(t)}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Rate (USDC)</Label>
                                        <Input type="number" placeholder="0.01" value={rate} onChange={(e) => setRate(e.target.value)} min="0" step="0.000001" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label>Min Duration (sec)</Label>
                                        <Input type="number" value={minDuration} onChange={(e) => setMinDuration(e.target.value)} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Max Duration (sec)</Label>
                                        <Input type="number" value={maxDuration} onChange={(e) => setMaxDuration(e.target.value)} />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Tags (comma-separated)</Label>
                                    <Input placeholder="ai, llm, inference" value={tags} onChange={(e) => setTags(e.target.value)} />
                                </div>
                                {write.state.error && (
                                    <Alert className="bg-red-500/10 border-red-500/20">
                                        <AlertDescription className="text-red-400 text-sm">{write.state.error}</AlertDescription>
                                    </Alert>
                                )}
                                <Button onClick={handleRegister} disabled={write.state.isLoading || !name || !rate} className="w-full">
                                    {write.state.isLoading ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registering...</>
                                    ) : (
                                        "Register Service"
                                    )}
                                </Button>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>

            {/* Stats */}
            {marketplaceStats && (
                <div className="grid grid-cols-3 gap-3">
                    <Card><CardContent className="p-3 text-center">
                        <div className="text-2xl font-bold">{marketplaceStats.totalServices}</div>
                        <div className="text-xs text-muted-foreground">Total Services</div>
                    </CardContent></Card>
                    <Card><CardContent className="p-3 text-center">
                        <div className="text-2xl font-bold">{marketplaceStats.totalProviders}</div>
                        <div className="text-xs text-muted-foreground">Providers</div>
                    </CardContent></Card>
                    <Card><CardContent className="p-3 text-center">
                        <div className="text-2xl font-bold">{(Number(marketplaceStats.totalVolume) / 1e6).toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">Total Volume (USDC)</div>
                    </CardContent></Card>
                </div>
            )}

            {/* Service Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : filteredServices.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Store className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <div className="text-sm text-muted-foreground">
                            {search ? "No services match your search" : "No services registered yet. Be the first!"}
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredServices.map((s) => (
                        <ServiceCard key={s.serviceId} service={s} />
                    ))}
                </div>
            )}
        </div>
    );
}
