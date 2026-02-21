#!/usr/bin/env node
const { ethers } = require('ethers');

const args = process.argv.slice(2);
function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : null;
}

const taskId = getArg('--task-id');

const VAULT_ADDRESS = process.env.BRAND_VAULT_ADDRESS;
const RPC_URL = process.env.HEDERA_RPC_URL || 'https://testnet.hashio.io/api';

const ABI = [
  "event TaskDelivered(uint256 indexed taskId, address indexed worker, bytes32 outputHash, bytes32 usedGuidelinesHash, bool guidelinesMatch)",
  "event AccessGranted(uint256 indexed taskId, address indexed workerAgent, uint256 expiresAt)"
];

async function main() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL, { chainId: 296, name: 'hedera-testnet' });
    const vault = new ethers.Contract(VAULT_ADDRESS, ABI, provider);

    // Query TaskDelivered events
    const filter = taskId
      ? vault.filters.TaskDelivered(parseInt(taskId))
      : vault.filters.TaskDelivered();

    // Hedera limits log queries to 7 days; use recent blocks
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 500;

    console.log("Querying TaskDelivered events...\n");
    const events = await vault.queryFilter(filter, fromBlock, currentBlock);

    if (events.length === 0) {
      console.log("No deliveries found" + (taskId ? ` for task ${taskId}` : ""));
      return;
    }

    for (const event of events) {
      const { taskId: tid, worker, outputHash, usedGuidelinesHash, guidelinesMatch } = event.args;
      console.log(`--- Task #${tid} ---`);
      console.log(`Worker:            ${worker}`);
      console.log(`Output hash:       ${outputHash}`);
      console.log(`Guidelines hash:   ${usedGuidelinesHash}`);
      console.log(`Compliance:        ${guidelinesMatch ? 'PASS' : 'FAIL — guidelines hash mismatch'}`);
      console.log(`Block:             ${event.blockNumber}`);
      console.log(`Tx:                ${event.transactionHash}`);
      console.log();
    }

    const passCount = events.filter(e => e.args.guidelinesMatch).length;
    console.log(`Summary: ${passCount}/${events.length} deliveries compliant`);
  } catch (err) {
    console.error("Error verifying deliveries:", err.message);
    process.exit(1);
  }
}

main();
