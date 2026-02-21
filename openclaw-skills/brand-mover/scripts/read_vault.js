#!/usr/bin/env node
const crypto = require('crypto');
const { ethers } = require('ethers');

const VAULT_ADDRESS = process.env.BRAND_VAULT_ADDRESS;
const AES_KEY = Buffer.from(process.env.BRAND_AES_KEY, 'hex');
const RPC_URL = process.env.HEDERA_RPC_URL || 'https://testnet.hashio.io/api';

const ABI = [
  "function getEncryptedGuidelines() view returns (bytes)"
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
    const provider = new ethers.JsonRpcProvider(RPC_URL, { chainId: 296, name: 'hedera-testnet' });
    const vault = new ethers.Contract(VAULT_ADDRESS, ABI, provider);

    const encryptedBytes = await vault.getEncryptedGuidelines();
    const cleanHex = encryptedBytes.startsWith('0x') ? encryptedBytes.slice(2) : encryptedBytes;

    const plaintext = decrypt(cleanHex);
    console.log(JSON.stringify(JSON.parse(plaintext), null, 2));
  } catch (err) {
    console.error("Error reading vault:", err.message);
    process.exit(1);
  }
}

main();
