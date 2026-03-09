/**
 * Server-side thirdweb auth instance.
 *
 * Uses `createAuth` from `thirdweb/auth` to generate login payloads
 * and verify signed payloads. This replaces our custom viem-based
 * nonce/verifyMessage flow and is the official thirdweb approach.
 *
 * The ConnectButton `auth` prop on the client wires into these endpoints:
 *   - getLoginPayload  → POST /api/auth/payload
 *   - doLogin          → POST /api/auth/verify
 *   - isLoggedIn       → GET  /api/auth/session
 *   - doLogout         → POST /api/auth/logout
 */
import { createAuth } from "thirdweb/auth";
import { createThirdwebClient } from "thirdweb";

const client = createThirdwebClient({
  // Server-side: use secretKey if available, otherwise clientId for EOA-only verification
  ...(process.env.THIRDWEB_SECRET_KEY
    ? { secretKey: process.env.THIRDWEB_SECRET_KEY }
    : { clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "510999ec2be00a99e36ab07b36f15a72" }),
});

export const thirdwebAuth = createAuth({
  domain: process.env.NEXT_PUBLIC_APP_DOMAIN || "localhost:3000",
  client,
  login: {
    statement: "Sign in to Swarm — this does not trigger a blockchain transaction or cost gas.",
    // Payload valid for 10 minutes
    payloadExpirationTimeSeconds: 600,
  },
});
