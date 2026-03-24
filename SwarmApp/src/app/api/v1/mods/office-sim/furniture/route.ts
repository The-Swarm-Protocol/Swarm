/**
 * GET /api/v1/mods/office-sim/furniture?orgId=...&themeId=...
 *
 * Batch-fetch completed furniture for an org + theme.
 * Returns a map of category → OfficeFurnitureData.
 *
 * Auth: x-wallet-address
 */

import { NextRequest } from "next/server";
import { getWalletAddress } from "@/lib/auth-guard";
import { getOrgFurniture } from "@/components/mods/office-sim/studio/furniture-firestore";

export async function GET(req: NextRequest) {
  const wallet = getWalletAddress(req);
  if (!wallet) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const orgId = req.nextUrl.searchParams.get("orgId");
  const themeId = req.nextUrl.searchParams.get("themeId");

  if (!orgId || !themeId) {
    return Response.json(
      { error: "orgId and themeId parameters required" },
      { status: 400 },
    );
  }

  const furniture = await getOrgFurniture(orgId, themeId);

  // Convert Map to plain object for JSON serialization
  const result: Record<string, unknown> = {};
  for (const [category, data] of furniture) {
    result[category] = data;
  }

  return Response.json({
    ok: true,
    furniture: result,
    count: furniture.size,
  });
}
