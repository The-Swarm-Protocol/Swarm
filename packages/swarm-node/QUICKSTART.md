# Swarm Node Quick Start

Get your node running in 5 minutes.

## Prerequisites

- Docker installed and running
- Node.js 18+ with npm
- Firebase project with Firestore enabled

## Step 1: Install Dependencies

```bash
cd packages/swarm-node
npm install
npm run build
```

## Step 2: Get Firebase Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Open your project → **Project Settings** → **Service Accounts**
3. Click **Generate New Private Key**
4. Download the JSON file

## Step 3: Configure Environment

```bash
cp .env.example .env
nano .env
```

Update these required fields:

```bash
NODE_ID=my-unique-node-id-123
PROVIDER_ADDRESS=0xYourEthereumAddress

# Option A: Use service account file
GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json

# Option B: Use individual env vars (extract from the JSON file)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Step 4: Start the Daemon

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

You should see:
```
============== Swarm Node Daemon ==============

[Swarm Node] Initializing daemon for node: my-unique-node-id-123
[Swarm Node] Host properties: { cpuCores: 8, ramGb: 16, platform: 'linux', gpus: [] }
[Hub] Registered node my-unique-node-id-123 successfully.
[Swarm Node] Listening for incoming container workloads...
```

## Step 5: Verify Registration

Check the Firestore console → `nodes` collection. You should see your node document with status `online`.

## What Happens Next?

1. Your node sends heartbeats every 30 seconds
2. When a workload is assigned, the daemon:
   - Pulls the Docker image
   - Starts a container with specified resources
   - Reports status back to the hub
3. When a workload completes, the container is stopped and removed

## Troubleshooting

**Docker permission denied?**
```bash
sudo usermod -aG docker $USER
# Log out and back in
```

**Firebase auth error?**
```bash
# Test credentials
node -e "require('firebase-admin').initializeApp(); console.log('OK')"
```

**No leases showing up?**
- Check Firestore rules allow reads on `leases` collection
- Verify your `NODE_ID` matches what's in the database
- Check the Firestore console for any assigned leases

## Running as a Service

For production deployment, use the systemd service:

```bash
sudo cp swarm-node.service.example /etc/systemd/system/swarm-node.service
sudo systemctl daemon-reload
sudo systemctl enable swarm-node
sudo systemctl start swarm-node
sudo systemctl status swarm-node
```

View logs:
```bash
sudo journalctl -u swarm-node -f
```

## Next Steps

- Monitor your node's health in the Swarm dashboard
- Adjust resource limits in `.env`
- Set up monitoring and alerting
- Join the Swarm provider network!
