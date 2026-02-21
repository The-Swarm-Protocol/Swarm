#!/usr/bin/env node
const { ethers } = require('ethers');

const args = process.argv.slice(2);
function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : null;
}

const name = getArg('--name') || 'Campaign';
const contentHash = getArg('--content-hash') || '0x' + '00'.repeat(32);
const remarketingHash = getArg('--remarketing-hash') || '0x' + '00'.repeat(32);
const platforms = getArg('--platforms') || 'twitter';
const daysFromNow = parseInt(getArg('--days-from-now') || '7');

const remarketingTimestamp = Math.floor(Date.now() / 1000) + (daysFromNow * 86400);

const VAULT_ADDRESS = process.env.BRAND_VAULT_ADDRESS;
const RPC_URL = process.env.HEDERA_RPC_URL || 'https://testnet.hashio.io/api';
const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;

const ABI = [
  "function launchCampaignWithRemarketing(string name, bytes32 contentHash, bytes32 remarketingHash, string platforms, uint256 remarketingTimestamp) returns (uint256)"
];

async function main() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL, { chainId: 296, name: 'hedera-testnet' });
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const vault = new ethers.Contract(VAULT_ADDRESS, ABI, wallet);

    const cHash = contentHash.startsWith('0x') ? contentHash : '0x' + contentHash;
    const rHash = remarketingHash.startsWith('0x') ? remarketingHash : '0x' + remarketingHash;

    console.log(`Launching campaign with remarketing: "${name}"`);
    console.log(`Remarketing scheduled for: ${new Date(remarketingTimestamp * 1000).toISOString()}`);

    const tx = await vault.launchCampaignWithRemarketing(name, cHash, rHash, platforms, remarketingTimestamp);
    const receipt = await tx.wait();
    console.log("Campaign launched + remarketing scheduled onchain!");
    console.log("Tx:", receipt.hash);
    console.log("Explorer:", `https://hashscan.io/testnet/transaction/${receipt.hash}`);
  } catch (err) {
    console.error("Error scheduling content:", err.message);
    process.exit(1);
  }
}

main();
