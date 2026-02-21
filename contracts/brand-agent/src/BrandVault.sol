// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IHederaScheduleService.sol";

/// @title BrandVault
/// @notice Encrypted onchain brand management for autonomous AI agents on Hedera.
///         Stores AES-256-CBC encrypted brand guidelines, manages campaigns,
///         schedules remarketing via Hedera Schedule Service, and logs agent activity.
/// @dev Ported from Movement blockchain (Move) to Hedera EVM. Part of the Swarm
///      autonomous corporation: Trading Agent earns, Brand Agent spends on marketing.
contract BrandVault {

    // ============================================================
    // CONSTANTS
    // ============================================================

    /// @dev Hedera Schedule Service system contract (0x16b)
    address constant HSS_ADDRESS = address(0x16b);

    /// @dev Set to true once HIP-1215 is confirmed live on testnet.
    ///      When false, the contract stores schedule entries for manual triggering.
    bool public hssEnabled;

    // ============================================================
    // STRUCTS
    // ============================================================

    struct Vault {
        bytes encryptedGuidelines;
        bytes32 guidelinesHash;
        string brandName;
        address owner;
        address agentAddress;
        uint256 campaignCount;
        uint256 lastUpdated;
    }

    struct Campaign {
        uint256 id;
        bytes32 contentHash;
        string platforms;
        string name;
        string campaignType;      // "full_launch", "remarketing", "pr_only"
        string contentTypes;      // "pr,twitter,linkedin,discord,instagram,video,email"
        address createdBy;
        uint256 createdAt;
        uint8 status;             // 0=draft, 1=active, 2=complete, 3=scheduled
    }

    struct ScheduleEntry {
        uint256 campaignId;
        bytes32 contentHash;
        string platforms;
        string scheduleType;      // "remarketing_7d", "remarketing_14d", "followup"
        uint256 scheduledFor;     // unix timestamp
        uint256 createdAt;
        bool executed;
    }

    struct ActivityEntry {
        string actionType;
        string description;
        bytes32 dataHash;
        uint256 timestamp;
    }

    struct TaskAccess {
        uint256 taskId;
        address workerAgent;
        bytes encryptedGuidelines;      // re-encrypted with a temp AES key
        bytes encryptedTempKey;          // temp key encrypted with worker's public key
        bytes32 guidelinesHash;          // hash of the plaintext subset shared
        uint256 grantedAt;
        uint256 expiresAt;
        bool revoked;
    }

    // ============================================================
    // STATE
    // ============================================================

    Vault public vault;
    bool public initialized;

    Campaign[] public campaigns;
    ScheduleEntry[] public scheduleEntries;
    ActivityEntry[] public activityEntries;

    /// @notice Growth wallet balance funded by the trading agent
    uint256 public growthWalletBalance;

    /// @notice Time-locked task access grants for swarm worker agents
    mapping(uint256 => TaskAccess) public taskAccess;

    /// @notice Treasury address that receives campaign payments
    address public treasury;

    /// @notice Campaign pricing in tinybars (1 HBAR = 10^8 tinybar on Hedera EVM)
    uint256 constant ONE_HBAR = 10 ** 8;
    uint256 public constant PRICE_FULL = 100 * ONE_HBAR;    // 100 HBAR
    uint256 public constant PRICE_SOCIAL = 40 * ONE_HBAR;   // 40 HBAR
    uint256 public constant PRICE_SINGLE = 15 * ONE_HBAR;   // 15 HBAR

    // ============================================================
    // EVENTS
    // ============================================================

    event VaultCreated(
        address indexed owner,
        string brandName,
        uint256 timestamp
    );

    event GuidelinesUpdated(
        address indexed owner,
        bytes32 newGuidelinesHash,
        uint256 timestamp
    );

    event CampaignCreated(
        uint256 indexed campaignId,
        string name,
        string campaignType,
        string contentTypes,
        address createdBy,
        string platforms,
        uint256 timestamp
    );

    event ContentScheduled(
        uint256 indexed campaignId,
        string scheduleType,
        uint256 scheduledFor,
        string platforms,
        uint256 timestamp
    );

    event AgentActivityLogged(
        address indexed agent,
        string actionType,
        bytes32 dataHash,
        uint256 timestamp
    );

    event RemarketingExecuted(
        uint256 indexed campaignId,
        string name,
        string platforms,
        uint256 timestamp
    );

    event GrowthWalletDeposit(
        address indexed from,
        uint256 amount,
        uint256 timestamp
    );

    event HSSStatusChanged(bool enabled);

    event CampaignRequested(
        address indexed requester,
        string campaignType,
        uint256 pricePaid,
        uint256 timestamp
    );

    event AccessGranted(
        uint256 indexed taskId,
        address indexed workerAgent,
        uint256 expiresAt
    );

    event AccessRevoked(uint256 indexed taskId);

    event TaskDelivered(
        uint256 indexed taskId,
        address indexed worker,
        bytes32 outputHash,
        bytes32 usedGuidelinesHash,
        bool guidelinesMatch
    );

    // ============================================================
    // ERRORS
    // ============================================================

    error VaultAlreadyInitialized();
    error VaultNotInitialized();
    error NotOwner();
    error NotAgent();
    error NotOwnerOrAgent();
    error InvalidCampaignId();
    error InvalidScheduleEntryId();
    error InvalidActivityEntryId();
    error ScheduleAlreadyExecuted();
    error ScheduleNotDue();
    error TaskAccessAlreadyExists();
    error TaskAccessNotFound();
    error TaskAccessExpired();
    error TaskAccessRevoked();
    error NotAssignedWorker();
    error InvalidCampaignType();
    error InsufficientPayment();
    error TreasuryNotSet();
    error PaymentFailed();

    // ============================================================
    // MODIFIERS
    // ============================================================

    modifier onlyOwner() {
        if (msg.sender != vault.owner) revert NotOwner();
        _;
    }

    modifier onlyAgent() {
        if (msg.sender != vault.agentAddress) revert NotAgent();
        _;
    }

    modifier onlyOwnerOrAgent() {
        if (msg.sender != vault.owner && msg.sender != vault.agentAddress)
            revert NotOwnerOrAgent();
        _;
    }

    modifier whenInitialized() {
        if (!initialized) revert VaultNotInitialized();
        _;
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================

    /// @notice Initialize the brand vault with encrypted guidelines
    /// @param brandName Human-readable brand name
    /// @param encryptedGuidelines AES-256-CBC encrypted brand guidelines (IV prepended)
    /// @param guidelinesHash SHA-256 hash of the plaintext guidelines
    /// @param agentAddress Address of the AI agent authorized to act on behalf of the brand
    function initializeVault(
        string calldata brandName,
        bytes calldata encryptedGuidelines,
        bytes32 guidelinesHash,
        address agentAddress
    ) external {
        if (initialized) revert VaultAlreadyInitialized();

        vault = Vault({
            encryptedGuidelines: encryptedGuidelines,
            guidelinesHash: guidelinesHash,
            brandName: brandName,
            owner: msg.sender,
            agentAddress: agentAddress,
            campaignCount: 0,
            lastUpdated: block.timestamp
        });

        initialized = true;

        emit VaultCreated(msg.sender, brandName, block.timestamp);
    }

    // ============================================================
    // OWNER-ONLY FUNCTIONS
    // ============================================================

    /// @notice Update encrypted brand guidelines
    function updateGuidelines(
        bytes calldata newEncryptedGuidelines,
        bytes32 newGuidelinesHash
    ) external whenInitialized onlyOwner {
        vault.encryptedGuidelines = newEncryptedGuidelines;
        vault.guidelinesHash = newGuidelinesHash;
        vault.lastUpdated = block.timestamp;

        emit GuidelinesUpdated(msg.sender, newGuidelinesHash, block.timestamp);
    }

    /// @notice Set or change the authorized AI agent address
    function setAgent(address newAgentAddress) external whenInitialized onlyOwner {
        vault.agentAddress = newAgentAddress;
        vault.lastUpdated = block.timestamp;
    }

    /// @notice Enable or disable HSS integration (for when HIP-1215 goes live)
    function setHSSEnabled(bool enabled) external whenInitialized onlyOwner {
        hssEnabled = enabled;
        emit HSSStatusChanged(enabled);
    }

    /// @notice Transfer vault ownership to a new address
    function transferOwnership(address newOwner) external whenInitialized onlyOwner {
        vault.owner = newOwner;
        vault.lastUpdated = block.timestamp;
    }

    /// @notice Set the treasury address that receives campaign payments
    function setTreasury(address _treasury) external whenInitialized onlyOwner {
        treasury = _treasury;
    }

    // ============================================================
    // CAMPAIGN PRICING
    // ============================================================

    /// @notice Request a campaign by paying the appropriate fee
    /// @param campaignType "full", "social", or "single"
    function requestCampaign(string calldata campaignType) external payable whenInitialized {
        uint256 price = _getCampaignPrice(campaignType);
        if (msg.value < price) revert InsufficientPayment();
        if (treasury == address(0)) revert TreasuryNotSet();

        // Forward payment to treasury
        (bool sent, ) = treasury.call{value: msg.value}("");
        if (!sent) revert PaymentFailed();

        emit CampaignRequested(msg.sender, campaignType, msg.value, block.timestamp);
    }

    function _getCampaignPrice(string calldata campaignType) internal pure returns (uint256) {
        bytes32 t = keccak256(bytes(campaignType));
        if (t == keccak256("full")) return PRICE_FULL;
        if (t == keccak256("social")) return PRICE_SOCIAL;
        if (t == keccak256("single")) return PRICE_SINGLE;
        revert InvalidCampaignType();
    }

    /// @notice Get the price for a campaign type
    function getCampaignPrice(string calldata campaignType) external pure returns (uint256) {
        return _getCampaignPrice(campaignType);
    }

    // ============================================================
    // CAMPAIGN MANAGEMENT
    // ============================================================

    /// @notice Create a new campaign entry onchain
    function createCampaign(
        string calldata name,
        bytes32 contentHash,
        string calldata platforms,
        string calldata campaignType,
        string calldata contentTypes
    ) external whenInitialized onlyOwnerOrAgent returns (uint256 campaignId) {
        campaignId = vault.campaignCount;
        vault.campaignCount++;

        campaigns.push(Campaign({
            id: campaignId,
            contentHash: contentHash,
            platforms: platforms,
            name: name,
            campaignType: campaignType,
            contentTypes: contentTypes,
            createdBy: msg.sender,
            createdAt: block.timestamp,
            status: 1 // active
        }));

        emit CampaignCreated(
            campaignId,
            name,
            campaignType,
            contentTypes,
            msg.sender,
            platforms,
            block.timestamp
        );
    }

    /// @notice Schedule content for future execution
    function scheduleContent(
        uint256 campaignId,
        bytes32 contentHash,
        string calldata platforms,
        string calldata scheduleType,
        uint256 scheduledFor
    ) external whenInitialized onlyOwnerOrAgent {
        scheduleEntries.push(ScheduleEntry({
            campaignId: campaignId,
            contentHash: contentHash,
            platforms: platforms,
            scheduleType: scheduleType,
            scheduledFor: scheduledFor,
            createdAt: block.timestamp,
            executed: false
        }));

        emit ContentScheduled(
            campaignId,
            scheduleType,
            scheduledFor,
            platforms,
            block.timestamp
        );
    }

    /// @notice Launch a campaign AND schedule remarketing via HSS (or fallback)
    /// @dev If HSS is enabled, schedules a future call to executeScheduledRemarketing()
    ///      via Hedera Schedule Service. Otherwise stores a ScheduleEntry for manual trigger.
    function launchCampaignWithRemarketing(
        string calldata name,
        bytes32 contentHash,
        bytes32 remarketingHash,
        string calldata platforms,
        uint256 remarketingTimestamp
    ) external whenInitialized onlyOwnerOrAgent returns (uint256 campaignId) {
        // 1. Create the initial campaign
        campaignId = vault.campaignCount;
        vault.campaignCount++;

        campaigns.push(Campaign({
            id: campaignId,
            contentHash: contentHash,
            platforms: platforms,
            name: name,
            campaignType: "full_launch",
            contentTypes: "pr,twitter,linkedin,discord,instagram,video,email",
            createdBy: msg.sender,
            createdAt: block.timestamp,
            status: 1
        }));

        emit CampaignCreated(
            campaignId,
            name,
            "full_launch",
            "pr,twitter,linkedin,discord,instagram,video,email",
            msg.sender,
            platforms,
            block.timestamp
        );

        // 2. Schedule remarketing
        if (hssEnabled) {
            // Use Hedera Schedule Service for auto-execution
            bytes memory callData = abi.encodeCall(
                this.executeScheduledRemarketing,
                (name, remarketingHash, platforms)
            );

            IHederaScheduleService hss = IHederaScheduleService(HSS_ADDRESS);
            hss.scheduleContractCall(
                address(this),
                callData,
                address(this),
                remarketingTimestamp
            );
        }

        // Always store the schedule entry (serves as record + fallback trigger)
        scheduleEntries.push(ScheduleEntry({
            campaignId: campaignId,
            contentHash: remarketingHash,
            platforms: platforms,
            scheduleType: "remarketing_7d",
            scheduledFor: remarketingTimestamp,
            createdAt: block.timestamp,
            executed: false
        }));

        emit ContentScheduled(
            campaignId,
            "remarketing_7d",
            remarketingTimestamp,
            platforms,
            block.timestamp
        );
    }

    /// @notice Execute a scheduled remarketing campaign
    /// @dev Called automatically by Hedera Schedule Service at the scheduled time,
    ///      or manually by the agent as a fallback when HSS is not available.
    function executeScheduledRemarketing(
        string calldata name,
        bytes32 contentHash,
        string calldata platforms
    ) external whenInitialized {
        // Allow calls from HSS (address(this) as scheduled payer) or from the agent
        require(
            msg.sender == vault.agentAddress || msg.sender == address(this),
            "Only agent or scheduled call"
        );

        uint256 campaignId = vault.campaignCount;
        vault.campaignCount++;

        campaigns.push(Campaign({
            id: campaignId,
            contentHash: contentHash,
            platforms: platforms,
            name: name,
            campaignType: "remarketing",
            contentTypes: "pr,twitter,linkedin,discord,instagram,video,email",
            createdBy: msg.sender,
            createdAt: block.timestamp,
            status: 1
        }));

        emit CampaignCreated(
            campaignId,
            name,
            "remarketing",
            "pr,twitter,linkedin,discord,instagram,video,email",
            msg.sender,
            platforms,
            block.timestamp
        );

        emit RemarketingExecuted(
            campaignId,
            name,
            platforms,
            block.timestamp
        );
    }

    /// @notice Manually trigger a scheduled entry (fallback when HSS is not available)
    /// @param entryId Index of the schedule entry to execute
    function triggerScheduledEntry(uint256 entryId) external whenInitialized onlyOwnerOrAgent {
        if (entryId >= scheduleEntries.length) revert InvalidScheduleEntryId();
        ScheduleEntry storage entry = scheduleEntries[entryId];
        if (entry.executed) revert ScheduleAlreadyExecuted();
        if (block.timestamp < entry.scheduledFor) revert ScheduleNotDue();

        entry.executed = true;

        // Create the remarketing campaign from the stored schedule data
        uint256 campaignId = vault.campaignCount;
        vault.campaignCount++;

        campaigns.push(Campaign({
            id: campaignId,
            contentHash: entry.contentHash,
            platforms: entry.platforms,
            name: "Remarketing (scheduled)",
            campaignType: "remarketing",
            contentTypes: "pr,twitter,linkedin,discord,instagram,video,email",
            createdBy: msg.sender,
            createdAt: block.timestamp,
            status: 1
        }));

        emit RemarketingExecuted(
            campaignId,
            "Remarketing (scheduled)",
            entry.platforms,
            block.timestamp
        );
    }

    // ============================================================
    // AGENT ACTIVITY LOG
    // ============================================================

    /// @notice Log AI agent activity onchain — AGENT ONLY
    function logAgentActivity(
        string calldata actionType,
        string calldata description,
        bytes32 dataHash
    ) external whenInitialized onlyAgent {
        activityEntries.push(ActivityEntry({
            actionType: actionType,
            description: description,
            dataHash: dataHash,
            timestamp: block.timestamp
        }));

        emit AgentActivityLogged(
            msg.sender,
            actionType,
            dataHash,
            block.timestamp
        );
    }

    // ============================================================
    // TASK ACCESS (Swarm Worker Delegation)
    // ============================================================

    /// @notice Grant time-locked access to brand guidelines for a swarm worker agent
    /// @param taskId Unique task identifier
    /// @param workerAgent Address of the worker agent receiving access
    /// @param encryptedGuidelines Guidelines re-encrypted with a temporary AES key
    /// @param encryptedTempKey Temporary AES key encrypted with the worker's public key
    /// @param guidelinesHash Hash of the plaintext subset being shared
    /// @param duration How long access lasts (seconds)
    function grantTaskAccess(
        uint256 taskId,
        address workerAgent,
        bytes calldata encryptedGuidelines,
        bytes calldata encryptedTempKey,
        bytes32 guidelinesHash,
        uint256 duration
    ) external whenInitialized onlyOwnerOrAgent {
        if (taskAccess[taskId].workerAgent != address(0)) revert TaskAccessAlreadyExists();

        taskAccess[taskId] = TaskAccess({
            taskId: taskId,
            workerAgent: workerAgent,
            encryptedGuidelines: encryptedGuidelines,
            encryptedTempKey: encryptedTempKey,
            guidelinesHash: guidelinesHash,
            grantedAt: block.timestamp,
            expiresAt: block.timestamp + duration,
            revoked: false
        });

        emit AccessGranted(taskId, workerAgent, block.timestamp + duration);
    }

    /// @notice Retrieve task access data — only callable by the assigned worker
    /// @param taskId The task to retrieve access for
    function getTaskAccess(uint256 taskId)
        external
        view
        whenInitialized
        returns (
            bytes memory encryptedGuidelines,
            bytes memory encryptedTempKey,
            bytes32 guidelinesHash,
            uint256 expiresAt
        )
    {
        TaskAccess storage access = taskAccess[taskId];
        if (access.workerAgent == address(0)) revert TaskAccessNotFound();
        if (access.revoked) revert TaskAccessRevoked();
        if (block.timestamp > access.expiresAt) revert TaskAccessExpired();
        if (msg.sender != access.workerAgent) revert NotAssignedWorker();

        return (
            access.encryptedGuidelines,
            access.encryptedTempKey,
            access.guidelinesHash,
            access.expiresAt
        );
    }

    /// @notice Revoke a worker's access and delete encrypted data from storage
    /// @param taskId The task to revoke access for
    function revokeAccess(uint256 taskId) external whenInitialized onlyOwnerOrAgent {
        TaskAccess storage access = taskAccess[taskId];
        if (access.workerAgent == address(0)) revert TaskAccessNotFound();

        access.revoked = true;
        delete access.encryptedGuidelines;
        delete access.encryptedTempKey;

        emit AccessRevoked(taskId);
    }

    /// @notice Worker submits task delivery with proof of guidelines compliance
    /// @param taskId The task being delivered
    /// @param outputHash Hash of the work product
    /// @param usedGuidelinesHash Hash the worker claims to have used
    function submitTaskDelivery(
        uint256 taskId,
        bytes32 outputHash,
        bytes32 usedGuidelinesHash
    ) external whenInitialized {
        TaskAccess storage access = taskAccess[taskId];
        if (access.workerAgent == address(0)) revert TaskAccessNotFound();
        if (msg.sender != access.workerAgent) revert NotAssignedWorker();
        if (access.revoked) revert TaskAccessRevoked();
        if (block.timestamp > access.expiresAt) revert TaskAccessExpired();

        bool guidelinesMatch = (usedGuidelinesHash == access.guidelinesHash);

        emit TaskDelivered(
            taskId,
            msg.sender,
            outputHash,
            usedGuidelinesHash,
            guidelinesMatch
        );
    }

    // ============================================================
    // GROWTH WALLET (Swarm Integration)
    // ============================================================

    /// @notice Deposit HBAR to fund marketing operations (from trading agent)
    function depositToGrowthWallet() external payable whenInitialized {
        growthWalletBalance += msg.value;
        emit GrowthWalletDeposit(msg.sender, msg.value, block.timestamp);
    }

    /// @notice Accept direct HBAR transfers as growth wallet deposits
    receive() external payable {
        growthWalletBalance += msg.value;
        emit GrowthWalletDeposit(msg.sender, msg.value, block.timestamp);
    }

    // ============================================================
    // VIEW FUNCTIONS
    // ============================================================

    function getEncryptedGuidelines() external view whenInitialized returns (bytes memory) {
        return vault.encryptedGuidelines;
    }

    function getBrandName() external view whenInitialized returns (string memory) {
        return vault.brandName;
    }

    function getGuidelinesHash() external view whenInitialized returns (bytes32) {
        return vault.guidelinesHash;
    }

    function getCampaignCount() external view whenInitialized returns (uint256) {
        return vault.campaignCount;
    }

    function getAgentAddress() external view whenInitialized returns (address) {
        return vault.agentAddress;
    }

    function getCampaign(uint256 id) external view whenInitialized returns (Campaign memory) {
        if (id >= campaigns.length) revert InvalidCampaignId();
        return campaigns[id];
    }

    function getScheduleEntry(uint256 id) external view whenInitialized returns (ScheduleEntry memory) {
        if (id >= scheduleEntries.length) revert InvalidScheduleEntryId();
        return scheduleEntries[id];
    }

    function getActivityEntry(uint256 id) external view whenInitialized returns (ActivityEntry memory) {
        if (id >= activityEntries.length) revert InvalidActivityEntryId();
        return activityEntries[id];
    }

    function getAllCampaigns() external view whenInitialized returns (Campaign[] memory) {
        return campaigns;
    }

    function getAllScheduleEntries() external view whenInitialized returns (ScheduleEntry[] memory) {
        return scheduleEntries;
    }

    function getAllActivityEntries() external view whenInitialized returns (ActivityEntry[] memory) {
        return activityEntries;
    }
}
