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

const VAULT_OWNER_ADDRESS = "0x72aebb6905136c341bc22e2ead3c20e759f7ac8755f42e19877c1559e834af87";
const AGENT_ADDRESS = "0xfa5b489a8b22912f01d61eaf183c3af444256513ec4a8182664fa902b8f33304";

console.log("=== SAVE THESE VALUES ===\n");
console.log("AES_KEY (KEEP SECRET — goes in OpenClaw .env):");
console.log(AES_KEY.toString('hex'));
console.log("\nAgent Address:");
console.log(AGENT_ADDRESS);
console.log("\nAgent Private Key:");
console.log("<YOUR_AGENT_PRIVATE_KEY>");
console.log("\nEncrypted guidelines (hex, goes onchain):");
console.log(encryptedWithIV);
console.log("\nGuidelines hash (hex, goes onchain):");
console.log(guidelinesHash);
console.log("\n=== MOVE CLI COMMAND ===");
console.log(`./movement move run \\`);
console.log(`  --function-id '${VAULT_OWNER_ADDRESS}::brand_vault::initialize_vault' \\`);
console.log(`  --args 'string:FOID Foundation' \\`);
console.log(`         'hex:${encryptedWithIV}' \\`);
console.log(`         'hex:${guidelinesHash}' \\`);
console.log(`         'address:${AGENT_ADDRESS}' \\`);
console.log(`  --url https://testnet.movementnetwork.xyz/v1 \\`);
console.log(`  --private-key <YOUR_OWNER_PRIVATE_KEY> \\`);
console.log(`  --assume-yes`);
