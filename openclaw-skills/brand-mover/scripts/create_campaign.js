#!/usr/bin/env node
const { ethers } = require('ethers');

const args = process.argv.slice(2);
function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : null;
}

const name = getArg('--name') || 'Unnamed Campaign';
const contentHash = getArg('--content-hash') || '0x' + '00'.repeat(32);
const platforms = getArg('--platforms') || 'twitter';
const campaignType = getArg('--campaign-type') || 'full_launch';
const contentTypes = getArg('--content-types') || 'twitter';

const VAULT_ADDRESS = process.env.BRAND_VAULT_ADDRESS;
const RPC_URL = process.env.HEDERA_RPC_URL || 'https://testnet.hashio.io/api';
const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;

const ABI = [
  "function createCampaign(string name, bytes32 contentHash, string platforms, string campaignType, string contentTypes) returns (uint256)"
];

async function main() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL, { chainId: 296, name: 'hedera-testnet' });
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const vault = new ethers.Contract(VAULT_ADDRESS, ABI, wallet);

    const hash = contentHash.startsWith('0x') ? contentHash : '0x' + contentHash;

    console.log(`Creating campaign: "${name}"`);
    const tx = await vault.createCampaign(name, hash, platforms, campaignType, contentTypes);
    const receipt = await tx.wait();
    console.log("Campaign created onchain!");
    console.log("Tx:", receipt.hash);
    console.log("Explorer:", `https://hashscan.io/testnet/transaction/${receipt.hash}`);
  } catch (err) {
    console.error("Error creating campaign:", err.message);
    process.exit(1);
  }
}

main();
