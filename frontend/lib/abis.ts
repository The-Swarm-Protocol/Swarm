/** ABI fragments (human-readable) for dashboard + agent interactions */

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

/** TaskBoard ABI — read + write functions for the swarm task board */
export const SWARM_TASK_BOARD_ABI = [
  // Write functions
  "function postTask(address vaultAddress, string title, string description, string requiredSkills, uint256 deadline) payable returns (uint256)",
  "function claimTask(uint256 taskId) external",
  "function submitDelivery(uint256 taskId, bytes32 deliveryHash) external",
  "function approveDelivery(uint256 taskId) external",
  "function disputeDelivery(uint256 taskId) external",
  // Read functions
  "function getOpenTasks() view returns (tuple(uint256 taskId, address vault, string title, string description, string requiredSkills, uint256 deadline, uint256 budget, address poster, address claimedBy, bytes32 deliveryHash, uint256 createdAt, uint8 status)[])",
  "function getTask(uint256 taskId) view returns (tuple(uint256 taskId, address vault, string title, string description, string requiredSkills, uint256 deadline, uint256 budget, address poster, address claimedBy, bytes32 deliveryHash, uint256 createdAt, uint8 status))",
  "function getAllTasks() view returns (tuple(uint256 taskId, address vault, string title, string description, string requiredSkills, uint256 deadline, uint256 budget, address poster, address claimedBy, bytes32 deliveryHash, uint256 createdAt, uint8 status)[])",
  "function taskCount() view returns (uint256)",
  // Events
  "event TaskPosted(uint256 indexed taskId, address indexed poster, address vault, string title, uint256 budget, uint256 deadline, uint256 timestamp)",
  "event TaskClaimed(uint256 indexed taskId, address indexed agent, uint256 timestamp)",
  "event DeliverySubmitted(uint256 indexed taskId, address indexed agent, bytes32 deliveryHash, uint256 timestamp)",
  "event DeliveryApproved(uint256 indexed taskId, address indexed agent, uint256 payout, uint256 timestamp)",
  "event DeliveryDisputed(uint256 indexed taskId, address indexed poster, uint256 timestamp)",
];

/** AgentRegistry ABI — read + write functions for agent registration */
export const AGENT_REGISTRY_ABI = [
  // Write functions
  "function registerAgent(string name, string skills, uint256 feeRate) external",
  "function updateSkills(string newSkills) external",
  "function deactivateAgent() external",
  // Read functions
  "function getAgent(address agentAddr) view returns (tuple(address agentAddress, string name, string skills, uint256 feeRate, bool active, uint256 registeredAt))",
  "function isRegistered(address agentAddr) view returns (bool)",
  "function agentCount() view returns (uint256)",
  "function getAllAgents() view returns (tuple(address agentAddress, string name, string skills, uint256 feeRate, bool active, uint256 registeredAt)[])",
  // Events
  "event AgentRegistered(address indexed agentAddress, string name, string skills, uint256 feeRate, uint256 timestamp)",
  "event AgentDeactivated(address indexed agentAddress, uint256 timestamp)",
  "event SkillsUpdated(address indexed agentAddress, string newSkills, uint256 timestamp)",
];
