/**
 * GET /api/auth/session
 * Returns the current session state from the httpOnly cookie.
 * Returns: { authenticated: true, address, role } or { authenticated: false }
 */
import { validateSession } from "@/lib/session";

export async function GET() {
  try {
    console.log("[auth/session] 🔍 GET request received");
    const session = await validateSession();

    console.log("[auth/session] Validated session:", session ? {
      address: session.sub,
      role: session.role,
      sid: session.sid
    } : "null");

    if (!session) {
      console.log("[auth/session] ❌ No valid session found");
      return Response.json({ authenticated: false });
    }

    console.log("[auth/session] ✅ Returning authenticated session");
    return Response.json({
      authenticated: true,
      address: session.sub,
      role: session.role,
      sessionId: session.sid,
    });
  } catch (err) {
    console.error("[auth/session] ❌ Error:", err);
    return Response.json({ authenticated: false });
  }
}
