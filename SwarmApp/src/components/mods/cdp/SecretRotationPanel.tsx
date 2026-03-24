"use client";

import { useState } from "react";
import { RotateCw, Key, Wallet, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useOrg } from "@/contexts/OrgContext";

interface SecretCard {
    type: "cdp_api_key" | "wallet_secret";
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
}

const SECRETS: SecretCard[] = [
    {
        type: "cdp_api_key",
        label: "CDP API Key",
        description: "Rotate the CDP API key used for all backend operations. Update env vars after rotation.",
        icon: Key,
    },
    {
        type: "wallet_secret",
        label: "Wallet Signing Secret",
        description: "Rotate the server-signer key for CDP wallets. Zero-downtime rotation with key overlap period.",
        icon: Wallet,
    },
];

export default function SecretRotationPanel() {
    const { currentOrg } = useOrg();
    const orgId = currentOrg?.id;
    const [rotating, setRotating] = useState<string | null>(null);
    const [confirmType, setConfirmType] = useState<string | null>(null);
    const [result, setResult] = useState<{ type: string; message: string } | null>(null);

    const handleRotate = async (secretType: string) => {
        if (!orgId) return;
        setConfirmType(null);
        setRotating(secretType);
        try {
            const res = await fetch("/api/v1/mods/cdp-addon/secrets/rotate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orgId, secretType }),
            });
            const data = await res.json();
            setResult({
                type: secretType,
                message: data.rotated
                    ? `Rotated successfully. New key prefix: ${data.newKeyPrefix}`
                    : data.newKeyPrefix || "Rotation initiated — follow instructions in CDP Dashboard.",
            });
        } catch (err) {
            setResult({ type: secretType, message: "Rotation failed. Check console for details." });
            console.error("Rotate error:", err);
        } finally {
            setRotating(null);
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                        <RotateCw className="h-4 w-4" /> Secret Rotation
                    </CardTitle>
                    <CardDescription>
                        Rotate CDP secrets when compromised or as part of routine security hygiene.
                        Secrets are stored in environment variables — never in Firestore.
                    </CardDescription>
                </CardHeader>
            </Card>

            {SECRETS.map(({ type, label, description, icon: Icon }) => (
                <Card key={type}>
                    <CardContent className="flex items-center justify-between py-4">
                        <div className="flex items-center gap-3">
                            <Icon className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium">{label}</p>
                                <p className="text-xs text-muted-foreground max-w-md">{description}</p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmType(type)}
                            disabled={rotating === type}
                        >
                            {rotating === type ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                                <RotateCw className="h-4 w-4 mr-1" />
                            )}
                            Rotate
                        </Button>
                    </CardContent>
                    {result?.type === type && (
                        <div className="px-6 pb-4">
                            <div className="text-xs bg-muted rounded p-3 flex items-start gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                <span>{result.message}</span>
                            </div>
                        </div>
                    )}
                </Card>
            ))}

            {/* Confirmation Dialog */}
            <Dialog open={!!confirmType} onOpenChange={() => setConfirmType(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Secret Rotation</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to rotate this secret? You will need to update
                            your environment variables after rotation. Active operations may be
                            briefly disrupted.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmType(null)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={() => confirmType && handleRotate(confirmType)}
                        >
                            Rotate Secret
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
