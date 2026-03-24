/**
 * GET  /api/v1/token-vault/connections?orgId=X
 * DELETE /api/v1/token-vault/connections  { connectionId, orgId }
 *
 * List and manage OAuth connections for an organization.
 */

import { NextRequest, NextResponse } from "next/server";
import { getWalletAddress } from "@/lib/auth-guard";
import { getConnections, disconnectConnection } from "@/lib/token-vault";

export async function GET(req: NextRequest) {
  const wallet = getWalletAddress(req);
  if (!wallet) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }

  try {
    const connections = await getConnections(orgId);

    // Strip encrypted token data from response
    const safeConnections = connections.map((c) => ({
      id: c.id,
      provider: c.provider,
      displayName: c.displayName,
      email: c.email,
      maskedAccessToken: c.maskedAccessToken,
      grantedScopes: c.grantedScopes,
      expiresAt: c.expiresAt,
      connectedBy: c.connectedBy,
      connectedAt: c.connectedAt,
      lastUsedAt: c.lastUsedAt,
      usageCount: c.usageCount,
      active: c.active,
    }));

    return NextResponse.json({ connections: safeConnections });
  } catch (err) {
    console.error("[TokenVault] List connections error:", err);
    return NextResponse.json({ error: "Failed to list connections" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const wallet = getWalletAddress(req);
  if (!wallet) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { connectionId, orgId } = await req.json();
    if (!connectionId || !orgId) {
      return NextResponse.json({ error: "connectionId and orgId are required" }, { status: 400 });
    }

    await disconnectConnection(connectionId, orgId, wallet);
    return NextResponse.json({ disconnected: true });
  } catch (err) {
    console.error("[TokenVault] Disconnect error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to disconnect" },
      { status: 500 },
    );
  }
}
