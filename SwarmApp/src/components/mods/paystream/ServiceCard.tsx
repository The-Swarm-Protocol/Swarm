"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Star, ExternalLink } from "lucide-react";
import {
    type BillingService,
    billingLabel,
    toUSDC,
    shortAddr,
    explorerAddr,
} from "@/lib/paystream-contracts";

const BILLING_COLORS: Record<number, string> = {
    0: "bg-green-500/10 text-green-400 border-green-500/20",  // PerSecond
    1: "bg-blue-500/10 text-blue-400 border-blue-500/20",     // PerCall
    2: "bg-purple-500/10 text-purple-400 border-purple-500/20", // PerToken
    3: "bg-amber-500/10 text-amber-400 border-amber-500/20",  // Fixed
    4: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",     // Hybrid
};

interface ServiceCardProps {
    service: BillingService;
    onSelect?: (service: BillingService) => void;
}

export function ServiceCard({ service, onSelect }: ServiceCardProps) {
    const avgRating = service.ratingCount > 0
        ? (service.ratingSum / service.ratingCount / 20).toFixed(1) // scale 0-100 → 0-5
        : "—";
    const rateDisplay = toUSDC(service.rate);

    return (
        <Card
            className={`border-border/50 transition-colors ${onSelect ? "cursor-pointer hover:border-blue-500/30" : ""}`}
            onClick={() => onSelect?.(service)}
        >
            <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <h3 className="font-medium text-sm truncate">{service.name}</h3>
                        <a
                            href={explorerAddr(service.provider)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground font-mono hover:underline flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {shortAddr(service.provider)} <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                    </div>
                    <Badge variant="outline" className={BILLING_COLORS[service.billingType] || ""}>
                        {billingLabel(service.billingType)}
                    </Badge>
                </div>

                {/* Description */}
                {service.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{service.description}</p>
                )}

                {/* Stats */}
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                        <span className="font-medium text-blue-400">
                            {rateDisplay < 0.01 ? rateDisplay.toFixed(6) : rateDisplay.toFixed(2)} USDC
                            <span className="text-muted-foreground font-normal text-xs">
                                /{service.billingType === 0 ? "sec" : service.billingType === 1 ? "call" : service.billingType === 2 ? "token" : "unit"}
                            </span>
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                            <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                            {avgRating}
                        </span>
                        <span>{service.ratingCount} reviews</span>
                    </div>
                </div>

                {/* Tags */}
                {service.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {service.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                                {tag}
                            </Badge>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
