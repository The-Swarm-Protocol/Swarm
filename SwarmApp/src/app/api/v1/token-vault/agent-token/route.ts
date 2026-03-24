/**
 * POST /api/v1/token-vault/agent-token
 *
 * Agent retrieves an access token for an approved connection.
 * Verifies the agent has approved access for the requested scopes,
 * then returns the decrypted token.
 *
 * Body: { agentId, connectionId, scopes }
 * Auth: Agent auth (Ed25519 signature or API key)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  checkAgentAccess,
  getDecryptedToken,
  getConnection,
  logAudit,
  PROVIDER_CONFIG,
  type OAuthProvider,
} from "@/lib/token-vault";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agentId, connectionId, scopes } = body;

    if (!agentId || !connectionId || !scopes?.length) {
      return NextResponse.json(
        { error: "agentId, connectionId, and scopes are required" },
        { status: 400 },
      );
    }

    // Verify the connection exists
    const conn = await getConnection(connectionId);
    if (!conn) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    // Check agent has approved access
    const access = await checkAgentAccess(agentId, connectionId, scopes);
    if (!access.allowed) {
      await logAudit({
        orgId: conn.orgId,
        action: "token_use",
        provider: conn.provider,
        connectionId,
        agentId,
        scopes,
        actorId: agentId,
        actorType: "agent",
        description: `DENIED: Agent ${agentId} attempted to use ${PROVIDER_CONFIG[conn.provider as OAuthProvider]?.label || conn.provider} token without approval`,
        metadata: { denied: true, reason: access.reason },
      });
      return NextResponse.json(
        { error: "Access not approved", reason: access.reason },
        { status: 403 },
      );
    }

    // Decrypt and return the token
    const { accessToken } = await getDecryptedToken(connectionId, conn.orgId);

    // Log successful token use
    await logAudit({
      orgId: conn.orgId,
      action: "token_use",
      provider: conn.provider,
      connectionId,
      agentId,
      requestId: access.requestId,
      scopes,
      actorId: agentId,
      actorType: "agent",
      description: `Agent ${agentId} used ${PROVIDER_CONFIG[conn.provider as OAuthProvider]?.label || conn.provider} token (scopes: ${scopes.join(", ")})`,
    });

    return NextResponse.json({
      accessToken,
      provider: conn.provider,
      scopes,
      expiresAt: conn.expiresAt,
    });
  } catch (err) {
    console.error("[TokenVault] Agent token error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to retrieve token" },
      { status: 500 },
    );
  }
}
