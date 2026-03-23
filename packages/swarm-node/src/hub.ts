import * as admin from 'firebase-admin';

// Initialize Firebase Admin
// Requires GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_* env vars
if (!admin.apps.length) {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                // Replace escaped literal newlines
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            }),
        });
    } else {
        // Will automatically look for GOOGLE_APPLICATION_CREDENTIALS
        admin.initializeApp();
    }
}

const db = admin.firestore();

export interface Lease {
    id: string;
    nodeId: string;
    agentId: string;
    status: 'starting' | 'running' | 'stopping' | 'terminated' | 'error';
    containerImage: string;
    containerId?: string;
    env?: Record<string, string>;
    memoryMb?: number;
    cpuCores?: number;
}

export async function registerNode(nodeId: string, resources: any, providerAddress: string) {
    const nodeRef = db.collection('nodes').doc(nodeId);
    await nodeRef.set({
        id: nodeId,
        providerAddress,
        status: 'online',
        resources,
        registeredAt: admin.firestore.FieldValue.serverTimestamp(),
        lastHeartbeat: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`[Hub] Registered node ${nodeId} successfully.`);
}

export async function heartbeat(nodeId: string, health: any) {
    const nodeRef = db.collection('nodes').doc(nodeId);
    await nodeRef.update({
        status: 'online',
        health,
        lastHeartbeat: admin.firestore.FieldValue.serverTimestamp(),
    });
}

export function listenForLeases(nodeId: string, onLeaseAdded: (lease: Lease) => void, onLeaseRemoved: (leaseId: string) => void) {
    const leasesRef = db.collection('leases')
        .where('nodeId', '==', nodeId)
        .where('status', 'in', ['starting', 'running', 'stopping']);

    return leasesRef.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' || change.type === 'modified') {
                const data = change.doc.data();
                onLeaseAdded({ id: change.doc.id, ...data } as Lease);
            }
            if (change.type === 'removed') {
                onLeaseRemoved(change.doc.id);
            }
        });
    }, (err) => {
        console.error('[Hub] Error listening to leases:', err);
    });
}

export async function updateLeaseStatus(leaseId: string, status: Lease['status'], containerId?: string, errorMsg?: string) {
    const leaseRef = db.collection('leases').doc(leaseId);
    const updateData: any = { status };
    if (containerId) updateData.containerId = containerId;
    if (errorMsg) updateData.error = errorMsg;
    
    if (status === 'running') updateData.startedAt = admin.firestore.FieldValue.serverTimestamp();
    if (status === 'terminated' || status === 'error') updateData.endedAt = admin.firestore.FieldValue.serverTimestamp();

    await leaseRef.update(updateData);
    console.log(`[Hub] Updated lease ${leaseId} to status: ${status}`);
}
