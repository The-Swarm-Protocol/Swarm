/**
 * React hook for write operations on PayStream contracts (Base Sepolia).
 * Uses ethers.js with BrowserProvider (window.ethereum) for signing.
 * Auto-switches wallet to Base Sepolia (chain 84532) if needed.
 */

"use client";

import { useState, useCallback } from "react";
import { ethers } from "ethers";
import {
    PAYSTREAM_CONTRACTS,
    BASE_SEPOLIA_CHAIN_ID,
    PAYMENT_STREAM_ABI,
    AGENT_WALLET_ABI,
    BILLING_REGISTRY_ABI,
    MOCK_USDC_ABI,
} from "@/lib/paystream-contracts";

declare global {
    interface Window {
        ethereum?: ethers.Eip1193Provider;
    }
}

interface WriteState {
    isLoading: boolean;
    error: string | null;
    txHash: string | null;
}

interface PayStreamWrite {
    // USDC
    approveUSDC: (spender: string, amount: bigint) => Promise<string | null>;
    faucetUSDC: () => Promise<string | null>;

    // Streams
    createStream: (recipient: string, amount: bigint, duration: number, serviceId: string, autoRenew: boolean) => Promise<string | null>;
    withdrawStream: (streamId: string) => Promise<string | null>;
    pauseStream: (streamId: string) => Promise<string | null>;
    resumeStream: (streamId: string) => Promise<string | null>;
    cancelStream: (streamId: string) => Promise<string | null>;

    // Agent wallet
    configureAutoStream: (recipient: string, maxAmount: bigint, maxDuration: number, enabled: boolean) => Promise<string | null>;
    depositToWallet: (amount: bigint) => Promise<string | null>;
    withdrawFromWallet: (amount: bigint) => Promise<string | null>;
    setDailyLimit: (limit: bigint) => Promise<string | null>;
    sendPayment: (recipient: string, amount: bigint) => Promise<string | null>;
    batchSend: (recipients: string[], amounts: bigint[]) => Promise<string | null>;

    // Billing registry
    registerService: (name: string, description: string, endpoint: string, billingType: number, rate: bigint, minDuration: number, maxDuration: number, tags: string[]) => Promise<string | null>;
    rateService: (serviceId: string, rating: number) => Promise<string | null>;

    state: WriteState;
    reset: () => void;
}

const CHAIN_HEX = "0x" + BASE_SEPOLIA_CHAIN_ID.toString(16); // "0x14a34"

async function getSigner(): Promise<ethers.Signer> {
    if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("No wallet detected. Please connect your wallet.");
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();

    if (Number(network.chainId) !== BASE_SEPOLIA_CHAIN_ID) {
        try {
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: CHAIN_HEX }],
            });
        } catch (switchErr: unknown) {
            const err = switchErr as { code?: number };
            if (err?.code === 4902) {
                await window.ethereum.request({
                    method: "wallet_addEthereumChain",
                    params: [{
                        chainId: CHAIN_HEX,
                        chainName: "Base Sepolia",
                        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
                        rpcUrls: ["https://sepolia.base.org"],
                        blockExplorerUrls: ["https://sepolia.basescan.org"],
                    }],
                });
            } else {
                throw new Error("Please switch your wallet to Base Sepolia (chain 84532) to continue.");
            }
        }
        return new ethers.BrowserProvider(window.ethereum).getSigner();
    }

    return provider.getSigner();
}

export function usePayStreamWrite(): PayStreamWrite {
    const [state, setState] = useState<WriteState>({
        isLoading: false,
        error: null,
        txHash: null,
    });

    const reset = useCallback(() => {
        setState({ isLoading: false, error: null, txHash: null });
    }, []);

    /** Helper: execute a write tx with loading/error state management */
    const exec = useCallback(async (
        fn: (signer: ethers.Signer) => Promise<ethers.TransactionResponse>,
        errorLabel: string,
    ): Promise<string | null> => {
        setState({ isLoading: true, error: null, txHash: null });
        try {
            const signer = await getSigner();
            const tx = await fn(signer);
            const receipt = await tx.wait();
            const hash = receipt?.hash ?? tx.hash;
            setState({ isLoading: false, error: null, txHash: hash });
            return hash;
        } catch (err) {
            const msg = err instanceof Error ? err.message : errorLabel;
            setState({ isLoading: false, error: msg, txHash: null });
            return null;
        }
    }, []);

    // ─── USDC ───────────────────────────────────────────────

    const approveUSDC = useCallback(async (spender: string, amount: bigint) => {
        return exec((signer) => {
            const usdc = new ethers.Contract(PAYSTREAM_CONTRACTS.MOCK_USDC, MOCK_USDC_ABI, signer);
            return usdc.approve(spender, amount);
        }, "Failed to approve USDC");
    }, [exec]);

    const faucetUSDC = useCallback(async () => {
        return exec((signer) => {
            const usdc = new ethers.Contract(PAYSTREAM_CONTRACTS.MOCK_USDC, MOCK_USDC_ABI, signer);
            return usdc.faucet();
        }, "Failed to request USDC from faucet");
    }, [exec]);

    // ─── Streams ────────────────────────────────────────────

    const createStream = useCallback(async (
        recipient: string, amount: bigint, duration: number, serviceId: string, autoRenew: boolean,
    ) => {
        return exec((signer) => {
            const stream = new ethers.Contract(PAYSTREAM_CONTRACTS.PAYMENT_STREAM, PAYMENT_STREAM_ABI, signer);
            return stream.createStream(recipient, amount, duration, serviceId, autoRenew);
        }, "Failed to create stream");
    }, [exec]);

    const withdrawStream = useCallback(async (streamId: string) => {
        return exec((signer) => {
            const stream = new ethers.Contract(PAYSTREAM_CONTRACTS.PAYMENT_STREAM, PAYMENT_STREAM_ABI, signer);
            return stream.withdraw(streamId);
        }, "Failed to withdraw from stream");
    }, [exec]);

    const pauseStream = useCallback(async (streamId: string) => {
        return exec((signer) => {
            const stream = new ethers.Contract(PAYSTREAM_CONTRACTS.PAYMENT_STREAM, PAYMENT_STREAM_ABI, signer);
            return stream.pauseStream(streamId);
        }, "Failed to pause stream");
    }, [exec]);

    const resumeStream = useCallback(async (streamId: string) => {
        return exec((signer) => {
            const stream = new ethers.Contract(PAYSTREAM_CONTRACTS.PAYMENT_STREAM, PAYMENT_STREAM_ABI, signer);
            return stream.resumeStream(streamId);
        }, "Failed to resume stream");
    }, [exec]);

    const cancelStream = useCallback(async (streamId: string) => {
        return exec((signer) => {
            const stream = new ethers.Contract(PAYSTREAM_CONTRACTS.PAYMENT_STREAM, PAYMENT_STREAM_ABI, signer);
            return stream.cancelStream(streamId);
        }, "Failed to cancel stream");
    }, [exec]);

    // ─── Agent Wallet ───────────────────────────────────────

    const configureAutoStream = useCallback(async (
        recipient: string, maxAmount: bigint, maxDuration: number, enabled: boolean,
    ) => {
        return exec((signer) => {
            const wallet = new ethers.Contract(PAYSTREAM_CONTRACTS.AGENT_WALLET, AGENT_WALLET_ABI, signer);
            return wallet.configureAutoStream(recipient, maxAmount, maxDuration, enabled);
        }, "Failed to configure auto-stream");
    }, [exec]);

    const depositToWallet = useCallback(async (amount: bigint) => {
        return exec((signer) => {
            const wallet = new ethers.Contract(PAYSTREAM_CONTRACTS.AGENT_WALLET, AGENT_WALLET_ABI, signer);
            return wallet.deposit(amount);
        }, "Failed to deposit to wallet");
    }, [exec]);

    const withdrawFromWallet = useCallback(async (amount: bigint) => {
        return exec((signer) => {
            const wallet = new ethers.Contract(PAYSTREAM_CONTRACTS.AGENT_WALLET, AGENT_WALLET_ABI, signer);
            return wallet.withdraw(amount);
        }, "Failed to withdraw from wallet");
    }, [exec]);

    const setDailyLimit = useCallback(async (limit: bigint) => {
        return exec((signer) => {
            const wallet = new ethers.Contract(PAYSTREAM_CONTRACTS.AGENT_WALLET, AGENT_WALLET_ABI, signer);
            return wallet.setDailyLimit(limit);
        }, "Failed to set daily limit");
    }, [exec]);

    const sendPayment = useCallback(async (recipient: string, amount: bigint) => {
        return exec((signer) => {
            const wallet = new ethers.Contract(PAYSTREAM_CONTRACTS.AGENT_WALLET, AGENT_WALLET_ABI, signer);
            return wallet.sendPayment(recipient, amount);
        }, "Failed to send payment");
    }, [exec]);

    const batchSend = useCallback(async (recipients: string[], amounts: bigint[]) => {
        return exec((signer) => {
            const wallet = new ethers.Contract(PAYSTREAM_CONTRACTS.AGENT_WALLET, AGENT_WALLET_ABI, signer);
            return wallet.batchSend(recipients, amounts);
        }, "Failed to batch send");
    }, [exec]);

    // ─── Billing Registry ───────────────────────────────────

    const registerService = useCallback(async (
        name: string, description: string, endpoint: string,
        billingType: number, rate: bigint, minDuration: number, maxDuration: number, tags: string[],
    ) => {
        return exec((signer) => {
            const registry = new ethers.Contract(PAYSTREAM_CONTRACTS.BILLING_REGISTRY, BILLING_REGISTRY_ABI, signer);
            return registry.registerService(name, description, endpoint, billingType, rate, minDuration, maxDuration, tags);
        }, "Failed to register service");
    }, [exec]);

    const rateService = useCallback(async (serviceId: string, rating: number) => {
        return exec((signer) => {
            const registry = new ethers.Contract(PAYSTREAM_CONTRACTS.BILLING_REGISTRY, BILLING_REGISTRY_ABI, signer);
            return registry.rateService(serviceId, rating);
        }, "Failed to rate service");
    }, [exec]);

    return {
        approveUSDC, faucetUSDC,
        createStream, withdrawStream, pauseStream, resumeStream, cancelStream,
        configureAutoStream, depositToWallet, withdrawFromWallet, setDailyLimit, sendPayment, batchSend,
        registerService, rateService,
        state, reset,
    };
}
