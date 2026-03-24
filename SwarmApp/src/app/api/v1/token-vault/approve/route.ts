/**
 * POST /api/v1/token-vault/approve
 *
 * Admin approves or denies an agent's access request.
 * Body: { requestId, orgId, action: "approve"|"deny"|"revoke", note?, expiresInDays? }
 */

import { NextRequest, NextResponse } from "next/server";
import { getWalletAddress } from "@/lib/auth-guard";
import { approveRequest, denyRequest, revokeRequest } from "@/lib/token-vault";

export async function POST(req: NextRequest) {
  const wallet = getWalletAddress(req);
  if (!wallet) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { requestId, orgId, action, note, expiresInDays } = await req.json();

    if (!requestId || !orgId || !action) {
      return NextResponse.json(
        { error: "requestId, orgId, and action are required" },
        { status: 400 },
      );
    }

    switch (action) {
      case "approve":
        await approveRequest(requestId, orgId, wallet, note, expiresInDays);
        return NextResponse.json({ status: "approved", requestId });

      case "deny":
        await denyRequest(requestId, orgId, wallet, note);
        return NextResponse.json({ status: "denied", requestId });

      case "revoke":
        await revokeRequest(requestId, orgId, wallet);
        return NextResponse.json({ status: "revoked", requestId });

      default:
        return NextResponse.json(
          { error: "Invalid action. Must be: approve, deny, or revoke" },
          { status: 400 },
        );
    }
  } catch (err) {
    console.error("[TokenVault] Approve/Deny error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to process request" },
      { status: 500 },
    );
  }
}
