import { ethers } from "hardhat";
import * as crypto from "crypto";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=".repeat(60));
  console.log("  DEPLOYING BRANDMOVER PLATFORM TO HEDERA TESTNET");
  console.log("=".repeat(60));
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "HBAR\n");

  // Hedera EVM uses tinybars: 1 HBAR = 10^8 tinybar
  const ONE_HBAR = 10n ** 8n;

  // ============================================================
  // 1. Deploy AgentTreasury
  // ============================================================
  console.log("--- 1. Deploying AgentTreasury ---");
  const growthThreshold = 50n * ONE_HBAR; // 50 HBAR in tinybars

  const AgentTreasury = await ethers.getContractFactory("AgentTreasury");
  const treasury = await AgentTreasury.deploy(deployer.address, growthThreshold);
  await treasury.waitForDeployment();
  const treasuryAddr = await treasury.getAddress();
  console.log("AgentTreasury:", treasuryAddr);

  // ============================================================
  // 2. Deploy BrandRegistry
  // ============================================================
  console.log("\n--- 2. Deploying BrandRegistry ---");
  const creationFee = 50n * ONE_HBAR; // 50 HBAR in tinybars

  const BrandRegistry = await ethers.getContractFactory("BrandRegistry");
  const registry = await BrandRegistry.deploy(treasuryAddr, creationFee);
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("BrandRegistry:", registryAddr);

  // ============================================================
  // 3. Deploy BrandMover's own BrandVault
  // ============================================================
  console.log("\n--- 3. Deploying BrandMover's Vault ---");

  const BrandVault = await ethers.getContractFactory("BrandVault");
  const bmVault = await BrandVault.deploy();
  await bmVault.waitForDeployment();
  const bmVaultAddr = await bmVault.getAddress();
  console.log("BrandMover vault deployed:", bmVaultAddr);

  // ============================================================
  // 4. Initialize BrandMover's vault with its own brand guidelines
  // ============================================================
  console.log("\n--- 4. Initializing BrandMover Vault ---");

  const brandMoverGuidelines = JSON.stringify({
    voice: "Professional but developer-friendly. Direct, no hype. We let results speak.",
    tone: "Confident and technical. Think developer docs meets pitch deck.",
    colors: {
      primary: "#00D4AA",
      secondary: "#1A1A2E",
      accent: "#FF6B35",
      background: "#0F0F23"
    },
    doNotUse: [
      "revolutionary", "game-changing", "disruptive", "web3 native",
      "to the moon", "WAGMI", "trustless", "decentralized marketing"
    ],
    targetAudience: "Web3 projects and DAOs that need marketing automation. Technical founders ages 25-40 who hate doing marketing manually.",
    messagingPillars: [
      "Your brand guidelines live encrypted onchain — not in a Google Doc",
      "One command launches a full campaign across 7 platforms",
      "The agent markets itself. Self-sustaining growth loop.",
      "Swarm workers handle subtasks. You set the strategy."
    ],
    approvedHashtags: ["#BrandMover", "#AutonomousMarketing", "#HederaAI", "#SwarmCorp", "#OnchainCMO"],
    valueProps: [
      "Encrypted brand vault — guidelines stored onchain, decrypted only by your agent",
      "Multi-platform campaigns — PR, Twitter, LinkedIn, Discord, Instagram, video, email",
      "Hedera Schedule Service — remarketing runs without bots or keepers",
      "Swarm delegation — break work into tasks, assign to worker agents, verify compliance",
      "Self-sustaining — campaign fees fund growth, agent markets itself"
    ],
    competitorPositioning: "Unlike agencies, BrandMover is autonomous. Unlike other AI tools, your brand identity is encrypted onchain. Unlike manual marketing, one command does everything.",
    pressReleaseStyle: "Technical but accessible. Lead with the problem, second paragraph the solution, third paragraph a quote. Max 350 words.",
    videoStyle: "Screen recordings with code overlays. Show the terminal, show the chain. Developer-first aesthetic. 30 seconds max."
  });

  const bmAesKey = crypto.randomBytes(32);
  const bmIV = crypto.randomBytes(16);
  const bmCipher = crypto.createCipheriv("aes-256-cbc", bmAesKey, bmIV);
  let bmEncrypted = bmCipher.update(brandMoverGuidelines, "utf8", "hex");
  bmEncrypted += bmCipher.final("hex");
  const bmEncryptedWithIV = "0x" + bmIV.toString("hex") + bmEncrypted;
  const bmHash = "0x" + crypto.createHash("sha256").update(brandMoverGuidelines).digest("hex");

  const bmAgent = ethers.Wallet.createRandom();

  const initTx = await bmVault.initializeVault(
    "BrandMover",
    bmEncryptedWithIV,
    bmHash,
    bmAgent.address
  );
  await initTx.wait();
  console.log("Vault initialized");

  // Set treasury on the vault
  const setTreasuryTx = await bmVault.setTreasury(treasuryAddr);
  await setTreasuryTx.wait();
  console.log("Treasury set on vault");

  // ============================================================
  // 5. Register BrandMover vault in the registry (pay 50 HBAR fee)
  // ============================================================
  console.log("\n--- 5. Registering in BrandRegistry ---");
  // Register and pay the 50 HBAR creation fee (in tinybars for EVM, weibar for ethers.js)
  const feeInWeibar = ethers.parseEther("50"); // relay converts to 50 * 10^8 tinybar
  const regTx = await registry.registerVault(
    deployer.address,
    bmVaultAddr,
    "BrandMover",
    { value: feeInWeibar }
  );
  await regTx.wait();
  console.log("Registered! Fee paid: 50 HBAR");

  // ============================================================
  // 6. Verify treasury received the fee
  // ============================================================
  console.log("\n--- 6. Verifying Treasury ---");
  const pnl = await treasury.getPnL();
  const toHbar = (v: bigint) => (Number(v) / 1e8).toFixed(2);
  console.log("Treasury total revenue:", toHbar(pnl[0]), "HBAR");
  console.log("  Compute (10%):", toHbar(pnl[1]), "HBAR");
  console.log("  Growth  (10%):", toHbar(pnl[2]), "HBAR");
  console.log("  Reserve (80%):", toHbar(pnl[3]), "HBAR");

  const totalBrands = await registry.getTotalBrands();
  console.log("Total brands registered:", totalBrands.toString());

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log("  PLATFORM DEPLOYED SUCCESSFULLY");
  console.log("=".repeat(60));
  console.log("\nContract Addresses:");
  console.log("  AgentTreasury:   ", treasuryAddr);
  console.log("  BrandRegistry:   ", registryAddr);
  console.log("  BrandMover Vault:", bmVaultAddr);

  console.log("\nBrandMover Agent:");
  console.log("  Address:", bmAgent.address);
  console.log("  Private Key:", bmAgent.privateKey);
  console.log("  AES Key:", bmAesKey.toString("hex"));

  console.log("\nExplorer Links:");
  console.log(`  Registry: https://hashscan.io/testnet/contract/${registryAddr}`);
  console.log(`  Treasury: https://hashscan.io/testnet/contract/${treasuryAddr}`);
  console.log(`  BM Vault: https://hashscan.io/testnet/contract/${bmVaultAddr}`);

  console.log("\n--- .env update ---");
  console.log(`AGENT_TREASURY=${treasuryAddr}`);
  console.log(`BRAND_REGISTRY=${registryAddr}`);
  console.log(`BRANDMOVER_VAULT=${bmVaultAddr}`);
  console.log(`BRANDMOVER_AES_KEY=${bmAesKey.toString("hex")}`);
  console.log(`BRANDMOVER_AGENT_KEY=${bmAgent.privateKey}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
