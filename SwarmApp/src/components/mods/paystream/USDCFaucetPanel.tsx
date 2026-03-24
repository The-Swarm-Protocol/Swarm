"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Droplet, ExternalLink, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useActiveAccount } from "thirdweb/react";
import { usePayStreamWrite } from "@/hooks/usePayStreamWrite";
import { usePayStreamData } from "@/hooks/usePayStreamData";
import { toUSDC, explorerTx, explorerAddr } from "@/lib/paystream-contracts";

export function USDCFaucetPanel() {
    const account = useActiveAccount();
    const address = account?.address;
    const { usdcBalance } = usePayStreamData(address);
    const { faucetUSDC, state, reset } = usePayStreamWrite();
    const [success, setSuccess] = useState<{ txHash: string } | null>(null);

    const handleRequest = async () => {
        setSuccess(null);
        reset();
        const txHash = await faucetUSDC();
        if (txHash) {
            setSuccess({ txHash });
        }
    };

    return (
        <div className="space-y-6">
            {/* Hero */}
            <Card className="border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <Droplet className="h-6 w-6 text-blue-400" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl">USDC Faucet</CardTitle>
                            <CardDescription className="text-base">
                                Get free testnet USDC on Base Sepolia
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex flex-col gap-1">
                            <div className="text-3xl font-bold text-blue-400">10,000 USDC</div>
                            <div className="text-sm text-muted-foreground">per request</div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="text-3xl font-bold text-blue-400">FREE</div>
                            <div className="text-sm text-muted-foreground">testnet only</div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="text-3xl font-bold text-blue-400">Base Sepolia</div>
                            <div className="text-sm text-muted-foreground">chain 84532</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Request Form */}
            <Card>
                <CardHeader>
                    <CardTitle>Request Testnet USDC</CardTitle>
                    <CardDescription>
                        Click below to receive 10,000 USDC from the MockUSDC faucet contract
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Wallet Status */}
                    {address ? (
                        <Alert className="bg-blue-500/10 border-blue-500/20">
                            <CheckCircle2 className="h-4 w-4 text-blue-400" />
                            <AlertDescription className="text-blue-400">
                                <span className="font-medium">Wallet connected:</span>{" "}
                                <a href={explorerAddr(address)} target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">
                                    {address.slice(0, 6)}...{address.slice(-4)}
                                </a>
                                {" · "}
                                <span className="font-mono">{toUSDC(usdcBalance).toLocaleString()} USDC</span>
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <Alert className="bg-amber-500/10 border-amber-500/20">
                            <Droplet className="h-4 w-4 text-amber-400" />
                            <AlertDescription className="text-amber-400">
                                Please connect your wallet to request testnet USDC
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Request Button */}
                    <Button
                        onClick={handleRequest}
                        disabled={state.isLoading || !address}
                        className="w-full"
                        size="lg"
                    >
                        {state.isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Requesting USDC...
                            </>
                        ) : (
                            <>
                                <Droplet className="mr-2 h-4 w-4" />
                                Request 10,000 USDC
                            </>
                        )}
                    </Button>

                    {/* Success */}
                    {success && (
                        <Alert className="bg-green-500/10 border-green-500/20">
                            <CheckCircle2 className="h-4 w-4 text-green-400" />
                            <AlertDescription className="space-y-2">
                                <div className="text-green-400 font-medium">
                                    10,000 USDC sent to your wallet!
                                </div>
                                <a
                                    href={explorerTx(success.txHash)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-sm text-green-400 hover:underline"
                                >
                                    View transaction <ExternalLink className="h-3 w-3" />
                                </a>
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Error */}
                    {state.error && (
                        <Alert className="bg-red-500/10 border-red-500/20">
                            <XCircle className="h-4 w-4 text-red-400" />
                            <AlertDescription className="text-red-400">
                                {state.error}
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* Instructions */}
            <Card>
                <CardHeader>
                    <CardTitle>How It Works</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-3">
                        {[
                            { step: "1", title: "Connect your wallet", desc: "Use any EVM wallet (MetaMask, Coinbase Wallet, etc.)" },
                            { step: "2", title: "Switch to Base Sepolia", desc: "The faucet will auto-prompt you to switch networks" },
                            { step: "3", title: "Click Request", desc: "Calls faucet() on the MockUSDC contract — 10,000 USDC per request" },
                            { step: "4", title: "Start streaming", desc: "Use your USDC to create payment streams for AI services" },
                        ].map(({ step, title, desc }) => (
                            <div key={step} className="flex gap-3">
                                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center shrink-0">
                                    {step}
                                </Badge>
                                <div>
                                    <div className="font-medium">{title}</div>
                                    <div className="text-sm text-muted-foreground">{desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <Alert>
                        <AlertDescription className="text-sm">
                            <strong>Note:</strong> This faucet distributes testnet USDC only on Base Sepolia.
                            Testnet tokens have no real-world value and are for testing purposes only.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        </div>
    );
}
