/**
 * GET /api/v1/token-vault/callback
 *
 * Auth0 OAuth callback handler.
 * Exchanges authorization code for tokens, stores them encrypted,
 * and redirects back to the Token Vault mod page.
 */

import { NextRequest, NextResponse } from "next/server";
import { storeConnection, type OAuthProvider } from "@/lib/token-vault";

export async function GET(req: NextRequest) {
  const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
  const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID;
  const AUTH0_CLIENT_SECRET = process.env.AUTH0_CLIENT_SECRET;
  const AUTH0_CALLBACK_URL = process.env.AUTH0_CALLBACK_URL
    || `${req.nextUrl.origin}/api/v1/token-vault/callback`;

  if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID || !AUTH0_CLIENT_SECRET) {
    return redirectWithError(req, "Auth0 not configured");
  }

  const code = req.nextUrl.searchParams.get("code");
  const stateParam = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");
  const errorDescription = req.nextUrl.searchParams.get("error_description");

  if (error) {
    return redirectWithError(req, errorDescription || error);
  }

  if (!code || !stateParam) {
    return redirectWithError(req, "Missing authorization code or state");
  }

  // Decode state
  let stateData: { orgId: string; provider: OAuthProvider; wallet: string; csrf: string };
  try {
    stateData = JSON.parse(Buffer.from(stateParam, "base64url").toString());
  } catch {
    return redirectWithError(req, "Invalid state parameter");
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: AUTH0_CLIENT_ID,
        client_secret: AUTH0_CLIENT_SECRET,
        code,
        redirect_uri: AUTH0_CALLBACK_URL,
      }),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      console.error("[TokenVault] Token exchange failed:", errBody);
      return redirectWithError(req, "Token exchange failed");
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in, scope } = tokens;

    // Get user profile from Auth0
    const userInfoResponse = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    let displayName = "Unknown";
    let email = "";
    let auth0Sub = "";

    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      displayName = userInfo.name || userInfo.nickname || userInfo.email || "Unknown";
      email = userInfo.email || "";
      auth0Sub = userInfo.sub || "";
    }

    // Store encrypted tokens
    const connectionId = await storeConnection(
      stateData.orgId,
      stateData.provider,
      {
        auth0Sub,
        displayName,
        email,
        accessToken: access_token,
        refreshToken: refresh_token,
        grantedScopes: scope ? scope.split(" ") : [],
        expiresIn: expires_in,
      },
      stateData.wallet,
    );

    // Redirect back to the Token Vault page with success
    const redirectUrl = new URL("/mods/token-vault", req.nextUrl.origin);
    redirectUrl.searchParams.set("connected", connectionId);
    redirectUrl.searchParams.set("provider", stateData.provider);
    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error("[TokenVault] Callback error:", err);
    return redirectWithError(req, "Connection failed");
  }
}

function redirectWithError(req: NextRequest, error: string): NextResponse {
  const redirectUrl = new URL("/mods/token-vault", req.nextUrl.origin);
  redirectUrl.searchParams.set("error", error);
  return NextResponse.redirect(redirectUrl);
}
