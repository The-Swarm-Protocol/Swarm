/**
 * React hook that polls PayStream contracts on Base Sepolia every 15 seconds.
 *
 * Usage:
 *   const { senderStreams, recipientStreams, services, usdcBalance, ... } = usePayStreamData(address);
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import {
    PAYSTREAM_CONTRACTS,
    BASE_SEPOLIA_RPC,
    PAYMENT_STREAM_ABI,
    BILLING_REGISTRY_ABI,
    MOCK_USDC_ABI,
    parseStream,
    parseService,
    type PayStream,
    type BillingService,
    type MarketplaceStats,
} from "@/lib/paystream-contracts";

const POLL_INTERVAL = 15_000; // 15s

interface PayStreamData {
    senderStreams: PayStream[];
    recipientStreams: PayStream[];
    services: BillingService[];
    marketplaceStats: MarketplaceStats | null;
    usdcBalance: bigint;
    streamCount: number;
    isLoading: boolean;
    error: string | null;
    lastRefresh: Date | null;
    refetch: () => Promise<void>;
}

export function usePayStreamData(address?: string): PayStreamData {
    const [senderStreams, setSenderStreams] = useState<PayStream[]>([]);
    const [recipientStreams, setRecipientStreams] = useState<PayStream[]>([]);
    const [services, setServices] = useState<BillingService[]>([]);
    const [marketplaceStats, setMarketplaceStats] = useState<MarketplaceStats | null>(null);
    const [usdcBalance, setUsdcBalance] = useState<bigint>(BigInt(0));
    const [streamCount, setStreamCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
    const providerRef = useRef<ethers.JsonRpcProvider | null>(null);
    const isFetchingRef = useRef(false);

    const getProvider = useCallback(() => {
        if (!providerRef.current) {
            providerRef.current = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
        }
        return providerRef.current;
    }, []);

    const fetchData = useCallback(async () => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        try {
            const provider = getProvider();
            const streamContract = new ethers.Contract(PAYSTREAM_CONTRACTS.PAYMENT_STREAM, PAYMENT_STREAM_ABI, provider);
            const registryContract = new ethers.Contract(PAYSTREAM_CONTRACTS.BILLING_REGISTRY, BILLING_REGISTRY_ABI, provider);
            const usdcContract = new ethers.Contract(PAYSTREAM_CONTRACTS.MOCK_USDC, MOCK_USDC_ABI, provider);

            // Fetch marketplace data (always available)
            const [rawStats, rawStreamCount, rawActiveServiceIds] = await Promise.all([
                registryContract.getMarketplaceStats().catch(() => null),
                streamContract.streamCount().catch(() => BigInt(0)),
                registryContract.getActiveServices(0, 50).catch(() => []),
            ]);

            if (rawStats) {
                setMarketplaceStats({
                    totalServices: Number(rawStats[0]),
                    totalVolume: BigInt(rawStats[1]),
                    totalProviders: Number(rawStats[2]),
                });
            }
            setStreamCount(Number(rawStreamCount));

            // Fetch service details for active services
            if (rawActiveServiceIds && rawActiveServiceIds.length > 0) {
                const servicePromises = rawActiveServiceIds.map((id: string) =>
                    registryContract.getService(id).catch(() => null)
                );
                const rawServices = await Promise.all(servicePromises);
                const parsedServices = rawServices
                    .filter((s: unknown) => s !== null)
                    .map((s: unknown) => parseService(s));
                setServices(parsedServices);
            }

            // Fetch user-specific data if address provided
            if (address) {
                const [rawBalance, rawSenderIds, rawRecipientIds] = await Promise.all([
                    usdcContract.balanceOf(address).catch(() => BigInt(0)),
                    streamContract.getSenderStreams(address).catch(() => []),
                    streamContract.getRecipientStreams(address).catch(() => []),
                ]);

                setUsdcBalance(BigInt(rawBalance));

                // Fetch sender stream details
                if (rawSenderIds.length > 0) {
                    const senderPromises = rawSenderIds.map((id: string) =>
                        streamContract.getStream(id).then((raw: unknown[]) => parseStream(id, raw)).catch(() => null)
                    );
                    const parsed = (await Promise.all(senderPromises)).filter((s): s is PayStream => s !== null);
                    setSenderStreams(parsed);
                } else {
                    setSenderStreams([]);
                }

                // Fetch recipient stream details
                if (rawRecipientIds.length > 0) {
                    const recipientPromises = rawRecipientIds.map((id: string) =>
                        streamContract.getStream(id).then((raw: unknown[]) => parseStream(id, raw)).catch(() => null)
                    );
                    const parsed = (await Promise.all(recipientPromises)).filter((s): s is PayStream => s !== null);
                    setRecipientStreams(parsed);
                } else {
                    setRecipientStreams([]);
                }
            }

            setError(null);
            setLastRefresh(new Date());
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch PayStream data");
        } finally {
            setIsLoading(false);
            isFetchingRef.current = false;
        }
    }, [getProvider, address]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchData]);

    return {
        senderStreams,
        recipientStreams,
        services,
        marketplaceStats,
        usdcBalance,
        streamCount,
        isLoading,
        error,
        lastRefresh,
        refetch: fetchData,
    };
}
