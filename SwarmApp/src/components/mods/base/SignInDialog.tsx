"use client";

import { useState } from "react";
import { ShieldCheck, XCircle, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
    open: boolean;
    onClose: () => void;
    walletAddress: string | null;
    onSignIn: (payload: { message: string; nonce: string }, signature: string) => Promise<void>;
}

type Step = "preview" | "signing" | "success" | "error";

export default function SignInDialog({ open, onClose, walletAddress, onSignIn }: Props) {
    const [step, setStep] = useState<Step>("preview");
    const [payload, setPayload] = useState<Record<string, string> | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const fetchPayload = async () => {
        if (!walletAddress) return;
        setLoading(true);
        try {
            const res = await fetch("/api/v1/base/auth/payload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ address: walletAddress, chainId: 8453 }),
            });
            const data = await res.json();
            if (res.ok) {
                setPayload(data.payload);
            } else {
                setError(data.error || "Failed to generate payload");
                setStep("error");
            }
        } catch {
            setError("Failed to generate payload");
            setStep("error");
        } finally {
            setLoading(false);
        }
    };

    const handleSign = async () => {
        if (!payload) return;
        setStep("signing");
        try {
            // The parent component handles the actual signing via wallet SDK
            await onSignIn(
                { message: payload.message, nonce: payload.nonce },
                "" // signature injected by parent
            );
            setStep("success");
        } catch {
            setError("Signing failed or was rejected");
            setStep("error");
        }
    };

    // Fetch payload on first open
    if (open && !payload && !loading && step === "preview") {
        fetchPayload();
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-blue-400" />
                        <h2 className="text-lg font-semibold">Sign in with Base</h2>
                    </div>
                    <button className="text-muted-foreground hover:text-foreground" onClick={onClose}>
                        <XCircle className="h-5 w-5" />
                    </button>
                </div>

                {loading && (
                    <div className="flex flex-col items-center py-8">
                        <RefreshCw className="h-8 w-8 animate-spin text-blue-400 mb-3" />
                        <p className="text-sm text-muted-foreground">Generating SIWE message...</p>
                    </div>
                )}

                {step === "preview" && payload && !loading && (
                    <div className="space-y-4">
                        <div className="rounded-lg bg-muted/50 border border-border p-4">
                            <p className="text-xs text-muted-foreground mb-2">You will sign the following message:</p>
                            <pre className="text-xs font-mono whitespace-pre-wrap text-foreground leading-relaxed">
                                {payload.message}
                            </pre>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button className="flex-1" onClick={handleSign}>
                                <ShieldCheck className="h-4 w-4 mr-1.5" />
                                Sign Message
                            </Button>
                            <Button variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}

                {step === "signing" && (
                    <div className="flex flex-col items-center py-8">
                        <RefreshCw className="h-8 w-8 animate-spin text-blue-400 mb-3" />
                        <p className="text-sm text-muted-foreground">Please sign in your wallet...</p>
                    </div>
                )}

                {step === "success" && (
                    <div className="flex flex-col items-center py-8">
                        <CheckCircle2 className="h-10 w-10 text-green-400 mb-3" />
                        <h3 className="text-lg font-medium mb-1">Signed in with Base</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Your Base account is now connected to Swarm.
                        </p>
                        <Button variant="outline" onClick={onClose}>Close</Button>
                    </div>
                )}

                {step === "error" && (
                    <div className="flex flex-col items-center py-8">
                        <XCircle className="h-10 w-10 text-red-400 mb-3" />
                        <h3 className="text-lg font-medium mb-1">Sign-in failed</h3>
                        <p className="text-sm text-muted-foreground mb-4">{error}</p>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => { setStep("preview"); setError(null); setPayload(null); }}>
                                Try Again
                            </Button>
                            <Button variant="ghost" onClick={onClose}>Cancel</Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
