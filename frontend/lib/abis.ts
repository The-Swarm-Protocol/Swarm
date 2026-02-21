/** Minimal ABI fragments (human-readable) for read-only dashboard calls */

export const BRAND_VAULT_ABI = [
  // View functions
  "function vault() view returns (bytes encryptedGuidelines, bytes32 guidelinesHash, string brandName, address owner, address agentAddress, uint256 campaignCount, uint256 lastUpdated)",
  "function initialized() view returns (bool)",
  "function getEncryptedGuidelines() view returns (bytes)",
  "function getBrandName() view returns (string)",
  "function getGuidelinesHash() view returns (bytes32)",
  "function getCampaignCount() view returns (uint256)",
  "function getAgentAddress() view returns (address)",
  "function getCampaign(uint256 id) view returns (tuple(uint256 id, bytes32 contentHash, string platforms, string name, string campaignType, string contentTypes, address createdBy, uint256 createdAt, uint8 status))",
  "function getScheduleEntry(uint256 id) view returns (tuple(uint256 campaignId, bytes32 contentHash, string platforms, string scheduleType, uint256 scheduledFor, uint256 createdAt, bool executed))",
  "function getActivityEntry(uint256 id) view returns (tuple(string actionType, string description, bytes32 dataHash, uint256 timestamp))",
  "function getAllCampaigns() view returns (tuple(uint256 id, bytes32 contentHash, string platforms, string name, string campaignType, string contentTypes, address createdBy, uint256 createdAt, uint8 status)[])",
  "function getAllScheduleEntries() view returns (tuple(uint256 campaignId, bytes32 contentHash, string platforms, string scheduleType, uint256 scheduledFor, uint256 createdAt, bool executed)[])",
  "function getAllActivityEntries() view returns (tuple(string actionType, string description, bytes32 dataHash, uint256 timestamp)[])",
  "function growthWalletBalance() view returns (uint256)",
  "function hssEnabled() view returns (bool)",
  // Events for task access
  "event AccessGranted(uint256 indexed taskId, address indexed workerAgent, uint256 expiresAt)",
  "event AccessRevoked(uint256 indexed taskId)",
  "event TaskDelivered(uint256 indexed taskId, address indexed worker, bytes32 outputHash, bytes32 usedGuidelinesHash, bool guidelinesMatch)",
];

export const BRAND_REGISTRY_ABI = [
  "function getTotalBrands() view returns (uint256)",
  "function getTotalRevenue() view returns (uint256)",
  "function getAllBrands() view returns (tuple(address owner, address vaultAddress, uint256 createdAt, uint256 totalSpent)[])",
  "function brands(uint256) view returns (address owner, address vaultAddress, uint256 createdAt, uint256 totalSpent)",
];

export const AGENT_TREASURY_ABI = [
  "function getPnL() view returns (uint256 totalRevenue, uint256 computeBalance, uint256 growthBalance, uint256 reserveBalance)",
  "function growthThreshold() view returns (uint256)",
  "function agentAddress() view returns (address)",
  "function owner() view returns (address)",
  "function totalRevenue() view returns (uint256)",
  "function computeBalance() view returns (uint256)",
  "function growthBalance() view returns (uint256)",
  "function reserveBalance() view returns (uint256)",
];
