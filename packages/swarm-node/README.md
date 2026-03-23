# Swarm Node Daemon

The Swarm Node Daemon connects your compute resources to the Swarm decentralized compute network. It listens for workload assignments from the Swarm hub and automatically provisions Docker containers to run agent workloads.

## Prerequisites

- **Node.js** 18+ (with `npm`)
- **Docker** installed and running
- **Firebase Admin SDK** credentials

## Installation

```bash
cd packages/swarm-node
npm install
npm run build
```

## Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and configure:
   - `NODE_ID`: A unique identifier for this node (e.g., `swarm-node-prod-1`)
   - `PROVIDER_ADDRESS`: Your Ethereum wallet address (provider identity)
   - Firebase credentials (choose one method):
     - **Option A**: Set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`
     - **Option B**: Set `GOOGLE_APPLICATION_CREDENTIALS` pointing to a service account JSON file

### Getting Firebase Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** > **Service Accounts**
4. Click **Generate New Private Key**
5. Save the JSON file securely and either:
   - Use the file path in `GOOGLE_APPLICATION_CREDENTIALS`, or
   - Extract `project_id`, `client_email`, and `private_key` into the individual env vars

## Running the Daemon

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

### Running as a Service (systemd)

Create a systemd service file at `/etc/systemd/system/swarm-node.service`:

```ini
[Unit]
Description=Swarm Node Daemon
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/swarm/packages/swarm-node
Environment="NODE_ENV=production"
EnvironmentFile=/path/to/swarm/packages/swarm-node/.env
ExecStart=/usr/bin/node /path/to/swarm/packages/swarm-node/dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl enable swarm-node
sudo systemctl start swarm-node
sudo systemctl status swarm-node
```

View logs:

```bash
sudo journalctl -u swarm-node -f
```

## How It Works

1. **Registration**: On startup, the daemon registers this node with the Swarm hub, reporting available CPU, RAM, and GPU resources
2. **Heartbeat**: Every 30 seconds, the daemon sends a heartbeat with current resource utilization
3. **Lease Listener**: The daemon listens for new compute leases assigned to this node
4. **Container Lifecycle**:
   - When a lease is assigned with status `starting`, the daemon pulls the specified Docker image and starts a container
   - When a lease transitions to `stopping`, the daemon stops and removes the container
   - Status updates are sent back to the hub in real-time

## Architecture

```
packages/swarm-node/
├── src/
│   ├── index.ts      # Main daemon entry point
│   ├── system.ts     # System resource detection (CPU, RAM, GPU)
│   ├── docker.ts     # Docker container management
│   └── hub.ts        # Firestore integration for lease management
├── package.json
├── tsconfig.json
└── .env
```

## Firestore Collections Used

- **`nodes`**: Node registration and heartbeat status
- **`leases`**: Workload assignments and container lifecycle state

## Security Considerations

- The daemon requires Docker socket access (`/var/run/docker.sock`)
- Containers run with resource limits (CPU cores, memory) as specified in the lease
- Firebase credentials should be kept secure and never committed to version control
- Consider running the daemon with a dedicated service account with limited Docker permissions

## Troubleshooting

### "Cannot connect to the Docker daemon"
Ensure Docker is running and your user has permission to access the Docker socket:
```bash
sudo systemctl start docker
sudo usermod -aG docker $USER
# Log out and back in for group changes to take effect
```

### Firebase authentication errors
Verify your credentials are correct:
```bash
# Test with firebase-admin
node -e "require('firebase-admin').initializeApp(); console.log('OK')"
```

### Container fails to start
Check Docker logs:
```bash
docker logs <container-id>
```

## License

MIT
