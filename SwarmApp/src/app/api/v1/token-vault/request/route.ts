/**
 * POST /api/v1/token-vault/request
 *
 * Agent requests scoped access to an OAuth connection.
 * Low-risk scopes are auto-approved; medium/high require admin review.
 *
 * Body: { orgId, agentId, agentName, connectionId, provider, scopes, reason }
 */

import { NextRequest, NextResponse } from "next/server";
import { getWalletAddress } from "@/lib/auth-guard";
import {
  createAccessRequest,
  getAccessRequests,
  getConnection,
  PROVIDER_CONFIG,
  type OAuthProvider,
} from "@/lib/token-vault";

/** POST — Create a new access request */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orgId, agentId, agentName, connectionId, provider, scopes, reason } = body;

    if (!orgId || !agentId || !agentName || !connectionId || !provider || !scopes?.length) {
      return NextResponse.json(
        { error: "Missing required fields: orgId, agentId, agentName, connectionId, provider, scopes" },
        { status: 400 },
      );
    }

    if (!PROVIDER_CONFIG[provider as OAuthProvider]) {
      return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 });
    }

    // Verify connection exists
    const conn = await getConnection(connectionId);
    if (!conn || conn.orgId !== orgId) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    const { requestId, autoApproved } = await createAccessRequest(
      orgId,
      agentId,
      agentName,
      connectionId,
      provider as OAuthProvider,
      scopes,
      reason || "Agent-initiated access request",
    );

    return NextResponse.json({
      requestId,
      status: autoApproved ? "approved" : "pending",
      autoApproved,
      message: autoApproved
        ? "Access auto-approved (all scopes are low-risk)"
        : "Access request submitted for admin review",
    });
  } catch (err) {
    console.error("[TokenVault] Request error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create request" },
      { status: 500 },
    );
  }
}

/** GET — List access requests for an org */
export async function GET(req: NextRequest) {
  const wallet = getWalletAddress(req);
  if (!wallet) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = req.nextUrl.searchParams.get("orgId");
  const status = req.nextUrl.searchParams.get("status") || undefined;

  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }

  try {
    const requests = await getAccessRequests(orgId, status);
    return NextResponse.json({ requests });
  } catch (err) {
    console.error("[TokenVault] List requests error:", err);
    return NextResponse.json({ error: "Failed to list requests" }, { status: 500 });
  }
}
