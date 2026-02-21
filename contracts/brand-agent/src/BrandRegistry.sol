// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title BrandRegistry
/// @notice Registry that tracks BrandVault deployments and collects creation fees.
///         Vaults are deployed externally (via script) and registered here.
///         Supports a one-step createAndRegister pattern via the deployment script.
/// @dev On Hedera, deploying large contracts from within another contract
///      exceeds gas limits, so we use an external deploy + register pattern.
contract BrandRegistry {

    // ============================================================
    // STRUCTS
    // ============================================================

    struct BrandEntry {
        address owner;
        address vaultAddress;
        uint256 createdAt;
        uint256 totalSpent;
    }

    // ============================================================
    // STATE
    // ============================================================

    address public treasury;
    address public owner;
    uint256 public creationFee;
    uint256 public totalRevenue;

    BrandEntry[] public brands;
    mapping(address => uint256) public brandIndex;    // owner => index+1
    mapping(address => uint256) public vaultIndex;    // vault => index+1

    // ============================================================
    // EVENTS
    // ============================================================

    event BrandCreated(
        address indexed owner,
        address indexed vaultAddress,
        string brandName,
        uint256 feePaid,
        uint256 timestamp
    );

    event CreationFeeUpdated(uint256 oldFee, uint256 newFee);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event BrandSpendRecorded(address indexed vaultAddress, uint256 amount);

    // ============================================================
    // ERRORS
    // ============================================================

    error InsufficientFee();
    error BrandAlreadyExists();
    error NotOwner();
    error TransferFailed();
    error BrandNotFound();
    error VaultAlreadyRegistered();

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

    constructor(address _treasury, uint256 _creationFee) {
        treasury = _treasury;
        creationFee = _creationFee;
        owner = msg.sender;
    }

    // ============================================================
    // CORE FUNCTIONS
    // ============================================================

    /// @notice Register a pre-deployed BrandVault and pay the creation fee
    /// @param brandOwner The brand's owner address
    /// @param vaultAddress The deployed BrandVault contract address
    /// @param brandName Human-readable name (for event logging)
    function registerVault(
        address brandOwner,
        address vaultAddress,
        string calldata brandName
    ) external payable {
        if (msg.value < creationFee) revert InsufficientFee();
        if (brandIndex[brandOwner] != 0) revert BrandAlreadyExists();
        if (vaultIndex[vaultAddress] != 0) revert VaultAlreadyRegistered();

        brands.push(BrandEntry({
            owner: brandOwner,
            vaultAddress: vaultAddress,
            createdAt: block.timestamp,
            totalSpent: 0
        }));
        brandIndex[brandOwner] = brands.length;
        vaultIndex[vaultAddress] = brands.length;

        totalRevenue += msg.value;
        if (treasury != address(0)) {
            (bool sent, ) = treasury.call{value: msg.value}("");
            if (!sent) revert TransferFailed();
        }

        emit BrandCreated(brandOwner, vaultAddress, brandName, msg.value, block.timestamp);
    }

    /// @notice Record campaign spend for a brand
    function recordSpend(address vaultAddress, uint256 amount) external {
        uint256 idx = vaultIndex[vaultAddress];
        if (idx == 0) revert BrandNotFound();
        brands[idx - 1].totalSpent += amount;
        emit BrandSpendRecorded(vaultAddress, amount);
    }

    // ============================================================
    // VIEW FUNCTIONS
    // ============================================================

    function getVault(address brandOwner) external view returns (address) {
        uint256 idx = brandIndex[brandOwner];
        if (idx == 0) revert BrandNotFound();
        return brands[idx - 1].vaultAddress;
    }

    function getAllBrands() external view returns (BrandEntry[] memory) {
        return brands;
    }

    function getTotalBrands() external view returns (uint256) {
        return brands.length;
    }

    function getTotalRevenue() external view returns (uint256) {
        return totalRevenue;
    }

    // ============================================================
    // ADMIN
    // ============================================================

    function setCreationFee(uint256 newFee) external onlyOwner {
        emit CreationFeeUpdated(creationFee, newFee);
        creationFee = newFee;
    }

    function setTreasury(address newTreasury) external onlyOwner {
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }
}
