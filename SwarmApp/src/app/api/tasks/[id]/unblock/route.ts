/**
 * POST /api/tasks/[id]/unblock
 *
 * Unblock a task (remove all blockers).
 */

import { NextRequest } from "next/server";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getWalletAddress, requireOrgMember } from "@/lib/auth-guard";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const wallet = getWalletAddress(request);
  if (!wallet) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;

  // Verify the task exists and user is member of its org
  const taskSnap = await getDoc(doc(db, "kanbanTasks", id));
  if (!taskSnap.exists()) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }
  const taskData = taskSnap.data();
  if (taskData.orgId) {
    const orgAuth = await requireOrgMember(request, taskData.orgId);
    if (!orgAuth.ok) {
      return Response.json({ error: orgAuth.error }, { status: orgAuth.status || 403 });
    }
  }

  try {
    await setDoc(
      doc(db, "kanbanTasks", id),
      {
        blockedBy: [],
        blockReason: "",
        blockedAt: null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return Response.json({
      ok: true,
      message: `Task ${id} has been unblocked`,
    });
  } catch (err) {
    console.error("Unblock task error:", err);
    return Response.json(
      { error: "Failed to unblock task" },
      { status: 500 }
    );
  }
}
