/**
 * POST /api/v1/token-vault/connect
 *
 * Initiates an Auth0 OAuth connection flow.
 * Returns the Auth0 authorization URL the client should redirect to.
 *
 * Body: { orgId, provider, scopes? }
 * Auth: x-wallet-address (org member)
 */

import { NextRequest, NextResponse } from "next/server";
import { getWalletAddress } from "@/lib/auth-guard";
import { PROVIDER_CONFIG, type OAuthProvider } from "@/lib/token-vault";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const wallet = getWalletAddress(req);
  if (!wallet) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
  const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID;
  const AUTH0_CALLBACK_URL = process.env.AUTH0_CALLBACK_URL
    || `${req.nextUrl.origin}/api/v1/token-vault/callback`;

  if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID) {
    return NextResponse.json(
      { error: "Auth0 not configured. Set AUTH0_DOMAIN and AUTH0_CLIENT_ID environment variables." },
      { status: 503 },
    );
  }

  try {
    const { orgId, provider, scopes } = await req.json();

    if (!orgId || !provider) {
      return NextResponse.json({ error: "orgId and provider are required" }, { status: 400 });
    }

    if (!PROVIDER_CONFIG[provider as OAuthProvider]) {
      return NextResponse.json(
        { error: `Unsupported provider: ${provider}. Supported: ${Object.keys(PROVIDER_CONFIG).join(", ")}` },
        { status: 400 },
      );
    }

    const providerConfig = PROVIDER_CONFIG[provider as OAuthProvider];

    // Build scopes — merge defaults with any additional requested scopes
    const requestScopes = new Set([
      ...providerConfig.defaultScopes,
      ...(scopes || []),
    ]);

    // Generate CSRF state token
    const state = crypto.randomBytes(32).toString("hex");

    // Encode metadata in state (org, provider, wallet, csrf)
    const statePayload = Buffer.from(
      JSON.stringify({ orgId, provider, wallet, csrf: state }),
    ).toString("base64url");

    // Build Auth0 authorization URL
    const authorizeUrl = new URL(`https://${AUTH0_DOMAIN}/authorize`);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", AUTH0_CLIENT_ID);
    authorizeUrl.searchParams.set("redirect_uri", AUTH0_CALLBACK_URL);
    authorizeUrl.searchParams.set("scope", [...requestScopes].join(" "));
    authorizeUrl.searchParams.set("connection", providerConfig.auth0Connection);
    authorizeUrl.searchParams.set("state", statePayload);
    // Request offline_access for refresh tokens
    if (!requestScopes.has("offline_access")) {
      authorizeUrl.searchParams.append("scope", "offline_access");
    }

    return NextResponse.json({
      authorizeUrl: authorizeUrl.toString(),
      state: statePayload,
      provider,
      scopes: [...requestScopes],
    });
  } catch (err) {
    console.error("[TokenVault] Connect error:", err);
    return NextResponse.json({ error: "Failed to initiate connection" }, { status: 500 });
  }
}
