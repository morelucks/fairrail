// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IntentMatcher} from "./IntentMatcher.sol";

/**
 * @title FairRailKeeper
 * @notice Chainlink Automation-compatible keeper for triggering batch intent matching
 * @dev Monitors registered token pairs and triggers processInternalBatchMatching
 *      when the pending intent queue exceeds a configurable threshold.
 *
 *      Register this contract on https://automation.chain.link as a Custom Logic upkeep.
 *
 *      Compatible with Chainlink Automation v2.1 (AutomationCompatibleInterface).
 */
contract FairRailKeeper {
    // ──────────────────────────────────────────────────────
    //  Types
    // ──────────────────────────────────────────────────────

    struct TokenPair {
        address tokenIn;
        address tokenOut;
    }

    // ──────────────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────────────

    IntentMatcher public immutable matcher;
    address public owner;
    uint256 public minPendingBatchSize;

    /// @notice Registry of token pairs monitored by this keeper
    TokenPair[] public registeredPairs;

    // ──────────────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────────────

    event PairRegistered(address indexed tokenIn, address indexed tokenOut);
    event PairRemoved(uint256 indexed index, address tokenIn, address tokenOut);
    event BatchSizeUpdated(uint256 newMinBatchSize);
    event UpkeepPerformed(address tokenIn, address tokenOut, uint256 matched);

    // ──────────────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────────────

    error Unauthorized();
    error IndexOutOfBounds();

    // ──────────────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    // ──────────────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────────────

    /**
     * @param _matcher Address of the deployed IntentMatcher contract
     * @param _minBatchSize Minimum number of pending intents to trigger batch matching
     */
    constructor(address _matcher, uint256 _minBatchSize) {
        matcher = IntentMatcher(_matcher);
        minPendingBatchSize = _minBatchSize;
        owner = msg.sender;
    }

    // ──────────────────────────────────────────────────────
    //  Pair Management
    // ──────────────────────────────────────────────────────

    /**
     * @notice Registers a token pair for the keeper to monitor
     * @param tokenIn The input token address
     * @param tokenOut The output token address
     */
    function registerPair(address tokenIn, address tokenOut) external onlyOwner {
        registeredPairs.push(TokenPair(tokenIn, tokenOut));
        emit PairRegistered(tokenIn, tokenOut);
    }

    /**
     * @notice Removes a token pair from the monitoring registry
     * @param index The index of the pair to remove
     */
    function removePair(uint256 index) external onlyOwner {
        if (index >= registeredPairs.length) revert IndexOutOfBounds();
        TokenPair memory removed = registeredPairs[index];
        // Swap with last element and pop
        registeredPairs[index] = registeredPairs[registeredPairs.length - 1];
        registeredPairs.pop();
        emit PairRemoved(index, removed.tokenIn, removed.tokenOut);
    }

    /**
     * @notice Updates the minimum batch size threshold
     * @param _minBatchSize New minimum pending intents to trigger upkeep
     */
    function setMinPendingBatchSize(uint256 _minBatchSize) external onlyOwner {
        minPendingBatchSize = _minBatchSize;
        emit BatchSizeUpdated(_minBatchSize);
    }

    /**
     * @notice Returns the total number of registered pairs
     */
    function registeredPairCount() external view returns (uint256) {
        return registeredPairs.length;
    }

    // ──────────────────────────────────────────────────────
    //  Chainlink Automation Interface
    // ──────────────────────────────────────────────────────

    /**
     * @notice Called off-chain by Chainlink Automation DON to check if upkeep is needed
     * @dev Iterates all registered pairs and returns the first pair that exceeds the batch threshold.
     *      This is a view function — no gas cost when simulated off-chain.
     * @return upkeepNeeded True if any registered pair has enough pending intents
     * @return performData ABI-encoded (address tokenIn, address tokenOut) for the pair to process
     */
    function checkUpkeep(bytes calldata /* checkData */)
        external
        view
        returns (bool upkeepNeeded, bytes memory performData)
    {
        for (uint256 i = 0; i < registeredPairs.length; i++) {
            TokenPair memory pair = registeredPairs[i];

            // Check forward direction
            uint256 forwardCount = matcher.pendingIntentCount(pair.tokenIn, pair.tokenOut);
            uint256 reverseCount = matcher.pendingIntentCount(pair.tokenOut, pair.tokenIn);

            // Upkeep needed if both directions have pending intents and at least one exceeds threshold
            if (forwardCount > 0 && reverseCount > 0 && (forwardCount + reverseCount) >= minPendingBatchSize) {
                return (true, abi.encode(pair.tokenIn, pair.tokenOut));
            }
        }

        return (false, "");
    }

    /**
     * @notice Called on-chain by Chainlink Automation when checkUpkeep returns true
     * @dev Decodes the token pair and triggers internal batch matching on IntentMatcher
     * @param performData ABI-encoded (address tokenIn, address tokenOut)
     */
    function performUpkeep(bytes calldata performData) external {
        (address tokenIn, address tokenOut) = abi.decode(performData, (address, address));

        // Re-validate the condition on-chain to prevent stale upkeep execution
        uint256 forwardCount = matcher.pendingIntentCount(tokenIn, tokenOut);
        uint256 reverseCount = matcher.pendingIntentCount(tokenOut, tokenIn);
        require(
            forwardCount > 0 && reverseCount > 0 && (forwardCount + reverseCount) >= minPendingBatchSize,
            "FairRailKeeper: upkeep condition not met"
        );

        uint256 matched = matcher.processInternalBatchMatching(tokenIn, tokenOut);
        emit UpkeepPerformed(tokenIn, tokenOut, matched);
    }
}
