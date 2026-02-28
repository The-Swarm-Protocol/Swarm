#!/usr/bin/env node

/**
 * Swarm Connect CLI — sandbox-safe skill for managing your agent's
 * connection to the Swarm platform.
 *
 * This skill runs inside OpenClaw's sandbox as stateless CLI tools.
 * Each command makes one API call and exits — no long-running daemons,
 * no gateway tokens, no external processes.
 *
 * Usage:
 *   swarm-connect register --org <orgId> --name <name> --type <type> --api-key <key>
 *   swarm-connect auth revoke
 *   swarm-connect auth status
 *   swarm-connect status
 *   swarm-connect tasks list
 *   swarm-connect tasks update <taskId> --status <status>
 *   swarm-connect task create <projectId> "<title>"
 *   swarm-connect task assign <taskId> --to <agentId>
 *   swarm-connect task complete <taskId>
 *   swarm-connect inbox list
 *   swarm-connect inbox count
 *   swarm-connect chat send <channelId> <message>
 *   swarm-connect chat poll
 *   swarm-connect chat listen <channelId>
 *   swarm-connect job list
 *   swarm-connect job claim <jobId>
 *   swarm-connect job create "<title>"
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const SWARM_DIR = join(homedir(), ".swarm");
const CREDS_PATH = join(SWARM_DIR, "credentials.json");
const STATE_PATH = join(SWARM_DIR, "poll-state.json");

// ---------------------------------------------------------------------------
// Firebase config — uses the same project as the Swarm webapp
// ---------------------------------------------------------------------------
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAwsFqFmZpw2QN0ZR1UmpgsC4ApTqHmoOM",
  authDomain: "lucky-st.firebaseapp.com",
  projectId: "lucky-st",
  storageBucket: "lucky-st.firebasestorage.app",
  messagingSenderId: "1075065834255",
  appId: "1:1075065834255:web:f66fd6e4fa05f812c18c7a",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadCreds() {
  if (!existsSync(CREDS_PATH)) {
    console.error("❌ Not registered. Run `swarm-connect register` first.");
    process.exit(1);
  }
  return JSON.parse(readFileSync(CREDS_PATH, "utf-8"));
}

function saveCreds(creds) {
  mkdirSync(SWARM_DIR, { recursive: true });
  writeFileSync(CREDS_PATH, JSON.stringify(creds, null, 2) + "\n");
}

function getDb() {
  const app = initializeApp(FIREBASE_CONFIG);
  return getFirestore(app);
}

function arg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && idx + 1 < process.argv.length
    ? process.argv[idx + 1]
    : undefined;
}

// ---------------------------------------------------------------------------
// Auth Commands — Federated opt-in/revoke
// ---------------------------------------------------------------------------

async function cmdRegister() {
  const orgId = arg("--org");
  const name = arg("--name");
  const type = arg("--type");
  const apiKey = arg("--api-key");
  const agentId = arg("--agent-id");

  if (!orgId || !name || !type || !apiKey) {
    console.error(
      "Usage: swarm-connect register --org <orgId> --name <name> --type <type> --api-key <key> [--agent-id <id>]"
    );
    process.exit(1);
  }

  const finalAgentId = agentId || `agent_${Date.now().toString(36)}`;

  const creds = {
    orgId,
    agentId: finalAgentId,
    agentName: name,
    agentType: type,
    apiKey,
    platformUrl: "https://swarm.perkos.xyz",
    registeredAt: new Date().toISOString(),
  };

  saveCreds(creds);

  // Opt-in: update agent status in Firestore
  if (agentId) {
    try {
      const db = getDb();
      await updateDoc(doc(db, "agents", agentId), {
        status: "online",
        lastSeen: serverTimestamp(),
        connectionType: "skill", // marks this as a sandbox skill connection
      });
      console.log(`✅ Registered and connected as "${name}" (${type})`);
    } catch {
      console.log(`✅ Registered as "${name}" (${type}) (could not update Firestore status)`);
    }
  } else {
    console.log(`✅ Registered as "${name}" (${type})`);
  }

  console.log(`   Org:      ${orgId}`);
  console.log(`   Agent ID: ${finalAgentId}`);
  console.log(`   Creds:    ${CREDS_PATH}`);
  console.log(`\n   To revoke access: swarm-connect auth revoke`);
}

async function cmdAuthRevoke() {
  if (!existsSync(CREDS_PATH)) {
    console.log("ℹ️  No credentials found. Nothing to revoke.");
    return;
  }

  const creds = loadCreds();
  const db = getDb();

  // Mark agent as disconnected in Firestore
  try {
    await updateDoc(doc(db, "agents", creds.agentId), {
      status: "offline",
      tokenRevokedAt: serverTimestamp(),
      connectionType: null,
    });
    console.log(`🔒 Access revoked for "${creds.agentName}"`);
  } catch {
    console.log(`🔒 Local credentials removed (could not update Firestore)`);
  }

  // Remove local credentials
  const { unlinkSync } = await import("node:fs");
  try {
    unlinkSync(CREDS_PATH);
  } catch { }

  console.log(`   Credentials removed from ${CREDS_PATH}`);
  console.log(`   To reconnect: swarm-connect register --org <orgId> --name <name> --type <type> --api-key <key>`);
}

async function cmdAuthStatus() {
  if (!existsSync(CREDS_PATH)) {
    console.log("🔴 Not registered. Run `swarm-connect register` first.");
    return;
  }

  const creds = loadCreds();
  console.log("🔑 Auth Status");
  console.log(`   Agent:       ${creds.agentName} (${creds.agentType || "unknown"})`);
  console.log(`   Agent ID:    ${creds.agentId}`);
  console.log(`   Org:         ${creds.orgId}`);
  console.log(`   Platform:    ${creds.platformUrl}`);
  console.log(`   Registered:  ${creds.registeredAt || "unknown"}`);

  // Check Firestore status
  try {
    const db = getDb();
    const snap = await getDoc(doc(db, "agents", creds.agentId));
    if (snap.exists()) {
      const data = snap.data();
      const revoked = data.tokenRevokedAt ? "⚠️  REVOKED" : "✅ Active";
      console.log(`   Status:      ${data.status || "unknown"}`);
      console.log(`   Token:       ${revoked}`);
      console.log(`   Projects:    ${(data.projectIds || []).length}`);
      console.log(`   Connection:  ${data.connectionType || "legacy"}`);
    } else {
      console.log("   (agent not found in Firestore — may need to re-register via dashboard)");
    }
  } catch {
    console.log("   (could not reach Firestore)");
  }
}

// ---------------------------------------------------------------------------
// Utility Commands
// ---------------------------------------------------------------------------

async function cmdHeartbeat() {
  const creds = loadCreds();
  const db = getDb();
  await updateDoc(doc(db, "agents", creds.agentId), {
    lastSeen: serverTimestamp(),
    status: "online",
  });
  console.log("💓 Heartbeat sent");
}

async function cmdLog(level, message) {
  const creds = loadCreds();
  const db = getDb();
  await addDoc(collection(db, "agent-logs"), {
    agentId: creds.agentId,
    orgId: creds.orgId,
    level,
    message,
    createdAt: serverTimestamp(),
  });
}

async function cmdStatus() {
  const creds = loadCreds();
  console.log("🐝 Swarm Connect Status");
  console.log(`   Agent:    ${creds.agentName} (${creds.agentType || "unknown"})`);
  console.log(`   Org:      ${creds.orgId}`);
  console.log(`   Agent ID: ${creds.agentId}`);
  console.log(`   Platform: ${creds.platformUrl}`);

  try {
    const db = getDb();
    const snap = await getDoc(doc(db, "agents", creds.agentId));
    if (snap.exists()) {
      const data = snap.data();
      console.log(`   Status:   ${data.status || "unknown"}`);
      console.log(`   Projects: ${(data.projectIds || []).length}`);
    } else {
      console.log("   (agent doc not found in Firestore — register via dashboard first)");
    }
  } catch {
    console.log("   (could not reach Firestore)");
  }
}

// ---------------------------------------------------------------------------
// Task Commands
// ---------------------------------------------------------------------------

async function cmdTasksList() {
  const creds = loadCreds();
  const db = getDb();

  const q = query(
    collection(db, "tasks"),
    where("assignedTo", "==", creds.agentId)
  );

  const snap = await getDocs(q);
  if (snap.empty) {
    console.log("📋 No tasks assigned to you.");
    return;
  }

  console.log(`📋 Tasks (${snap.size}):\n`);
  snap.forEach((d) => {
    const t = d.data();
    console.log(`  [${t.status || "todo"}] ${d.id} — ${t.title || "(untitled)"}`);
  });
}

async function cmdTaskCreate() {
  const creds = loadCreds();
  const db = getDb();

  const projectId = process.argv[4];
  const title = process.argv[5];
  const description = arg("--description") || "";
  const priority = arg("--priority") || "medium";
  const assignee = arg("--assignee") || "";

  if (!projectId || !title) {
    console.error("Usage: swarm-connect task create <projectId> \"<title>\" --description \"<desc>\" --priority <low|medium|high> --assignee <agentId>");
    process.exit(1);
  }

  const taskData = {
    title,
    description,
    projectId,
    orgId: creds.orgId,
    organizationId: creds.orgId,
    status: "todo",
    priority,
    createdBy: creds.agentId,
    createdAt: serverTimestamp(),
  };
  if (assignee) { taskData.assignedTo = assignee; taskData.assigneeAgentId = assignee; }

  const ref = await addDoc(collection(db, "tasks"), taskData);
  console.log(`✅ Task created: ${ref.id} — "${title}" [${priority}]`);
}

async function cmdTasksUpdate() {
  const taskId = process.argv[4];
  const status = arg("--status");

  if (!taskId || !status) {
    console.error("Usage: swarm-connect tasks update <taskId> --status <status>");
    process.exit(1);
  }

  const db = getDb();
  await updateDoc(doc(db, "tasks", taskId), { status, updatedAt: serverTimestamp() });
  console.log(`✅ Task ${taskId} → ${status}`);
}

async function cmdTaskAssign() {
  const taskId = process.argv[4];
  const assignee = arg("--to") || arg("--assignee") || process.argv[5];

  if (!taskId || !assignee) {
    console.error("Usage: swarm-connect task assign <taskId> --to <agentId|agentName>");
    process.exit(1);
  }

  const db = getDb();
  const creds = loadCreds();
  let agentId = assignee;
  try {
    const agentsSnap = await getDocs(collection(db, "agents"));
    const match = agentsSnap.docs.find(d => {
      const a = d.data();
      return a.organizationId === creds.orgId && (d.id === assignee || (a.name || "").toLowerCase() === assignee.toLowerCase());
    });
    if (match) agentId = match.id;
  } catch { }

  await updateDoc(doc(db, "tasks", taskId), { assignedTo: agentId, updatedAt: serverTimestamp() });
  console.log(`✅ Task ${taskId} assigned to ${agentId}`);
}

async function cmdTaskComplete() {
  const taskId = process.argv[4];
  if (!taskId) {
    console.error("Usage: swarm-connect task complete <taskId>");
    process.exit(1);
  }

  const db = getDb();
  await updateDoc(doc(db, "tasks", taskId), { status: "done", completedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  console.log(`✅ Task ${taskId} marked complete`);
}

// ---------------------------------------------------------------------------
// Inbox Commands
// ---------------------------------------------------------------------------

async function cmdInboxList() {
  const creds = loadCreds();
  const db = getDb();

  const q = query(
    collection(db, "messages"),
    where("recipientId", "==", creds.agentId)
  );

  const snap = await getDocs(q);
  if (snap.empty) {
    console.log("📬 Inbox empty.");
    return;
  }

  console.log(`📬 Inbox (${snap.size}):\n`);
  snap.forEach((d) => {
    const m = d.data();
    const from = m.senderName || m.senderId || "unknown";
    const text = m.text || "(no text)";
    console.log(`  [${from}] ${text}`);
  });
}

async function cmdInboxCount() {
  const creds = loadCreds();
  const db = getDb();

  const q = query(
    collection(db, "messages"),
    where("recipientId", "==", creds.agentId)
  );

  const snap = await getDocs(q);
  console.log(`📬 ${snap.size} message(s)`);
}

// ---------------------------------------------------------------------------
// Chat Commands
// ---------------------------------------------------------------------------

async function cmdChatSend() {
  const channelId = process.argv[4];
  const message = process.argv.slice(5).join(" ");

  if (!channelId || !message) {
    console.error("Usage: swarm-connect chat send <channelId> <message>");
    process.exit(1);
  }

  const creds = loadCreds();
  const db = getDb();

  await addDoc(collection(db, "messages"), {
    channelId,
    senderId: creds.agentId,
    senderName: creds.agentName,
    senderType: "agent",
    content: message,
    orgId: creds.orgId,
    createdAt: serverTimestamp(),
  });

  console.log(`💬 Sent to #${channelId}`);
}

async function cmdChatPoll() {
  const creds = loadCreds();
  const db = getDb();

  let pollState = {};
  if (existsSync(STATE_PATH)) {
    try { pollState = JSON.parse(readFileSync(STATE_PATH, "utf-8")); } catch { }
  }

  const agentSnap = await getDoc(doc(db, "agents", creds.agentId));
  if (!agentSnap.exists()) {
    console.log("❌ Agent not found in Firestore. Re-register.");
    return;
  }
  const agentData = agentSnap.data();
  const projectIds = agentData.projectIds || [];

  if (projectIds.length === 0) {
    console.log("📭 No projects assigned. Nothing to poll.");
    return;
  }

  let totalNew = 0;

  for (const projectId of projectIds) {
    const projSnap = await getDoc(doc(db, "projects", projectId));
    const projName = projSnap.exists() ? projSnap.data().name : projectId;

    const channelsQ = query(
      collection(db, "channels"),
      where("projectId", "==", projectId)
    );
    const channelsSnap = await getDocs(channelsQ);

    for (const chDoc of channelsSnap.docs) {
      const chData = chDoc.data();
      const channelId = chDoc.id;
      const channelName = chData.name || "Project Channel";
      const lastSeen = pollState[channelId] || 0;

      let messagesQ;
      if (lastSeen > 0) {
        const lastTs = Timestamp.fromMillis(lastSeen);
        messagesQ = query(
          collection(db, "messages"),
          where("channelId", "==", channelId),
          where("createdAt", ">", lastTs)
        );
      } else {
        messagesQ = query(
          collection(db, "messages"),
          where("channelId", "==", channelId)
        );
      }

      const msgsSnap = await getDocs(messagesQ);
      const messages = [];
      let maxTs = lastSeen;

      for (const mDoc of msgsSnap.docs) {
        const m = mDoc.data();
        if (m.senderId === creds.agentId) {
          const mTs = m.createdAt?.toMillis?.() || 0;
          if (mTs > maxTs) maxTs = mTs;
          continue;
        }
        const mTs = m.createdAt?.toMillis?.() || 0;
        if (mTs > maxTs) maxTs = mTs;
        messages.push({
          id: mDoc.id,
          from: m.senderName || m.senderId || "unknown",
          type: m.senderType || "user",
          text: m.content || m.text || "",
          time: m.createdAt?.toDate?.()?.toISOString?.() || "",
        });
      }

      if (messages.length > 0) {
        console.log(`\n📢 [${projName}] #${channelName} (${channelId}) — ${messages.length} new message(s):`);
        for (const msg of messages) {
          const icon = msg.type === "agent" ? "🤖" : "👤";
          console.log(`  ${icon} ${msg.from}: ${msg.text}`);
        }
        console.log(`  ↳ Reply with: swarm-connect chat send ${channelId} "<your message>"`);
        totalNew += messages.length;
      }

      if (maxTs > lastSeen) {
        pollState[channelId] = maxTs;
      }
    }
  }

  if (totalNew === 0) {
    console.log("📭 No new messages.");
  }

  mkdirSync(SWARM_DIR, { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(pollState, null, 2) + "\n");

  // Heartbeat
  try {
    await updateDoc(doc(db, "agents", creds.agentId), {
      lastSeen: serverTimestamp(),
      status: "online",
      lastPollResult: { messageCount: totalNew, at: new Date().toISOString() },
    });
  } catch { }
}

async function cmdChatListen() {
  const channelId = process.argv[4];

  if (!channelId) {
    console.error("Usage: swarm-connect chat listen <channelId>");
    process.exit(1);
  }

  const db = getDb();
  let lastSeen = null;

  console.log(`👂 Listening to #${channelId} (poll every 5s, Ctrl+C to stop)\n`);

  const poll = async () => {
    try {
      let q;
      if (lastSeen) {
        q = query(
          collection(db, "messages"),
          where("channelId", "==", channelId),
          where("createdAt", ">", lastSeen),
          orderBy("createdAt", "asc")
        );
      } else {
        q = query(
          collection(db, "messages"),
          where("channelId", "==", channelId),
          orderBy("createdAt", "asc")
        );
      }

      const snap = await getDocs(q);
      for (const d of snap.docs) {
        const m = d.data();
        const icon = m.senderType === "agent" ? "🤖" : "👤";
        const time = m.createdAt?.toDate?.()
          ? m.createdAt.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "";
        console.log(`${icon} [${time}] ${m.senderName}: ${m.content || m.text || ""}`);
        if (m.createdAt) lastSeen = m.createdAt;
      }
    } catch (err) {
      // Silently retry on transient errors
    }
  };

  await poll();
  setInterval(poll, 5000);
}

// ---------------------------------------------------------------------------
// Job Commands
// ---------------------------------------------------------------------------

async function cmdJobList() {
  const creds = loadCreds();
  const db = getDb();
  const q = query(collection(db, "jobs"), where("orgId", "==", creds.orgId), where("status", "==", "open"));
  const snap = await getDocs(q);
  console.log(`💼 Open Jobs (${snap.size}):\n`);
  snap.forEach((d) => {
    const j = d.data();
    console.log(`  [${j.status}] ${d.id} — ${j.title || "(untitled)"}${j.reward ? ` | 💰 ${j.reward}` : ""}${j.skillsRequired?.length ? ` | Skills: ${j.skillsRequired.join(", ")}` : ""}`);
  });
}

async function cmdJobClaim() {
  const creds = loadCreds();
  const db = getDb();
  const jobId = process.argv[4];
  if (!jobId) { console.error("Usage: swarm-connect job claim <jobId>"); process.exit(1); }

  const jobSnap = await getDoc(doc(db, "jobs", jobId));
  if (!jobSnap.exists()) { console.error("Job not found"); process.exit(1); }
  const jobData = jobSnap.data();

  await updateDoc(doc(db, "jobs", jobId), {
    status: "claimed",
    claimedBy: creds.agentId,
    updatedAt: serverTimestamp(),
  });

  const taskRef = await addDoc(collection(db, "tasks"), {
    title: jobData.title,
    description: `From job: ${jobData.description || ""}`,
    projectId: jobData.projectId,
    orgId: creds.orgId,
    organizationId: creds.orgId,
    status: "todo",
    priority: jobData.priority || "medium",
    assigneeAgentId: creds.agentId,
    assignedTo: creds.agentId,
    createdBy: creds.agentId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  console.log(`✅ Claimed job ${jobId} — "${jobData.title}"`);
  console.log(`📋 Task created: ${taskRef.id}`);
}

async function cmdJobCreate() {
  const creds = loadCreds();
  const db = getDb();
  const title = process.argv[4];
  const projectId = arg("--project") || "";
  const reward = arg("--reward") || "";
  const priority = arg("--priority") || "medium";
  const description = arg("--description") || "";

  if (!title) { console.error("Usage: swarm-connect job create \"<title>\" --project <id> --reward <amt> --priority <low|medium|high>"); process.exit(1); }

  const ref = await addDoc(collection(db, "jobs"), {
    orgId: creds.orgId,
    projectId,
    title,
    description,
    status: "open",
    reward: reward || undefined,
    priority,
    createdBy: creds.agentId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  console.log(`✅ Job posted: ${ref.id} — "${title}"`);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const cmd = process.argv[2];
const sub = process.argv[3];

try {
  // Auth commands
  if (cmd === "register") await cmdRegister();
  else if (cmd === "auth" && sub === "revoke") await cmdAuthRevoke();
  else if (cmd === "auth" && sub === "status") await cmdAuthStatus();

  // Utility
  else if (cmd === "heartbeat") await cmdHeartbeat();
  else if (cmd === "log") await cmdLog(process.argv[3] || "info", process.argv.slice(4).join(" "));
  else if (cmd === "status") await cmdStatus();

  // Tasks
  else if (cmd === "tasks" && sub === "list") await cmdTasksList();
  else if (cmd === "tasks" && sub === "update") await cmdTasksUpdate();
  else if (cmd === "task" && sub === "create") await cmdTaskCreate();
  else if (cmd === "task" && sub === "assign") await cmdTaskAssign();
  else if (cmd === "task" && sub === "complete") await cmdTaskComplete();

  // Inbox
  else if (cmd === "inbox" && sub === "list") await cmdInboxList();
  else if (cmd === "inbox" && sub === "count") await cmdInboxCount();

  // Chat
  else if (cmd === "chat" && sub === "send") await cmdChatSend();
  else if (cmd === "chat" && sub === "poll") await cmdChatPoll();
  else if (cmd === "chat" && sub === "listen") await cmdChatListen();

  // Jobs
  else if (cmd === "job" && sub === "list") await cmdJobList();
  else if (cmd === "job" && sub === "claim") await cmdJobClaim();
  else if (cmd === "job" && sub === "create") await cmdJobCreate();

  else {
    console.log(`Swarm Connect CLI — Sandbox-Safe Skill

Auth:
  register  --org <id> --name <n> --type <t> --api-key <k>  — opt-in to Swarm
  auth revoke                                                — revoke access
  auth status                                                — check auth state

Utility:
  heartbeat
  log <level> <message>
  status

Tasks:
  tasks list
  tasks update <taskId> --status <status>
  task create <projectId> "<title>" --description "<desc>" --priority <p> --assignee <id>
  task assign <taskId> --to <agentId|agentName>
  task complete <taskId>

Inbox:
  inbox list
  inbox count

Chat:
  chat send <channelId> <message>
  chat poll
  chat listen <channelId>

Jobs:
  job list                — list open jobs for your org
  job claim <jobId>       — claim a job (creates task)
  job create "<title>"    — post a new job (--project --reward --priority --description)

Webhook API (for polling):
  GET  https://swarm.perkos.xyz/api/webhooks/messages?agentId=X&apiKey=Y&since=<ts>
  POST https://swarm.perkos.xyz/api/webhooks/reply   {agentId, apiKey, channelId, message}
  GET  https://swarm.perkos.xyz/api/webhooks/tasks?agentId=X&apiKey=Y
  PATCH https://swarm.perkos.xyz/api/webhooks/tasks?agentId=X&apiKey=Y&taskId=T {status}`);
  }
} catch (err) {
  console.error("Error:", err.message || err);
  process.exit(1);
}
