# BrandMover → Hedera Port (Claude Code Instructions)

## Context
I'm porting BrandMover — an encrypted onchain brand management system — from Movement blockchain (Move) to Hedera (Solidity/EVM). This is part of a larger team project called "Swarm" where multiple OpenClaw agents form an autonomous corporation:
- **Trading Agent** — earns revenue (market making, arb)
- **Brand Agent** (THIS IS MY PART) — spends revenue on marketing to grow the corporation
- **Swarm Agent** — coordinates the other agents

We're targeting two Hedera hackathon tracks:
1. **$10K: Killer App for the Agentic Society (OpenClaw)** — agent-native app on Hedera
2. **$5K: On-Chain Automation with Hedera Schedule Service** — self-running app using HSS

## What Already Exists (from Movement hackathon)
I have a working BrandMover on Movement blockchain with:
- Move smart contract (`brand_vault.move`) with 4 resources: BrandVault, CampaignRegistry, ScheduledContent, AgentActivityLog
- AES-256-CBC encryption of brand guidelines (encrypted onchain, decrypted locally by agent)
- OpenClaw skill with 4 scripts: read_vault.js, create_campaign.js, schedule_content.js, log_activity.js
- Next.js dashboard reading chain data in real-time

## What Needs To Be Built

### 1. Solidity Contract: `BrandVault.sol`

Port the Move contract to Solidity for Hedera EVM. Must include:

**Storage:**
- `BrandVault` struct: encrypted_guidelines (bytes), guidelines_hash (bytes32), brand_name (string), owner (address), agent_address (address), campaign_count (uint256), last_updated (uint256)
- `Campaign` struct: id, content_hash (bytes32), platforms (string), name (string), campaign_type (string), content_types (string), created_by (address), created_at (uint256), status (uint8)
- `ScheduleEntry` struct: campaign_id, content_hash (bytes32), platforms (string), schedule_type (string), scheduled_for (uint256), created_at (uint256), executed (bool)
- `ActivityEntry` struct: action_type (string), description (string), data_hash (bytes32), timestamp (uint256)
- Arrays for campaigns, scheduled entries, activity entries

**Access Control:**
- Two-role system: owner + agent
- modifier `onlyOwnerOrAgent`
- modifier `onlyAgent`
- modifier `onlyOwner`

**Functions:**
- `initializeVault(string brand_name, bytes encrypted_guidelines, bytes32 guidelines_hash, address agent_address)`
- `updateGuidelines(bytes new_encrypted_guidelines, bytes32 new_guidelines_hash)` — owner only
- `setAgent(address new_agent_address)` — owner only
- `createCampaign(string name, bytes32 content_hash, string platforms, string campaign_type, string content_types)` — owner or agent
- `scheduleContent(uint256 campaign_id, bytes32 content_hash, string platforms, string schedule_type, uint256 scheduled_for)` — owner or agent
- `logAgentActivity(string action_type, string description, bytes32 data_hash)` — agent only

**Hedera Schedule Service Integration (CRITICAL):**
- Import `IHederaScheduleService` from address `0x16b`
- `launchCampaignWithRemarketing(string name, bytes32 contentHash, bytes32 remarketingHash, string platforms, uint256 remarketingTimestamp)` — creates campaign AND uses HSS to schedule a future contract call to `executeScheduledRemarketing()` at the remarketing timestamp
- `executeScheduledRemarketing(string name, bytes32 contentHash, string platforms)` — auto-called by Hedera's schedule service at the scheduled time, creates a new campaign entry marked as "remarketing"
- This is the key differentiator: NO BOTS, NO KEEPERS. The blockchain itself executes the remarketing.

**Events:**
- VaultCreated, GuidelinesUpdated, CampaignCreated, ContentScheduled, AgentActivityLogged, RemarketingExecuted

**View Functions:**
- getEncryptedGuidelines(), getBrandName(), getGuidelinesHash(), getCampaignCount(), getAgentAddress()
- getCampaign(uint256 id), getScheduleEntry(uint256 id), getActivityEntry(uint256 id)
- getAllCampaigns(), getAllScheduleEntries(), getAllActivityEntries()

### 2. Deployment Setup

**Network: Hedera Testnet**
- RPC: `https://testnet.hashio.io/api`
- Chain ID: `296` (0x128)
- Explorer: `https://hashscan.io/testnet`
- Faucet: `https://portal.hedera.com` (create ECDSA testnet account)
- Mirror Node: `https://testnet.mirrornode.hedera.com`

**Use Hardhat** with config pointing to Hashio JSON-RPC relay.

hardhat.config.js should include:
```javascript
networks: {
  hederaTestnet: {
    url: "https://testnet.hashio.io/api",
    chainId: 296,
    accounts: [process.env.PRIVATE_KEY],
  }
}
```

### 3. Init Script: `scripts/init_vault.ts`

Same pattern as Movement version:
1. Define brand guidelines JSON (FOID Foundation brand identity)
2. Generate random 32-byte AES key + 16-byte IV
3. Encrypt with AES-256-CBC
4. SHA-256 hash the plaintext
5. Call `initializeVault()` on the deployed contract
6. Generate agent ECDSA keypair
7. Print AES key (CRITICAL — save this)

### 4. OpenClaw Skill Updates

Update `~/.openclaw/skills/brand-mover/scripts/` to use ethers.js targeting Hedera:

**read_vault.js:**
- ethers.js provider pointing to `https://testnet.hashio.io/api`
- Call `getEncryptedGuidelines()` view function
- Decrypt with AES-256-CBC using stored key
- Return JSON

**create_campaign.js:**
- ethers.js + wallet signer
- Call `createCampaign()` or `launchCampaignWithRemarketing()` for full campaign + auto-scheduled remarketing

**schedule_content.js:**
- Call `launchCampaignWithRemarketing()` — HSS handles the scheduling natively

**log_activity.js:**
- Call `logAgentActivity()`

**Environment variables for openclaw.json:**
```json
{
  "BRAND_AES_KEY": "<hex key>",
  "BRAND_VAULT_ADDRESS": "<contract address on Hedera>",
  "HEDERA_RPC_URL": "https://testnet.hashio.io/api",
  "AGENT_PRIVATE_KEY": "<ECDSA private key>",
  "HEDERA_CHAIN_ID": "296"
}
```

### 5. SKILL.md Update

Update the OpenClaw skill definition to reference Hedera instead of Movement. Same 4 workflows:
1. Read Guidelines — fetch from Hedera, decrypt locally
2. Full Campaign Launch — generate 7 content types, hash, log campaign, schedule remarketing via HSS
3. Brand Monitoring — web search for mentions, log activity
4. Execute Scheduled — now handled by Hedera HSS automatically (highlight this!)

### 6. Integration with Team Swarm

The brand agent needs to:
- Accept instructions from the swarm coordinator ("generate a campaign for X")
- Read its own encrypted vault for brand guidelines
- Generate content and log onchain
- Report back to swarm coordinator with campaign hash
- Accept revenue allocation from trading agent (for growth wallet / ad spend)

The contract should have a `receive()` function or a `depositToGrowthWallet()` so the trading agent can send HBAR to fund marketing operations.

## Hedera Schedule Service Reference

The HSS system contract is at address `0x16b`. Key interface:

```solidity
interface IHederaScheduleService {
    function authorizeSchedule(address schedule) external returns (int64 responseCode);
    function signSchedule(address schedule, bytes memory signatureMap) external returns (int64 responseCode);
}
```

For HIP-1215 (generalized scheduled contract calls), the contract can schedule future calls to itself:
```solidity
function scheduleContractCall(
    address to,
    bytes memory callData, 
    address payer,
    uint256 expirationTime
) external returns (int64 responseCode, address scheduleAddress);
```

Note: HIP-1215 may still be in development. Check https://docs.hedera.com/hedera/core-concepts/smart-contracts/system-smart-contracts/hedera-schedule-service for latest status. If not available yet on testnet, implement a fallback pattern where the contract stores scheduled entries and the agent manually triggers execution when time is due (same as Movement version), but structure the code so HSS can be swapped in.

## File Structure

```
swarm/
├── contracts/
│   └── brand-agent/
│       ├── BrandVault.sol
│       ├── IHederaScheduleService.sol
│       └── hardhat.config.js
├── scripts/
│   └── brand-agent/
│       ├── init_vault.ts
│       └── deploy.ts
├── openclaw-skills/
│   └── brand-mover/
│       ├── SKILL.md
│       └── scripts/
│           ├── read_vault.js
│           ├── create_campaign.js
│           ├── schedule_content.js
│           └── log_activity.js
└── frontend/
    └── (dashboard - port from Movement version)
```

## Priority Order
1. Write and deploy `BrandVault.sol` with HSS integration
2. Run `init_vault.ts` to encrypt and store FOID Foundation guidelines
3. Update OpenClaw scripts for Hedera
4. Test full loop: read guidelines → generate campaign → log onchain → schedule remarketing
5. Wire up to team's swarm coordinator
6. Frontend dashboard (if time permits)
