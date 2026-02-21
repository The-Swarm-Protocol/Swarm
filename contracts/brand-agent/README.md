# BrandMover — The Autonomous AI Marketing Agent

**An AI agent that manages brands, launches campaigns, delegates work to swarm workers, and markets itself. Built on Hedera.**

🔗 **Live Dashboard:** [frontend-blue-one-76.vercel.app](https://frontend-blue-one-76.vercel.app)
🔍 **Explorer:** [BrandVault](https://hashscan.io/testnet/contract/0x2254185AB8B6AC995F97C769a414A0281B42853b) · [Registry](https://hashscan.io/testnet/contract/0x76c00C56A60F0a92ED899246Af76c65D835A8EAA) · [Treasury](https://hashscan.io/testnet/contract/0x1AC9C959459ED904899a1d52f493e9e4A879a9f4)

---

## What Is BrandMover?

BrandMover is one agent in a larger autonomous corporation called **Swarm**:

- **Trading Agent** — earns revenue (market making, arbitrage)
- **Brand Agent (BrandMover)** — spends revenue on marketing to grow the corporation
- **Swarm Coordinator** — orchestrates the agents

BrandMover is the marketing department. It holds encrypted brand guidelines onchain, generates full marketing campaigns, outsources subtasks to swarm worker agents with temporary private access, verifies their work for brand compliance, and uses a portion of its revenue to market itself — acquiring more clients without human intervention.

---

## How It Works

### 1. Encrypted Brand Identity Onchain

Brand guidelines — voice, tone, colors, hashtags, restricted words — are **AES-256-CBC encrypted** and stored in a `BrandVault` smart contract on Hedera. Only the agent holding the decryption key can read them.

The brand identity is tamper-proof and auditable, but completely private. Anyone can see the encrypted blob on HashScan. Nobody can read it.

### 2. Campaign Generation

When the agent receives a campaign request:

1. Reads encrypted guidelines from Hedera → decrypts locally
2. Generates 7 content types: press release, Twitter thread, LinkedIn post, Discord announcement, Instagram caption, video script, email newsletter — all constrained by brand guidelines
3. SHA-256 hashes all content
4. Logs the campaign onchain with content hash, platforms, and type
5. Schedules remarketing 7 days later via **Hedera Schedule Service** — the blockchain itself executes the follow-up. No bots. No keepers. No human.

### 3. Swarm Worker Delegation (Temporary Private Access)

This is the key innovation. When BrandMover outsources work to a swarm agent:

1. Decrypts the full guidelines, extracts only the **subset** the worker needs
2. Re-encrypts the subset with a **temporary AES key**
3. Encrypts the temp key with the **worker's public key**
4. Stores it onchain with a **time lock** (e.g., 24 hours)
5. Worker decrypts, does the work, submits delivery with a **guidelines hash**
6. The contract automatically verifies compliance — did the worker use the correct guidelines?
7. Access is **revoked** after completion. Encrypted data is wiped from chain.

The worker never sees the master key. Each task gets a unique temp key. After expiry, access is dead even if the worker saved the key.

### 4. Self-Sustaining Revenue Loop

Every time a brand pays for a campaign:

- **80%** → Reserve (pay workers, fund operations)
- **10%** → Compute (Claude API costs)
- **10%** → Growth (self-marketing budget)

When the growth wallet hits 50 HBAR, the agent reads **its own brand vault** and generates a marketing campaign to attract more brands. More brands → more revenue → more self-marketing → more brands. The marketing agent markets itself.

---

## Hackathon Tracks

### $10K: Killer App for the Agentic Society (OpenClaw + Hedera)

BrandMover is an agent-native application where agents hire other agents. The boss agent delegates tasks to worker agents, grants temporary encrypted access to brand data, verifies their work onchain, and pays them automatically. The platform gets more valuable as more agents join.

### $5K: On-Chain Automation with Hedera Schedule Service

Campaign remarketing is scheduled using the Hedera Schedule Service (HIP-1215). The contract schedules its own future execution — no external bots, no keeper networks. The blockchain itself triggers the remarketing campaign at the specified time.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                 BrandMover (Boss Agent)               │
│                                                      │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ BrandVault│  │BrandRegistry │  │AgentTreasury │  │
│  │           │  │              │  │              │  │
│  │ Encrypted │  │ Any brand    │  │ Auto-splits  │  │
│  │ guidelines│  │ can sign up  │  │ 80/10/10     │  │
│  │ Campaigns │  │ and pay for  │  │              │  │
│  │ Tasks     │  │ a vault      │  │ Reserve      │  │
│  │ Schedules │  │              │  │ Compute      │  │
│  │           │  │              │  │ Growth       │  │
│  └───────────┘  └──────────────┘  └──────────────┘  │
│                        │                             │
│          ┌─────────────┼─────────────┐               │
│          ▼             ▼             ▼               │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│    │ Task 1   │  │ Task 2   │  │ Task 3   │         │
│    │ PR Write │  │ Social   │  │ Video    │         │
│    │ 24hr key │  │ 24hr key │  │ 12hr key │         │
│    └────┬─────┘  └────┬─────┘  └────┬─────┘         │
│         │             │             │                │
└─────────┼─────────────┼─────────────┼────────────────┘
          ▼             ▼             ▼
┌──────────────────────────────────────────────────────┐
│                 Swarm (Worker Pool)                   │
│                                                      │
│   Writing Agent    Social Agent    Video Agent        │
│   delivers + hash  delivers + hash delivers + hash   │
│   compliance ✓     compliance ✓    compliance ✓      │
│   gets paid        gets paid       gets paid         │
└──────────────────────────────────────────────────────┘
```

---

## Deployed Contracts (Hedera Testnet)

| Contract | Address | Purpose |
|----------|---------|---------|
| BrandVault | `0x2254185AB8B6AC995F97C769a414A0281B42853b` | Encrypted vault, campaigns, task access, HSS scheduling |
| BrandRegistry | `0x76c00C56A60F0a92ED899246Af76c65D835A8EAA` | Multi-tenant brand registration with fees |
| AgentTreasury | `0x1AC9C959459ED904899a1d52f493e9e4A879a9f4` | Revenue auto-split (80/10/10) |

---

## OpenClaw Agent

### Scripts

| Script | Function |
|--------|----------|
| `read_vault.js` | Reads encrypted guidelines from Hedera, decrypts with AES key |
| `create_campaign.js` | Generates campaign, hashes content, logs onchain |
| `schedule_content.js` | Launches campaign + schedules remarketing via HSS |
| `log_activity.js` | Logs agent activity onchain |
| `grant_access.js` | Extracts guideline subset, re-encrypts with temp key, grants time-locked worker access |
| `verify_delivery.js` | Queries TaskDelivered events, verifies guidelines hash compliance |

### Workflows

1. **Read Guidelines** — fetch from Hedera, decrypt locally
2. **Full Campaign Launch** — generate 7 content types, hash, log, schedule remarketing
3. **Brand Monitoring** — web search for mentions, log activity
4. **Execute Scheduled** — HSS auto-executes remarketing
5. **Outsource Task** — break campaign into subtasks, delegate to swarm workers
6. **Verify Deliveries** — check work against guidelines hash, approve/reject, revoke access
7. **Self-Marketing** — monitor growth wallet, generate campaign for BrandMover itself

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | Hedera Testnet (EVM, Chain ID 296) |
| Contracts | Solidity 0.8.20, Hardhat |
| RPC | Hashio JSON-RPC Relay |
| Scheduling | Hedera Schedule Service (HIP-1215) |
| Encryption | AES-256-CBC, per-task re-encryption |
| Agent | OpenClaw, ethers.js v6 |
| Frontend | Next.js 14, Tailwind, ethers.js v6 |
| Hosting | Vercel |

---

## Running Locally

### Contracts

```bash
cd contracts/brand-agent
npm install
cp .env.example .env
# Add your Hedera testnet ECDSA private key
npx hardhat compile
npx hardhat run scripts/deploy_platform.ts --network hederaTestnet
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### OpenClaw

Copy `openclaw-skills/brand-mover/` to `~/.openclaw/skills/brand-mover/` and configure env vars in `~/.openclaw/openclaw.json`.

---

## File Structure

```
swarm/
├── contracts/brand-agent/
│   ├── src/
│   │   ├── BrandVault.sol              # Core vault (746 lines)
│   │   ├── BrandRegistry.sol           # Multi-tenant registry
│   │   ├── AgentTreasury.sol           # Revenue auto-split
│   │   └── IHederaScheduleService.sol  # HSS interface
│   ├── scripts/
│   │   ├── deploy_platform.ts
│   │   ├── test_platform.ts            # 8-test integration suite
│   │   └── init_vault.ts
│   └── hardhat.config.ts
├── openclaw-skills/brand-mover/
│   ├── SKILL.md
│   └── scripts/                        # 6 OpenClaw scripts
├── frontend/                           # Next.js dashboard (Vercel)
└── README.md
```

---

## Tests

All 8 passing on Hedera testnet:

```
TEST 1: Read Brand Guidelines        — PASS
TEST 2: Create Campaign              — PASS
TEST 3: Grant Task Access to Worker  — PASS
TEST 4: Worker Submits Delivery      — PASS (guidelinesMatch: true)
TEST 5: Verify Compliance            — PASS
TEST 6: Revoke Access                — PASS (worker blocked after revoke)
TEST 7: Campaign Payment + Treasury  — PASS
TEST 8: Growth Wallet Accumulation   — PASS
```

---

Built by Moses at ETHDenver 2026.
