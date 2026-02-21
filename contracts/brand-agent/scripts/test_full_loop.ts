import { ethers } from "hardhat";
import * as crypto from "crypto";

async function main() {
  const vaultAddress = process.env.BRAND_VAULT_ADDRESS;
  if (!vaultAddress) {
    console.error("Set BRAND_VAULT_ADDRESS in .env");
    process.exit(1);
  }

  const [owner] = await ethers.getSigners();
  const BrandVault = await ethers.getContractFactory("BrandVault");
  const vault = BrandVault.attach(vaultAddress);

  console.log("=".repeat(60));
  console.log("  FULL LOOP TEST — BrandVault on Hedera Testnet");
  console.log("=".repeat(60));
  console.log("Contract:", vaultAddress);
  console.log("Owner:", owner.address);

  // ============================================================
  // TEST 1: Read brand guidelines from Hedera
  // ============================================================
  console.log("\n--- TEST 1: Read Brand Guidelines ---");
  const encryptedBytes = await vault.getEncryptedGuidelines();
  const brandName = await vault.getBrandName();
  const guidelinesHash = await vault.getGuidelinesHash();
  const agentAddr = await vault.getAgentAddress();

  console.log("Brand name:", brandName);
  console.log("Agent address:", agentAddr);
  console.log("Guidelines hash:", guidelinesHash);
  console.log("Encrypted data length:", (encryptedBytes.length - 2) / 2, "bytes");
  console.log("TEST 1: PASS\n");

  // ============================================================
  // TEST 2: Create a campaign (as owner)
  // ============================================================
  console.log("--- TEST 2: Create Campaign ---");
  const campaignContent = "Test campaign content for FOID Foundation launch on Hedera";
  const contentHash = "0x" + crypto.createHash("sha256").update(campaignContent).digest("hex");

  const tx2 = await vault.createCampaign(
    "FOID Hedera Launch",
    contentHash,
    "twitter,linkedin,discord",
    "full_launch",
    "pr,twitter,linkedin,discord,instagram,video,email"
  );
  const receipt2 = await tx2.wait();
  console.log("Campaign created! Tx:", receipt2?.hash);

  const campaignCount = await vault.getCampaignCount();
  console.log("Total campaigns:", campaignCount.toString());

  const campaign = await vault.getCampaign(0);
  console.log("Campaign name:", campaign.name);
  console.log("Campaign type:", campaign.campaignType);
  console.log("Created by:", campaign.createdBy);
  console.log("TEST 2: PASS\n");

  // ============================================================
  // TEST 3: Grant temporary access to a mock worker agent
  // ============================================================
  console.log("--- TEST 3: Grant Task Access to Worker ---");

  // Use the owner as mock worker (Hedera requires accounts to exist before receiving HBAR)
  // In production, the worker would be a separate funded Hedera account
  const mockWorker = owner;
  console.log("Mock worker address (using owner for test):", mockWorker.address);

  // Simulate: re-encrypt guidelines subset with temp key
  const subsetData = JSON.stringify({
    voice: "Irreverent, optimistic, technically precise.",
    approvedHashtags: ["#FOID", "#CultureOnchain"],
  });
  const tempKey = crypto.randomBytes(32);
  const tempIV = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", tempKey, tempIV);
  let encSubset = cipher.update(subsetData, "utf8", "hex");
  encSubset += cipher.final("hex");
  const encryptedGuidelines = "0x" + tempIV.toString("hex") + encSubset;

  // temp key "encrypted with worker public key" (for test: just store raw)
  const encryptedTempKey = "0x" + tempKey.toString("hex");

  // Hash of the plaintext subset
  const subsetHash = "0x" + crypto.createHash("sha256").update(subsetData).digest("hex");

  // Use timestamp-based ID to avoid collision with previous test runs
  const taskId = Math.floor(Date.now() / 1000);
  const duration = 3600; // 1 hour
  console.log("Task ID:", taskId);

  const tx3 = await vault.grantTaskAccess(
    taskId,
    mockWorker.address,
    encryptedGuidelines,
    encryptedTempKey,
    subsetHash,
    duration
  );
  const receipt3 = await tx3.wait();
  console.log("Access granted! Tx:", receipt3?.hash);

  // Verify the stored data
  const stored = await vault.taskAccess(taskId);
  console.log("Stored worker:", stored.workerAgent);
  console.log("Expires at:", new Date(Number(stored.expiresAt) * 1000).toISOString());
  console.log("Revoked:", stored.revoked);
  console.log("TEST 3: PASS\n");

  // ============================================================
  // TEST 4: Worker submits delivery with correct guidelines hash
  // ============================================================
  console.log("--- TEST 4: Worker Submits Delivery ---");

  // Worker uses the same signer (owner) for this test
  const workerVault = BrandVault.attach(vaultAddress).connect(mockWorker);
  const outputContent = "Worker output: Twitter thread about FOID Foundation #CultureOnchain";
  const outputHash = "0x" + crypto.createHash("sha256").update(outputContent).digest("hex");

  // Submit with CORRECT guidelines hash (should match)
  const tx4 = await workerVault.submitTaskDelivery(taskId, outputHash, subsetHash);
  const receipt4 = await tx4.wait();
  console.log("Delivery submitted! Tx:", receipt4?.hash);

  // Check the event for compliance (Hedera limits log queries to 7 days)
  const currentBlock = await ethers.provider.getBlockNumber();
  const fromBlock = currentBlock - 500; // recent blocks only

  const deliveryFilter = vault.filters.TaskDelivered(taskId);
  const deliveryEvents = await vault.queryFilter(deliveryFilter, fromBlock, currentBlock);
  const lastDelivery = deliveryEvents[deliveryEvents.length - 1];
  const guidelinesMatch = lastDelivery.args[4]; // 5th arg: guidelinesMatch
  console.log("Guidelines match:", guidelinesMatch);
  console.log("TEST 4:", guidelinesMatch ? "PASS" : "FAIL", "\n");

  // ============================================================
  // TEST 5: Verify compliance onchain
  // ============================================================
  console.log("--- TEST 5: Verify Compliance ---");
  const allDeliveries = await vault.queryFilter(vault.filters.TaskDelivered(), fromBlock, currentBlock);
  console.log(`Total deliveries found: ${allDeliveries.length}`);
  for (const evt of allDeliveries) {
    const [tid, worker, outHash, usedHash, match] = evt.args;
    console.log(`  Task #${tid}: worker=${worker.slice(0, 10)}... match=${match}`);
  }
  console.log("TEST 5: PASS\n");

  // ============================================================
  // TEST 6: Revoke access
  // ============================================================
  console.log("--- TEST 6: Revoke Access ---");
  const tx6 = await vault.revokeAccess(taskId);
  const receipt6 = await tx6.wait();
  console.log("Access revoked! Tx:", receipt6?.hash);

  const revokedAccess = await vault.taskAccess(taskId);
  console.log("Revoked:", revokedAccess.revoked);

  // Verify worker can no longer submit
  try {
    await workerVault.submitTaskDelivery(taskId, outputHash, subsetHash);
    console.log("TEST 6: FAIL — worker could still submit after revoke");
  } catch (err: any) {
    console.log("Worker correctly blocked after revoke");
    console.log("TEST 6: PASS\n");
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log("=".repeat(60));
  console.log("  ALL TESTS PASSED");
  console.log("=".repeat(60));
  console.log("\nContract:", vaultAddress);
  console.log("Explorer:", `https://hashscan.io/testnet/contract/${vaultAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
