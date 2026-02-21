# 🔐 BrandMover v2: Full Campaign Launch System
## Encrypted Onchain Brand Vault + AI CMO Agent (OpenClaw × Movement)
### Movement OpenClaw Hackathon @ ETHDenver — Feb 19, 2026 (5 Hours)

---

## WHAT YOU'RE BUILDING

One command: **"Launch my campaign"**

The AI CMO agent:
1. Reads encrypted brand guidelines from Movement chain
2. Decrypts locally (plaintext never touches the chain)
3. Generates a FULL campaign launch package:
   - 📰 Press Release
   - 🐦 Twitter/X thread
   - 💼 LinkedIn post
   - 💬 Discord announcement
   - 📸 Instagram caption
   - 🎬 20-sec video promo script + AI-generated video
   - 📧 Email newsletter snippet
4. Hashes ALL content and logs campaign onchain
5. Auto-schedules remarketing content for T+7 days across all channels
6. Logs the full schedule onchain as an audit trail

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  YOU: "Launch a campaign for ETHDenver"                          │
│  (via Telegram / Discord / OpenClaw Control UI)                  │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  OPENCLAW GATEWAY (Running locally on your machine)              │
│  Loads brand-mover SKILL.md                                      │
│  Has AES-256 decryption key in local .env                        │
└────────┬──────────────────────────┬──────────────────────────────┘
         │                          │
         ▼                          ▼
┌──────────────────┐    ┌──────────────────────────────────────────┐
│  MOVEMENT RPC     │    │  CLAUDE API (Content Generation)         │
│                    │    │                                          │
│  1. Read encrypted │    │  3. Receive decrypted brand guidelines   │
│     brand vault    │    │  4. Generate FULL campaign package:      │
│  2. Decrypt locally│    │     - Press Release                      │
│                    │    │     - Twitter thread                     │
│  6. Write campaign │    │     - LinkedIn post                      │
│     hash onchain   │    │     - Discord announcement               │
│  7. Write remarket │    │     - Instagram caption                  │
│     schedule onchain│   │     - Video promo script                 │
│  8. Log all agent  │    │     - Email newsletter                   │
│     activity       │    │  5. Generate remarketing series (T+7)    │
└──────────────────┘    └──────────────────────────────────────────┘
```

---

## HOUR-BY-HOUR BREAKDOWN

---

## HOUR 1 (12:00–13:00): Move Smart Contract on Movement

### Step 1.1: Set Up Movement Dev Environment

```bash
# Install Aptos CLI (Movement-compatible)
curl -fsSL "https://aptos.dev/scripts/install_cli.py" | python3

# Create project
mkdir brandmover && cd brandmover
aptos init --network custom --rest-url https://testnet.movementnetwork.xyz/v1

# Fund your account via Movement faucet
# Save your address
export VAULT_OWNER_ADDRESS=0x<your_address_here>
```

### Step 1.2: Create `Move.toml`

```toml
[package]
name = "brandmover"
version = "1.0.0"

[addresses]
brandmover = "_"

[dependencies]
AptosFramework = { git = "https://github.com/aptos-labs/aptos-core.git", subdir = "aptos-move/framework/aptos-framework", rev = "main" }
```

> **NOTE:** Ask Movement team at hackathon for their exact framework dependency. May differ.

### Step 1.3: Create `sources/brand_vault.move`

```move
module brandmover::brand_vault {
    use std::signer;
    use std::vector;
    use std::string::String;
    use aptos_framework::timestamp;
    use aptos_framework::event;

    // ============================================================
    // ERROR CODES
    // ============================================================
    const E_NOT_OWNER: u64 = 1;
    const E_VAULT_EXISTS: u64 = 2;
    const E_VAULT_NOT_FOUND: u64 = 3;
    const E_NOT_AUTHORIZED: u64 = 4;
    const E_AGENT_NOT_SET: u64 = 5;

    // ============================================================
    // RESOURCES
    // ============================================================

    /// Core brand vault — stores ENCRYPTED brand guidelines
    struct BrandVault has key {
        encrypted_guidelines: vector<u8>,
        guidelines_hash: vector<u8>,
        brand_name: String,
        owner: address,
        agent_address: address,
        authorized_readers: vector<address>,
        campaign_count: u64,
        last_updated: u64,
    }

    /// A campaign with full launch metadata
    struct Campaign has key, store, drop, copy {
        id: u64,
        content_hash: vector<u8>,
        platforms: String,
        name: String,
        campaign_type: String,       // "full_launch", "remarketing", "pr_only"
        content_types: String,       // "pr,twitter,linkedin,discord,instagram,video,email"
        created_by: address,
        created_at: u64,
        status: u8,                  // 0=draft, 1=active, 2=complete, 3=scheduled
    }

    /// Stores all campaigns for a brand
    struct CampaignRegistry has key {
        campaigns: vector<Campaign>,
    }

    /// Scheduled remarketing content
    struct ScheduledContent has key {
        entries: vector<ScheduleEntry>,
    }

    struct ScheduleEntry has store, drop, copy {
        campaign_id: u64,
        content_hash: vector<u8>,
        platforms: String,
        schedule_type: String,       // "remarketing_7d", "remarketing_14d", "followup"
        scheduled_for: u64,          // unix timestamp for when to execute
        created_at: u64,
        executed: bool,
    }

    /// Activity log for the AI agent
    struct AgentActivityLog has key {
        entries: vector<ActivityEntry>,
    }

    struct ActivityEntry has store, drop, copy {
        action_type: String,
        description: String,
        data_hash: vector<u8>,
        timestamp: u64,
    }

    // ============================================================
    // EVENTS
    // ============================================================

    #[event]
    struct VaultCreatedEvent has drop, store {
        owner: address,
        brand_name: String,
        timestamp: u64,
    }

    #[event]
    struct CampaignCreatedEvent has drop, store {
        campaign_id: u64,
        name: String,
        campaign_type: String,
        content_types: String,
        created_by: address,
        platforms: String,
        timestamp: u64,
    }

    #[event]
    struct ContentScheduledEvent has drop, store {
        campaign_id: u64,
        schedule_type: String,
        scheduled_for: u64,
        platforms: String,
        timestamp: u64,
    }

    #[event]
    struct AgentActivityEvent has drop, store {
        agent: address,
        action_type: String,
        data_hash: vector<u8>,
        timestamp: u64,
    }

    // ============================================================
    // PUBLIC ENTRY FUNCTIONS
    // ============================================================

    /// Initialize a new brand vault with encrypted guidelines
    public entry fun initialize_vault(
        owner: &signer,
        brand_name: String,
        encrypted_guidelines: vector<u8>,
        guidelines_hash: vector<u8>,
        agent_address: address,
    ) {
        let owner_addr = signer::address_of(owner);
        assert!(!exists<BrandVault>(owner_addr), E_VAULT_EXISTS);

        let now = timestamp::now_seconds();

        move_to(owner, BrandVault {
            encrypted_guidelines,
            guidelines_hash,
            brand_name,
            owner: owner_addr,
            agent_address,
            authorized_readers: vector::empty<address>(),
            campaign_count: 0,
            last_updated: now,
        });

        move_to(owner, CampaignRegistry {
            campaigns: vector::empty<Campaign>(),
        });

        move_to(owner, ScheduledContent {
            entries: vector::empty<ScheduleEntry>(),
        });

        move_to(owner, AgentActivityLog {
            entries: vector::empty<ActivityEntry>(),
        });

        event::emit(VaultCreatedEvent {
            owner: owner_addr,
            brand_name,
            timestamp: now,
        });
    }

    /// Update encrypted guidelines — OWNER ONLY
    public entry fun update_guidelines(
        owner: &signer,
        new_encrypted_guidelines: vector<u8>,
        new_guidelines_hash: vector<u8>,
    ) acquires BrandVault {
        let owner_addr = signer::address_of(owner);
        assert!(exists<BrandVault>(owner_addr), E_VAULT_NOT_FOUND);
        let vault = borrow_global_mut<BrandVault>(owner_addr);
        assert!(vault.owner == owner_addr, E_NOT_OWNER);

        vault.encrypted_guidelines = new_encrypted_guidelines;
        vault.guidelines_hash = new_guidelines_hash;
        vault.last_updated = timestamp::now_seconds();
    }

    /// Add authorized reader — OWNER ONLY
    public entry fun add_reader(
        owner: &signer,
        reader_address: address,
    ) acquires BrandVault {
        let owner_addr = signer::address_of(owner);
        let vault = borrow_global_mut<BrandVault>(owner_addr);
        assert!(vault.owner == owner_addr, E_NOT_OWNER);
        vector::push_back(&mut vault.authorized_readers, reader_address);
    }

    /// Set AI agent address — OWNER ONLY
    public entry fun set_agent(
        owner: &signer,
        new_agent_address: address,
    ) acquires BrandVault {
        let owner_addr = signer::address_of(owner);
        let vault = borrow_global_mut<BrandVault>(owner_addr);
        assert!(vault.owner == owner_addr, E_NOT_OWNER);
        vault.agent_address = new_agent_address;
    }

    /// Create a full campaign — OWNER or AGENT only
    public entry fun create_campaign(
        caller: &signer,
        vault_owner: address,
        name: String,
        content_hash: vector<u8>,
        platforms: String,
        campaign_type: String,
        content_types: String,
    ) acquires BrandVault, CampaignRegistry {
        let caller_addr = signer::address_of(caller);
        let vault = borrow_global_mut<BrandVault>(vault_owner);
        assert!(
            caller_addr == vault.owner || caller_addr == vault.agent_address,
            E_NOT_AUTHORIZED
        );

        let now = timestamp::now_seconds();
        let campaign_id = vault.campaign_count;
        vault.campaign_count = campaign_id + 1;

        let campaign = Campaign {
            id: campaign_id,
            content_hash,
            platforms,
            name,
            campaign_type,
            content_types,
            created_by: caller_addr,
            created_at: now,
            status: 1,
        };

        let registry = borrow_global_mut<CampaignRegistry>(vault_owner);
        vector::push_back(&mut registry.campaigns, campaign);

        event::emit(CampaignCreatedEvent {
            campaign_id,
            name,
            campaign_type,
            content_types,
            created_by: caller_addr,
            platforms,
            timestamp: now,
        });
    }

    /// Schedule remarketing content — OWNER or AGENT only
    public entry fun schedule_content(
        caller: &signer,
        vault_owner: address,
        campaign_id: u64,
        content_hash: vector<u8>,
        platforms: String,
        schedule_type: String,
        scheduled_for: u64,
    ) acquires BrandVault, ScheduledContent {
        let caller_addr = signer::address_of(caller);
        let vault = borrow_global<BrandVault>(vault_owner);
        assert!(
            caller_addr == vault.owner || caller_addr == vault.agent_address,
            E_NOT_AUTHORIZED
        );

        let now = timestamp::now_seconds();
        let entry = ScheduleEntry {
            campaign_id,
            content_hash,
            platforms,
            schedule_type,
            scheduled_for,
            created_at: now,
            executed: false,
        };

        let schedule = borrow_global_mut<ScheduledContent>(vault_owner);
        vector::push_back(&mut schedule.entries, entry);

        event::emit(ContentScheduledEvent {
            campaign_id,
            schedule_type,
            scheduled_for,
            platforms,
            timestamp: now,
        });
    }

    /// Log agent activity — AGENT ONLY
    public entry fun log_agent_activity(
        agent: &signer,
        vault_owner: address,
        action_type: String,
        description: String,
        data_hash: vector<u8>,
    ) acquires BrandVault, AgentActivityLog {
        let agent_addr = signer::address_of(agent);
        let vault = borrow_global<BrandVault>(vault_owner);
        assert!(agent_addr == vault.agent_address, E_NOT_AUTHORIZED);

        let now = timestamp::now_seconds();
        let entry = ActivityEntry {
            action_type,
            description,
            data_hash,
            timestamp: now,
        };

        let log = borrow_global_mut<AgentActivityLog>(vault_owner);
        vector::push_back(&mut log.entries, entry);

        event::emit(AgentActivityEvent {
            agent: agent_addr,
            action_type,
            data_hash,
            timestamp: now,
        });
    }

    // ============================================================
    // VIEW FUNCTIONS
    // ============================================================

    #[view]
    public fun get_encrypted_guidelines(vault_owner: address): vector<u8> acquires BrandVault {
        borrow_global<BrandVault>(vault_owner).encrypted_guidelines
    }

    #[view]
    public fun get_brand_name(vault_owner: address): String acquires BrandVault {
        borrow_global<BrandVault>(vault_owner).brand_name
    }

    #[view]
    public fun get_guidelines_hash(vault_owner: address): vector<u8> acquires BrandVault {
        borrow_global<BrandVault>(vault_owner).guidelines_hash
    }

    #[view]
    public fun get_campaign_count(vault_owner: address): u64 acquires BrandVault {
        borrow_global<BrandVault>(vault_owner).campaign_count
    }

    #[view]
    public fun get_agent_address(vault_owner: address): address acquires BrandVault {
        borrow_global<BrandVault>(vault_owner).agent_address
    }
}
```

### Step 1.4: Compile and Deploy

```bash
# Compile
aptos move compile --named-addresses brandmover=default

# Deploy to Movement testnet
aptos move publish --named-addresses brandmover=default \
  --url https://testnet.movementnetwork.xyz/v1

# Save your address
export VAULT_OWNER_ADDRESS=0x<your_address_here>
```

### Step 1.5: Encrypt and Initialize Vault

Create `scripts/init_vault.ts`:

```typescript
import * as crypto from 'crypto';

// Your brand guidelines
const brandGuidelines = JSON.stringify({
  voice: "Irreverent, optimistic, technically precise. We speak like builders who believe the internet can be magical again.",
  tone: "Playful but never frivolous. Think early-internet wonder meets serious engineering.",
  colors: {
    primary: "#00D4AA",
    secondary: "#FF6B35",
    background: "#0A0A1A",
    accent: "#7B61FF"
  },
  doNotUse: [
    "synergy", "leverage", "disrupt", "web3 native",
    "to the moon", "WAGMI", "not financial advice"
  ],
  targetAudience: "Developers and creators who miss the magic of early internet. Ages 22-35. Active on Twitter, Discord, Farcaster.",
  messagingPillars: [
    "The internet's permanent memory",
    "Culture is the real currency",
    "Built by the community, for the community"
  ],
  approvedHashtags: ["#FOID", "#CultureOnchain", "#InternetMemory", "#BrandMover"],
  competitorPositioning: "Unlike NFT marketplaces, we're not about trading. We're about preserving and curating culture collaboratively.",
  pressReleaseStyle: "AP style, concise leads, quote from founder in paragraph 3. No jargon. Max 400 words.",
  videoStyle: "Fast-paced, glitch aesthetic, text overlays, no voiceover needed. 20 seconds max. Hook in first 2 seconds."
});

// Encrypt
const AES_KEY = crypto.randomBytes(32);
const IV = crypto.randomBytes(16);
const cipher = crypto.createCipheriv('aes-256-cbc', AES_KEY, IV);
let encrypted = cipher.update(brandGuidelines, 'utf8', 'hex');
encrypted += cipher.final('hex');
const encryptedWithIV = IV.toString('hex') + encrypted;

// Hash plaintext for verification
const guidelinesHash = crypto.createHash('sha256')
  .update(brandGuidelines).digest('hex');

console.log("=== SAVE THESE VALUES ===\n");
console.log("AES_KEY (KEEP SECRET — goes in OpenClaw .env):");
console.log(AES_KEY.toString('hex'));
console.log("\nEncrypted guidelines (hex, goes onchain):");
console.log(encryptedWithIV);
console.log("\nGuidelines hash (hex, goes onchain):");
console.log(guidelinesHash);
console.log("\n=== MOVE CLI COMMAND ===");
console.log(`aptos move run \\`);
console.log(`  --function-id \${VAULT_OWNER_ADDRESS}::brand_vault::initialize_vault \\`);
console.log(`  --args string:"FOID Foundation" \\`);
console.log(`         hex:${encryptedWithIV} \\`);
console.log(`         hex:${guidelinesHash} \\`);
console.log(`         address:0x<AGENT_WALLET_ADDRESS> \\`);
console.log(`  --url https://testnet.movementnetwork.xyz/v1`);
```

Run it:
```bash
npx ts-node scripts/init_vault.ts
# Execute the outputted Move CLI command
# SAVE THE AES_KEY IN MULTIPLE PLACES
```

---

## HOUR 2 (13:00–14:00): OpenClaw Skill — `brand-mover`

### Step 2.1: Create Skill Directory

```bash
mkdir -p ~/.openclaw/skills/brand-mover/scripts
mkdir -p ~/.openclaw/skills/brand-mover/references
```

### Step 2.2: Create `SKILL.md`

Create `~/.openclaw/skills/brand-mover/SKILL.md`:

````markdown
---
name: brand-mover
description: >
  Full-stack AI CMO agent. Onchain brand management with encrypted guidelines,
  full campaign launches (PR + social + video + email), and automated
  remarketing scheduling. Triggers on: "brand", "campaign", "launch",
  "marketing", "content", "press release", "social media", "remarketing",
  "schedule", "CMO", "guidelines", "brand report", "video promo".
metadata:
  openclaw:
    emoji: "🔐"
    requires:
      bins: ["node", "curl"]
---

# BrandMover: Full-Stack AI CMO Agent

You are an autonomous AI CMO managing a brand whose identity is stored as
AES-256 encrypted data on the Movement blockchain. You don't just generate
content — you EXECUTE full campaign launches and schedule follow-up marketing.

## Core Architecture

- Brand guidelines: AES-256 encrypted onchain in a Move smart contract
- Decryption key: held locally in environment variable BRAND_AES_KEY
- Flow: read encrypted from chain → decrypt locally → generate content → hash → log onchain
- Every campaign and scheduled content is logged onchain with content hashes
- Remarketing runs autonomously — you schedule it and the gateway executes later

## Environment Variables

- `BRAND_AES_KEY` — AES-256 hex key for decrypting brand guidelines
- `BRAND_VAULT_ADDRESS` — Movement address of the BrandVault
- `MOVEMENT_RPC_URL` — Movement RPC (default: https://testnet.movementnetwork.xyz/v1)
- `AGENT_PRIVATE_KEY` — Agent wallet private key for onchain writes

## ============================================================
## WORKFLOW 1: Read Brand Guidelines
## ============================================================

When you need brand guidelines for ANY task:

1. Run: `node {baseDir}/scripts/read_vault.js`
2. Parse the returned JSON and use ALL fields:
   - `voice` — match this tone exactly
   - `tone` — calibrate formality
   - `colors` — reference in visual content
   - `doNotUse` — NEVER use these words/phrases
   - `targetAudience` — tailor to this demographic
   - `messagingPillars` — weave into all content
   - `approvedHashtags` — use only these
   - `competitorPositioning` — maintain differentiation
   - `pressReleaseStyle` — follow for all PR content
   - `videoStyle` — follow for all video scripts

## ============================================================
## WORKFLOW 2: Full Campaign Launch (THE MAIN EVENT)
## ============================================================

When user says "launch a campaign" or "full launch":

### Phase 1: Read & Decrypt
1. Run `node {baseDir}/scripts/read_vault.js` to get brand guidelines

### Phase 2: Generate Full Content Package
Generate ALL of the following, constrained by brand guidelines:

**📰 PRESS RELEASE**
- Follow `pressReleaseStyle` from guidelines
- AP style, concise lead paragraph
- Include a quote from the founder/team
- Max 400 words
- Include boilerplate "About [Brand]" at bottom

**🐦 TWITTER/X THREAD (3-5 tweets)**
- Hook tweet: bold claim or question (max 280 chars)
- Supporting tweets with key details
- Final tweet: CTA with approved hashtags
- Tag relevant accounts if mentioned

**💼 LINKEDIN POST**
- Professional but on-brand tone
- 150-300 words
- Include a "why this matters" angle
- End with engagement question

**💬 DISCORD ANNOUNCEMENT**
- Community-native tone
- Use emoji section headers
- Include key links and dates
- End with community call-to-action

**📸 INSTAGRAM CAPTION**
- Concise, visual-first language
- Line breaks for readability
- Approved hashtags at the end (5-10)
- CTA: "Link in bio" or "Drop a 🔥 if..."

**🎬 VIDEO PROMO SCRIPT (20 seconds)**
- Follow `videoStyle` from guidelines
- Format as shot-by-shot breakdown:
  - [0-2s] HOOK: bold text overlay + glitch
  - [2-8s] PROBLEM: what we're solving
  - [8-15s] SOLUTION: the product/event in action
  - [15-18s] SOCIAL PROOF: numbers or testimonials
  - [18-20s] CTA: clear next step
- Include text overlay copy for each segment
- Include suggested background music mood

**📧 EMAIL NEWSLETTER SNIPPET**
- Subject line (A/B test: provide 2 options)
- Preview text (40-90 chars)
- Body: 150-200 words, one clear CTA
- Matches brand voice

### Phase 3: Hash & Log Onchain
1. Combine ALL generated content into one string
2. Create SHA-256 hash of combined content
3. Log campaign onchain:
   ```bash
   node {baseDir}/scripts/create_campaign.js \
     --name "Campaign Name" \
     --content-hash <sha256_hex> \
     --platforms "twitter,linkedin,discord,instagram,youtube,email" \
     --campaign-type "full_launch" \
     --content-types "pr,twitter,linkedin,discord,instagram,video,email"
   ```
4. Log agent activity:
   ```bash
   node {baseDir}/scripts/log_activity.js \
     --action "full_campaign_launched" \
     --description "Full launch: [name] — PR + 5 social + video + email" \
     --data-hash <sha256_hex>
   ```

### Phase 4: Schedule Remarketing (T+7 Days)
Generate a SECOND set of content for remarketing, 7 days after launch:

**Remarketing content should:**
- Reference the original campaign ("Last week we announced...")
- Create urgency ("Only X days left..." / "Don't miss...")
- Include a new angle or update
- Be shorter/punchier than the original

Generate remarketing versions of:
- Twitter/X (2-3 tweets)
- LinkedIn (shorter recap post)
- Discord (reminder ping)
- Instagram caption (urgency-focused)
- Email (short follow-up, "in case you missed it")

Then hash and schedule:
```bash
node {baseDir}/scripts/schedule_content.js \
  --campaign-id <id_from_step_3> \
  --content-hash <remarketing_sha256> \
  --platforms "twitter,linkedin,discord,instagram,email" \
  --schedule-type "remarketing_7d" \
  --days-from-now 7
```

Log the scheduling:
```bash
node {baseDir}/scripts/log_activity.js \
  --action "remarketing_scheduled" \
  --description "Scheduled 7-day remarketing for campaign: [name]" \
  --data-hash <remarketing_sha256>
```

### Phase 5: Present Everything to User
Display ALL content organized by platform, with clear headers.
Show the onchain campaign ID and content hashes.
Confirm the remarketing schedule.

## ============================================================
## WORKFLOW 3: Brand Monitoring
## ============================================================

When user says "monitor brand" or "check mentions":
1. Web search for recent brand mentions
2. Analyze sentiment
3. Compile report with metrics
4. Hash report and log onchain

## ============================================================
## WORKFLOW 4: Execute Scheduled Content
## ============================================================

When the gateway triggers a scheduled task (or user says "execute scheduled"):
1. Check `ScheduledContent` onchain for entries where `scheduled_for <= now`
2. Present the pre-generated remarketing content for user approval
3. On approval, mark as executed

## Content Rules (ALWAYS FOLLOW)

- NEVER generate content without first reading encrypted guidelines from chain
- NEVER use any phrase in the `doNotUse` list
- ALWAYS include at least one `approvedHashtag` in social posts
- ALWAYS match the `voice` and `tone` descriptions
- ALWAYS reference at least one `messagingPillar` naturally
- Press releases ALWAYS follow `pressReleaseStyle`
- Video scripts ALWAYS follow `videoStyle`
- If unsure about brand alignment, ask the user

## Pitch / Demo Mode

When user says "demo" or "pitch mode":
- Walk through the full flow visibly: fetch → decrypt → generate all 7 content types → hash → log onchain → schedule remarketing
- Narrate each step for the audience
- Emphasize: "One command launched a full marketing campaign with 7 content types and auto-scheduled follow-up"
````

### Step 2.3: Create the Scripts

**`scripts/read_vault.js`** — Fetches encrypted guidelines from Movement and decrypts locally:

```javascript
#!/usr/bin/env node
const crypto = require('crypto');
const https = require('https');
const http = require('http');

const VAULT_ADDRESS = process.env.BRAND_VAULT_ADDRESS;
const AES_KEY = Buffer.from(process.env.BRAND_AES_KEY, 'hex');
const RPC_URL = process.env.MOVEMENT_RPC_URL || 'https://testnet.movementnetwork.xyz/v1';

async function fetchFromChain() {
  const url = `${RPC_URL}/view`;
  const body = JSON.stringify({
    function: `${VAULT_ADDRESS}::brand_vault::get_encrypted_guidelines`,
    type_arguments: [],
    arguments: [VAULT_ADDRESS]
  });

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const req = client.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function decrypt(encryptedHex) {
  const iv = Buffer.from(encryptedHex.slice(0, 32), 'hex');
  const ciphertext = Buffer.from(encryptedHex.slice(32), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', AES_KEY, iv);
  let decrypted = decipher.update(ciphertext, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function main() {
  try {
    const response = await fetchFromChain();
    const encryptedHex = response[0] || response.result?.[0];
    if (!encryptedHex) {
      console.error("No data from chain:", JSON.stringify(response));
      process.exit(1);
    }
    const cleanHex = encryptedHex.startsWith('0x') ? encryptedHex.slice(2) : encryptedHex;
    const plaintext = decrypt(cleanHex);
    console.log(JSON.stringify(JSON.parse(plaintext), null, 2));
  } catch (err) {
    console.error("Error reading vault:", err.message);
    process.exit(1);
  }
}

main();
```

**`scripts/create_campaign.js`** — Creates campaign onchain:

```javascript
#!/usr/bin/env node
const { execSync } = require('child_process');

const args = process.argv.slice(2);
function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : null;
}

const name = getArg('--name') || 'Unnamed Campaign';
const contentHash = getArg('--content-hash') || '00';
const platforms = getArg('--platforms') || 'twitter';
const campaignType = getArg('--campaign-type') || 'full_launch';
const contentTypes = getArg('--content-types') || 'twitter';

const VAULT_ADDRESS = process.env.BRAND_VAULT_ADDRESS;
const RPC_URL = process.env.MOVEMENT_RPC_URL || 'https://testnet.movementnetwork.xyz/v1';

try {
  const cmd = `aptos move run \
    --function-id ${VAULT_ADDRESS}::brand_vault::create_campaign \
    --args address:${VAULT_ADDRESS} \
           string:"${name}" \
           hex:${contentHash} \
           string:"${platforms}" \
           string:"${campaignType}" \
           string:"${contentTypes}" \
    --url ${RPC_URL} \
    --assume-yes`;

  const result = execSync(cmd, { encoding: 'utf8' });
  console.log("Campaign created onchain!");
  console.log(result);
} catch (err) {
  console.error("Error creating campaign:", err.message);
  process.exit(1);
}
```

**`scripts/schedule_content.js`** — Schedules remarketing content onchain:

```javascript
#!/usr/bin/env node
const { execSync } = require('child_process');

const args = process.argv.slice(2);
function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : null;
}

const campaignId = getArg('--campaign-id') || '0';
const contentHash = getArg('--content-hash') || '00';
const platforms = getArg('--platforms') || 'twitter';
const scheduleType = getArg('--schedule-type') || 'remarketing_7d';
const daysFromNow = parseInt(getArg('--days-from-now') || '7');

// Calculate unix timestamp for scheduled execution
const scheduledFor = Math.floor(Date.now() / 1000) + (daysFromNow * 86400);

const VAULT_ADDRESS = process.env.BRAND_VAULT_ADDRESS;
const RPC_URL = process.env.MOVEMENT_RPC_URL || 'https://testnet.movementnetwork.xyz/v1';

try {
  const cmd = `aptos move run \
    --function-id ${VAULT_ADDRESS}::brand_vault::schedule_content \
    --args address:${VAULT_ADDRESS} \
           u64:${campaignId} \
           hex:${contentHash} \
           string:"${platforms}" \
           string:"${scheduleType}" \
           u64:${scheduledFor} \
    --url ${RPC_URL} \
    --assume-yes`;

  const result = execSync(cmd, { encoding: 'utf8' });
  console.log(`Remarketing scheduled for ${new Date(scheduledFor * 1000).toISOString()}`);
  console.log(result);
} catch (err) {
  console.error("Error scheduling content:", err.message);
  process.exit(1);
}
```

**`scripts/log_activity.js`** — Logs agent activity onchain:

```javascript
#!/usr/bin/env node
const { execSync } = require('child_process');

const args = process.argv.slice(2);
function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : null;
}

const action = getArg('--action') || 'unknown';
const description = getArg('--description') || '';
const dataHash = getArg('--data-hash') || '00';

const VAULT_ADDRESS = process.env.BRAND_VAULT_ADDRESS;
const RPC_URL = process.env.MOVEMENT_RPC_URL || 'https://testnet.movementnetwork.xyz/v1';

try {
  const cmd = `aptos move run \
    --function-id ${VAULT_ADDRESS}::brand_vault::log_agent_activity \
    --args address:${VAULT_ADDRESS} \
           string:"${action}" \
           string:"${description}" \
           hex:${dataHash} \
    --url ${RPC_URL} \
    --assume-yes`;

  const result = execSync(cmd, { encoding: 'utf8' });
  console.log("Activity logged onchain!");
  console.log(result);
} catch (err) {
  console.error("Error logging activity:", err.message);
  process.exit(1);
}
```

### Step 2.4: Configure OpenClaw Environment

Add to `~/.openclaw/openclaw.json`:

```json
{
  "agent": {
    "model": "anthropic/claude-sonnet-4-5-20250929"
  },
  "env": {
    "BRAND_AES_KEY": "<paste hex key from Step 1.5>",
    "BRAND_VAULT_ADDRESS": "0x<your_vault_owner_address>",
    "MOVEMENT_RPC_URL": "https://testnet.movementnetwork.xyz/v1"
  }
}
```

### Step 2.5: Test

```
Read my brand guidelines from chain
```

Agent should return full decrypted guidelines with voice, tone, colors, doNotUse, etc.

---

## HOUR 3 (14:00–15:00): Full Campaign Launch Engine

### Step 3.1: Test the Full Launch

Send this to your OpenClaw agent:

```
Launch a full campaign called "BrandMover at ETHDenver" announcing that
BrandMover is the first encrypted onchain brand management system, built on
Movement blockchain. We're demoing live at ETHDenver 2026.

I need the FULL package:
- Press release
- Twitter/X thread
- LinkedIn post
- Discord announcement
- Instagram caption
- 20-second video promo script
- Email newsletter snippet

Then schedule remarketing content for 7 days from now across all channels.
```

**What should happen:**
1. Agent reads encrypted guidelines from Movement chain
2. Agent decrypts locally using AES key
3. Agent generates ALL 7 content types, constrained to brand voice/rules
4. Agent hashes all content combined
5. Agent calls `create_campaign.js` to log onchain with type "full_launch"
6. Agent generates remarketing content series
7. Agent calls `schedule_content.js` to log scheduled content onchain
8. Agent presents EVERYTHING organized by platform with headers

### Step 3.2: Verify Onchain

```bash
# Check campaign count (should be 1)
aptos move view \
  --function-id $VAULT_OWNER_ADDRESS::brand_vault::get_campaign_count \
  --args address:$VAULT_OWNER_ADDRESS \
  --url https://testnet.movementnetwork.xyz/v1
```

### Step 3.3: Iterate

If any content feels off-brand, tweak the SKILL.md instructions. OpenClaw reloads skills on the fly.

### Step 3.4: Pre-Generate Video (IMPORTANT)

The agent generates a VIDEO SCRIPT. For the demo, you should have an actual video ready:

**Option A: Pre-render before the hackathon**
- Take the video script the agent generates
- Use Runway (runwayml.com) or Pika to generate a 20-second clip
- Have it ready on your laptop to show during the demo

**Option B: During the demo**
- Show the detailed shot-by-shot script the agent generated
- Say "In production, this script feeds directly to Runway's API to generate the video"
- Show a sample pre-made video as proof of concept

---

## HOUR 4 (15:00–16:00): Dashboard OR Polish (YOUR CHOICE)

### Option A: Quick React Dashboard

If you have time, build a single-page dashboard showing:

1. **Vault Status** — Brand name, encrypted hex preview (Matrix-style), last updated
2. **Campaign Feed** — Each campaign with type, platforms, content hash, timestamp
3. **Scheduled Content** — Upcoming remarketing with countdown timers
4. **Agent Activity Log** — Live feed of agent actions

Use your brand colors: `#00D4AA`, `#FF6B35`, `#0A0A1A`, `#7B61FF`

### Option B: Skip Dashboard, Polish Demo

If time is tight, use Movement block explorer to show onchain data. Spend this hour:
- Running the full demo 3 times
- Noting any issues
- Pre-generating backup content
- Recording a 60-second backup video

**I recommend Option B.** A polished demo beats a buggy dashboard.

---

## HOUR 5 (16:00–17:00): Demo & Pitch

### Demo Script (Practice This 3x)

**[Screen: OpenClaw chat + Movement explorer side by side]**

---

**"Hey everyone, I'm Moses. My girlfriend is a CMO whose CEO just asked her to explore AI marketing tools. So I built her an AI CMO that actually LAUNCHES campaigns — not just writes drafts."**

**[Send to agent:]**
> "Read my brand guidelines from chain"

**"Our brand guidelines live on Movement chain — but they're AES-256 encrypted."**

**[Show Movement explorer: encrypted hex data visible but unreadable]**

**"Nobody scanning this chain can read our brand strategy. Competitors can't reverse-engineer our messaging. But our AI CMO holds the decryption key locally."**

**[Agent returns decrypted guidelines]**

**"Decrypted on my machine. The plaintext never touches the blockchain. Now watch what a FULL campaign launch looks like."**

**[Send to agent:]**
> "Launch a full campaign called 'Movement Demo Day' for our ETHDenver showcase. Give me everything — press release, Twitter, LinkedIn, Discord, Instagram, video promo, and email. Then schedule remarketing for next week."

**[Agent generates all 7 content types + remarketing schedule]**

**"One command. Seven pieces of professional marketing content — press release, social media for 4 platforms, a video production script, and an email blast. All perfectly on-brand — no banned phrases, matching our voice, using our approved hashtags."**

**[Point to onchain data]**

**"The campaign is now logged on Movement chain with a content hash. And look — remarketing content is SCHEDULED for 7 days from now. This agent will wake up next week and execute the follow-up campaign automatically."**

**"This is Move's resource-oriented programming applied to brand identity. Your brand is a non-copyable, non-duplicable resource. Only the owner controls it. The encryption layer keeps strategy private. And the AI CMO runs 24/7."**

**"One Mac Mini. One AI agent. A full marketing department for any brand in the Movement ecosystem. Thank you."**

---

### Judge Q&A

1. **"Why Move?"** — Move's resource model treats brand identity like a financial asset. Non-duplicable, owner-controlled, enforced at the VM level.

2. **"Why encrypt?"** — Brand guidelines contain competitive strategy. Encryption gives you blockchain immutability + privacy. Competitors can't read your playbook.

3. **"Why OpenClaw?"** — This isn't a chatbot. It's an always-on, autonomous CMO. It runs campaigns, schedules follow-ups, monitors mentions. OpenClaw's persistent agent + skill architecture makes it a 24/7 brand manager.

4. **"How does remarketing work?"** — The agent generates follow-up content at launch time, schedules it onchain with a timestamp. The OpenClaw gateway checks for scheduled tasks and executes them when the time arrives. All logged and auditable.

5. **"Video generation?"** — The agent creates shot-by-shot scripts with text overlays and timing. In production, this feeds directly to AI video APIs (Runway, Pika) and auto-publishes to YouTube, X, and Instagram. For this demo, we show the script + a pre-rendered sample.

6. **"Business model?"** — Brand management SaaS for web3 projects. Every project on Movement needs marketing. Vault creation fees + premium agent skills. The Movehat of marketing.

7. **"How is this different from ChatGPT?"** — ChatGPT generates text in a chat window. BrandMover reads encrypted brand identity from a blockchain, generates a full multi-channel campaign, logs everything onchain for audit, and auto-schedules remarketing. It's an autonomous system, not a conversation.

---

## File Structure

```
brandmover/
├── Move.toml
├── sources/
│   └── brand_vault.move
├── scripts/
│   └── init_vault.ts

~/.openclaw/skills/brand-mover/
├── SKILL.md
├── scripts/
│   ├── read_vault.js
│   ├── create_campaign.js
│   ├── schedule_content.js
│   └── log_activity.js
└── references/
    └── brand_guidelines_schema.md
```

---

## Critical Checklist

- [ ] Fund testnet wallets (owner + agent) with gas
- [ ] Save AES key in MULTIPLE places (if lost = vault bricked)
- [ ] Install OpenClaw + confirm Anthropic API key works
- [ ] Test full loop: fetch → decrypt → generate 7 content types → hash → log → schedule
- [ ] Pre-render a 20-sec video sample (Runway/Pika) before the hackathon
- [ ] Have backup: screenshots of onchain data + saved generated content
- [ ] Practice the demo script 3 times
- [ ] The story matters: "Built this for my girlfriend's CEO"
- [ ] The "aha" moment: unreadable encrypted hex on chain → perfect on-brand content

---

## Go get that Mac Mini, Moses. 🦞
