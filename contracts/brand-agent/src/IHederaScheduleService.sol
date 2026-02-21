// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IHederaScheduleService
/// @notice Interface for Hedera Schedule Service system contract at address 0x16b
/// @dev Based on HIP-1215 — generalized scheduled contract calls.
///      If HIP-1215 is not yet live on testnet, the BrandVault uses a fallback
///      pattern (manual trigger) that can be swapped to HSS without code changes.
interface IHederaScheduleService {
    /// @notice Authorize a scheduled transaction
    function authorizeSchedule(address schedule) external returns (int64 responseCode);

    /// @notice Sign a scheduled transaction
    function signSchedule(address schedule, bytes memory signatureMap) external returns (int64 responseCode);

    /// @notice Schedule a future contract call (HIP-1215)
    /// @param to Target contract address
    /// @param callData ABI-encoded function call
    /// @param payer Address that pays for execution
    /// @param expirationTime Unix timestamp when the scheduled call should execute
    /// @return responseCode Hedera response code
    /// @return scheduleAddress Address of the created schedule entity
    function scheduleContractCall(
        address to,
        bytes memory callData,
        address payer,
        uint256 expirationTime
    ) external returns (int64 responseCode, address scheduleAddress);
}
