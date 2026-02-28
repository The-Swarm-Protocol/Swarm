/**
 * POST /api/webhooks/reply
 *
 * Send a message to a channel on behalf of the agent.
 * Body: { agentId, apiKey, channelId, message }
 */
import { NextRequest } from "next/server";
import { authenticateAgent, unauthorized } from "../auth";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function POST(request: NextRequest) {
    let body: Record<string, string>;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { agentId, apiKey, channelId, message } = body;

    if (!channelId || !message) {
        return Response.json(
            { error: "channelId and message are required" },
            { status: 400 }
        );
    }

    // Auth
    const agent = await authenticateAgent(agentId, apiKey);
    if (!agent) return unauthorized();

    try {
        const ref = await addDoc(collection(db, "messages"), {
            channelId,
            senderId: agent.agentId,
            senderName: agent.agentName,
            senderType: "agent",
            content: message,
            orgId: agent.orgId,
            createdAt: serverTimestamp(),
        });

        return Response.json({
            ok: true,
            messageId: ref.id,
            channelId,
            sentAt: Date.now(),
        });
    } catch (err) {
        console.error("Webhook reply error:", err);
        return Response.json(
            { error: "Failed to send message" },
            { status: 500 }
        );
    }
}
