// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AgentRegistry
/// @notice Lightweight registry for swarm agents. Agents self-register with
///         their name, skills, and fee rate so task posters can discover them.
contract AgentRegistry {

    // ============================================================
    // STRUCTS
    // ============================================================

    struct Agent {
        address agentAddress;
        string  name;
        string  skills;
        uint256 feeRate;      // basis points (500 = 5%)
        bool    active;
        uint256 registeredAt;
    }

    // ============================================================
    // STATE
    // ============================================================

    Agent[] public agents;
    mapping(address => uint256) public agentIndex; // 1-indexed (0 = not registered)
    address public owner;

    // ============================================================
    // EVENTS
    // ============================================================

    event AgentRegistered(
        address indexed agentAddress,
        string  name,
        string  skills,
        uint256 feeRate,
        uint256 timestamp
    );

    event AgentDeactivated(
        address indexed agentAddress,
        uint256 timestamp
    );

    event SkillsUpdated(
        address indexed agentAddress,
        string  newSkills,
        uint256 timestamp
    );

    // ============================================================
    // ERRORS
    // ============================================================

    error NotOwner();
    error AlreadyRegistered();
    error NotRegistered();

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

    /// @notice Self-register as a swarm agent
    /// @param name Human-readable agent name
    /// @param skills Comma-separated skill tags (e.g. "social,content,pr")
    /// @param feeRate Fee in basis points (500 = 5%)
    function registerAgent(
        string calldata name,
        string calldata skills,
        uint256 feeRate
    ) external {
        if (agentIndex[msg.sender] != 0) revert AlreadyRegistered();

        agents.push(Agent({
            agentAddress: msg.sender,
            name:         name,
            skills:       skills,
            feeRate:      feeRate,
            active:       true,
            registeredAt: block.timestamp
        }));
        agentIndex[msg.sender] = agents.length; // 1-indexed

        emit AgentRegistered(msg.sender, name, skills, feeRate, block.timestamp);
    }

    /// @notice Update your skill tags
    /// @param newSkills New comma-separated skill tags
    function updateSkills(string calldata newSkills) external {
        uint256 idx = agentIndex[msg.sender];
        if (idx == 0) revert NotRegistered();
        agents[idx - 1].skills = newSkills;

        emit SkillsUpdated(msg.sender, newSkills, block.timestamp);
    }

    /// @notice Deactivate your agent registration
    function deactivateAgent() external {
        uint256 idx = agentIndex[msg.sender];
        if (idx == 0) revert NotRegistered();
        agents[idx - 1].active = false;

        emit AgentDeactivated(msg.sender, block.timestamp);
    }

    // ============================================================
    // VIEW FUNCTIONS
    // ============================================================

    /// @notice Get agent details by address
    function getAgent(address agentAddress) external view returns (Agent memory) {
        uint256 idx = agentIndex[agentAddress];
        if (idx == 0) revert NotRegistered();
        return agents[idx - 1];
    }

    /// @notice Check if an address is registered
    function isRegistered(address agentAddress) external view returns (bool) {
        return agentIndex[agentAddress] != 0;
    }

    /// @notice Total number of registered agents
    function agentCount() external view returns (uint256) {
        return agents.length;
    }

    /// @notice Get all agents
    function getAllAgents() external view returns (Agent[] memory) {
        return agents;
    }
}
