/**
 * GET /api/v1/messages?agent=<agentId>&since=<timestampMs>&sig=<signature>
 *
 * Poll for new messages. Signature-verified.
 * Signature = Ed25519.sign("GET:/v1/messages:<since_timestamp>")
 */
import { NextRequest } from "next/server";
import { verifyAgentRequest, isTimestampFresh, unauthorized } from "../verify";
import { db } from "@/lib/firebase";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    Timestamp,
} from "firebase/firestore";

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const agentId = searchParams.get("agent");
    const sinceParam = searchParams.get("since") || "0";
    const sig = searchParams.get("sig");

    if (!agentId || !sig) {
        return unauthorized("agent and sig parameters are required");
    }

    // Verify signature: agent signed "GET:/v1/messages:<since>"
    const signedMessage = `GET:/v1/messages:${sinceParam}`;
    const agent = await verifyAgentRequest(agentId, signedMessage, sig);
    if (!agent) return unauthorized();

    // Check timestamp freshness
    const sinceMs = parseInt(sinceParam, 10);
    if (sinceMs > 0 && !isTimestampFresh(sinceMs)) {
        return unauthorized("Request timestamp too stale (>5 min)");
    }

    try {
        // Get agent's projects
        const agentSnap = await getDoc(doc(db, "agents", agent.agentId));
        if (!agentSnap.exists()) {
            return Response.json({ error: "Agent not found" }, { status: 404 });
        }
        const projectIds: string[] = agentSnap.data().projectIds || [];

        if (projectIds.length === 0) {
            return Response.json({ messages: [], channels: [] });
        }

        // Get channels for agent's projects
        const channelIds: string[] = [];
        const channelMeta: Record<string, { name: string; projectId: string }> = {};

        for (const projectId of projectIds.slice(0, 10)) {
            const channelsQ = query(
                collection(db, "channels"),
                where("projectId", "==", projectId)
            );
            const channelsSnap = await getDocs(channelsQ);
            for (const chDoc of channelsSnap.docs) {
                channelIds.push(chDoc.id);
                channelMeta[chDoc.id] = {
                    name: chDoc.data().name || "Channel",
                    projectId,
                };
            }
        }

        if (channelIds.length === 0) {
            return Response.json({ messages: [], channels: [] });
        }

        // Fetch messages
        const messages: Array<{
            id: string;
            channelId: string;
            channelName: string;
            from: string;
            fromType: string;
            text: string;
            timestamp: number;
        }> = [];

        for (const channelId of channelIds) {
            let messagesQ;
            if (sinceMs > 0) {
                const sinceTs = Timestamp.fromMillis(sinceMs);
                messagesQ = query(
                    collection(db, "messages"),
                    where("channelId", "==", channelId),
                    where("createdAt", ">", sinceTs),
                    orderBy("createdAt", "asc")
                );
            } else {
                messagesQ = query(
                    collection(db, "messages"),
                    where("channelId", "==", channelId),
                    orderBy("createdAt", "asc")
                );
            }

            const msgsSnap = await getDocs(messagesQ);
            for (const mDoc of msgsSnap.docs) {
                const m = mDoc.data();
                if (m.senderId === agent.agentId) continue;

                messages.push({
                    id: mDoc.id,
                    channelId,
                    channelName: channelMeta[channelId]?.name || channelId,
                    from: m.senderName || m.senderId || "unknown",
                    fromType: m.senderType || "user",
                    text: m.content || m.text || "",
                    timestamp: m.createdAt?.toMillis?.() || m.ts || 0,
                });
            }
        }

        // Cap at 100
        const capped = messages.slice(-100);

        return Response.json({
            messages: capped,
            channels: Object.entries(channelMeta).map(([id, meta]) => ({
                id,
                ...meta,
            })),
            polledAt: Date.now(),
        });
    } catch (err) {
        console.error("v1/messages error:", err);
        return Response.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
