// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";

import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta} from "v4-core/types/BeforeSwapDelta.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";

import "../src/IntentMatcher.sol";
import "../src/MevAuction.sol";
import "../src/FairRailHook.sol";
import {TestERC20} from "v4-core/test/TestERC20.sol";

contract FairRailHookTest is Test {
    using PoolIdLibrary for PoolKey;
    using Hooks for IHooks;

    FairRailHook public hook;
    IntentMatcher public matcher;
    MevAuction public auction;

    address public poolManager = address(0x1111111111111111111111111111111111111111);

    // Use private keys so we can sign intents with vm.sign()
    uint256 public traderAKey = 0xA11CE;
    uint256 public traderBKey = 0xB0B;
    address public traderA;
    address public traderB;

    address public searcher = address(0xCCCC);
    address public searcher2 = address(0xDDDD);

    TestERC20 public token0;
    TestERC20 public token1;
    Currency public currency0;
    Currency public currency1;

    PoolKey public poolKey;

    function setUp() public {
        // Derive trader addresses from private keys
        traderA = vm.addr(traderAKey);
        traderB = vm.addr(traderBKey);

        matcher = new IntentMatcher();

        // Deploy real ERC-20 tokens for intent matching tests
        token0 = new TestERC20(0);
        token1 = new TestERC20(0);

        // Ensure token0 address < token1 address (Uniswap v4 canonical ordering)
        if (address(token0) > address(token1)) {
            (token0, token1) = (token1, token0);
        }

        currency0 = Currency.wrap(address(token0));
        currency1 = Currency.wrap(address(token1));

        // Mint tokens to traders
        token0.mint(traderA, 1000 ether);
        token1.mint(traderA, 1000 ether);
        token0.mint(traderB, 1000 ether);
        token1.mint(traderB, 1000 ether);

        // Traders approve IntentMatcher to spend their tokens
        vm.prank(traderA);
        token0.approve(address(matcher), type(uint256).max);
        vm.prank(traderA);
        token1.approve(address(matcher), type(uint256).max);
        vm.prank(traderB);
        token0.approve(address(matcher), type(uint256).max);
        vm.prank(traderB);
        token1.approve(address(matcher), type(uint256).max);

        // FairRailHook requires beforeSwap, afterSwap, and beforeSwapReturnDelta flags
        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG);

        bytes memory constructorArgs = abi.encode(IPoolManager(poolManager), address(matcher));
        deployCodeTo("FairRailHook.sol:FairRailHook", constructorArgs, address(flags));
        hook = FairRailHook(payable(address(flags)));
        auction = hook.mevAuction();

        poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
    }

    // ──────────────────────────────────────────────────────
    //  EIP-712 Signing Helpers
    // ──────────────────────────────────────────────────────

    /// @dev Signs a TradeIntent with the given private key using EIP-712
    function _signIntent(
        IntentMatcher.TradeIntent memory intent,
        uint256 privateKey
    ) internal view returns (bytes memory) {
        bytes32 digest = matcher.getDigest(intent);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    /// @dev Creates a signed TradeIntent for convenience
    function _makeSignedIntent(
        uint256 privateKey,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (IntentMatcher.TradeIntent memory intent) {
        address trader = vm.addr(privateKey);
        intent = IntentMatcher.TradeIntent({
            trader: trader,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            minAmountOut: minAmountOut,
            nonce: nonce,
            deadline: deadline,
            signature: "" // placeholder
        });
        intent.signature = _signIntent(intent, privateKey);
    }

    // ──────────────────────────────────────────────────────
    //  Hook Permission Tests
    // ──────────────────────────────────────────────────────

    function test_HookPermissions() public view {
        Hooks.Permissions memory flags = hook.getHookPermissions();
        assertTrue(flags.beforeSwap);
        assertTrue(flags.afterSwap);
        assertFalse(flags.beforeInitialize);
        assertFalse(flags.afterInitialize);
        assertFalse(flags.beforeAddLiquidity);
        assertFalse(flags.afterAddLiquidity);
        assertFalse(flags.beforeRemoveLiquidity);
        assertFalse(flags.afterRemoveLiquidity);
        assertFalse(flags.beforeDonate);
        assertFalse(flags.afterDonate);
        assertTrue(flags.beforeSwapReturnDelta);
        assertFalse(flags.afterSwapReturnDelta);
    }

    function test_HookImplementsIHooks() public view {
        assertTrue(IHooks(address(hook)).hasPermission(Hooks.BEFORE_SWAP_FLAG));
        assertTrue(IHooks(address(hook)).hasPermission(Hooks.AFTER_SWAP_FLAG));
        assertFalse(IHooks(address(hook)).hasPermission(Hooks.BEFORE_INITIALIZE_FLAG));
    }

    // ──────────────────────────────────────────────────────
    //  EIP-712 Domain & Hashing Tests
    // ──────────────────────────────────────────────────────

    function test_DomainSeparator() public view {
        bytes32 ds = matcher.DOMAIN_SEPARATOR();
        assertTrue(ds != bytes32(0));
    }

    function test_TradeIntentTypehash() public view {
        bytes32 expected = keccak256(
            "TradeIntent(address trader,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 nonce,uint256 deadline)"
        );
        assertEq(matcher.TRADE_INTENT_TYPEHASH(), expected);
    }

    function test_IntentSchemaHash() public view {
        IntentMatcher.TradeIntent memory intent = _makeSignedIntent(
            traderAKey,
            Currency.unwrap(currency0),
            Currency.unwrap(currency1),
            10 ether,
            9.9 ether,
            0,
            block.timestamp + 100
        );

        bytes32 hash = matcher.getSchemaHash(intent);
        assertTrue(hash != bytes32(0));
    }

    function test_DigestDeterministic() public view {
        IntentMatcher.TradeIntent memory intent = IntentMatcher.TradeIntent({
            trader: traderA,
            tokenIn: Currency.unwrap(currency0),
            tokenOut: Currency.unwrap(currency1),
            amountIn: 10 ether,
            minAmountOut: 9.9 ether,
            nonce: 0,
            deadline: block.timestamp + 100,
            signature: ""
        });

        bytes32 digest1 = matcher.getDigest(intent);
        bytes32 digest2 = matcher.getDigest(intent);
        assertEq(digest1, digest2);
        assertTrue(digest1 != bytes32(0));
    }

    // ──────────────────────────────────────────────────────
    //  IntentMatcher — Signed Matching Tests
    // ──────────────────────────────────────────────────────

    function test_DirectIntentMatchingWithSignatures() public {
        uint256 traderAToken0Before = token0.balanceOf(traderA);
        uint256 traderBToken1Before = token1.balanceOf(traderB);

        IntentMatcher.TradeIntent memory intentA = _makeSignedIntent(
            traderAKey,
            Currency.unwrap(currency0),
            Currency.unwrap(currency1),
            10 ether,
            10 ether,
            0, // nonce 0
            block.timestamp + 100
        );

        IntentMatcher.TradeIntent memory intentB = _makeSignedIntent(
            traderBKey,
            Currency.unwrap(currency1),
            Currency.unwrap(currency0),
            10 ether,
            10 ether,
            0, // nonce 0
            block.timestamp + 100
        );

        (uint256 matchedA, uint256 matchedB) = matcher.matchDirectIntents(intentA, intentB);
        assertEq(matchedA, 10 ether);
        assertEq(matchedB, 10 ether);

        // Nonces should have incremented
        assertEq(matcher.userNonces(traderA), 1);
        assertEq(matcher.userNonces(traderB), 1);

        // Verify actual token transfers occurred
        assertEq(token0.balanceOf(traderA), traderAToken0Before - 10 ether); // A sent token0
        assertEq(token0.balanceOf(traderB), 1000 ether + 10 ether);          // B received token0
        assertEq(token1.balanceOf(traderB), traderBToken1Before - 10 ether); // B sent token1
        assertEq(token1.balanceOf(traderA), 1000 ether + 10 ether);          // A received token1
    }

    function test_NonceIncrements() public {
        // First match at nonce 0
        IntentMatcher.TradeIntent memory intentA = _makeSignedIntent(
            traderAKey, Currency.unwrap(currency0), Currency.unwrap(currency1),
            5 ether, 5 ether, 0, block.timestamp + 100
        );
        IntentMatcher.TradeIntent memory intentB = _makeSignedIntent(
            traderBKey, Currency.unwrap(currency1), Currency.unwrap(currency0),
            5 ether, 5 ether, 0, block.timestamp + 100
        );
        matcher.matchDirectIntents(intentA, intentB);
        assertEq(matcher.userNonces(traderA), 1);
        assertEq(matcher.userNonces(traderB), 1);

        // Second match at nonce 1
        IntentMatcher.TradeIntent memory intentA2 = _makeSignedIntent(
            traderAKey, Currency.unwrap(currency0), Currency.unwrap(currency1),
            7 ether, 7 ether, 1, block.timestamp + 100
        );
        IntentMatcher.TradeIntent memory intentB2 = _makeSignedIntent(
            traderBKey, Currency.unwrap(currency1), Currency.unwrap(currency0),
            7 ether, 7 ether, 1, block.timestamp + 100
        );
        matcher.matchDirectIntents(intentA2, intentB2);
        assertEq(matcher.userNonces(traderA), 2);
        assertEq(matcher.userNonces(traderB), 2);
    }

    function test_BatchMatchingSimulation() public {
        // Submit a counter-intent from traderB: wants to sell token1 and buy token0
        IntentMatcher.TradeIntent memory counterIntent = _makeSignedIntent(
            traderBKey,
            Currency.unwrap(currency1),
            Currency.unwrap(currency0),
            40 ether,
            40 ether,
            0,
            block.timestamp + 100
        );
        matcher.submitPendingIntent(counterIntent);

        // processBatchMatching looks for counter-intents that sell currency1 and buy currency0
        IntentMatcher.MatchResult memory res = matcher.processBatchMatching(
            Currency.unwrap(currency0), Currency.unwrap(currency1), 100 ether
        );
        // The counter-intent has 40 ether available, so 40 ether is matched
        assertEq(res.matchedAmount, 40 ether);
        assertEq(res.remainingAmountIn, 60 ether);
    }

    function test_BatchMatchingNoCounterIntents() public {
        // With an empty queue, nothing should match
        IntentMatcher.MatchResult memory res = matcher.processBatchMatching(
            Currency.unwrap(currency0), Currency.unwrap(currency1), 100 ether
        );
        assertEq(res.matchedAmount, 0);
        assertEq(res.remainingAmountIn, 100 ether);
    }

    function test_BatchMatchingMultipleCounterIntents() public {
        // Submit two small counter-intents from traderB (10 ether each)
        IntentMatcher.TradeIntent memory ci1 = _makeSignedIntent(
            traderBKey, Currency.unwrap(currency1), Currency.unwrap(currency0),
            10 ether, 10 ether, 0, block.timestamp + 100
        );
        matcher.submitPendingIntent(ci1);

        // traderA submits another counter-intent (nonce 0 for traderA)
        IntentMatcher.TradeIntent memory ci2 = _makeSignedIntent(
            traderAKey, Currency.unwrap(currency1), Currency.unwrap(currency0),
            15 ether, 15 ether, 0, block.timestamp + 100
        );
        matcher.submitPendingIntent(ci2);

        // Process incoming 100 ether — should match 10 + 15 = 25 ether total
        IntentMatcher.MatchResult memory res = matcher.processBatchMatching(
            Currency.unwrap(currency0), Currency.unwrap(currency1), 100 ether
        );
        assertEq(res.matchedAmount, 25 ether);
        assertEq(res.remainingAmountIn, 75 ether);
    }

    // ──────────────────────────────────────────────────────
    //  submitPendingIntent — Revert Tests
    // ──────────────────────────────────────────────────────

    function test_RevertSubmitPendingIntentExpired() public {
        IntentMatcher.TradeIntent memory intent = _makeSignedIntent(
            traderAKey, Currency.unwrap(currency0), Currency.unwrap(currency1),
            10 ether, 10 ether, 0, block.timestamp - 1 // expired
        );
        vm.expectRevert(IntentMatcher.IntentExpired.selector);
        matcher.submitPendingIntent(intent);
    }

    function test_RevertSubmitPendingIntentBadNonce() public {
        IntentMatcher.TradeIntent memory intent = _makeSignedIntent(
            traderAKey, Currency.unwrap(currency0), Currency.unwrap(currency1),
            10 ether, 10 ether, 5, block.timestamp + 100 // nonce 5 but expected 0
        );
        vm.expectRevert(IntentMatcher.InvalidNonce.selector);
        matcher.submitPendingIntent(intent);
    }

    function test_RevertSubmitPendingIntentBadSignature() public {
        // Create intent for traderB but sign with traderA's key
        IntentMatcher.TradeIntent memory intent = IntentMatcher.TradeIntent({
            trader: traderB,
            tokenIn: Currency.unwrap(currency1),
            tokenOut: Currency.unwrap(currency0),
            amountIn: 10 ether,
            minAmountOut: 10 ether,
            nonce: 0,
            deadline: block.timestamp + 100,
            signature: ""
        });
        intent.signature = _signIntent(intent, traderAKey); // wrong key!

        vm.expectRevert(IntentMatcher.InvalidSignature.selector);
        matcher.submitPendingIntent(intent);
    }

    // ──────────────────────────────────────────────────────
    //  Queue Cleanup Tests
    // ──────────────────────────────────────────────────────

    function test_CleanupPendingIntents() public {
        // Submit an intent and then consume it via processBatchMatching
        IntentMatcher.TradeIntent memory ci = _makeSignedIntent(
            traderBKey, Currency.unwrap(currency1), Currency.unwrap(currency0),
            10 ether, 10 ether, 0, block.timestamp + 100
        );
        matcher.submitPendingIntent(ci);

        // Queue should have 1 entry
        assertEq(matcher.pendingIntentCount(Currency.unwrap(currency1), Currency.unwrap(currency0)), 1);

        // Consume it
        matcher.processBatchMatching(Currency.unwrap(currency0), Currency.unwrap(currency1), 10 ether);

        // Still 1 entry (zeroed out but not removed)
        assertEq(matcher.pendingIntentCount(Currency.unwrap(currency1), Currency.unwrap(currency0)), 1);

        // Cleanup
        uint256 removed = matcher.cleanupPendingIntents(Currency.unwrap(currency1), Currency.unwrap(currency0));
        assertEq(removed, 1);
        assertEq(matcher.pendingIntentCount(Currency.unwrap(currency1), Currency.unwrap(currency0)), 0);
    }

    function test_ClaimLpRevenueTwiceReverts() public {
        bytes32 rawPoolId = PoolId.unwrap(poolKey.toId());

        vm.deal(searcher, 5 ether);
        vm.prank(searcher);
        auction.submitBid{value: 1 ether}(rawPoolId);

        vm.prank(address(hook));
        auction.settleAuction(rawPoolId);

        // First claim succeeds
        address payable lpDist = payable(address(0x8888));
        PoolId poolId = poolKey.toId();
        hook.claimLpRevenue(poolId, lpDist);

        // Second claim should revert — nothing left
        vm.expectRevert(MevAuction.NothingToWithdraw.selector);
        hook.claimLpRevenue(poolId, lpDist);
    }

    // ──────────────────────────────────────────────────────
    //  IntentMatcher — Revert Tests
    // ──────────────────────────────────────────────────────

    function test_RevertInvalidSignature() public {
        IntentMatcher.TradeIntent memory intentA = _makeSignedIntent(
            traderAKey, Currency.unwrap(currency0), Currency.unwrap(currency1),
            10 ether, 10 ether, 0, block.timestamp + 100
        );

        // Create intentB but sign with traderA's key (wrong signer)
        IntentMatcher.TradeIntent memory intentB = IntentMatcher.TradeIntent({
            trader: traderB,
            tokenIn: Currency.unwrap(currency1),
            tokenOut: Currency.unwrap(currency0),
            amountIn: 10 ether,
            minAmountOut: 10 ether,
            nonce: 0,
            deadline: block.timestamp + 100,
            signature: ""
        });
        // Sign with traderA's key instead of traderB's key
        intentB.signature = _signIntent(intentB, traderAKey);

        vm.expectRevert(IntentMatcher.InvalidSignature.selector);
        matcher.matchDirectIntents(intentA, intentB);
    }

    function test_RevertEmptySignature() public {
        IntentMatcher.TradeIntent memory intentA = _makeSignedIntent(
            traderAKey, Currency.unwrap(currency0), Currency.unwrap(currency1),
            10 ether, 10 ether, 0, block.timestamp + 100
        );

        // intentB has empty signature
        IntentMatcher.TradeIntent memory intentB = IntentMatcher.TradeIntent({
            trader: traderB,
            tokenIn: Currency.unwrap(currency1),
            tokenOut: Currency.unwrap(currency0),
            amountIn: 10 ether,
            minAmountOut: 10 ether,
            nonce: 0,
            deadline: block.timestamp + 100,
            signature: "" // empty!
        });

        vm.expectRevert(IntentMatcher.InvalidSignature.selector);
        matcher.matchDirectIntents(intentA, intentB);
    }

    function test_RevertInvalidNonce() public {
        IntentMatcher.TradeIntent memory intentA = _makeSignedIntent(
            traderAKey, Currency.unwrap(currency0), Currency.unwrap(currency1),
            10 ether, 10 ether, 0, block.timestamp + 100
        );

        // intentB uses nonce 5 but expected nonce is 0
        IntentMatcher.TradeIntent memory intentB = _makeSignedIntent(
            traderBKey, Currency.unwrap(currency1), Currency.unwrap(currency0),
            10 ether, 10 ether, 5, block.timestamp + 100
        );

        vm.expectRevert(IntentMatcher.InvalidNonce.selector);
        matcher.matchDirectIntents(intentA, intentB);
    }

    function test_RevertExpiredIntent() public {
        IntentMatcher.TradeIntent memory intentA = _makeSignedIntent(
            traderAKey, Currency.unwrap(currency0), Currency.unwrap(currency1),
            10 ether, 10 ether, 0, block.timestamp - 1 // expired
        );

        IntentMatcher.TradeIntent memory intentB = _makeSignedIntent(
            traderBKey, Currency.unwrap(currency1), Currency.unwrap(currency0),
            10 ether, 10 ether, 0, block.timestamp + 100
        );

        vm.expectRevert(IntentMatcher.IntentExpired.selector);
        matcher.matchDirectIntents(intentA, intentB);
    }

    function test_RevertDuplicateIntent() public {
        IntentMatcher.TradeIntent memory intentA = _makeSignedIntent(
            traderAKey, Currency.unwrap(currency0), Currency.unwrap(currency1),
            10 ether, 10 ether, 0, block.timestamp + 100
        );

        IntentMatcher.TradeIntent memory intentB = _makeSignedIntent(
            traderBKey, Currency.unwrap(currency1), Currency.unwrap(currency0),
            10 ether, 10 ether, 0, block.timestamp + 100
        );

        // First match succeeds
        matcher.matchDirectIntents(intentA, intentB);

        // Second attempt — nonce is now 1 but intent was signed with nonce 0
        vm.expectRevert(IntentMatcher.InvalidNonce.selector);
        matcher.matchDirectIntents(intentA, intentB);
    }

    function test_RevertIncompatibleTokens() public {
        address token2 = address(0x3000);

        IntentMatcher.TradeIntent memory intentA = _makeSignedIntent(
            traderAKey, Currency.unwrap(currency0), Currency.unwrap(currency1),
            10 ether, 10 ether, 0, block.timestamp + 100
        );

        IntentMatcher.TradeIntent memory intentB = _makeSignedIntent(
            traderBKey, Currency.unwrap(currency1), token2,
            10 ether, 10 ether, 0, block.timestamp + 100
        );

        vm.expectRevert(IntentMatcher.IncompatibleTokens.selector);
        matcher.matchDirectIntents(intentA, intentB);
    }

    // ──────────────────────────────────────────────────────
    //  MEV Auction Tests
    // ──────────────────────────────────────────────────────

    function test_MevAuctionBiddingAndSettlement() public {
        bytes32 poolId = PoolId.unwrap(poolKey.toId());

        vm.deal(searcher, 5 ether);
        vm.prank(searcher);
        auction.submitBid{value: 1 ether}(poolId);

        (address highestSearcher, uint256 bidAmount,,) = auction.highestBids(poolId);
        assertEq(highestSearcher, searcher);
        assertEq(bidAmount, 1 ether);

        vm.prank(address(hook));
        uint256 lpRevenue = auction.settleAuction(poolId);

        assertEq(lpRevenue, 0.8 ether);
        assertEq(auction.getAccruedLpRevenue(poolId), 0.8 ether);
        assertEq(auction.protocolTreasury(), 0.2 ether);
    }

    function test_RevertZeroBid() public {
        bytes32 poolId = PoolId.unwrap(poolKey.toId());

        vm.expectRevert(MevAuction.BidTooLow.selector);
        auction.submitBid{value: 0}(poolId);
    }

    function test_RevertBidTooLow() public {
        bytes32 poolId = PoolId.unwrap(poolKey.toId());

        vm.deal(searcher, 5 ether);
        vm.prank(searcher);
        auction.submitBid{value: 2 ether}(poolId);

        vm.deal(searcher2, 5 ether);
        vm.prank(searcher2);
        vm.expectRevert(MevAuction.BidTooLow.selector);
        auction.submitBid{value: 1 ether}(poolId);
    }

    function test_OutbidRefundPullPattern() public {
        bytes32 poolId = PoolId.unwrap(poolKey.toId());

        vm.deal(searcher, 5 ether);
        vm.prank(searcher);
        auction.submitBid{value: 1 ether}(poolId);

        vm.deal(searcher2, 5 ether);
        vm.prank(searcher2);
        auction.submitBid{value: 2 ether}(poolId);

        assertEq(auction.pendingRefunds(searcher), 1 ether);

        uint256 balanceBefore = searcher.balance;
        vm.prank(searcher);
        auction.withdrawRefund();
        assertEq(searcher.balance, balanceBefore + 1 ether);
        assertEq(auction.pendingRefunds(searcher), 0);
    }

    function test_RevertWithdrawNothingToWithdraw() public {
        vm.prank(searcher);
        vm.expectRevert(MevAuction.NothingToWithdraw.selector);
        auction.withdrawRefund();
    }

    function test_RevertUnauthorizedSettleAuction() public {
        bytes32 poolId = PoolId.unwrap(poolKey.toId());

        vm.prank(traderA);
        vm.expectRevert(MevAuction.Unauthorized.selector);
        auction.settleAuction(poolId);
    }

    function test_ProtocolTreasuryWithdrawal() public {
        bytes32 poolId = PoolId.unwrap(poolKey.toId());

        vm.deal(searcher, 5 ether);
        vm.prank(searcher);
        auction.submitBid{value: 1 ether}(poolId);

        vm.prank(address(hook));
        auction.settleAuction(poolId);

        assertEq(auction.protocolTreasury(), 0.2 ether);

        address treasury = address(0x9999);
        vm.prank(address(hook));
        auction.withdrawProtocolTreasury(treasury);

        assertEq(treasury.balance, 0.2 ether);
        assertEq(auction.protocolTreasury(), 0);
    }

    function test_RevertUnauthorizedTreasuryWithdrawal() public {
        vm.prank(traderA);
        vm.expectRevert(MevAuction.Unauthorized.selector);
        auction.withdrawProtocolTreasury(traderA);
    }

    function test_LpRevenueWithdrawal() public {
        bytes32 poolId = PoolId.unwrap(poolKey.toId());

        // Searcher bids 1 ETH
        vm.deal(searcher, 5 ether);
        vm.prank(searcher);
        auction.submitBid{value: 1 ether}(poolId);

        // Hook settles — 0.8 ETH goes to LP revenue
        vm.prank(address(hook));
        auction.settleAuction(poolId);
        assertEq(auction.getAccruedLpRevenue(poolId), 0.8 ether);

        // Withdraw LP revenue to a recipient
        address lpRecipient = address(0x7777);
        vm.prank(address(hook));
        uint256 withdrawn = auction.withdrawLpRevenue(poolId, lpRecipient);

        assertEq(withdrawn, 0.8 ether);
        assertEq(lpRecipient.balance, 0.8 ether);
        assertEq(auction.getAccruedLpRevenue(poolId), 0);
    }

    function test_ClaimLpRevenueViaHook() public {
        bytes32 rawPoolId = PoolId.unwrap(poolKey.toId());

        // Searcher bids 2 ETH
        vm.deal(searcher, 5 ether);
        vm.prank(searcher);
        auction.submitBid{value: 2 ether}(rawPoolId);

        // afterSwap settles the auction
        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: -10 ether,
            sqrtPriceLimitX96: 0
        });
        vm.prank(poolManager);
        hook.afterSwap(traderA, poolKey, params, BalanceDelta.wrap(0), "");

        // LP revenue should be 80% of 2 ETH = 1.6 ETH
        assertEq(auction.getAccruedLpRevenue(rawPoolId), 1.6 ether);

        // Anyone can call claimLpRevenue on the hook
        address payable lpDist = payable(address(0x8888));
        PoolId poolId = poolKey.toId();
        uint256 claimed = hook.claimLpRevenue(poolId, lpDist);

        assertEq(claimed, 1.6 ether);
        assertEq(lpDist.balance, 1.6 ether);
        assertEq(auction.getAccruedLpRevenue(rawPoolId), 0);
    }

    function test_RevertClaimLpRevenueNothingAccrued() public {
        PoolId poolId = poolKey.toId();
        address payable lpDist = payable(address(0x8888));

        vm.expectRevert(MevAuction.NothingToWithdraw.selector);
        hook.claimLpRevenue(poolId, lpDist);
    }

    // ──────────────────────────────────────────────────────
    //  Hook Callback Tests
    // ──────────────────────────────────────────────────────

    function test_BeforeSwapHookCallback() public {
        // Submit a counter-intent so beforeSwap has something to match against
        IntentMatcher.TradeIntent memory counterIntent = _makeSignedIntent(
            traderBKey,
            Currency.unwrap(currency1),
            Currency.unwrap(currency0),
            4 ether,
            4 ether,
            0,
            block.timestamp + 100
        );
        matcher.submitPendingIntent(counterIntent);

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: -10 ether,
            sqrtPriceLimitX96: 0
        });

        vm.prank(poolManager);
        (bytes4 selector,,) = hook.beforeSwap(traderA, poolKey, params, "");
        assertEq(selector, IHooks.beforeSwap.selector);

        PoolId poolId = poolKey.toId();
        (uint256 matchedVol,) = hook.getPoolMetrics(poolId);
        assertEq(matchedVol, 4 ether); // 4 ether counter-intent matched from 10 ether swap
    }

    function test_BeforeSwapNoMatch() public {
        // No pending intents — nothing should match
        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: -10 ether,
            sqrtPriceLimitX96: 0
        });

        vm.prank(poolManager);
        (bytes4 selector,,) = hook.beforeSwap(traderA, poolKey, params, "");
        assertEq(selector, IHooks.beforeSwap.selector);

        PoolId poolId = poolKey.toId();
        (uint256 matchedVol,) = hook.getPoolMetrics(poolId);
        assertEq(matchedVol, 0);
    }

    function test_AfterSwapHookCallback() public {
        bytes32 rawPoolId = PoolId.unwrap(poolKey.toId());

        vm.deal(searcher, 2 ether);
        vm.prank(searcher);
        auction.submitBid{value: 1 ether}(rawPoolId);

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: -10 ether,
            sqrtPriceLimitX96: 0
        });

        vm.prank(poolManager);
        (bytes4 selector,) = hook.afterSwap(traderA, poolKey, params, BalanceDelta.wrap(0), "");
        assertEq(selector, IHooks.afterSwap.selector);

        PoolId poolId = poolKey.toId();
        (, uint256 totalLpMev) = hook.getPoolMetrics(poolId);
        assertEq(totalLpMev, 0.8 ether);
    }

    function test_RevertBeforeSwapUnauthorized() public {
        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: -10 ether,
            sqrtPriceLimitX96: 0
        });

        vm.prank(traderA);
        vm.expectRevert(FairRailHook.OnlyPoolManager.selector);
        hook.beforeSwap(traderA, poolKey, params, "");
    }

    function test_RevertAfterSwapUnauthorized() public {
        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: -10 ether,
            sqrtPriceLimitX96: 0
        });

        vm.prank(traderA);
        vm.expectRevert(FairRailHook.OnlyPoolManager.selector);
        hook.afterSwap(traderA, poolKey, params, BalanceDelta.wrap(0), "");
    }

    function test_PoolIdComputedCanonically() public view {
        PoolId poolId = poolKey.toId();
        assertTrue(PoolId.unwrap(poolId) != bytes32(0));
    }
}
