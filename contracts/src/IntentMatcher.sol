// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20Minimal} from "v4-core/interfaces/external/IERC20Minimal.sol";
import {AcrossMessageHandler} from "./interfaces/IAcrossMessageHandler.sol";
import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";

/**
 * @title IntentMatcher
 * @notice Manages off-chain signed trade intents and peer-to-peer batch matching
 * @dev Pre-filters swap flow before hitting the Uniswap v4 AMM pool, reducing slippage and LVR exposure.
 *      Uses EIP-712 structured data signing for intent authentication and nonce-based replay protection.
 *      Traders must approve this contract to spend their tokens before submitting intents.
 *
 *      Integrations:
 *      - Across Protocol V3: Receives cross-chain intents via handleV3AcrossMessage callback
 *      - Chainlink Price Feeds: Validates intent match prices against oracle reference rates
 */
contract IntentMatcher is AcrossMessageHandler {
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
    //  Ownership
    // ──────────────────────────────────────────────────────

    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "IntentMatcher: not owner");
        _;
    }

    // ──────────────────────────────────────────────────────
    //  Across Protocol V3
    // ──────────────────────────────────────────────────────

    /// @notice The Across V3 SpokePool authorized to deliver cross-chain intents
    address public immutable spokePool;

    modifier onlySpokePool() {
        require(msg.sender == spokePool, "IntentMatcher: only SpokePool");
        _;
    }

    // ──────────────────────────────────────────────────────
    //  Chainlink Price Feeds
    // ──────────────────────────────────────────────────────

    /// @notice Maps token addresses to their Chainlink price feed aggregators
    mapping(address => address) public priceFeeds;

    /// @notice Maximum allowed price deviation in basis points (default 100 = 1%)
    uint256 public maxPriceDeviationBps = 100;

    /// @notice Maximum staleness for price feed data (default 1 hour)
    uint256 public maxPriceStaleness = 1 hours;

    /// @notice Whether oracle price validation is enforced on batch matches
    bool public oracleValidationEnabled = false;

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

    event CrossChainIntentReceived(
        address indexed trader,
        address tokenSent,
        uint256 amount,
        address relayer
    );

    event PriceFeedUpdated(address indexed token, address indexed feed);
    event OracleValidationToggled(bool enabled);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ──────────────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────────────

    error IntentExpired();
    error InvalidSignature();
    error IntentAlreadyExecuted();
    error IncompatibleTokens();
    error InvalidNonce();
    error TransferFailed();
    error OraclePriceDeviation();
    error StaleOraclePrice();
    error InvalidOraclePrice();
    error NoPriceFeedConfigured();

    // ──────────────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────────────

    /**
     * @param _spokePool Address of the Across V3 SpokePool on this chain (set to address(0) to disable cross-chain)
     * @param _owner Address of the contract owner for admin functions
     */
    constructor(address _spokePool, address _owner) {
        _CHAIN_ID = block.chainid;
        _DOMAIN_SEPARATOR = _computeDomainSeparator();
        spokePool = _spokePool;
        owner = _owner;
    }

    // ──────────────────────────────────────────────────────
    //  Ownership
    // ──────────────────────────────────────────────────────

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "IntentMatcher: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
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
    //  Chainlink Price Feed Management
    // ──────────────────────────────────────────────────────

    /**
     * @notice Configures a Chainlink price feed for a given token
     * @param token The ERC-20 token address
     * @param feed The Chainlink AggregatorV3 price feed address
     */
    function setPriceFeed(address token, address feed) external onlyOwner {
        priceFeeds[token] = feed;
        emit PriceFeedUpdated(token, feed);
    }

    /**
     * @notice Updates the maximum allowed price deviation for oracle validation
     * @param _bps Deviation in basis points (e.g., 100 = 1%)
     */
    function setMaxPriceDeviationBps(uint256 _bps) external onlyOwner {
        require(_bps > 0 && _bps <= 5000, "IntentMatcher: deviation out of range");
        maxPriceDeviationBps = _bps;
    }

    /**
     * @notice Updates the maximum staleness threshold for price data
     * @param _seconds Maximum age of price data in seconds
     */
    function setMaxPriceStaleness(uint256 _seconds) external onlyOwner {
        require(_seconds > 0, "IntentMatcher: zero staleness");
        maxPriceStaleness = _seconds;
    }

    /**
     * @notice Enables or disables oracle price validation on batch matches
     */
    function setOracleValidationEnabled(bool _enabled) external onlyOwner {
        oracleValidationEnabled = _enabled;
        emit OracleValidationToggled(_enabled);
    }

    /**
     * @notice Reads the latest price for a token from its configured Chainlink feed
     * @param token The token to query the price for
     * @return price The latest price as a uint256
     * @return feedDecimals The number of decimals in the feed's price
     */
    function getLatestPrice(address token) public view returns (uint256 price, uint8 feedDecimals) {
        address feedAddress = priceFeeds[token];
        if (feedAddress == address(0)) revert NoPriceFeedConfigured();

        AggregatorV3Interface priceFeed = AggregatorV3Interface(feedAddress);
        (
            /* uint80 roundId */,
            int256 rawPrice,
            /* uint256 startedAt */,
            uint256 updatedAt,
            /* uint80 answeredInRound */
        ) = priceFeed.latestRoundData();

        if (rawPrice <= 0) revert InvalidOraclePrice();
        if (block.timestamp - updatedAt > maxPriceStaleness) revert StaleOraclePrice();

        return (uint256(rawPrice), priceFeed.decimals());
    }

    /**
     * @notice Validates that a match price is within acceptable deviation of Chainlink oracle rates
     * @param tokenIn The input token
     * @param tokenOut The output token
     * @param amountIn Amount of tokenIn being traded
     * @param amountOut Amount of tokenOut being received
     * @return valid True if the price is within the acceptable deviation
     */
    function validateMatchPrice(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    ) public view returns (bool valid) {
        // If either token has no feed configured, skip validation (return true)
        if (priceFeeds[tokenIn] == address(0) || priceFeeds[tokenOut] == address(0)) {
            return true;
        }

        (uint256 priceIn, uint8 decIn) = getLatestPrice(tokenIn);
        (uint256 priceOut, uint8 decOut) = getLatestPrice(tokenOut);

        // Calculate expected output: (amountIn * priceIn / priceOut) adjusted for decimal differences
        // Use intermediate scaling to avoid precision loss
        uint256 expectedOut = (amountIn * priceIn * (10 ** decOut)) / (priceOut * (10 ** decIn));

        // Allow deviation within maxPriceDeviationBps
        uint256 minAllowed = (expectedOut * (10000 - maxPriceDeviationBps)) / 10000;

        return amountOut >= minAllowed;
    }

    // ──────────────────────────────────────────────────────
    //  Across Protocol V3 — Cross-Chain Intent Receipt
    // ──────────────────────────────────────────────────────

    /**
     * @notice Callback invoked by the Across SpokePool when a cross-chain deposit is filled
     * @dev Decodes the trader's intent from the message payload and queues it for batch matching.
     *      The bridged tokens are already held by this contract when this function is called.
     * @param tokenSent The token that was bridged to this chain
     * @param amount The amount of tokens bridged
     * @param relayer The relayer that fulfilled the deposit
     * @param message ABI-encoded intent data: (address trader, address tokenOut, uint256 minAmountOut, uint256 deadline)
     */
    function handleV3AcrossMessage(
        address tokenSent,
        uint256 amount,
        address relayer,
        bytes memory message
    ) external override onlySpokePool {
        // Decode the cross-chain intent payload
        (
            address trader,
            address tokenOut,
            uint256 minAmountOut,
            uint256 deadline
        ) = abi.decode(message, (address, address, uint256, uint256));

        require(block.timestamp <= deadline, "IntentMatcher: cross-chain intent expired");

        // Assign a nonce and construct the intent
        uint256 nonce = userNonces[trader];
        userNonces[trader]++;

        // Add to the pending queue for batch matching
        bytes32 pairHash = keccak256(abi.encodePacked(tokenSent, tokenOut));
        _pendingIntents[pairHash].push(TradeIntent({
            trader: trader,
            tokenIn: tokenSent,
            tokenOut: tokenOut,
            amountIn: amount,
            minAmountOut: minAmountOut,
            nonce: nonce,
            deadline: deadline,
            signature: "" // Cross-chain intents are authenticated by the SpokePool, not by signature
        }));

        emit CrossChainIntentReceived(trader, tokenSent, amount, relayer);
        emit PendingIntentSubmitted(trader, tokenSent, tokenOut, amount, deadline);
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

        // 7. Oracle price validation (if enabled)
        if (oracleValidationEnabled) {
            if (!validateMatchPrice(intentA.tokenIn, intentA.tokenOut, matchedInA, matchedInB)) {
                revert OraclePriceDeviation();
            }
        }

        // 8. Mark intents as executed and increment nonces
        executedIntents[hashA] = true;
        executedIntents[hashB] = true;
        userNonces[intentA.trader]++;
        userNonces[intentB.trader]++;

        // 9. Execute token transfers (traders must have approved this contract)
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

        // Reject signatures with `s` in the upper half of the secp256k1 curve to prevent malleability
        // See: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/cryptography/ECDSA.sol
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            revert InvalidSignature();
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

            // Oracle price validation (if enabled)
            if (oracleValidationEnabled) {
                if (!validateMatchPrice(tokenIn, tokenOut, matchable, matchable)) continue;
            }

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

    // ──────────────────────────────────────────────────────
    //  Internal Batch Matching (for Chainlink Automation)
    // ──────────────────────────────────────────────────────

    event InternalBatchMatched(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 totalMatched
    );

    /**
     * @notice Matches pending intents against each other without an incoming swap trigger.
     *         Scans the forward queue (tokenIn → tokenOut) against the reverse queue (tokenOut → tokenIn)
     *         and executes P2P matches between pending intents.
     * @dev Designed to be called by Chainlink Automation Keepers or any external triggerer.
     * @param tokenIn The input token of the pair to process
     * @param tokenOut The output token of the pair to process
     * @return totalMatched Total volume matched across both queues
     */
    function processInternalBatchMatching(
        address tokenIn,
        address tokenOut
    ) external returns (uint256 totalMatched) {
        bytes32 forwardPairHash = keccak256(abi.encodePacked(tokenIn, tokenOut));
        bytes32 reversePairHash = keccak256(abi.encodePacked(tokenOut, tokenIn));

        TradeIntent[] storage forwardIntents = _pendingIntents[forwardPairHash];
        TradeIntent[] storage reverseIntents = _pendingIntents[reversePairHash];

        for (uint256 i = 0; i < forwardIntents.length; i++) {
            TradeIntent storage fi = forwardIntents[i];

            // Skip consumed or expired forward intents
            if (fi.amountIn == 0 || block.timestamp > fi.deadline) continue;

            for (uint256 j = 0; j < reverseIntents.length; j++) {
                TradeIntent storage ri = reverseIntents[j];

                // Skip consumed or expired reverse intents
                if (ri.amountIn == 0 || block.timestamp > ri.deadline) continue;

                // Determine matchable volume: min of both available amounts
                uint256 matchable = fi.amountIn < ri.amountIn ? fi.amountIn : ri.amountIn;

                // Enforce minimum output requirements
                if (matchable < fi.minAmountOut || matchable < ri.minAmountOut) continue;

                // Oracle validation (if enabled)
                if (oracleValidationEnabled) {
                    if (!validateMatchPrice(tokenIn, tokenOut, matchable, matchable)) continue;
                }

                // Execute the match
                totalMatched += matchable;

                // Consume matched volume
                fi.amountIn -= matchable;
                ri.amountIn -= matchable;

                // Mark as executed if fully consumed
                if (fi.amountIn == 0) {
                    bytes32 fHash = keccak256(
                        abi.encode(fi.trader, fi.tokenIn, fi.tokenOut, matchable, fi.minAmountOut, fi.nonce, fi.deadline)
                    );
                    executedIntents[fHash] = true;
                    emit IntentMatched(fHash, fi.trader, fi.tokenIn, fi.tokenOut, matchable, matchable);
                }

                if (ri.amountIn == 0) {
                    bytes32 rHash = keccak256(
                        abi.encode(ri.trader, ri.tokenIn, ri.tokenOut, matchable, ri.minAmountOut, ri.nonce, ri.deadline)
                    );
                    executedIntents[rHash] = true;
                    emit IntentMatched(rHash, ri.trader, ri.tokenIn, ri.tokenOut, matchable, matchable);
                }

                // If forward intent is fully consumed, move to next forward intent
                if (fi.amountIn == 0) break;
            }
        }

        if (totalMatched > 0) {
            emit InternalBatchMatched(tokenIn, tokenOut, totalMatched);
        }
    }

    // ──────────────────────────────────────────────────────
    //  Queue Cleanup
    // ──────────────────────────────────────────────────────

    /**
     * @notice Compacts the pending intent queue for a token pair by removing consumed and expired entries.
     *         Callable by anyone to prevent unbounded gas growth from stale queue entries.
     * @param tokenIn The input token of the pair to clean up
     * @param tokenOut The output token of the pair to clean up
     * @return removed The number of entries removed
     */
    function cleanupPendingIntents(address tokenIn, address tokenOut) external returns (uint256 removed) {
        bytes32 pairHash = keccak256(abi.encodePacked(tokenIn, tokenOut));
        TradeIntent[] storage intents = _pendingIntents[pairHash];

        uint256 writeIdx = 0;
        for (uint256 readIdx = 0; readIdx < intents.length; readIdx++) {
            // Keep the intent if it still has volume and hasn't expired
            if (intents[readIdx].amountIn > 0 && block.timestamp <= intents[readIdx].deadline) {
                if (writeIdx != readIdx) {
                    intents[writeIdx] = intents[readIdx];
                }
                writeIdx++;
            }
        }

        removed = intents.length - writeIdx;

        // Pop removed entries from the end
        for (uint256 i = 0; i < removed; i++) {
            intents.pop();
        }
    }
}
