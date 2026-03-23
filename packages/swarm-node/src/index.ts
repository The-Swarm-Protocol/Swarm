#!/usr/bin/env node

import dotenv from 'dotenv';
import { getSystemProperties, getSystemHealth } from './system';
import { registerNode, heartbeat, listenForLeases, updateLeaseStatus, Lease } from './hub';
import { startContainer, stopContainer } from './docker';

dotenv.config();

const NODE_ID = process.env.NODE_ID || 'dev-node-1';
const PROVIDER_ADDRESS = process.env.PROVIDER_ADDRESS || '0x0000000000000000000000000000000000000000';

async function main() {
    console.log(`\n============== Swarm Node Daemon ==============\n`);
    console.log(`[Swarm Node] Initializing daemon for node: ${NODE_ID}`);

    // Initial Registration
    const properties = await getSystemProperties();
    console.log(`[Swarm Node] Host properties:`, properties);
    await registerNode(NODE_ID, properties, PROVIDER_ADDRESS);

    // Heartbeat Loop
    setInterval(async () => {
        try {
            const health = await getSystemHealth();
            await heartbeat(NODE_ID, health);
            // Optional debug log
            // console.log(`[Swarm Node] Heartbeat sent (CPU: ${health.cpuLoadPercent.toFixed(1)}%, RAM: ${health.ramUsedGb.toFixed(2)}GB)`);
        } catch (err) {
            console.error('[Swarm Node] Error sending heartbeat:', err);
        }
    }, 30000);

    // Lease Listener
    listenForLeases(NODE_ID, async (lease: Lease) => {
        if (lease.status === 'starting') {
            console.log(`-------------------------------------------------`);
            console.log(`[Daemon] Received new lease: ${lease.id}`);
            console.log(`[Daemon] Pulling image ${lease.containerImage} and starting container...`);
            
            try {
                const containerId = await startContainer({
                    name: `swarm-agent-${lease.id}`,
                    image: lease.containerImage || 'ubuntu:22.04',
                    env: lease.env,
                    memoryMb: lease.memoryMb,
                    cpuCores: lease.cpuCores,
                });
                console.log(`[Daemon] Container started successfully. ID: ${containerId}`);
                await updateLeaseStatus(lease.id, 'running', containerId);
            } catch (err: any) {
                console.error(`[Daemon] Failed to start container for lease ${lease.id}:`, err);
                await updateLeaseStatus(lease.id, 'error', undefined, err.message);
            }
            console.log(`-------------------------------------------------`);
        }

        if (lease.status === 'stopping') {
            console.log(`-------------------------------------------------`);
            console.log(`[Daemon] Stopping lease: ${lease.id}...`);
            if (lease.containerId) {
                try {
                    await stopContainer(lease.containerId);
                    console.log(`[Daemon] Container ${lease.containerId} stopped and removed.`);
                    await updateLeaseStatus(lease.id, 'terminated');
                } catch (err: any) {
                    console.error(`[Daemon] Failed to stop container:`, err);
                    await updateLeaseStatus(lease.id, 'error', undefined, err.message);
                }
            } else {
                console.log(`[Daemon] No container ID found for lease. Marking terminated.`);
                await updateLeaseStatus(lease.id, 'terminated');
            }
            console.log(`-------------------------------------------------`);
        }
    }, async (leaseId: string) => {
        console.log(`[Daemon] Lease dynamically deleted from registry: ${leaseId}`);
        // We'll trust the stopping event to handle container cleanup gracefully
        // Hard-deletes trigger this, we could force kill containers matching `swarm-agent-${leaseId}` here.
    });

    console.log(`[Swarm Node] Listening for incoming container workloads...\n`);
}

main().catch(console.error);
