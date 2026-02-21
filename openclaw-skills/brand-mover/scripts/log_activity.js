#!/usr/bin/env node
const { ethers } = require('ethers');

const args = process.argv.slice(2);
function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : null;
}

const action = getArg('--action') || 'unknown';
const description = getArg('--description') || '';
const dataHash = getArg('--data-hash') || '0x' + '00'.repeat(32);

const VAULT_ADDRESS = process.env.BRAND_VAULT_ADDRESS;
const RPC_URL = process.env.HEDERA_RPC_URL || 'https://testnet.hashio.io/api';
const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;

const ABI = [
  "function logAgentActivity(string actionType, string description, bytes32 dataHash)"
];

async function main() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL, { chainId: 296, name: 'hedera-testnet' });
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const vault = new ethers.Contract(VAULT_ADDRESS, ABI, wallet);

    const hash = dataHash.startsWith('0x') ? dataHash : '0x' + dataHash;

    console.log(`Logging activity: "${action}"`);
    const tx = await vault.logAgentActivity(action, description, hash);
    const receipt = await tx.wait();
    console.log("Activity logged onchain!");
    console.log("Tx:", receipt.hash);
  } catch (err) {
    console.error("Error logging activity:", err.message);
    process.exit(1);
  }
}

main();
