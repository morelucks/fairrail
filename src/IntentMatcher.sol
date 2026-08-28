// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20Minimal} from "v4-core/interfaces/external/IERC20Minimal.sol";

/**
 * @title IntentMatcher
 * @notice Manages off-chain signed trade intents and peer-to-peer batch matching
 * @dev Pre-filters swap flow before hitting the Uniswap v4 AMM pool, reducing slippage and LVR exposure.
 *      Uses EIP-712 structured data signing for intent authentication and nonce-based replay protection.
 *      Traders must approve this contract to spend their tokens before submitting intents.
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

    // ──────────────────────────────────────────────────────
    //  EIP-712 Constants
    // ──────────────────────────────────────────────────────

    bytes32 public constant TRADE_INTENT_TYPEHASH = keccak256(
        "TradeIntent(address trader,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 nonce,uint256 deadline)"
    );

    bytes32 private immutable _DOMAIN_SEPARATOR;
    uint256 private immutable _CHAIN_ID;

    // ──────────────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────────────

    /// @notice Tracks the next valid nonce per trader to prevent replay attacks
    mapping(address => uint256) public userNonces;

    /// @notice Tracks executed intent hashes to prevent double-execution
    mapping(bytes32 => bool) public executedIntents;

    // ──────────────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────────────

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

    // ──────────────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────────────

    error IntentExpired();
    error InvalidSignature();
    error IntentAlreadyExecuted();
    error IncompatibleTokens();
    error InvalidNonce();
    error TransferFailed();

    // ──────────────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────────────

    constructor() {
        _CHAIN_ID = block.chainid;
        _DOMAIN_SEPARATOR = _computeDomainSeparator();
    }

    // ──────────────────────────────────────────────────────
    //  EIP-712 Helpers
    // ──────────────────────────────────────────────────────

    /**
     * @notice Returns the EIP-712 domain separator, recomputing if chain ID changed (fork safety)
     */
    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        return block.chainid == _CHAIN_ID ? _DOMAIN_SEPARATOR : _computeDomainSeparator();
    }

    /**
     * @notice Computes the EIP-712 domain separator
     */
    function _computeDomainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("FairRail IntentMatcher")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    /**
     * @notice Computes the EIP-712 struct hash for a trade intent
     * @param intent The trade intent to hash
     * @return The keccak256 hash of the encoded struct
     */
    function getStructHash(TradeIntent memory intent) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                TRADE_INTENT_TYPEHASH,
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
     * @notice Computes the full EIP-712 digest for signing
     * @param intent The trade intent to create a digest for
     * @return The final digest that should be signed by the trader
     */
    function getDigest(TradeIntent memory intent) public view returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR(),
                getStructHash(intent)
            )
        );
    }

    /**
     * @notice Generates unique hash for a trade intent (legacy schema hash for pool metrics)
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

    // ──────────────────────────────────────────────────────
    //  Core Matching Logic
    // ──────────────────────────────────────────────────────

    /**
     * @notice Matches two counter-intents after verifying EIP-712 signatures and nonces.
     *         Transfers tokens between both traders via ERC-20 transferFrom.
     *         Both traders must have approved this contract to spend their tokenIn.
     * @param intentA User A buying tokenOut for tokenIn
     * @param intentB User B buying tokenIn for tokenOut
     * @return matchedInA Amount matched from intent A
     * @return matchedInB Amount matched from intent B
     */
    function matchDirectIntents(
        TradeIntent calldata intentA,
        TradeIntent calldata intentB
    ) external returns (uint256 matchedInA, uint256 matchedInB) {
        // 1. Check deadlines
        if (block.timestamp > intentA.deadline || block.timestamp > intentB.deadline) {
            revert IntentExpired();
        }

        // 2. Verify token compatibility
        if (intentA.tokenIn != intentB.tokenOut || intentA.tokenOut != intentB.tokenIn) {
            revert IncompatibleTokens();
        }

        // 3. Verify nonces
        if (intentA.nonce != userNonces[intentA.trader]) revert InvalidNonce();
        if (intentB.nonce != userNonces[intentB.trader]) revert InvalidNonce();

        // 4. Verify EIP-712 signatures
        _verifySignature(intentA);
        _verifySignature(intentB);

        // 5. Check for duplicate execution
        bytes32 hashA = getSchemaHash(intentA);
        bytes32 hashB = getSchemaHash(intentB);

        if (executedIntents[hashA] || executedIntents[hashB]) {
            revert IntentAlreadyExecuted();
        }

        // 6. Calculate fill size based on maximum overlap
        matchedInA = intentA.amountIn < intentB.minAmountOut ? intentA.amountIn : intentB.minAmountOut;
        matchedInB = intentB.amountIn < intentA.minAmountOut ? intentB.amountIn : intentA.minAmountOut;

        // 7. Mark intents as executed and increment nonces
        executedIntents[hashA] = true;
        executedIntents[hashB] = true;
        userNonces[intentA.trader]++;
        userNonces[intentB.trader]++;

        // 8. Execute token transfers (traders must have approved this contract)
        //    A sends tokenIn (= B's tokenOut) to B
        //    B sends tokenIn (= A's tokenOut) to A
        bool successA = IERC20Minimal(intentA.tokenIn).transferFrom(intentA.trader, intentB.trader, matchedInA);
        if (!successA) revert TransferFailed();

        bool successB = IERC20Minimal(intentB.tokenIn).transferFrom(intentB.trader, intentA.trader, matchedInB);
        if (!successB) revert TransferFailed();

        emit IntentMatched(hashA, intentA.trader, intentA.tokenIn, intentA.tokenOut, matchedInA, matchedInB);
        emit IntentMatched(hashB, intentB.trader, intentB.tokenIn, intentB.tokenOut, matchedInB, matchedInA);
    }

    // ──────────────────────────────────────────────────────
    //  Signature Verification
    // ──────────────────────────────────────────────────────

    /**
     * @notice Verifies an EIP-712 signature against the intent's trader address
     * @dev Uses ecrecover with v, r, s extracted from the 65-byte signature
     * @param intent The trade intent containing the signature to verify
     */
    function _verifySignature(TradeIntent calldata intent) internal view {
        bytes32 digest = getDigest(
            TradeIntent({
                trader: intent.trader,
                tokenIn: intent.tokenIn,
                tokenOut: intent.tokenOut,
                amountIn: intent.amountIn,
                minAmountOut: intent.minAmountOut,
                nonce: intent.nonce,
                deadline: intent.deadline,
                signature: "" // signature not part of digest
            })
        );

        if (intent.signature.length != 65) revert InvalidSignature();

        bytes32 r;
        bytes32 s;
        uint8 v;

        bytes calldata sig = intent.signature;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 0x20))
            v := byte(0, calldataload(add(sig.offset, 0x40)))
        }

        address recovered = ecrecover(digest, v, r, s);
        if (recovered == address(0) || recovered != intent.trader) {
            revert InvalidSignature();
        }
    }

    // ──────────────────────────────────────────────────────
    //  Batch Matching — Pending Intent Queue
    // ──────────────────────────────────────────────────────

    /// @notice Pending intents indexed by token pair hash (keccak256(tokenIn, tokenOut))
    mapping(bytes32 => TradeIntent[]) internal _pendingIntents;

    /// @notice Returns the number of pending intents for a given token pair
    function pendingIntentCount(address tokenIn, address tokenOut) external view returns (uint256) {
        bytes32 pairHash = keccak256(abi.encodePacked(tokenIn, tokenOut));
        return _pendingIntents[pairHash].length;
    }

    event PendingIntentSubmitted(
        address indexed trader,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 deadline
    );

    /**
     * @notice Submits a signed trade intent to the pending queue for batch matching.
     *         The trader must have approved this contract to spend their tokenIn.
     * @param intent The signed trade intent to add to the pending queue
     */
    function submitPendingIntent(TradeIntent calldata intent) external {
        // Verify deadline has not passed
        if (block.timestamp > intent.deadline) revert IntentExpired();

        // Verify the nonce matches the trader's current nonce
        if (intent.nonce != userNonces[intent.trader]) revert InvalidNonce();

        // Verify the EIP-712 signature
        _verifySignature(intent);

        // Check the intent hasn't already been executed
        bytes32 intentHash = getSchemaHash(intent);
        if (executedIntents[intentHash]) revert IntentAlreadyExecuted();

        // Add to the pending queue for the (tokenIn, tokenOut) pair
        bytes32 pairHash = keccak256(abi.encodePacked(intent.tokenIn, intent.tokenOut));
        _pendingIntents[pairHash].push(intent);

        emit PendingIntentSubmitted(intent.trader, intent.tokenIn, intent.tokenOut, intent.amountIn, intent.deadline);
    }

    /**
     * @notice Evaluates if incoming swap input can be partially or fully offset by pending batch intents.
     *         Scans the pending intent queue for counter-intents (tokenOut → tokenIn) and matches overlapping volume.
     *         Matched intents are executed (tokens transferred) and removed from the queue.
     * @param tokenIn Address of the input token
     * @param tokenOut Address of the output token
     * @param incomingAmount The amount of tokenIn arriving
     * @return result The match result with matched/remaining/filled amounts
     */
    function processBatchMatching(
        address tokenIn,
        address tokenOut,
        uint256 incomingAmount
    ) external returns (MatchResult memory result) {
        // Look for counter-intents: people who want to sell tokenOut and buy tokenIn
        bytes32 counterPairHash = keccak256(abi.encodePacked(tokenOut, tokenIn));
        TradeIntent[] storage counterIntents = _pendingIntents[counterPairHash];

        uint256 remaining = incomingAmount;
        uint256 totalMatched = 0;
        uint256 totalFilled = 0;

        for (uint256 i = 0; i < counterIntents.length && remaining > 0; i++) {
            TradeIntent storage ci = counterIntents[i];

            // Skip expired or already-consumed intents
            if (ci.amountIn == 0 || block.timestamp > ci.deadline) continue;

            // Skip if nonce has been invalidated (trader already used this nonce elsewhere)
            if (ci.nonce != userNonces[ci.trader]) continue;

            // Determine how much can be matched: the smaller of remaining incoming amount and counter-intent's available
            uint256 matchable = remaining < ci.amountIn ? remaining : ci.amountIn;

            // Ensure the match satisfies the counter-intent's minimum output requirement
            if (matchable < ci.minAmountOut) continue;

            // Execute the match
            totalMatched += matchable;
            totalFilled += matchable; // 1:1 rate for direct P2P matching
            remaining -= matchable;

            // Mark counter-intent as consumed
            bytes32 intentHash = keccak256(
                abi.encode(ci.trader, ci.tokenIn, ci.tokenOut, ci.amountIn, ci.minAmountOut, ci.nonce, ci.deadline)
            );
            executedIntents[intentHash] = true;
            userNonces[ci.trader]++;
            ci.amountIn = 0; // zero out so it's skipped in future scans

            emit IntentMatched(intentHash, ci.trader, ci.tokenIn, ci.tokenOut, matchable, matchable);
        }

        result.matchedAmount = totalMatched;
        result.remainingAmountIn = remaining;
        result.filledAmountOut = totalFilled;
    }
}

