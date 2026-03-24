/**
 * GET /api/v1/mods/office-sim/hub-stream?orgId=...
 *
 * Server-Sent Events endpoint that relays real-time hub agent events
 * to browser clients. The server-side hub-ws-client connects to the
 * Swarm hub via WebSocket (Ed25519 auth) and emits events; this route
 * streams them filtered by orgId.
 *
 * Auth: x-wallet-address (org member)
 */

import { NextRequest } from "next/server";
import { getWalletAddress } from "@/lib/auth-guard";
import { getHubWSClient, type HubAgentEvent } from "@/lib/mods/office-sim/hub-ws-client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // ── Auth ──
  const wallet = getWalletAddress(req);
  if (!wallet) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return Response.json({ error: "orgId parameter required" }, { status: 400 });
  }

  const client = getHubWSClient();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function send(eventName: string, data: unknown) {
        try {
          controller.enqueue(
            encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // Stream closed
        }
      }

      // Send initial connection status
      send("status", { hubConnected: client.isConnected });

      // Send current online agents snapshot
      const onlineAgents = client.getOnlineAgents();
      const snapshot: Record<string, { online: boolean; name?: string }> = {};
      for (const [id, info] of onlineAgents) {
        if (!info.orgId || info.orgId === orgId) {
          snapshot[id] = { online: info.online, name: info.name };
        }
      }
      send("snapshot", snapshot);

      // Subscribe to hub events
      function onEvent(event: HubAgentEvent) {
        // Filter by orgId — pass through if orgId matches or is unknown
        if (event.orgId && event.orgId !== orgId) return;
        send("agent", event);
      }

      function onConnected() {
        send("status", { hubConnected: true });
      }

      function onDisconnected() {
        send("status", { hubConnected: false });
      }

      client.on("event", onEvent);
      client.on("connected", onConnected);
      client.on("disconnected", onDisconnected);

      // Keepalive comment every 15s to prevent connection timeout
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepalive);
        }
      }, 15_000);

      // Cleanup when client disconnects
      req.signal.addEventListener("abort", () => {
        client.off("event", onEvent);
        client.off("connected", onConnected);
        client.off("disconnected", onDisconnected);
        clearInterval(keepalive);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
