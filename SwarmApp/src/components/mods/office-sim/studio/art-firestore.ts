/**
 * Art Firestore CRUD — Manages the officeArt collection.
 *
 * Mirrors the pattern from furniture-firestore.ts.
 * Keyed by slotId (not category) since multiple slots can share a category.
 */

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
  limit,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  ArtGenerationTask,
  ArtGenerationStatus,
  OfficeArtPieceData,
} from "./art-types";

const COLLECTION = "officeArt";

function toTimestamp(val: unknown): number | undefined {
  if (!val) return undefined;
  if (val instanceof Timestamp) return val.toMillis();
  if (val instanceof Date) return val.getTime();
  if (typeof val === "number") return val;
  return undefined;
}

/* ═══════════════════════════════════════
   Create
   ═══════════════════════════════════════ */

export async function createArtTask(
  task: Omit<ArtGenerationTask, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...task,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/* ═══════════════════════════════════════
   Update
   ═══════════════════════════════════════ */

export async function updateArtTask(
  taskId: string,
  patch: Partial<ArtGenerationTask>,
): Promise<void> {
  const ref = doc(db, COLLECTION, taskId);
  await updateDoc(ref, {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

/* ═══════════════════════════════════════
   Read — Single task
   ═══════════════════════════════════════ */

export async function getArtTask(
  taskId: string,
): Promise<ArtGenerationTask | null> {
  const snap = await getDoc(doc(db, COLLECTION, taskId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ArtGenerationTask;
}

/* ═══════════════════════════════════════
   Read — Active task for slot+theme
   ═══════════════════════════════════════ */

const ACTIVE_STATUSES: ArtGenerationStatus[] = [
  "pending",
  "generating",
  "refining",
  "uploading",
];

export async function getActiveArtTask(
  orgId: string,
  themeId: string,
  slotId: string,
): Promise<ArtGenerationTask | null> {
  const q = query(
    collection(db, COLLECTION),
    where("orgId", "==", orgId),
    where("themeId", "==", themeId),
    where("slotId", "==", slotId),
    where("status", "in", ACTIVE_STATUSES),
    orderBy("createdAt", "desc"),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as ArtGenerationTask;
}

/* ═══════════════════════════════════════
   Read — Completed art for org+theme
   ═══════════════════════════════════════ */

export async function getOrgArt(
  orgId: string,
  themeId: string,
): Promise<Map<string, OfficeArtPieceData>> {
  const q = query(
    collection(db, COLLECTION),
    where("orgId", "==", orgId),
    where("themeId", "==", themeId),
    where("status", "==", "completed"),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);

  // Keep only the latest per slotId
  const map = new Map<string, OfficeArtPieceData>();
  for (const d of snap.docs) {
    const data = d.data() as ArtGenerationTask;
    if (map.has(data.slotId)) continue;

    const modelUrl = data.meshy?.gatewayUrl;
    const imageUrl = data.comfyui?.gatewayUrl;

    if (modelUrl || imageUrl) {
      map.set(data.slotId, {
        slotId: data.slotId,
        category: data.category,
        pipeline: data.pipeline,
        themeId: data.themeId,
        modelUrl,
        imageUrl,
        prompt: data.prompt,
        generatedAt: toTimestamp(data.completedAt) || toTimestamp(data.updatedAt),
      });
    }
  }
  return map;
}

/* ═══════════════════════════════════════
   Delete — Revert art piece
   ═══════════════════════════════════════ */

export async function deleteArtPiece(taskId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, taskId));
}

/* ═══════════════════════════════════════
   Read — All active tasks for org+theme
   ═══════════════════════════════════════ */

export async function getActiveArtTasks(
  orgId: string,
  themeId: string,
): Promise<ArtGenerationTask[]> {
  const q = query(
    collection(db, COLLECTION),
    where("orgId", "==", orgId),
    where("themeId", "==", themeId),
    where("status", "in", ACTIVE_STATUSES),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ArtGenerationTask);
}
