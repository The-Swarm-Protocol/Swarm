/**
 * POST /api/v1/base/auth/payload
 *
 * Generate a SIWE (EIP-4361) payload for Base chain authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest) {
    try {
        const { address, chainId = 8453 } = await req.json();

        if (!address || typeof address !== "string") {
            return NextResponse.json({ error: "address is required" }, { status: 400 });
        }

        const domain = req.headers.get("host") || "swarmprotocol.fun";
        const uri = `https://${domain}`;
        const nonce = randomBytes(16).toString("hex");
        const issuedAt = new Date().toISOString();
        const expirationTime = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

        const message = [
            `${domain} wants you to sign in with your Ethereum account:`,
            address,
            "",
            "Sign in with Base to Swarm Protocol",
            "",
            `URI: ${uri}`,
            `Version: 1`,
            `Chain ID: ${chainId}`,
            `Nonce: ${nonce}`,
            `Issued At: ${issuedAt}`,
            `Expiration Time: ${expirationTime}`,
        ].join("\n");

        return NextResponse.json({
            payload: {
                domain,
                address,
                statement: "Sign in with Base to Swarm Protocol",
                uri,
                version: "1",
                chainId,
                nonce,
                issuedAt,
                expirationTime,
                message,
            },
        });
    } catch (err) {
        console.error("[Base Auth] Payload generation error:", err);
        return NextResponse.json({ error: "Failed to generate payload" }, { status: 500 });
    }
}
