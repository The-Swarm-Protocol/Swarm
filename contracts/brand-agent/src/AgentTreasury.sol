// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AgentTreasury
/// @notice Receives all platform revenue and auto-splits into compute, growth, and reserve.
///         The autonomous brand agent uses growth funds for self-marketing campaigns.
/// @dev Split: 80% reserve, 10% compute (Claude API), 10% growth (self-marketing)
contract AgentTreasury {

    // ============================================================
    // STATE
    // ============================================================

    address public owner;
    address public agentAddress;

    uint256 public computeBalance;
    uint256 public growthBalance;
    uint256 public reserveBalance;
    uint256 public totalRevenue;

    /// @notice Minimum growth balance to trigger a self-marketing campaign
    uint256 public growthThreshold;

    // ============================================================
    // EVENTS
    // ============================================================

    event PaymentReceived(
        address indexed from,
        uint256 amount,
        uint256 computeSplit,
        uint256 growthSplit,
        uint256 reserveSplit,
        uint256 timestamp
    );

    event ComputeWithdrawn(
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );

    event GrowthCampaignTriggered(
        uint256 growthBalance,
        uint256 timestamp
    );

    event SwarmWorkerPaid(
        address indexed worker,
        uint256 amount,
        uint256 timestamp
    );

    event GrowthWithdrawn(address indexed to, uint256 amount, uint256 timestamp);

    // ============================================================
    // ERRORS
    // ============================================================

    error NotOwner();
    error NotOwnerOrAgent();
    error InsufficientBalance();
    error TransferFailed();
    error GrowthBelowThreshold();

    // ============================================================
    // MODIFIERS
    // ============================================================

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyOwnerOrAgent() {
        if (msg.sender != owner && msg.sender != agentAddress) revert NotOwnerOrAgent();
        _;
    }

    // ============================================================
    // CONSTRUCTOR
    // ============================================================

    /// @param _agentAddress Address of the brand agent
    /// @param _growthThreshold Minimum growth balance to trigger self-marketing (in wei)
    constructor(address _agentAddress, uint256 _growthThreshold) {
        owner = msg.sender;
        agentAddress = _agentAddress;
        growthThreshold = _growthThreshold;
    }

    // ============================================================
    // RECEIVE — AUTO-SPLIT
    // ============================================================

    /// @notice Auto-splits incoming payments: 80% reserve, 10% compute, 10% growth
    receive() external payable {
        uint256 amount = msg.value;
        uint256 computeSplit = amount / 10;          // 10%
        uint256 growthSplit = amount / 10;            // 10%
        uint256 reserveSplit = amount - computeSplit - growthSplit; // 80%

        computeBalance += computeSplit;
        growthBalance += growthSplit;
        reserveBalance += reserveSplit;
        totalRevenue += amount;

        emit PaymentReceived(
            msg.sender,
            amount,
            computeSplit,
            growthSplit,
            reserveSplit,
            block.timestamp
        );
    }

    // ============================================================
    // WITHDRAW FUNCTIONS
    // ============================================================

    /// @notice Withdraw from compute balance to pay for Claude API
    function withdrawCompute(address to, uint256 amount) external onlyOwner {
        if (amount > computeBalance) revert InsufficientBalance();
        computeBalance -= amount;
        (bool sent, ) = to.call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit ComputeWithdrawn(to, amount, block.timestamp);
    }

    /// @notice Pay a swarm worker for completed task from reserve
    function paySwarmWorker(address worker, uint256 amount) external onlyOwnerOrAgent {
        if (amount > reserveBalance) revert InsufficientBalance();
        reserveBalance -= amount;
        (bool sent, ) = worker.call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit SwarmWorkerPaid(worker, amount, block.timestamp);
    }

    /// @notice Withdraw from growth balance for marketing spend
    function withdrawGrowth(address to, uint256 amount) external onlyOwnerOrAgent {
        if (amount > growthBalance) revert InsufficientBalance();
        growthBalance -= amount;
        (bool sent, ) = to.call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit GrowthWithdrawn(to, amount, block.timestamp);
    }

    // ============================================================
    // GROWTH CAMPAIGN TRIGGER
    // ============================================================

    /// @notice Trigger a self-marketing campaign when growth balance exceeds threshold
    /// @dev Agent monitors this event and generates a campaign for BrandMover itself
    function triggerGrowthCampaign() external onlyOwnerOrAgent {
        if (growthBalance < growthThreshold) revert GrowthBelowThreshold();
        emit GrowthCampaignTriggered(growthBalance, block.timestamp);
    }

    // ============================================================
    // VIEW FUNCTIONS
    // ============================================================

    /// @notice Returns P&L breakdown
    function getPnL()
        external
        view
        returns (
            uint256 _totalRevenue,
            uint256 _computeBalance,
            uint256 _growthBalance,
            uint256 _reserveBalance
        )
    {
        return (totalRevenue, computeBalance, growthBalance, reserveBalance);
    }

    // ============================================================
    // ADMIN
    // ============================================================

    function setAgent(address newAgent) external onlyOwner {
        agentAddress = newAgent;
    }

    function setGrowthThreshold(uint256 newThreshold) external onlyOwner {
        growthThreshold = newThreshold;
    }
}
