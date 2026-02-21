import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { AgentType, MarketType } from "./mock-data";

// ─── Types ──────────────────────────────────────────────

export interface FirestoreTeam {
  id?: string;
  name: string;
  description?: string;
  walletAddress: string;
  createdAt?: unknown;
}

export interface FirestoreSwarm {
  id?: string;
  name: string;
  description: string;
  status: "active" | "paused";
  agentIds: string[];
  teamId: string;
  createdAt: number;
}

export interface FirestoreAgent {
  id?: string;
  name: string;
  type: AgentType;
  description: string;
  capabilities: string[];
  status: "online" | "offline";
  winRate: number;
  totalPredictions: number;
  teamId: string;
  createdAt: number;
}

export interface FirestoreMission {
  id?: string;
  title: string;
  description: string;
  status: "pending" | "active" | "resolved";
  priority: "low" | "normal" | "high" | "urgent";
  marketType: MarketType;
  assigneeId: string | null;
  swarmId: string;
  teamId: string;
  prediction: {
    market: string;
    position: string;
    confidence: number;
    stake: number;
    odds: number;
  } | null;
  outcome: {
    result: "win" | "loss";
    pnl: number;
    resolvedAt: number;
  } | null;
  targetDate: number;
  createdAt: number;
  updatedAt: number;
}

export interface FirestoreMessage {
  id?: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderType: "agent" | "operator";
  content: string;
  timestamp: number;
  teamId: string;
}

export interface FirestoreChannel {
  id?: string;
  name: string;
  type: "general" | "swarm" | "dm";
  swarmId?: string;
  teamId: string;
  createdAt: number;
}

// ─── Teams ──────────────────────────────────────────────

export async function createTeam(data: Omit<FirestoreTeam, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "teams"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getTeam(teamId: string): Promise<FirestoreTeam | null> {
  const snap = await getDoc(doc(db, "teams", teamId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as FirestoreTeam;
}

export async function updateTeam(teamId: string, data: Partial<FirestoreTeam>): Promise<void> {
  await updateDoc(doc(db, "teams", teamId), data);
}

export async function getTeamsByWallet(walletAddress: string): Promise<FirestoreTeam[]> {
  const q = query(collection(db, "teams"), where("walletAddress", "==", walletAddress));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreTeam));
}

// ─── Swarms ─────────────────────────────────────────────

export async function createSwarm(data: Omit<FirestoreSwarm, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "swarms"), data);
  return ref.id;
}

export async function getSwarm(swarmId: string): Promise<FirestoreSwarm | null> {
  const snap = await getDoc(doc(db, "swarms", swarmId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as FirestoreSwarm;
}

export async function getSwarmsByTeam(teamId: string): Promise<FirestoreSwarm[]> {
  const q = query(collection(db, "swarms"), where("teamId", "==", teamId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreSwarm));
}

export async function updateSwarm(swarmId: string, data: Partial<FirestoreSwarm>): Promise<void> {
  await updateDoc(doc(db, "swarms", swarmId), data);
}

export async function deleteSwarm(swarmId: string): Promise<void> {
  await deleteDoc(doc(db, "swarms", swarmId));
}

// ─── Agents ─────────────────────────────────────────────

export async function createAgent(data: Omit<FirestoreAgent, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "agents"), data);
  return ref.id;
}

export async function getAgent(agentId: string): Promise<FirestoreAgent | null> {
  const snap = await getDoc(doc(db, "agents", agentId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as FirestoreAgent;
}

export async function getAgentsByTeam(teamId: string): Promise<FirestoreAgent[]> {
  const q = query(collection(db, "agents"), where("teamId", "==", teamId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreAgent));
}

export async function updateAgent(agentId: string, data: Partial<FirestoreAgent>): Promise<void> {
  await updateDoc(doc(db, "agents", agentId), data);
}

export async function deleteAgent(agentId: string): Promise<void> {
  await deleteDoc(doc(db, "agents", agentId));
}

// ─── Missions ───────────────────────────────────────────

export async function createMission(data: Omit<FirestoreMission, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "missions"), data);
  return ref.id;
}

export async function getMission(missionId: string): Promise<FirestoreMission | null> {
  const snap = await getDoc(doc(db, "missions", missionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as FirestoreMission;
}

export async function getMissionsBySwarm(swarmId: string): Promise<FirestoreMission[]> {
  const q = query(collection(db, "missions"), where("swarmId", "==", swarmId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreMission));
}

export async function getMissionsByTeam(teamId: string): Promise<FirestoreMission[]> {
  const q = query(collection(db, "missions"), where("teamId", "==", teamId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreMission));
}

export async function updateMission(missionId: string, data: Partial<FirestoreMission>): Promise<void> {
  await updateDoc(doc(db, "missions", missionId), data);
}

// ─── Messages ───────────────────────────────────────────

export async function sendMessage(data: Omit<FirestoreMessage, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "messages"), data);
  return ref.id;
}

export function onMessagesByChannel(
  channelId: string,
  callback: (messages: FirestoreMessage[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "messages"),
    where("channelId", "==", channelId),
    orderBy("timestamp", "asc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreMessage)));
  });
}

export async function getMessagesByChannel(channelId: string): Promise<FirestoreMessage[]> {
  const q = query(
    collection(db, "messages"),
    where("channelId", "==", channelId),
    orderBy("timestamp", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreMessage));
}

// ─── Channels ───────────────────────────────────────────

export async function createChannel(data: Omit<FirestoreChannel, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "channels"), data);
  return ref.id;
}

export async function getChannelsByTeam(teamId: string): Promise<FirestoreChannel[]> {
  const q = query(collection(db, "channels"), where("teamId", "==", teamId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreChannel));
}
