// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SwarmTaskBoard
/// @notice A task board where brand owners post jobs and swarm agents claim, deliver, and get paid.
///         Budget is held in escrow until the poster approves the delivery.
contract SwarmTaskBoard {

    // ============================================================
    // ENUMS
    // ============================================================

    // 0 = Open, 1 = Claimed, 2 = Delivered, 3 = Approved, 4 = Disputed
    uint8 public constant STATUS_OPEN      = 0;
    uint8 public constant STATUS_CLAIMED   = 1;
    uint8 public constant STATUS_DELIVERED = 2;
    uint8 public constant STATUS_APPROVED  = 3;
    uint8 public constant STATUS_DISPUTED  = 4;

    // ============================================================
    // STRUCTS
    // ============================================================

    struct Task {
        uint256 taskId;
        address vault;
        string  title;
        string  description;
        string  requiredSkills;
        uint256 deadline;
        uint256 budget;
        address poster;
        address claimedBy;
        bytes32 deliveryHash;
        uint256 createdAt;
        uint8   status;
    }

    // ============================================================
    // STATE
    // ============================================================

    Task[] public tasks;
    uint256 public taskCount;
    address public owner;

    // ============================================================
    // EVENTS
    // ============================================================

    event TaskPosted(
        uint256 indexed taskId,
        address indexed poster,
        address vault,
        string  title,
        uint256 budget,
        uint256 deadline,
        uint256 timestamp
    );

    event TaskClaimed(
        uint256 indexed taskId,
        address indexed agent,
        uint256 timestamp
    );

    event DeliverySubmitted(
        uint256 indexed taskId,
        address indexed agent,
        bytes32 deliveryHash,
        uint256 timestamp
    );

    event DeliveryApproved(
        uint256 indexed taskId,
        address indexed agent,
        uint256 payout,
        uint256 timestamp
    );

    event DeliveryDisputed(
        uint256 indexed taskId,
        address indexed poster,
        uint256 timestamp
    );

    // ============================================================
    // ERRORS
    // ============================================================

    error NotOwner();
    error TaskNotFound();
    error TaskNotOpen();
    error TaskNotClaimed();
    error TaskNotDelivered();
    error NotPoster();
    error AlreadyClaimed();
    error CannotClaimOwn();
    error DeadlinePassed();
    error NoBudget();
    error TransferFailed();

    // ============================================================
    // MODIFIERS
    // ============================================================

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ============================================================
    // CONSTRUCTOR
    // ============================================================

    constructor() {
        owner = msg.sender;
    }

    // ============================================================
    // CORE FUNCTIONS
    // ============================================================

    /// @notice Post a new task with HBAR budget held in escrow
    /// @param vaultAddress The BrandVault this task relates to
    /// @param title Short title for the task
    /// @param description Detailed description of what needs to be done
    /// @param requiredSkills Comma-separated skill tags (e.g. "social,twitter,pr")
    /// @param deadline Unix timestamp deadline
    /// @return taskId The ID of the newly created task
    function postTask(
        address vaultAddress,
        string calldata title,
        string calldata description,
        string calldata requiredSkills,
        uint256 deadline
    ) external payable returns (uint256) {
        if (msg.value == 0) revert NoBudget();

        uint256 id = taskCount;
        tasks.push(Task({
            taskId:         id,
            vault:          vaultAddress,
            title:          title,
            description:    description,
            requiredSkills: requiredSkills,
            deadline:       deadline,
            budget:         msg.value,
            poster:         msg.sender,
            claimedBy:      address(0),
            deliveryHash:   bytes32(0),
            createdAt:      block.timestamp,
            status:         STATUS_OPEN
        }));
        taskCount++;

        emit TaskPosted(id, msg.sender, vaultAddress, title, msg.value, deadline, block.timestamp);
        return id;
    }

    /// @notice Claim an open task
    /// @param taskId The task to claim
    function claimTask(uint256 taskId) external {
        if (taskId >= taskCount) revert TaskNotFound();
        Task storage t = tasks[taskId];
        if (t.status != STATUS_OPEN) revert TaskNotOpen();
        if (t.deadline != 0 && block.timestamp > t.deadline) revert DeadlinePassed();
        if (msg.sender == t.poster) revert CannotClaimOwn();

        t.claimedBy = msg.sender;
        t.status = STATUS_CLAIMED;

        emit TaskClaimed(taskId, msg.sender, block.timestamp);
    }

    /// @notice Submit delivery hash as proof of work
    /// @param taskId The task being delivered
    /// @param _deliveryHash keccak256 hash of the deliverable content
    function submitDelivery(uint256 taskId, bytes32 _deliveryHash) external {
        if (taskId >= taskCount) revert TaskNotFound();
        Task storage t = tasks[taskId];
        if (t.status != STATUS_CLAIMED) revert TaskNotClaimed();
        if (msg.sender != t.claimedBy) revert AlreadyClaimed();

        t.deliveryHash = _deliveryHash;
        t.status = STATUS_DELIVERED;

        emit DeliverySubmitted(taskId, msg.sender, _deliveryHash, block.timestamp);
    }

    /// @notice Approve delivery and release budget to worker
    /// @param taskId The task to approve
    function approveDelivery(uint256 taskId) external {
        if (taskId >= taskCount) revert TaskNotFound();
        Task storage t = tasks[taskId];
        if (t.status != STATUS_DELIVERED) revert TaskNotDelivered();
        if (msg.sender != t.poster) revert NotPoster();

        t.status = STATUS_APPROVED;
        uint256 payout = t.budget;

        (bool sent, ) = t.claimedBy.call{value: payout}("");
        if (!sent) revert TransferFailed();

        emit DeliveryApproved(taskId, t.claimedBy, payout, block.timestamp);
    }

    /// @notice Dispute a delivery (poster only)
    /// @param taskId The task to dispute
    function disputeDelivery(uint256 taskId) external {
        if (taskId >= taskCount) revert TaskNotFound();
        Task storage t = tasks[taskId];
        if (t.status != STATUS_DELIVERED) revert TaskNotDelivered();
        if (msg.sender != t.poster) revert NotPoster();

        t.status = STATUS_DISPUTED;

        emit DeliveryDisputed(taskId, msg.sender, block.timestamp);
    }

    // ============================================================
    // VIEW FUNCTIONS
    // ============================================================

    /// @notice Get a single task by ID
    function getTask(uint256 taskId) external view returns (Task memory) {
        if (taskId >= taskCount) revert TaskNotFound();
        return tasks[taskId];
    }

    /// @notice Get all tasks
    function getAllTasks() external view returns (Task[] memory) {
        return tasks;
    }

    /// @notice Get only open tasks
    function getOpenTasks() external view returns (Task[] memory) {
        uint256 openCount = 0;
        for (uint256 i = 0; i < taskCount; i++) {
            if (tasks[i].status == STATUS_OPEN) openCount++;
        }

        Task[] memory result = new Task[](openCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < taskCount; i++) {
            if (tasks[i].status == STATUS_OPEN) {
                result[idx] = tasks[i];
                idx++;
            }
        }
        return result;
    }

    // ============================================================
    // RECEIVE
    // ============================================================

    /// @notice Accept HBAR deposits
    receive() external payable {}
}
