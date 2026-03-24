"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
    KeyRound, Copy, CheckCircle2, Eye, EyeOff, AlertTriangle, Loader2, ExternalLink,
    Wallet, ArrowDownToLine, ArrowUpFromLine,
} from "lucide-react";
import { ethers } from "ethers";
import { usePayStreamWrite } from "@/hooks/usePayStreamWrite";
import { fromUSDC, explorerTx, explorerAddr } from "@/lib/paystream-contracts";

export function PayStreamWallets() {
    // Wallet generation
    const [mnemonic, setMnemonic] = useState<string | null>(null);
    const [derivedAddress, setDerivedAddress] = useState<string | null>(null);
    const [showMnemonic, setShowMnemonic] = useState(false);
    const [copied, setCopied] = useState(false);

    // Wallet config
    const [dailyLimit, setDailyLimit] = useState("");
    const [depositAmount, setDepositAmount] = useState("");
    const [withdrawAmount, setWithdrawAmount] = useState("");

    const write = usePayStreamWrite();

    const generateWallet = () => {
        const wallet = ethers.Wallet.createRandom();
        setMnemonic(wallet.mnemonic?.phrase || null);
        setDerivedAddress(wallet.address);
        setShowMnemonic(true);
        setCopied(false);
    };

    const copyMnemonic = () => {
        if (mnemonic) {
            navigator.clipboard.writeText(mnemonic);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleSetDailyLimit = async () => {
        if (!dailyLimit) return;
        await write.setDailyLimit(fromUSDC(parseFloat(dailyLimit)));
    };

    const handleDeposit = async () => {
        if (!depositAmount) return;
        await write.depositToWallet(fromUSDC(parseFloat(depositAmount)));
    };

    const handleWithdraw = async () => {
        if (!withdrawAmount) return;
        await write.withdrawFromWallet(fromUSDC(parseFloat(withdrawAmount)));
    };

    return (
        <div className="space-y-4">
            {/* Generate Wallet */}
            <Card className="border-2 border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-transparent to-transparent">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20">
                            <KeyRound className="h-5 w-5 text-purple-400" />
                        </div>
                        <div>
                            <CardTitle>Generate Agent Wallet</CardTitle>
                            <CardDescription>
                                Create a self-custodial BIP39 HD wallet for autonomous agent payments
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button onClick={generateWallet} variant="outline" className="w-full">
                        <KeyRound className="mr-2 h-4 w-4" />
                        Generate New Wallet
                    </Button>

                    {mnemonic && (
                        <div className="space-y-3">
                            <Alert className="bg-amber-500/10 border-amber-500/20">
                                <AlertTriangle className="h-4 w-4 text-amber-400" />
                                <AlertDescription className="text-amber-400 text-sm">
                                    Save this mnemonic securely. It is generated client-side and never sent to any server.
                                    Anyone with this phrase can access the wallet.
                                </AlertDescription>
                            </Alert>

                            {/* Mnemonic */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>12-Word Mnemonic</Label>
                                    <div className="flex gap-1">
                                        <Button size="sm" variant="ghost" onClick={() => setShowMnemonic(!showMnemonic)}>
                                            {showMnemonic ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={copyMnemonic}>
                                            {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                                        </Button>
                                    </div>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-3 border border-border">
                                    {showMnemonic ? (
                                        <div className="grid grid-cols-3 gap-2">
                                            {mnemonic.split(" ").map((word, i) => (
                                                <div key={i} className="flex items-center gap-1.5 text-sm">
                                                    <span className="text-muted-foreground text-xs w-4 text-right">{i + 1}.</span>
                                                    <span className="font-mono">{word}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-sm text-muted-foreground text-center py-2">
                                            Click the eye icon to reveal
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Derived Address */}
                            {derivedAddress && (
                                <div className="space-y-1.5">
                                    <Label>Derived Address (m/44&apos;/60&apos;/0&apos;/0/0)</Label>
                                    <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3 border border-border">
                                        <span className="font-mono text-sm flex-1 truncate">{derivedAddress}</span>
                                        <a href={explorerAddr(derivedAddress)} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Wallet Operations */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Daily Limit */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Wallet className="h-4 w-4" /> Daily Limit
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-1.5">
                            <Label>Max Daily Spend (USDC)</Label>
                            <Input type="number" placeholder="500" value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} min="0" step="1" />
                        </div>
                        <Button onClick={handleSetDailyLimit} disabled={write.state.isLoading || !dailyLimit} className="w-full" size="sm">
                            {write.state.isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Set Limit"}
                        </Button>
                    </CardContent>
                </Card>

                {/* Deposit */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <ArrowDownToLine className="h-4 w-4" /> Deposit
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-1.5">
                            <Label>Amount (USDC)</Label>
                            <Input type="number" placeholder="1000" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} min="0" step="1" />
                        </div>
                        <Button onClick={handleDeposit} disabled={write.state.isLoading || !depositAmount} className="w-full" size="sm">
                            {write.state.isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Deposit USDC"}
                        </Button>
                    </CardContent>
                </Card>

                {/* Withdraw */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <ArrowUpFromLine className="h-4 w-4" /> Withdraw
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-1.5">
                            <Label>Amount (USDC)</Label>
                            <Input type="number" placeholder="100" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} min="0" step="1" />
                        </div>
                        <Button onClick={handleWithdraw} disabled={write.state.isLoading || !withdrawAmount} className="w-full" size="sm" variant="outline">
                            {write.state.isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Withdraw USDC"}
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* TX Feedback */}
            {write.state.txHash && (
                <Alert className="bg-green-500/10 border-green-500/20">
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                    <AlertDescription className="space-y-1">
                        <div className="text-green-400 font-medium">Transaction successful!</div>
                        <a href={explorerTx(write.state.txHash)} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-green-400 hover:underline">
                            View on BaseScan <ExternalLink className="h-3 w-3" />
                        </a>
                    </AlertDescription>
                </Alert>
            )}
            {write.state.error && (
                <Alert className="bg-red-500/10 border-red-500/20">
                    <AlertDescription className="text-red-400 text-sm">{write.state.error}</AlertDescription>
                </Alert>
            )}
        </div>
    );
}
