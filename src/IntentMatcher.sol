// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title IntentMatcher
 * @notice Manages off-chain signed trade intents and peer-to-peer batch matching
 * @dev Pre-filters swap flow before hitting the Uniswap v4 AMM pool, reducing slippage and LVR exposure.
 */
contract IntentMatcher {
    struct TradeIntent {
        address trader;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        uint256 nonce;
        uint256 deadline;
        bytes signature;
    }

    struct MatchResult {
        uint256 matchedAmount;
        uint256 remainingAmountIn;
        uint256 filledAmountOut;
    }

    mapping(address => uint256) public userNonces;
    mapping(bytes32 => bool) public executedIntents;

    event IntentMatched(
        bytes32 indexed intentHash,
        address indexed trader,
        address tokenIn,
        address tokenOut,
        uint256 matchedAmount,
        uint256 outputAmount
    );

    event BatchMatched(
        bytes32 indexed batchId,
        uint256 totalIntents,
        uint256 totalVolumeMatched,
        uint256 unmatchedVolumeRoutedToAMM
    );

    error IntentExpired();
    error InvalidSignature();
    error IntentAlreadyExecuted();
    error IncompatibleTokens();
}
