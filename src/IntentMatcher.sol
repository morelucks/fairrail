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
    //  Batch Matching (Simulation)
    // ──────────────────────────────────────────────────────

    /**
     * @notice Evaluates if incoming swap input can be partially or fully offset by pending batch intents
     * @dev HACKATHON DEMO: This is a simulation stub that always matches 40% of volume.
     *      In production, this would query an actual pending intent queue and compute real overlaps.
     * @param tokenIn Address of the input token
     * @param tokenOut Address of the output token
     * @param incomingAmount The amount of tokenIn arriving
     * @return result The match result with matched/remaining/filled amounts
     */
    function processBatchMatching(
        address tokenIn,
        address tokenOut,
        uint256 incomingAmount
    ) external pure returns (MatchResult memory result) {
        // Simulated matching ratio — always matches 40% of incoming trade off-chain
        uint256 simulatedMatch = (incomingAmount * 40) / 100;
        result.matchedAmount = simulatedMatch;
        result.remainingAmountIn = incomingAmount - simulatedMatch;
        result.filledAmountOut = simulatedMatch; // 1:1 baseline rate for matched portion
    }
}
