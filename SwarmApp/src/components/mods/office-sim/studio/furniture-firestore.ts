/**
 * Furniture Firestore CRUD — Manages the officeFurniture collection.
 *
 * Mirrors the pattern from avatar-firestore.ts but simplified
 * (no rigging/animation steps).
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  FurnitureGenerationTask,
  FurnitureGenerationStatus,
  FurnitureCategory,
  OfficeFurnitureData,
} from "./furniture-types";

const COLLECTION = "officeFurniture";

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

export async function createFurnitureTask(
  task: Omit<FurnitureGenerationTask, "id" | "createdAt" | "updatedAt">,
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

export async function updateFurnitureTask(
  taskId: string,
  patch: Partial<FurnitureGenerationTask>,
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

export async function getFurnitureTask(
  taskId: string,
): Promise<FurnitureGenerationTask | null> {
  const snap = await getDoc(doc(db, COLLECTION, taskId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as FurnitureGenerationTask;
}

/* ═══════════════════════════════════════
   Read — Active task for category+theme
   ═══════════════════════════════════════ */

const ACTIVE_STATUSES: FurnitureGenerationStatus[] = [
  "pending",
  "generating_3d",
  "refining_3d",
  "uploading",
];

export async function getActiveFurnitureTask(
  orgId: string,
  themeId: string,
  category: FurnitureCategory,
): Promise<FurnitureGenerationTask | null> {
  const q = query(
    collection(db, COLLECTION),
    where("orgId", "==", orgId),
    where("themeId", "==", themeId),
    where("category", "==", category),
    where("status", "in", ACTIVE_STATUSES),
    orderBy("createdAt", "desc"),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as FurnitureGenerationTask;
}

/* ═══════════════════════════════════════
   Read — Completed furniture for org+theme
   ═══════════════════════════════════════ */

export async function getOrgFurniture(
  orgId: string,
  themeId: string,
): Promise<Map<FurnitureCategory, OfficeFurnitureData>> {
  const q = query(
    collection(db, COLLECTION),
    where("orgId", "==", orgId),
    where("themeId", "==", themeId),
    where("status", "==", "completed"),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);

  // Keep only the latest per category
  const map = new Map<FurnitureCategory, OfficeFurnitureData>();
  for (const d of snap.docs) {
    const data = d.data() as FurnitureGenerationTask;
    if (!map.has(data.category) && data.meshy?.gatewayUrl) {
      map.set(data.category, {
        category: data.category,
        themeId: data.themeId,
        modelUrl: data.meshy.gatewayUrl,
        prompt: data.prompt,
        generatedAt: toTimestamp(data.completedAt) || toTimestamp(data.updatedAt),
      });
    }
  }
  return map;
}

/* ═══════════════════════════════════════
   Read — All active tasks for org+theme (for progress tracking)
   ═══════════════════════════════════════ */

export async function getActiveFurnitureTasks(
  orgId: string,
  themeId: string,
): Promise<FurnitureGenerationTask[]> {
  const q = query(
    collection(db, COLLECTION),
    where("orgId", "==", orgId),
    where("themeId", "==", themeId),
    where("status", "in", ACTIVE_STATUSES),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FurnitureGenerationTask);
}
