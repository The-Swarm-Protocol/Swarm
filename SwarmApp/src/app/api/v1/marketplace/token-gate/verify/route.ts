/**
 * POST /api/v1/marketplace/token-gate/verify
 *
 * Verifies whether a wallet meets the token-gate requirements for a marketplace item.
 *
 * Input: { wallet, itemId }
 * Returns: { ok, passed, result: TokenGateResult }
 */

import { NextRequest, NextResponse } from "next/server";
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { verifyTokenGate, type TokenGateConfig, type TokenGateResult } from "@/lib/token-gate";

const TOKEN_GATE_ACCESS_COLLECTION = "tokenGateAccess";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function POST(req: NextRequest) {
    const walletHeader = req.headers.get("x-wallet-address")?.toLowerCase();

    const body = await req.json();
    const { wallet: bodyWallet, itemId } = body as { wallet?: string; itemId: string };

    const wallet = bodyWallet?.toLowerCase() || walletHeader;
    if (!wallet) {
        return NextResponse.json({ error: "wallet address required" }, { status: 400 });
    }
    if (!itemId) {
        return NextResponse.json({ error: "itemId required" }, { status: 400 });
    }

    // Look up the item's token gate config
    // Check verified items first, then community items
    let tokenGate: TokenGateConfig | null = null;

    const verifiedSnap = await getDoc(doc(db, "verifiedMarketItems", itemId));
    if (verifiedSnap.exists()) {
        const data = verifiedSnap.data();
        tokenGate = (data.tokenGate as TokenGateConfig) || null;
    }

    if (!tokenGate) {
        const communitySnap = await getDoc(doc(db, "communityMarketItems", itemId));
        if (communitySnap.exists()) {
            const data = communitySnap.data();
            tokenGate = (data.tokenGate as TokenGateConfig) || null;
        }
    }

    if (!tokenGate) {
        return NextResponse.json({
            error: "Item not found or has no token gate configured",
        }, { status: 404 });
    }

    // Check Firestore cache (24h TTL)
    const cacheDocId = `${wallet}:${itemId}`;
    const cacheRef = doc(db, TOKEN_GATE_ACCESS_COLLECTION, cacheDocId);

    try {
        const cacheSnap = await getDoc(cacheRef);
        if (cacheSnap.exists()) {
            const cached = cacheSnap.data();
            const checkedAt = cached.checkedAt instanceof Timestamp
                ? cached.checkedAt.toDate().getTime()
                : cached.checkedAt;
            if (Date.now() - checkedAt < CACHE_TTL_MS) {
                return NextResponse.json({
                    ok: true,
                    passed: cached.passed as boolean,
                    cached: true,
                    result: cached.result as TokenGateResult,
                });
            }
        }
    } catch {
        // Cache miss — proceed with fresh check
    }

    // Verify on-chain
    const result = await verifyTokenGate(wallet, tokenGate);

    // Store result in Firestore cache
    try {
        await setDoc(cacheRef, {
            wallet,
            itemId,
            passed: result.passed,
            result,
            checkedAt: Date.now(),
            updatedAt: serverTimestamp(),
        });
    } catch {
        // Non-blocking — cache write failure shouldn't block the response
    }

    return NextResponse.json({
        ok: true,
        passed: result.passed,
        cached: false,
        result,
    });
}
