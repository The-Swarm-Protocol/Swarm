import { ethers } from "hardhat";
import * as crypto from "crypto";

async function main() {
  // ============================================================
  // FOID Foundation Brand Guidelines (same as Movement version)
  // ============================================================
  const brandGuidelines = JSON.stringify({
    voice:
      "Irreverent, optimistic, technically precise. We speak like builders who believe the internet can be magical again.",
    tone: "Playful but never frivolous. Think early-internet wonder meets serious engineering.",
    colors: {
      primary: "#00D4AA",
      secondary: "#FF6B35",
      background: "#0A0A1A",
      accent: "#7B61FF",
    },
    doNotUse: [
      "synergy",
      "leverage",
      "disrupt",
      "web3 native",
      "to the moon",
      "WAGMI",
      "not financial advice",
    ],
    targetAudience:
      "Developers and creators who miss the magic of early internet. Ages 22-35. Active on Twitter, Discord, Farcaster.",
    messagingPillars: [
      "The internet's permanent memory",
      "Culture is the real currency",
      "Built by the community, for the community",
    ],
    approvedHashtags: [
      "#FOID",
      "#CultureOnchain",
      "#InternetMemory",
      "#BrandMover",
    ],
    competitorPositioning:
      "Unlike NFT marketplaces, we're not about trading. We're about preserving and curating culture collaboratively.",
    pressReleaseStyle:
      "AP style, concise leads, quote from founder in paragraph 3. No jargon. Max 400 words.",
    videoStyle:
      "Fast-paced, glitch aesthetic, text overlays, no voiceover needed. 20 seconds max. Hook in first 2 seconds.",
  });

  // ============================================================
  // Encryption: AES-256-CBC
  // ============================================================
  const AES_KEY = crypto.randomBytes(32);
  const IV = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv("aes-256-cbc", AES_KEY, IV);
  let encrypted = cipher.update(brandGuidelines, "utf8", "hex");
  encrypted += cipher.final("hex");

  // Prepend IV to ciphertext (same pattern as Movement version)
  const encryptedWithIV = IV.toString("hex") + encrypted;

  // Hash plaintext for onchain integrity verification
  const guidelinesHash = crypto
    .createHash("sha256")
    .update(brandGuidelines)
    .digest();

  // ============================================================
  // Generate Agent ECDSA Keypair
  // ============================================================
  const agentWallet = ethers.Wallet.createRandom();

  // ============================================================
  // Initialize Vault Onchain
  // ============================================================
  const vaultAddress = process.env.BRAND_VAULT_ADDRESS;
  if (!vaultAddress) {
    console.error(
      "ERROR: Set BRAND_VAULT_ADDRESS in .env before running init"
    );
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  console.log("Initializing vault with owner:", deployer.address);

  const BrandVault = await ethers.getContractFactory("BrandVault");
  const vault = BrandVault.attach(vaultAddress);

  const encryptedBytes = "0x" + encryptedWithIV;
  const hashBytes32 =
    "0x" + guidelinesHash.toString("hex");

  console.log("Calling initializeVault()...");
  const tx = await vault.initializeVault(
    "FOID Foundation",
    encryptedBytes,
    hashBytes32,
    agentWallet.address
  );
  const receipt = await tx.wait();
  console.log("Transaction hash:", receipt?.hash);

  // ============================================================
  // Output — SAVE THESE VALUES
  // ============================================================
  console.log("\n====================================");
  console.log("  VAULT INITIALIZED SUCCESSFULLY");
  console.log("====================================\n");

  console.log("--- CRITICAL: SAVE THESE VALUES ---\n");

  console.log("BRAND_AES_KEY (for OpenClaw .env — KEEP SECRET):");
  console.log(AES_KEY.toString("hex"));

  console.log("\nBRAND_AES_IV (first 32 hex chars of encrypted data):");
  console.log(IV.toString("hex"));

  console.log("\nAGENT_ADDRESS:");
  console.log(agentWallet.address);

  console.log("\nAGENT_PRIVATE_KEY (for OpenClaw .env — KEEP SECRET):");
  console.log(agentWallet.privateKey);

  console.log("\nBRAND_VAULT_ADDRESS:");
  console.log(vaultAddress);

  console.log("\nGUIDELINES_HASH (sha256 of plaintext):");
  console.log("0x" + guidelinesHash.toString("hex"));

  console.log("\nENCRYPTED_GUIDELINES_LENGTH:", encryptedWithIV.length / 2, "bytes");

  console.log("\n--- OpenClaw .env snippet ---");
  console.log(`BRAND_AES_KEY=${AES_KEY.toString("hex")}`);
  console.log(`BRAND_VAULT_ADDRESS=${vaultAddress}`);
  console.log(`HEDERA_RPC_URL=https://testnet.hashio.io/api`);
  console.log(`AGENT_PRIVATE_KEY=${agentWallet.privateKey}`);
  console.log(`HEDERA_CHAIN_ID=296`);

  console.log("\nExplorer:", `https://hashscan.io/testnet/contract/${vaultAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
