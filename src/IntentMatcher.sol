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

    /**
     * @notice Generates unique hash for a trade intent
     */
    function getSchemaHash(TradeIntent calldata intent) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                intent.trader,
                intent.tokenIn,
                intent.tokenOut,
                intent.amountIn,
                intent.minAmountOut,
                intent.nonce,
                intent.deadline
            )
        );
    }

    /**
     * @notice Simulates or executes matching between two counter-intents
     * @param intentA User A buying tokenOut for tokenIn
     * @param intentB User B buying tokenIn for tokenOut
     */
    function matchDirectIntents(
        TradeIntent calldata intentA,
        TradeIntent calldata intentB
    ) external returns (uint256 matchedInA, uint256 matchedInB) {
        if (block.timestamp > intentA.deadline || block.timestamp > intentB.deadline) {
            revert IntentExpired();
        }
        if (intentA.tokenIn != intentB.tokenOut || intentA.tokenOut != intentB.tokenIn) {
            revert IncompatibleTokens();
        }

        bytes32 hashA = getSchemaHash(intentA);
        bytes32 hashB = getSchemaHash(intentB);

        if (executedIntents[hashA] || executedIntents[hashB]) {
            revert IntentAlreadyExecuted();
        }

        // Calculate fill size based on maximum overlap
        matchedInA = intentA.amountIn < intentB.minAmountOut ? intentA.amountIn : intentB.minAmountOut;
        matchedInB = intentB.amountIn < intentA.minAmountOut ? intentB.amountIn : intentA.minAmountOut;

        executedIntents[hashA] = true;
        executedIntents[hashB] = true;

        emit IntentMatched(hashA, intentA.trader, intentA.tokenIn, intentA.tokenOut, matchedInA, matchedInB);
        emit IntentMatched(hashB, intentB.trader, intentB.tokenIn, intentB.tokenOut, matchedInB, matchedInA);
    }
}
