/**
 * GET /api/v1/mods/office-sim/avatars?orgId=ORG_ID
 *
 * Fetch all completed avatar data for an org.
 * Returns a map of agentId -> AgentAvatarData.
 *
 * Called by OfficeProvider during its polling cycle.
 *
 * Auth: x-wallet-address (org member)
 */

import { NextRequest } from "next/server";
import { getWalletAddress } from "@/lib/auth-guard";
import { batchGetAvatars } from "@/components/mods/office-sim/studio/avatar-firestore";

export async function GET(req: NextRequest) {
  const wallet = getWalletAddress(req);
  if (!wallet) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return Response.json({ error: "orgId is required" }, { status: 400 });
  }

  try {
    const avatarMap = await batchGetAvatars(orgId);

    // Convert Map to plain object for JSON serialization
    const avatars: Record<string, unknown> = {};
    for (const [agentId, data] of avatarMap) {
      avatars[agentId] = data;
    }

    return Response.json({ ok: true, avatars });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to fetch avatars" },
      { status: 500 },
    );
  }
}
