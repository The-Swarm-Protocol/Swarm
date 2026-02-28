/**
 * POST /api/webhooks/auth/register
 *
 * Explicit opt-in: register an agent and receive confirmation.
 * Body: { orgId, agentName, agentType, apiKey, agentId? }
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/firebase";
import {
    doc,
    getDoc,
    updateDoc,
    serverTimestamp,
} from "firebase/firestore";

export async function POST(request: NextRequest) {
    let body: Record<string, string>;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { orgId, agentName, agentType, apiKey, agentId } = body;

    if (!orgId || !agentName || !agentType || !apiKey) {
        return Response.json(
            { error: "orgId, agentName, agentType, and apiKey are required" },
            { status: 400 }
        );
    }

    if (!agentId) {
        return Response.json(
            { error: "agentId is required (from dashboard)" },
            { status: 400 }
        );
    }

    try {
        // Validate credentials
        const agentSnap = await getDoc(doc(db, "agents", agentId));
        if (!agentSnap.exists()) {
            return Response.json({ error: "Agent not found" }, { status: 404 });
        }

        const agentData = agentSnap.data();
        if (agentData.apiKey !== apiKey) {
            return Response.json({ error: "Invalid API key" }, { status: 401 });
        }

        // Mark agent as connected via skill (opt-in)
        await updateDoc(doc(db, "agents", agentId), {
            status: "online",
            lastSeen: serverTimestamp(),
            connectionType: "skill",
            tokenRevokedAt: null, // clear any previous revocation
        });

        return Response.json({
            ok: true,
            agentId,
            agentName: agentData.name || agentName,
            orgId: agentData.orgId || orgId,
            connectionType: "skill",
            scopes: ["messages:read", "messages:write", "tasks:read", "tasks:write"],
            registeredAt: new Date().toISOString(),
            message: "Agent registered. Use auth/revoke to disconnect.",
        });
    } catch (err) {
        console.error("Auth register error:", err);
        return Response.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
