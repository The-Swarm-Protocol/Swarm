import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying BrandVault with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "HBAR");

  const BrandVault = await ethers.getContractFactory("BrandVault");
  console.log("Deploying BrandVault...");

  const vault = await BrandVault.deploy();
  await vault.waitForDeployment();

  const address = await vault.getAddress();
  console.log("\n=== DEPLOYMENT SUCCESSFUL ===");
  console.log("BrandVault deployed to:", address);
  console.log("Explorer:", `https://hashscan.io/testnet/contract/${address}`);
  console.log("\nAdd to your .env:");
  console.log(`BRAND_VAULT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
