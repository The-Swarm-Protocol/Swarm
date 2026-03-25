/**
 * POST /api/mods/gemini/chat — Chat with Gemini Live Agent
 *
 * Body: { message: string, image?: string (base64), history?: { role, text }[] }
 * Returns: { ok: true, reply: string, demo: false } or { ok: true, reply: string, demo: true }
 */
import { NextRequest } from "next/server";
import { getWalletAddress } from "@/lib/auth-guard";
import { chat, isGeminiConfigured } from "@/lib/mods/gemini/client";
import { rateLimit } from "@/app/api/v1/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const limited = await rateLimit(`gemini-chat:${ip}`);
  if (limited) return limited;

  const wallet = getWalletAddress(req);
  if (!wallet) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = body.message as string | undefined;
  if (!message || typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  if (message.length > 10000) {
    return Response.json({ error: "Message too long (max 10,000 chars)" }, { status: 400 });
  }

  // Check if Gemini API is configured
  if (!isGeminiConfigured()) {
    return Response.json({
      ok: true,
      reply: "Gemini API is not configured. Set the `GOOGLE_GENAI_API_KEY` environment variable to enable live AI responses.",
      demo: true,
    });
  }

  const image = body.image as string | undefined;
  const history = body.history as { role: "user" | "model"; text: string }[] | undefined;

  try {
    const reply = await chat(message, image, history);
    return Response.json({ ok: true, reply, demo: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gemini API error";
    console.error("Gemini chat error:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
