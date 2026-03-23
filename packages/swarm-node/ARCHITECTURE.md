# Swarm Node Architecture

## System Components

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                          SWARM WEB DASHBOARD                             │
│                        (SwarmApp - Next.js)                              │
│                                                                          │
│  ┌─────────────────┐  ┌────────────────┐  ┌─────────────────────────┐  │
│  │  Resource       │  │  Compute       │  │  API Routes             │  │
│  │  Picker UI      │  │  Provider      │  │  /api/compute/...       │  │
│  │                 │  │  (swarm-node)  │  │                         │  │
│  │  • Select node  │→ │  • createLease │→ │  • Start instance       │  │
│  │  • View status  │  │  • updateLease │  │  • Stop instance        │  │
│  └─────────────────┘  └────────────────┘  └─────────────────────────┘  │
│                              ▲                        │                  │
└──────────────────────────────┼────────────────────────┼──────────────────┘
                               │                        │
                               │      Firestore API     │
                               │                        ▼
                    ┌──────────┴────────────────────────────────┐
                    │                                            │
                    │         GOOGLE FIRESTORE                   │
                    │                                            │
                    │  ┌──────────────────────────────────────┐ │
                    │  │  Collection: nodes                   │ │
                    │  │  • Node registration                 │ │
                    │  │  • Resource capacity                 │ │
                    │  │  • Health metrics (CPU/RAM/uptime)   │ │
                    │  │  • Last heartbeat timestamp          │ │
                    │  └──────────────────────────────────────┘ │
                    │                                            │
                    │  ┌──────────────────────────────────────┐ │
                    │  │  Collection: leases                  │ │
                    │  │  • Workload assignments              │ │
                    │  │  • Container status lifecycle        │ │
                    │  │  • Resource specs (CPU/RAM/image)    │ │
                    │  │  • Container ID when running         │ │
                    │  └──────────────────────────────────────┘ │
                    │                                            │
                    └──────────────┬─────────────────────────────┘
                                   │
                Real-time Listener │ (onSnapshot)
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                       SWARM NODE DAEMON                                  │
│                  (packages/swarm-node - Node.js)                         │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  src/index.ts - Main Daemon                                        │ │
│  │                                                                     │ │
│  │  1. Initialize                                                     │ │
│  │     └─→ Load .env config (NODE_ID, PROVIDER_ADDRESS)              │ │
│  │                                                                     │ │
│  │  2. Register Node                                                  │ │
│  │     └─→ system.ts: detect CPU cores, RAM GB, GPUs                 │ │
│  │     └─→ hub.ts: write to Firestore nodes/{NODE_ID}                │ │
│  │                                                                     │ │
│  │  3. Start Heartbeat Loop (every 30s)                               │ │
│  │     └─→ system.ts: get CPU load %, RAM used, uptime               │ │
│  │     └─→ hub.ts: update Firestore nodes/{NODE_ID}/health           │ │
│  │                                                                     │ │
│  │  4. Listen for Leases                                              │ │
│  │     └─→ hub.ts: onSnapshot(leases where nodeId == NODE_ID)        │ │
│  │                                                                     │ │
│  │         On lease.status = "starting":                              │ │
│  │         ├─→ docker.ts: pullImageIfNotExists(lease.containerImage) │ │
│  │         ├─→ docker.ts: startContainer() with resource limits      │ │
│  │         └─→ hub.ts: updateLease(status="running", containerId)    │ │
│  │                                                                     │ │
│  │         On lease.status = "stopping":                              │ │
│  │         ├─→ docker.ts: stopContainer(containerId)                 │ │
│  │         └─→ hub.ts: updateLease(status="terminated")              │ │
│  │                                                                     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Docker Daemon (dockerode library)                                 │ │
│  │                                                                     │ │
│  │  • Pull images from Docker Hub / registries                        │ │
│  │  • Create containers with memory/CPU limits                        │ │
│  │  • Start/stop containers                                           │ │
│  │  • Remove containers on cleanup                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                   ▼                                      │
│           ┌───────────────────────────────────────────────┐             │
│           │  Running Containers                           │             │
│           │  • swarm-agent-{leaseId}                      │             │
│           │  • Isolated with resource limits              │             │
│           │  • Environment variables from lease.env       │             │
│           └───────────────────────────────────────────────┘             │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Sequence Diagram: Provisioning a Container

```
User              Dashboard         Firestore        Node Daemon      Docker
 │                    │                 │                  │             │
 │ Click "Start"      │                 │                  │             │
 ├───────────────────→│                 │                  │             │
 │                    │ createLease()   │                  │             │
 │                    ├────────────────→│                  │             │
 │                    │                 │ onSnapshot()     │             │
 │                    │                 ├─────────────────→│             │
 │                    │                 │ (lease status:   │             │
 │                    │                 │  "starting")     │             │
 │                    │                 │                  │             │
 │                    │                 │    Pull image    │             │
 │                    │                 │                  ├────────────→│
 │                    │                 │                  │             │
 │                    │                 │                  │ Image       │
 │                    │                 │                  │←────────────┤
 │                    │                 │                  │             │
 │                    │                 │    Start container              │
 │                    │                 │                  ├────────────→│
 │                    │                 │                  │             │
 │                    │                 │                  │ Container   │
 │                    │                 │                  │ ID          │
 │                    │                 │                  │←────────────┤
 │                    │                 │                  │             │
 │                    │                 │ updateLease()    │             │
 │                    │                 │ (status="running"│             │
 │                    │                 │  containerId)    │             │
 │                    │                 │←─────────────────┤             │
 │                    │                 │                  │             │
 │                    │ Poll lease      │                  │             │
 │   Status update    │ status          │                  │             │
 │←───────────────────┤←────────────────┤                  │             │
 │  "Running"         │                 │                  │             │
 │                    │                 │                  │             │
```

## Module Responsibilities

### Frontend (SwarmApp)

**resource-picker.tsx**
- UI for selecting swarm-node provider
- Fetches available nodes from Firestore
- Displays node resources (CPU, RAM, GPU)
- Hijacks region selector to choose specific node

**providers/swarm-node.ts**
- Implements ComputeProvider interface
- Creates leases in Firestore
- Updates lease status for lifecycle operations
- Delegates actual work to node daemon via Firestore

### Backend (packages/swarm-node)

**src/index.ts**
- Entry point and orchestrator
- Initializes all subsystems
- Coordinates registration, heartbeat, and lease handling

**src/system.ts**
- Hardware detection using `systeminformation`
- `getSystemProperties()`: CPU cores, RAM, platform, GPUs
- `getSystemHealth()`: CPU load, RAM usage, uptime

**src/hub.ts**
- Firebase Admin SDK integration
- `registerNode()`: write to `nodes` collection
- `heartbeat()`: update health metrics
- `listenForLeases()`: real-time listener for assigned workloads
- `updateLeaseStatus()`: report container lifecycle back to hub

**src/docker.ts**
- Docker API via `dockerode`
- `pullImageIfNotExists()`: ensure image available
- `startContainer()`: create and start with resource limits
- `stopContainer()`: graceful stop + removal
- `getContainerStatus()`, `getContainerLogs()`: monitoring

## Data Flow

### Node Registration Flow
```
Node Daemon Startup
  ↓
Detect Hardware (system.ts)
  ↓
Write to Firestore nodes/{NODE_ID}
  {
    resources: { cpuCores, ramGb, gpus },
    status: "online",
    registeredAt: timestamp
  }
  ↓
Dashboard fetches nodes
  ↓
User sees node in provider dropdown
```

### Heartbeat Flow
```
Every 30 seconds:
  ↓
Get Current Metrics (system.ts)
  { cpuLoadPercent, ramUsedGb, uptimeSec }
  ↓
Update Firestore nodes/{NODE_ID}
  {
    health: { ... },
    lastHeartbeat: timestamp,
    status: "online"
  }
```

### Lease Assignment Flow
```
User creates instance with swarm-node provider
  ↓
Dashboard creates lease in Firestore
  {
    nodeId: selectedNode,
    orgId: userOrg,
    computerId: instanceId,
    containerImage: "ubuntu:22.04",
    memoryMb: 4096,
    cpuCores: 2,
    status: "starting"
  }
  ↓
Node daemon's onSnapshot() fires
  ↓
Daemon checks lease.status === "starting"
  ↓
Pull image (docker.ts)
  ↓
Start container with limits (docker.ts)
  ↓
Get container ID
  ↓
Update lease in Firestore
  {
    status: "running",
    containerId: "abc123...",
    startedAt: timestamp
  }
  ↓
Dashboard polls lease, shows "Running"
```

### Container Shutdown Flow
```
User clicks "Stop" in dashboard
  ↓
Dashboard updates lease
  { status: "stopping" }
  ↓
Node daemon's onSnapshot() fires
  ↓
Daemon checks lease.status === "stopping"
  ↓
Stop container (docker.ts)
  ↓
Remove container (docker.ts)
  ↓
Update lease in Firestore
  {
    status: "terminated",
    endedAt: timestamp
  }
  ↓
Dashboard shows "Stopped"
```

## Error Handling

### Container Fails to Start
```
Node Daemon
  ↓
docker.startContainer() throws
  ↓
Catch error
  ↓
Update lease
  {
    status: "error",
    error: err.message,
    endedAt: timestamp
  }
  ↓
Dashboard shows error state
```

### Node Goes Offline
```
Node daemon crashes or loses network
  ↓
Firestore stops receiving heartbeats
  ↓
Dashboard monitors lastHeartbeat
  ↓
If lastHeartbeat > 2 minutes old:
  Show node as "offline" in picker
  (Future: auto-reassign leases)
```

## Security Considerations

### Firestore Rules (Recommended)

```javascript
// Allow public read for node discovery
match /nodes/{nodeId} {
  allow read: if true;
  allow write: if false; // Only daemon via Admin SDK
}

// Leases scoped to org
match /leases/{leaseId} {
  allow read: if request.auth.token.orgId == resource.data.orgId;
  allow write: if false; // Only API via Admin SDK
}
```

### Container Isolation
- Each container runs with CPU and memory limits
- No host network access (default Docker networking)
- No privileged mode (unless explicitly needed for GPU passthrough)

### Provider Trust
- `providerAddress` recorded but not enforced (MVP)
- Future: stake requirement, reputation system, slashing conditions

## Performance Optimization

### Image Caching
- `pullImageIfNotExists()` checks local images before pulling
- Popular images (ubuntu, python, node) only pulled once per node

### Heartbeat Efficiency
- 30-second interval balances freshness with API quota
- Health metrics collected via single `systeminformation` call

### Firestore Query Optimization
- `listenForLeases()` uses compound index on `nodeId` + `status`
- Listener only fires for relevant status changes
- Minimizes read operations and billing

## Monitoring & Observability

### Daemon Logs
```bash
# Development
npm run dev

# Production (systemd)
sudo journalctl -u swarm-node -f

# Search for errors
sudo journalctl -u swarm-node | grep -i error
```

### Firestore Console
- Check `nodes` collection for online status
- Inspect `leases` for workload distribution
- Monitor `lastHeartbeat` for node health

### Docker Monitoring
```bash
# Running containers
docker ps

# All containers (including stopped)
docker ps -a

# Container logs
docker logs <container-id>

# Resource usage
docker stats
```

## Scaling Considerations

### Single Node
- Supports multiple concurrent containers (limited by hardware)
- One daemon instance per physical/virtual machine

### Multi-Node
- Each node has unique `NODE_ID`
- Dashboard load-balances across available nodes
- Leases distributed based on resource availability

### Future: Auto-Scaling
- Monitor node health metrics
- Auto-provision new nodes when demand exceeds capacity
- Kubernetes integration for cluster orchestration
