import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=".repeat(60));
  console.log("  DEPLOYING SWARM TASKBOARD + AGENT REGISTRY TO HEDERA");
  console.log("=".repeat(60));
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "HBAR\n");

  // ============================================================
  // 1. Deploy SwarmTaskBoard
  // ============================================================
  console.log("--- 1. Deploying SwarmTaskBoard ---");
  const SwarmTaskBoard = await ethers.getContractFactory("SwarmTaskBoard");
  const taskBoard = await SwarmTaskBoard.deploy();
  await taskBoard.waitForDeployment();
  const taskBoardAddr = await taskBoard.getAddress();
  console.log("SwarmTaskBoard:", taskBoardAddr);

  // ============================================================
  // 2. Deploy AgentRegistry
  // ============================================================
  console.log("\n--- 2. Deploying AgentRegistry ---");
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const registry = await AgentRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("AgentRegistry:", registryAddr);

  // ============================================================
  // 3. Verify
  // ============================================================
  console.log("\n--- 3. Verifying ---");
  const tc = await taskBoard.taskCount();
  console.log("TaskBoard taskCount:", tc.toString());
  const ac = await registry.agentCount();
  console.log("AgentRegistry agentCount:", ac.toString());

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log("  SWARM CONTRACTS DEPLOYED SUCCESSFULLY");
  console.log("=".repeat(60));
  console.log("\nContract Addresses:");
  console.log("  SwarmTaskBoard:", taskBoardAddr);
  console.log("  AgentRegistry: ", registryAddr);

  console.log("\nExplorer Links:");
  console.log(`  TaskBoard: https://hashscan.io/testnet/contract/${taskBoardAddr}`);
  console.log(`  Registry:  https://hashscan.io/testnet/contract/${registryAddr}`);

  console.log("\n--- .env / constants.ts update ---");
  console.log(`SWARM_TASK_BOARD_ADDRESS=${taskBoardAddr}`);
  console.log(`AGENT_REGISTRY_ADDRESS=${registryAddr}`);

  console.log("\n--- frontend/lib/constants.ts snippet ---");
  console.log(`export const SWARM_TASK_BOARD_ADDRESS = "${taskBoardAddr}";`);
  console.log(`export const AGENT_REGISTRY_ADDRESS = "${registryAddr}";`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
