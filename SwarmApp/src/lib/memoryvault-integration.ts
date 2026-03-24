/**
 * MemoryVault Pro Integration for HBAR Mod
 *
 * Integrates Filecoin-based persistent memory with NFT access control
 * alongside Hedera HCS private memory.
 *
 * Architecture:
 * - MemoryRegistry contract on Base Sepolia (0x7C86CE2F4B394C76c0C5c88EaE99b39AC68Abc73)
 * - MemoryAccessNFT for credential management (0xf387c90612d2086C1870cAef589E660300523aeD)
 * - Filecoin storage for 100+ year persistence
 * - NFT-based access control (only NFT holder can access memories)
 *
 * Integration with Swarm:
 * - ASN as primary identity
 * - Hedera HCS for real-time encrypted memories
 * - MemoryVault Pro for long-term archival
 * - Cross-chain memory synchronization
 */

import { ethers } from "ethers";

// ═══════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════

// Base Sepolia (MemoryVault Pro contracts)
const BASE_SEPOLIA_RPC = "https://sepolia.base.org";
const MEMORY_REGISTRY_ADDRESS = "0x7C86CE2F4B394C76c0C5c88EaE99b39AC68Abc73";
const MEMORY_ACCESS_NFT_ADDRESS = "0xf387c90612d2086C1870cAef589E660300523aeD";

// MemoryRegistry ABI (minimal for integration)
const MEMORY_REGISTRY_ABI = [
  "function storeMemory(string memory cid, bytes memory encryptedData) external returns (uint256)",
  "function getMemory(uint256 memoryId) external view returns (string memory cid, bytes memory encryptedData, address owner, uint256 timestamp)",
  "function getMemoriesByOwner(address owner) external view returns (uint256[] memory)",
  "function hasAccess(address user, uint256 memoryId) external view returns (bool)",
];

// MemoryAccessNFT ABI (minimal)
const MEMORY_ACCESS_NFT_ABI = [
  "function mint(address to, uint256 memoryId) external returns (uint256)",
  "function burn(uint256 tokenId) external",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function balanceOf(address owner) external view returns (uint256)",
];

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface MemoryVaultConfig {
  agentId: string;
  asn: string;
  walletAddress: string;
  nftTokenId?: string;
  baseSepoliaConnected: boolean;
}

export interface FilecoinMemory {
  memoryId: string;
  cid: string; // Filecoin CID
  encryptedData: string;
  owner: string;
  timestamp: number;
  accessNFT?: string;
}

export interface MemorySyncStatus {
  hederaMessages: number;
  storachaBackups: number;
  filecoinArchives: number;
  lastSync: number;
}

// ═══════════════════════════════════════════════════════════════
// MemoryVault Pro Integration
// ═══════════════════════════════════════════════════════════════

/**
 * Get provider and contracts for Base Sepolia
 */
function getMemoryVaultContracts() {
  const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);

  const registry = new ethers.Contract(
    MEMORY_REGISTRY_ADDRESS,
    MEMORY_REGISTRY_ABI,
    provider
  );

  const nft = new ethers.Contract(
    MEMORY_ACCESS_NFT_ADDRESS,
    MEMORY_ACCESS_NFT_ABI,
    provider
  );

  return { provider, registry, nft };
}

/**
 * Store memory snapshot to Filecoin via MemoryVault Pro
 *
 * @param cid - IPFS/Filecoin CID of the encrypted memory snapshot
 * @param encryptedData - Additional encrypted metadata
 * @param signerPrivateKey - User's Base Sepolia wallet private key
 * @returns memoryId from MemoryRegistry contract
 */
export async function storeToFilecoin(
  cid: string,
  encryptedData: string,
  signerPrivateKey: string
): Promise<{ memoryId: string; txHash: string }> {
  try {
    const { provider, registry } = getMemoryVaultContracts();
    const wallet = new ethers.Wallet(signerPrivateKey, provider);
    const registryWithSigner = registry.connect(wallet);

    // Store memory on-chain (Filecoin CID + encrypted metadata)
    const tx = await (registryWithSigner as any).storeMemory(
      cid,
      ethers.toUtf8Bytes(encryptedData)
    );

    const receipt = await tx.wait();

    // Extract memoryId from event logs
    const memoryId = receipt.logs[0]?.topics[1] || "0";

    console.log(`[MemoryVault] Stored to Filecoin: CID=${cid}, memoryId=${memoryId}`);

    return {
      memoryId,
      txHash: receipt.hash,
    };
  } catch (error) {
    console.error("[MemoryVault] Failed to store to Filecoin:", error);
    throw error;
  }
}

/**
 * Retrieve memory from Filecoin via MemoryVault Pro
 */
export async function retrieveFromFilecoin(
  memoryId: string
): Promise<FilecoinMemory> {
  try {
    const { registry } = getMemoryVaultContracts();

    const memory = await (registry as any).getMemory(memoryId);

    return {
      memoryId,
      cid: memory[0],
      encryptedData: ethers.toUtf8String(memory[1]),
      owner: memory[2],
      timestamp: Number(memory[3]),
    };
  } catch (error) {
    console.error("[MemoryVault] Failed to retrieve from Filecoin:", error);
    throw error;
  }
}

/**
 * Get all memories for a wallet address
 */
export async function getMemoriesByOwner(
  walletAddress: string
): Promise<string[]> {
  try {
    const { registry } = getMemoryVaultContracts();

    const memoryIds = await (registry as any).getMemoriesByOwner(walletAddress);

    return memoryIds.map((id: bigint) => id.toString());
  } catch (error) {
    console.error("[MemoryVault] Failed to get memories by owner:", error);
    throw error;
  }
}

/**
 * Mint NFT access credential for a memory
 * This creates an NFT that grants access to the memory
 */
export async function mintMemoryAccessNFT(
  memoryId: string,
  recipientAddress: string,
  signerPrivateKey: string
): Promise<{ nftTokenId: string; txHash: string }> {
  try {
    const { provider, nft } = getMemoryVaultContracts();
    const wallet = new ethers.Wallet(signerPrivateKey, provider);
    const nftWithSigner = nft.connect(wallet);

    const tx = await (nftWithSigner as any).mint(recipientAddress, memoryId);
    const receipt = await tx.wait();

    const nftTokenId = receipt.logs[0]?.topics[3] || "0";

    console.log(`[MemoryVault] Minted access NFT: tokenId=${nftTokenId} for memory=${memoryId}`);

    return {
      nftTokenId,
      txHash: receipt.hash,
    };
  } catch (error) {
    console.error("[MemoryVault] Failed to mint access NFT:", error);
    throw error;
  }
}

/**
 * Check if address has access to a memory
 */
export async function checkMemoryAccess(
  userAddress: string,
  memoryId: string
): Promise<boolean> {
  try {
    const { registry } = getMemoryVaultContracts();

    const hasAccess = await (registry as any).hasAccess(userAddress, memoryId);

    return hasAccess;
  } catch (error) {
    console.error("[MemoryVault] Failed to check access:", error);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// Cross-Chain Memory Synchronization
// ═══════════════════════════════════════════════════════════════

/**
 * Sync agent memories across all chains:
 * - Hedera HCS (real-time, encrypted, cheap)
 * - Storacha (decentralized backup)
 * - Filecoin via MemoryVault Pro (100+ year archival)
 */
export async function syncMemoriesAcrossChains(
  agentId: string,
  asn: string,
  walletAddress: string
): Promise<MemorySyncStatus> {
  console.log(`[MemorySync] Starting cross-chain sync for agent ${agentId}`);

  // This would integrate with:
  // 1. Hedera HCS (retrievePrivateMemories from hedera-agent-memory.ts)
  // 2. Storacha (existing ASN backup system)
  // 3. MemoryVault Pro (getMemoriesByOwner above)

  // For now, return placeholder data
  return {
    hederaMessages: 0,
    storachaBackups: 0,
    filecoinArchives: 0,
    lastSync: Date.now(),
  };
}

/**
 * Archive Hedera memories to Filecoin for long-term storage
 * Use this to move old memories from HCS (pay per query) to Filecoin (one-time cost)
 */
export async function archiveHederaToFilecoin(
  agentId: string,
  asn: string,
  hederaTopicId: string,
  filecoinCID: string,
  signerPrivateKey: string
): Promise<{ memoryId: string; archived: number }> {
  console.log(`[Archive] Moving Hedera memories to Filecoin for agent ${agentId}`);

  // 1. Retrieve all memories from Hedera HCS
  // 2. Bundle into single archive
  // 3. Upload to Filecoin (get CID)
  // 4. Store reference in MemoryVault Pro contract

  const result = await storeToFilecoin(
    filecoinCID,
    JSON.stringify({ agentId, asn, hederaTopicId, archived: true }),
    signerPrivateKey
  );

  return {
    memoryId: result.memoryId,
    archived: 0, // Would be actual message count
  };
}

// ═══════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════

export {
  storeToFilecoin as archiveToFilecoin,
  retrieveFromFilecoin as restoreFromFilecoin,
  getMemoriesByOwner as getFilecoinMemories,
  mintMemoryAccessNFT as createMemoryAccessNFT,
  checkMemoryAccess as verifyMemoryAccess,
  syncMemoriesAcrossChains as syncAllMemories,
  archiveHederaToFilecoin as moveToFilecoin,
};
