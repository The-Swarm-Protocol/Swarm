/**
 * PATCH /api/v1/base/permissions/[id]
 *
 * Approve, deny, or revoke a spend permission.
 */

import { NextRequest, NextResponse } from "next/server";
import { getWalletAddress } from "@/lib/auth-guard";
import {
    approveSpendPermission,
    denySpendPermission,
    revokeSpendPermission,
    appendAuditLog,
} from "@/lib/base-accounts";

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
    const wallet = getWalletAddress(req);
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;
    try {
        const { action, orgId } = await req.json();

        if (!action || !orgId) {
            return NextResponse.json({ error: "action and orgId are required" }, { status: 400 });
        }

        const validActions = ["approve", "deny", "revoke"];
        if (!validActions.includes(action)) {
            return NextResponse.json({ error: `action must be one of: ${validActions.join(", ")}` }, { status: 400 });
        }

        if (action === "approve") {
            await approveSpendPermission(id, wallet);
        } else if (action === "deny") {
            await denySpendPermission(id);
        } else if (action === "revoke") {
            await revokeSpendPermission(id, wallet);
        }

        const auditActionMap: Record<string, "permission_approved" | "permission_denied" | "permission_revoked"> = {
            approve: "permission_approved",
            deny: "permission_denied",
            revoke: "permission_revoked",
        };

        await appendAuditLog({
            orgId,
            action: auditActionMap[action],
            actorType: "user",
            actorId: wallet,
            description: `Spend permission ${id} ${action}d`,
            metadata: { permissionId: id },
        });

        return NextResponse.json({ updated: true, status: action === "approve" ? "approved" : action === "deny" ? "denied" : "revoked" });
    } catch (err) {
        console.error("[Base] Update permission error:", err);
        return NextResponse.json({ error: "Failed to update permission" }, { status: 500 });
    }
}
