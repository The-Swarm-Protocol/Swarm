#!/usr/bin/env node
const crypto = require('crypto');
const { ethers } = require('ethers');

const args = process.argv.slice(2);
function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : null;
}

const taskId = parseInt(getArg('--task-id') || '0');
const workerAddress = getArg('--worker');
const workerPublicKey = getArg('--worker-pubkey'); // hex-encoded public key
const durationHours = parseInt(getArg('--duration-hours') || '24');
const guidelinesSubset = getArg('--guidelines-subset'); // JSON string of guideline subset to share

const VAULT_ADDRESS = process.env.BRAND_VAULT_ADDRESS;
const AES_KEY = Buffer.from(process.env.BRAND_AES_KEY, 'hex');
const RPC_URL = process.env.HEDERA_RPC_URL || 'https://testnet.hashio.io/api';
const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;

const ABI = [
  "function getEncryptedGuidelines() view returns (bytes)",
  "function grantTaskAccess(uint256 taskId, address workerAgent, bytes encryptedGuidelines, bytes encryptedTempKey, bytes32 guidelinesHash, uint256 duration)"
];

function decrypt(encryptedHex) {
  const iv = Buffer.from(encryptedHex.slice(0, 32), 'hex');
  const ciphertext = Buffer.from(encryptedHex.slice(32), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', AES_KEY, iv);
  let decrypted = decipher.update(ciphertext, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function main() {
  try {
    if (!workerAddress) { console.error("--worker address required"); process.exit(1); }

    const provider = new ethers.JsonRpcProvider(RPC_URL, { chainId: 296, name: 'hedera-testnet' });
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const vault = new ethers.Contract(VAULT_ADDRESS, ABI, wallet);

    // 1. Decrypt full guidelines from chain
    const encryptedBytes = await vault.getEncryptedGuidelines();
    const cleanHex = encryptedBytes.startsWith('0x') ? encryptedBytes.slice(2) : encryptedBytes;
    const fullGuidelines = JSON.parse(decrypt(cleanHex));

    // 2. Extract subset (or use full guidelines if no subset specified)
    let subset;
    if (guidelinesSubset) {
      const keys = JSON.parse(guidelinesSubset);
      subset = {};
      for (const key of keys) {
        if (fullGuidelines[key] !== undefined) subset[key] = fullGuidelines[key];
      }
    } else {
      subset = fullGuidelines;
    }
    const subsetJson = JSON.stringify(subset);

    // 3. Generate temporary AES key, encrypt subset
    const tempKey = crypto.randomBytes(32);
    const tempIV = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', tempKey, tempIV);
    let encSubset = cipher.update(subsetJson, 'utf8', 'hex');
    encSubset += cipher.final('hex');
    const encryptedGuidelines = '0x' + tempIV.toString('hex') + encSubset;

    // 4. Encrypt temp key with worker's public key (or share directly for demo)
    let encryptedTempKey;
    if (workerPublicKey) {
      const pubKeyBuf = Buffer.from(workerPublicKey.replace('0x', ''), 'hex');
      const encrypted = crypto.publicEncrypt(
        { key: pubKeyBuf, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
        tempKey
      );
      encryptedTempKey = '0x' + encrypted.toString('hex');
    } else {
      // For demo/testing: store temp key as-is (worker knows to read it directly)
      encryptedTempKey = '0x' + tempKey.toString('hex');
    }

    // 5. Hash the plaintext subset for compliance verification
    const guidelinesHash = '0x' + crypto.createHash('sha256').update(subsetJson).digest('hex');

    // 6. Grant access onchain
    const duration = durationHours * 3600;
    console.log(`Granting task ${taskId} access to worker ${workerAddress}`);
    console.log(`Duration: ${durationHours} hours`);
    console.log(`Guidelines subset: ${Object.keys(subset).join(', ')}`);

    const tx = await vault.grantTaskAccess(
      taskId,
      workerAddress,
      encryptedGuidelines,
      encryptedTempKey,
      guidelinesHash,
      duration
    );
    const receipt = await tx.wait();

    console.log("\nAccess granted onchain!");
    console.log("Tx:", receipt.hash);
    console.log("Guidelines hash:", guidelinesHash);
    console.log("Temp AES key (for testing):", tempKey.toString('hex'));
  } catch (err) {
    console.error("Error granting access:", err.message);
    process.exit(1);
  }
}

main();
