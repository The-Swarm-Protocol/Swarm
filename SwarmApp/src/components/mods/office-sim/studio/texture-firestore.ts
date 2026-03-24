/**
 * Texture Firestore CRUD — Manages the officeTextures collection.
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
  TextureGenerationTask,
  TextureGenerationStatus,
  TextureMaterial,
  OfficeTextureData,
} from "./texture-types";

const COLLECTION = "officeTextures";

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

export async function createTextureTask(
  task: Omit<TextureGenerationTask, "id" | "createdAt" | "updatedAt">,
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

export async function updateTextureTask(
  taskId: string,
  patch: Partial<TextureGenerationTask>,
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

export async function getTextureTask(
  taskId: string,
): Promise<TextureGenerationTask | null> {
  const snap = await getDoc(doc(db, COLLECTION, taskId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as TextureGenerationTask;
}

/* ═══════════════════════════════════════
   Read — Active task for material+theme
   ═══════════════════════════════════════ */

const ACTIVE_STATUSES: TextureGenerationStatus[] = [
  "pending",
  "generating",
  "uploading",
];

export async function getActiveTextureTask(
  orgId: string,
  themeId: string,
  material: TextureMaterial,
): Promise<TextureGenerationTask | null> {
  const q = query(
    collection(db, COLLECTION),
    where("orgId", "==", orgId),
    where("themeId", "==", themeId),
    where("material", "==", material),
    where("status", "in", ACTIVE_STATUSES),
    orderBy("createdAt", "desc"),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as TextureGenerationTask;
}

/* ═══════════════════════════════════════
   Read — Completed textures for org+theme
   ═══════════════════════════════════════ */

export async function getOrgTextures(
  orgId: string,
  themeId: string,
): Promise<Map<TextureMaterial, OfficeTextureData>> {
  const q = query(
    collection(db, COLLECTION),
    where("orgId", "==", orgId),
    where("themeId", "==", themeId),
    where("status", "==", "completed"),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);

  const map = new Map<TextureMaterial, OfficeTextureData>();
  for (const d of snap.docs) {
    const data = d.data() as TextureGenerationTask;
    if (!map.has(data.material) && data.provider?.gatewayUrl) {
      map.set(data.material, {
        material: data.material,
        themeId: data.themeId,
        textureUrl: data.provider.gatewayUrl,
        prompt: data.prompt,
        generatedAt: toTimestamp(data.completedAt) || toTimestamp(data.updatedAt),
      });
    }
  }
  return map;
}
