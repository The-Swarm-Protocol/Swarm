import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import crypto from "crypto";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

// ── Config ──────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "8400", 10);
const JWT_SECRET =
  process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const ACCESS_TTL = "15m";
const REFRESH_TTL = "1h";
const RATE_LIMIT_WINDOW = 60_000; // 1 min
const RATE_LIMIT_MAX = 30;
const MAX_CONNECTIONS_PER_AGENT = 5;

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAwsFqFmZpw2QN0ZR1UmpgsC4ApTqHmoOM",
  authDomain: "lucky-st.firebaseapp.com",
  projectId: "lucky-st",
  storageBucket: "lucky-st.firebasestorage.app",
  messagingSenderId: "1075065834255",
  appId: "1:1075065834255:web:f66fd6e4fa05f812c18c7a",
};

const firebaseApp = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(firebaseApp);

// ── Logging ─────────────────────────────────────────────────────────────────
function log(level, msg, meta = {}) {
  const ts = new Date().toISOString();
  const extra = Object.keys(meta).length
    ? " " + JSON.stringify(meta)
    : "";
  console.log(`[${ts}] [${level.toUpperCase()}] ${msg}${extra}`);
}

// ── State ───────────────────────────────────────────────────────────────────
// agentId → Set<ws>
const agentConnections = new Map();
// channelId → Set<ws>
const channelSubscribers = new Map();
// ws → { agentId, orgId, agentName, agentType, channels: Set }
const wsState = new Map();
// agentId → { timestamps: number[] }
const rateLimits = new Map();

// ── Helpers ─────────────────────────────────────────────────────────────────
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function signAccess(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TTL });
}

function signRefresh(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TTL });
}

function checkRateLimit(agentId) {
  const now = Date.now();
  let entry = rateLimits.get(agentId);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimits.set(agentId, entry);
  }
  entry.timestamps = entry.timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
  if (entry.timestamps.length >= RATE_LIMIT_MAX) return false;
  entry.timestamps.push(now);
  return true;
}

function broadcastToChannel(channelId, message, excludeWs = null) {
  const subs = channelSubscribers.get(channelId);
  if (!subs) return;
  const data = typeof message === "string" ? message : JSON.stringify(message);
  for (const ws of subs) {
    if (ws !== excludeWs && ws.readyState === 1) {
      ws.send(data);
    }
  }
}

function subscribeToChannel(ws, channelId) {
  const state = wsState.get(ws);
  if (!state) return;
  if (!channelSubscribers.has(channelId)) {
    channelSubscribers.set(channelId, new Set());
  }
  channelSubscribers.get(channelId).add(ws);
  state.channels.add(channelId);
}

function unsubscribeFromChannel(ws, channelId) {
  const state = wsState.get(ws);
  if (!state) return;
  const subs = channelSubscribers.get(channelId);
  if (subs) {
    subs.delete(ws);
    if (subs.size === 0) channelSubscribers.delete(channelId);
  }
  state.channels.delete(channelId);
}

async function persistMessage(agentId, agentName, channelId, content, type) {
  try {
    await addDoc(collection(db, "messages"), {
      channelId,
      senderId: agentId,
      senderName: agentName || agentId,
      senderType: "agent",
      content,
      type,
      createdAt: serverTimestamp(),
      ts: Date.now(),
    });
  } catch (err) {
    log("error", "Failed to persist message", { channelId, error: err.message });
  }
}

async function getAgentChannels(agentId) {
  try {
    // Look up agent → projectIds → channels
    const agentSnap = await getDoc(doc(db, "agents", agentId));
    if (!agentSnap.exists()) return [];
    const agentData = agentSnap.data();
    const projectIds = agentData.projectIds || [];
    if (projectIds.length === 0) return [];

    const channelsQuery = query(
      collection(db, "channels"),
      where("projectId", "in", projectIds.slice(0, 10))
    );
    const snap = await getDocs(channelsQuery);
    return snap.docs.map((d) => d.id);
  } catch (err) {
    log("error", "Failed to fetch agent channels", { agentId, error: err.message });
    return [];
  }
}

// ── Express ─────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// Auth middleware for protected routes
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }
  try {
    req.agent = verifyToken(authHeader.slice(7));
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// POST /auth/token
app.post("/auth/token", async (req, res) => {
  const { agentId, apiKey } = req.body || {};
  if (!agentId || !apiKey) {
    log("warn", "Auth attempt missing fields");
    return res.status(400).json({ error: "agentId and apiKey required" });
  }
  try {
    const agentDoc = await getDoc(doc(db, "agents", agentId));
    if (!agentDoc.exists()) {
      log("warn", "Auth failed — agent not found", { agentId });
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const agentData = agentDoc.data();
    if (agentData.apiKey !== apiKey) {
      log("warn", "Auth failed — bad apiKey", { agentId });
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const payload = {
      agentId,
      orgId: agentData.orgId || null,
      agentName: agentData.name || agentId,
      agentType: agentData.type || "agent",
    };
    const accessToken = signAccess(payload);
    const refreshToken = signRefresh({ ...payload, refresh: true });
    log("info", "Token issued", { agentId });
    res.json({ accessToken, refreshToken });
  } catch (err) {
    log("error", "Auth error", { error: err.message });
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /auth/refresh
app.post("/auth/refresh", (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: "refreshToken required" });
  try {
    const decoded = verifyToken(refreshToken);
    if (!decoded.refresh) return res.status(401).json({ error: "Not a refresh token" });
    const { agentId, orgId, agentName, agentType } = decoded;
    const accessToken = signAccess({ agentId, orgId, agentName, agentType });
    log("info", "Token refreshed", { agentId });
    res.json({ accessToken });
  } catch {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
});

// GET /health
app.get("/health", (_req, res) => {
  let totalConnections = 0;
  for (const conns of agentConnections.values()) totalConnections += conns.size;
  res.json({
    status: "ok",
    uptime: process.uptime(),
    agents: agentConnections.size,
    connections: totalConnections,
    channels: channelSubscribers.size,
    ts: new Date().toISOString(),
  });
});

// GET /agents/online
app.get("/agents/online", authMiddleware, (_req, res) => {
  const online = [];
  for (const [agentId, conns] of agentConnections) {
    if (conns.size > 0) {
      const first = conns.values().next().value;
      const state = wsState.get(first);
      online.push({
        agentId,
        agentName: state?.agentName || agentId,
        agentType: state?.agentType || "agent",
        connections: conns.size,
      });
    }
  }
  res.json({ agents: online });
});

// ── HTTP + WS Server ────────────────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get("token");
  if (!token) {
    log("warn", "WS upgrade rejected — no token");
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }
  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    log("warn", "WS upgrade rejected — invalid token");
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  // Check max connections
  const existing = agentConnections.get(decoded.agentId);
  if (existing && existing.size >= MAX_CONNECTIONS_PER_AGENT) {
    log("warn", "WS upgrade rejected — max connections", { agentId: decoded.agentId });
    socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    ws._agentPayload = decoded;
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", async (ws, _req) => {
  const { agentId, orgId, agentName, agentType } = ws._agentPayload;
  delete ws._agentPayload;

  // Track connection
  if (!agentConnections.has(agentId)) agentConnections.set(agentId, new Set());
  agentConnections.get(agentId).add(ws);

  const state = { agentId, orgId, agentName, agentType, channels: new Set() };
  wsState.set(ws, state);

  log("info", "Agent connected", { agentId, agentName });

  // Auto-subscribe to channels
  const channelIds = await getAgentChannels(agentId);
  for (const chId of channelIds) {
    subscribeToChannel(ws, chId);
    broadcastToChannel(chId, {
      type: "agent:online",
      agentId,
      agentName,
      ts: Date.now(),
    }, ws);
  }

  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }

    // Rate limit
    if (!checkRateLimit(agentId)) {
      ws.send(JSON.stringify({ error: "Rate limit exceeded" }));
      return;
    }

    const { type, channelId, content } = msg;

    if (type === "subscribe" && channelId) {
      subscribeToChannel(ws, channelId);
      log("info", "Subscribed", { agentId, channelId });
      ws.send(JSON.stringify({ type: "subscribed", channelId }));
      return;
    }

    if (type === "unsubscribe" && channelId) {
      unsubscribeFromChannel(ws, channelId);
      log("info", "Unsubscribed", { agentId, channelId });
      ws.send(JSON.stringify({ type: "unsubscribed", channelId }));
      return;
    }

    if (!channelId) {
      ws.send(JSON.stringify({ error: "channelId required" }));
      return;
    }

    if (!["message", "typing", "status", "task"].includes(type)) {
      ws.send(JSON.stringify({ error: "Invalid message type" }));
      return;
    }

    const outgoing = {
      id: uuidv4(),
      type,
      channelId,
      agentId,
      agentName,
      content,
      ts: Date.now(),
    };

    broadcastToChannel(channelId, outgoing, ws);
    log("info", "Message routed", { type, channelId, agentId });

    // Persist chat messages and tasks to Firestore
    if (type === "message" || type === "task") {
      await persistMessage(agentId, agentName, channelId, content, type);
    }
  });

  ws.on("close", () => {
    log("info", "Agent disconnected", { agentId, agentName });

    // Broadcast offline to all subscribed channels
    for (const chId of state.channels) {
      broadcastToChannel(chId, {
        type: "agent:offline",
        agentId,
        agentName,
        ts: Date.now(),
      }, ws);
      const subs = channelSubscribers.get(chId);
      if (subs) {
        subs.delete(ws);
        if (subs.size === 0) channelSubscribers.delete(chId);
      }
    }

    // Remove from agent pool
    const conns = agentConnections.get(agentId);
    if (conns) {
      conns.delete(ws);
      if (conns.size === 0) agentConnections.delete(agentId);
    }
    wsState.delete(ws);
  });

  ws.on("error", (err) => {
    log("error", "WebSocket error", { agentId, error: err.message });
  });
});

// ── Start ───────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  log("info", `Swarm Hub listening on port ${PORT}`);
  log("info", `Health: http://localhost:${PORT}/health`);
  if (!process.env.JWT_SECRET) {
    log("warn", "JWT_SECRET not set — using random secret (tokens won't survive restart)");
  }
});
