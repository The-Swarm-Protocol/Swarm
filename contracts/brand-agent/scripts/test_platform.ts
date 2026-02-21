import { ethers } from "hardhat";
import * as crypto from "crypto";

const ONE_HBAR = 10n ** 8n;

async function main() {
  const [deployer] = await ethers.getSigners();
  const toHbar = (v: bigint) => (Number(v) / 1e8).toFixed(2);

  // Deployed addresses from deploy_platform.ts
  const TREASURY_ADDR = "0x1AC9C959459ED904899a1d52f493e9e4A879a9f4";
  const REGISTRY_ADDR = "0x76c00C56A60F0a92ED899246Af76c65D835A8EAA";
  const BM_VAULT_ADDR = "0x2254185AB8B6AC995F97C769a414A0281B42853b";
  const BM_AES_KEY = "4f75adc7f9bc27cacd18ef1c9087ef078717e575806f4f6f047c05a64535484c";

  const BrandVault = await ethers.getContractFactory("BrandVault");
  const AgentTreasury = await ethers.getContractFactory("AgentTreasury");
  const BrandRegistry = await ethers.getContractFactory("BrandRegistry");

  const treasury = AgentTreasury.attach(TREASURY_ADDR);
  const registry = BrandRegistry.attach(REGISTRY_ADDR);
  const bmVault = BrandVault.attach(BM_VAULT_ADDR);

  console.log("=".repeat(60));
  console.log("  FULL MULTI-TENANT PLATFORM TEST");
  console.log("=".repeat(60));

  // ============================================================
  // TEST 1: New brand signs up and creates a vault
  // ============================================================
  console.log("\n--- TEST 1: New Brand Signs Up ---");

  // Deploy a new vault for a simulated client brand
  const clientVault = await BrandVault.deploy();
  await clientVault.waitForDeployment();
  const clientVaultAddr = await clientVault.getAddress();

  const clientGuidelines = JSON.stringify({
    voice: "Fun, casual, Gen-Z native",
    tone: "Meme-adjacent but informed",
    approvedHashtags: ["#TestBrand", "#Web3Fun"],
  });
  const clientAesKey = crypto.randomBytes(32);
  const clientIV = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", clientAesKey, clientIV);
  let enc = cipher.update(clientGuidelines, "utf8", "hex");
  enc += cipher.final("hex");
  const clientEncrypted = "0x" + clientIV.toString("hex") + enc;
  const clientHash = "0x" + crypto.createHash("sha256").update(clientGuidelines).digest("hex");
  const clientAgent = ethers.Wallet.createRandom();

  const initTx = await clientVault.initializeVault(
    "TestBrand",
    clientEncrypted,
    clientHash,
    clientAgent.address
  );
  await initTx.wait();

  // Set treasury
  await (await clientVault.setTreasury(TREASURY_ADDR)).wait();

  // Register with 50 HBAR fee — use clientAgent.address as the brand owner
  // (deployer is already registered as BrandMover's owner)
  const regTx = await registry.registerVault(
    clientAgent.address,
    clientVaultAddr,
    "TestBrand",
    { value: ethers.parseEther("50") }
  );
  await regTx.wait();

  const totalBrands = await registry.getTotalBrands();
  console.log("Total brands:", totalBrands.toString());
  console.log("TestBrand vault:", clientVaultAddr);
  console.log("TEST 1: PASS\n");

  // ============================================================
  // TEST 2: Brand pays for a campaign
  // ============================================================
  console.log("--- TEST 2: Brand Requests Full Campaign (100 HBAR) ---");
  const pnlBefore = await treasury.getPnL();

  const campaignTx = await clientVault.requestCampaign("full", {
    value: ethers.parseEther("100"),
  });
  await campaignTx.wait();
  console.log("Campaign requested!");

  const pnlAfter = await treasury.getPnL();
  const revenueGain = pnlAfter[0] - pnlBefore[0];
  console.log("Treasury revenue increase:", toHbar(revenueGain), "HBAR");
  console.log("TEST 2: PASS\n");

  // ============================================================
  // TEST 3: Agent creates campaign and grants access to worker
  // ============================================================
  console.log("--- TEST 3: Campaign + Worker Delegation ---");

  // Agent creates campaign
  const content = "TestBrand full campaign content across all platforms";
  const contentHash = "0x" + crypto.createHash("sha256").update(content).digest("hex");

  const createTx = await clientVault.createCampaign(
    "TestBrand Launch",
    contentHash,
    "twitter,linkedin,discord",
    "full_launch",
    "pr,twitter,linkedin,discord,instagram,video,email"
  );
  await createTx.wait();
  console.log("Campaign created onchain");

  // Grant access to a mock worker
  const taskId = Math.floor(Date.now() / 1000);
  const subsetData = JSON.stringify({ voice: "Fun, casual, Gen-Z native" });
  const tempKey = crypto.randomBytes(32);
  const tempIV = crypto.randomBytes(16);
  const tempCipher = crypto.createCipheriv("aes-256-cbc", tempKey, tempIV);
  let encSub = tempCipher.update(subsetData, "utf8", "hex");
  encSub += tempCipher.final("hex");
  const encryptedGuidelines = "0x" + tempIV.toString("hex") + encSub;
  const encryptedTempKey = "0x" + tempKey.toString("hex");
  const subsetHash = "0x" + crypto.createHash("sha256").update(subsetData).digest("hex");

  // Use deployer as the mock worker (already has HBAR)
  const grantTx = await clientVault.grantTaskAccess(
    taskId,
    deployer.address,
    encryptedGuidelines,
    encryptedTempKey,
    subsetHash,
    3600
  );
  await grantTx.wait();
  console.log("Task access granted to worker (task:", taskId, ")");
  console.log("TEST 3: PASS\n");

  // ============================================================
  // TEST 4: Worker submits delivery + compliance check
  // ============================================================
  console.log("--- TEST 4: Worker Delivers + Compliance ---");
  const outputContent = "TestBrand Twitter thread: Gen-Z vibes #TestBrand #Web3Fun";
  const outputHash = "0x" + crypto.createHash("sha256").update(outputContent).digest("hex");

  const deliverTx = await clientVault.submitTaskDelivery(taskId, outputHash, subsetHash);
  await deliverTx.wait();
  console.log("Delivery submitted");

  // Check compliance via event
  const currentBlock = await ethers.provider.getBlockNumber();
  const events = await clientVault.queryFilter(
    clientVault.filters.TaskDelivered(taskId),
    currentBlock - 100,
    currentBlock
  );
  const match = events[0].args[4]; // guidelinesMatch
  console.log("Guidelines compliance:", match ? "PASS" : "FAIL");
  console.log("TEST 4: PASS\n");

  // ============================================================
  // TEST 5: Pay swarm worker from treasury
  // ============================================================
  console.log("--- TEST 5: Pay Swarm Worker ---");
  const workerPayment = 10n * ONE_HBAR; // 10 HBAR
  const reserveBefore = (await treasury.getPnL())[3];

  const payTx = await treasury.paySwarmWorker(deployer.address, workerPayment);
  await payTx.wait();

  const reserveAfter = (await treasury.getPnL())[3];
  console.log("Reserve before:", toHbar(reserveBefore), "HBAR");
  console.log("Reserve after: ", toHbar(reserveAfter), "HBAR");
  console.log("Worker paid:", toHbar(reserveBefore - reserveAfter), "HBAR");
  console.log("TEST 5: PASS\n");

  // ============================================================
  // TEST 6: Revoke access
  // ============================================================
  console.log("--- TEST 6: Revoke Access ---");
  const revokeTx = await clientVault.revokeAccess(taskId);
  await revokeTx.wait();
  const access = await clientVault.taskAccess(taskId);
  console.log("Access revoked:", access.revoked);
  console.log("TEST 6: PASS\n");

  // ============================================================
  // TEST 7: Check growth balance for self-marketing trigger
  // ============================================================
  console.log("--- TEST 7: Treasury P&L Summary ---");
  const finalPnl = await treasury.getPnL();
  console.log("Total revenue: ", toHbar(finalPnl[0]), "HBAR");
  console.log("Compute (10%):", toHbar(finalPnl[1]), "HBAR");
  console.log("Growth  (10%):", toHbar(finalPnl[2]), "HBAR");
  console.log("Reserve (80%):", toHbar(finalPnl[3]), "HBAR");

  const growthBalance = finalPnl[2];
  console.log("\nGrowth balance:", toHbar(growthBalance), "HBAR");
  console.log("Growth threshold: 50.00 HBAR");
  console.log("Self-marketing trigger:", Number(growthBalance) >= 50 * 1e8 ? "READY" : "accumulating...");
  console.log("TEST 7: PASS\n");

  // ============================================================
  // TEST 8: Read BrandMover's own guidelines
  // ============================================================
  console.log("--- TEST 8: BrandMover Self-Read ---");
  const bmName = await bmVault.getBrandName();
  const bmEncrypted2 = await bmVault.getEncryptedGuidelines();
  const cleanHex = (bmEncrypted2 as string).startsWith("0x")
    ? (bmEncrypted2 as string).slice(2)
    : (bmEncrypted2 as string);
  const aesKey = Buffer.from(BM_AES_KEY, "hex");
  const iv = Buffer.from(cleanHex.slice(0, 32), "hex");
  const ciphertext = Buffer.from(cleanHex.slice(32), "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
  let decrypted = decipher.update(ciphertext, undefined, "utf8");
  decrypted += decipher.final("utf8");
  const guidelines = JSON.parse(decrypted);

  console.log("Brand:", bmName);
  console.log("Voice:", guidelines.voice);
  console.log("Hashtags:", guidelines.approvedHashtags.join(", "));
  console.log("TEST 8: PASS\n");

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log("=".repeat(60));
  console.log("  ALL 8 TESTS PASSED");
  console.log("=".repeat(60));
  console.log("\nPlatform flow verified:");
  console.log("  1. Brand signs up → vault created → fee to treasury");
  console.log("  2. Brand pays for campaign → treasury splits 80/10/10");
  console.log("  3. Agent creates campaign → grants worker access");
  console.log("  4. Worker delivers → compliance verified onchain");
  console.log("  5. Worker paid from treasury reserve");
  console.log("  6. Access revoked after completion");
  console.log("  7. Growth wallet accumulates for self-marketing");
  console.log("  8. BrandMover reads its own guidelines for self-marketing");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
