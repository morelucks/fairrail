// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title AcrossMessageHandler
 * @notice Interface for contracts that receive cross-chain messages via Across Protocol V3
 * @dev When a relayer fills a cross-chain deposit on the destination chain, the SpokePool
 *      calls this function on the recipient contract with the bridged tokens and encoded message.
 *      Source: https://github.com/across-protocol/contracts
 */
interface AcrossMessageHandler {
    /**
     * @notice Called by the Across SpokePool when a cross-chain deposit is filled
     * @param tokenSent The address of the token that was bridged to this chain
     * @param amount The amount of tokens bridged
     * @param relayer The address of the relayer that fulfilled the deposit
     * @param message Arbitrary bytes data encoded by the depositor on the source chain
     */
    function handleV3AcrossMessage(
        address tokenSent,
        uint256 amount,
        address relayer,
        bytes memory message
    ) external;
}
