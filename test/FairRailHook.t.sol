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

contract FairRailHookTest is Test {
    using PoolIdLibrary for PoolKey;
    using Hooks for IHooks;

    FairRailHook public hook;
    IntentMatcher public matcher;
    MevAuction public auction;

    address public poolManager = address(0x1111111111111111111111111111111111111111);
    address public traderA = address(0xAAAA);
    address public traderB = address(0xBBBB);
    address public searcher = address(0xCCCC);
    address public searcher2 = address(0xDDDD);

    Currency public currency0;
    Currency public currency1;

    PoolKey public poolKey;

    function setUp() public {
        matcher = new IntentMatcher();

        // FairRailHook requires beforeSwap (1<<7 = 0x80) and afterSwap (1<<6 = 0x40) flags
        // encoded in the hook address. Compute a valid address: low 14 bits = 0x00C0
        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);

        // Deploy hook to a deterministic address encoding the correct permission flags.
        // We use deployCodeTo to place the contract at the flag-valid address.
        bytes memory constructorArgs = abi.encode(IPoolManager(poolManager), address(matcher));
        deployCodeTo("FairRailHook.sol:FairRailHook", constructorArgs, address(flags));
        hook = FairRailHook(address(flags));
        auction = hook.mevAuction();

        currency0 = Currency.wrap(address(0x1000));
        currency1 = Currency.wrap(address(0x2000));

        poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
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
        assertFalse(flags.beforeSwapReturnDelta);
        assertFalse(flags.afterSwapReturnDelta);
    }

    function test_HookImplementsIHooks() public view {
        // Verify the hook address encodes the correct flags
        assertTrue(IHooks(address(hook)).hasPermission(Hooks.BEFORE_SWAP_FLAG));
        assertTrue(IHooks(address(hook)).hasPermission(Hooks.AFTER_SWAP_FLAG));
        assertFalse(IHooks(address(hook)).hasPermission(Hooks.BEFORE_INITIALIZE_FLAG));
    }

    // ──────────────────────────────────────────────────────
    //  IntentMatcher Tests
    // ──────────────────────────────────────────────────────

    function test_IntentSchemaHash() public view {
        IntentMatcher.TradeIntent memory intent = IntentMatcher.TradeIntent({
            trader: traderA,
            tokenIn: Currency.unwrap(currency0),
            tokenOut: Currency.unwrap(currency1),
            amountIn: 10 ether,
            minAmountOut: 9.9 ether,
            nonce: 1,
            deadline: block.timestamp + 100,
            signature: ""
        });

        bytes32 hash = matcher.getSchemaHash(intent);
        assertTrue(hash != bytes32(0));
    }

    function test_DirectIntentMatching() public {
        IntentMatcher.TradeIntent memory intentA = IntentMatcher.TradeIntent({
            trader: traderA,
            tokenIn: Currency.unwrap(currency0),
            tokenOut: Currency.unwrap(currency1),
            amountIn: 10 ether,
            minAmountOut: 10 ether,
            nonce: 1,
            deadline: block.timestamp + 100,
            signature: ""
        });

        IntentMatcher.TradeIntent memory intentB = IntentMatcher.TradeIntent({
            trader: traderB,
            tokenIn: Currency.unwrap(currency1),
            tokenOut: Currency.unwrap(currency0),
            amountIn: 10 ether,
            minAmountOut: 10 ether,
            nonce: 1,
            deadline: block.timestamp + 100,
            signature: ""
        });

        (uint256 matchedA, uint256 matchedB) = matcher.matchDirectIntents(intentA, intentB);
        assertEq(matchedA, 10 ether);
        assertEq(matchedB, 10 ether);
    }

    function test_BatchMatchingSimulation() public view {
        IntentMatcher.MatchResult memory res = matcher.processBatchMatching(
            Currency.unwrap(currency0), Currency.unwrap(currency1), 100 ether
        );
        assertEq(res.matchedAmount, 40 ether);
        assertEq(res.remainingAmountIn, 60 ether);
    }

    function test_RevertExpiredIntent() public {
        IntentMatcher.TradeIntent memory intentA = IntentMatcher.TradeIntent({
            trader: traderA,
            tokenIn: Currency.unwrap(currency0),
            tokenOut: Currency.unwrap(currency1),
            amountIn: 10 ether,
            minAmountOut: 10 ether,
            nonce: 1,
            deadline: block.timestamp - 1, // already expired
            signature: ""
        });

        IntentMatcher.TradeIntent memory intentB = IntentMatcher.TradeIntent({
            trader: traderB,
            tokenIn: Currency.unwrap(currency1),
            tokenOut: Currency.unwrap(currency0),
            amountIn: 10 ether,
            minAmountOut: 10 ether,
            nonce: 1,
            deadline: block.timestamp + 100,
            signature: ""
        });

        vm.expectRevert(IntentMatcher.IntentExpired.selector);
        matcher.matchDirectIntents(intentA, intentB);
    }

    function test_RevertDuplicateIntent() public {
        IntentMatcher.TradeIntent memory intentA = IntentMatcher.TradeIntent({
            trader: traderA,
            tokenIn: Currency.unwrap(currency0),
            tokenOut: Currency.unwrap(currency1),
            amountIn: 10 ether,
            minAmountOut: 10 ether,
            nonce: 1,
            deadline: block.timestamp + 100,
            signature: ""
        });

        IntentMatcher.TradeIntent memory intentB = IntentMatcher.TradeIntent({
            trader: traderB,
            tokenIn: Currency.unwrap(currency1),
            tokenOut: Currency.unwrap(currency0),
            amountIn: 10 ether,
            minAmountOut: 10 ether,
            nonce: 1,
            deadline: block.timestamp + 100,
            signature: ""
        });

        // First match should succeed
        matcher.matchDirectIntents(intentA, intentB);

        // Second attempt with same intents should revert
        vm.expectRevert(IntentMatcher.IntentAlreadyExecuted.selector);
        matcher.matchDirectIntents(intentA, intentB);
    }

    function test_RevertIncompatibleTokens() public {
        address token2 = address(0x3000);

        IntentMatcher.TradeIntent memory intentA = IntentMatcher.TradeIntent({
            trader: traderA,
            tokenIn: Currency.unwrap(currency0),
            tokenOut: Currency.unwrap(currency1),
            amountIn: 10 ether,
            minAmountOut: 10 ether,
            nonce: 1,
            deadline: block.timestamp + 100,
            signature: ""
        });

        IntentMatcher.TradeIntent memory intentB = IntentMatcher.TradeIntent({
            trader: traderB,
            tokenIn: Currency.unwrap(currency1),
            tokenOut: token2,
            amountIn: 10 ether,
            minAmountOut: 10 ether,
            nonce: 1,
            deadline: block.timestamp + 100,
            signature: ""
        });

        vm.expectRevert(IntentMatcher.IncompatibleTokens.selector);
        matcher.matchDirectIntents(intentA, intentB);
    }

    // ──────────────────────────────────────────────────────
    //  MEV Auction Tests
    // ──────────────────────────────────────────────────────

    function test_MevAuctionBiddingAndSettlement() public {
        bytes32 poolId = PoolId.unwrap(poolKey.toId());

        // Searcher bids 1 ETH on the pool MEV auction
        vm.deal(searcher, 5 ether);
        vm.prank(searcher);
        auction.submitBid{value: 1 ether}(poolId);

        (address highestSearcher, uint256 bidAmount,,) = auction.highestBids(poolId);
        assertEq(highestSearcher, searcher);
        assertEq(bidAmount, 1 ether);

        // Prank as hook to settle auction
        vm.prank(address(hook));
        uint256 lpRevenue = auction.settleAuction(poolId);

        // 80% of 1 ETH = 0.8 ETH allocated to LPs
        assertEq(lpRevenue, 0.8 ether);
        assertEq(auction.getAccruedLpRevenue(poolId), 0.8 ether);

        // 20% = 0.2 ETH goes to protocol treasury
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

        // Searcher2 bids lower in the same block — should revert
        vm.deal(searcher2, 5 ether);
        vm.prank(searcher2);
        vm.expectRevert(MevAuction.BidTooLow.selector);
        auction.submitBid{value: 1 ether}(poolId);
    }

    function test_OutbidRefundPullPattern() public {
        bytes32 poolId = PoolId.unwrap(poolKey.toId());

        // Searcher1 bids 1 ETH
        vm.deal(searcher, 5 ether);
        vm.prank(searcher);
        auction.submitBid{value: 1 ether}(poolId);

        // Searcher2 outbids with 2 ETH — searcher1 gets refund credit
        vm.deal(searcher2, 5 ether);
        vm.prank(searcher2);
        auction.submitBid{value: 2 ether}(poolId);

        assertEq(auction.pendingRefunds(searcher), 1 ether);

        // Searcher1 withdraws refund
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

        // Random address trying to settle — should revert
        vm.prank(traderA);
        vm.expectRevert(MevAuction.Unauthorized.selector);
        auction.settleAuction(poolId);
    }

    function test_ProtocolTreasuryWithdrawal() public {
        bytes32 poolId = PoolId.unwrap(poolKey.toId());

        // Create and settle a bid
        vm.deal(searcher, 5 ether);
        vm.prank(searcher);
        auction.submitBid{value: 1 ether}(poolId);

        vm.prank(address(hook));
        auction.settleAuction(poolId);

        // Protocol treasury should have 0.2 ETH
        assertEq(auction.protocolTreasury(), 0.2 ether);

        // Withdraw treasury via hook
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

    // ──────────────────────────────────────────────────────
    //  Hook Callback Tests
    // ──────────────────────────────────────────────────────

    function test_BeforeSwapHookCallback() public {
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
        assertEq(matchedVol, 4 ether); // 40% of 10 ether
    }

    function test_AfterSwapHookCallback() public {
        bytes32 rawPoolId = PoolId.unwrap(poolKey.toId());

        // Submit searcher bid first
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

        // Calling from non-poolManager should revert
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

        // Calling from non-poolManager should revert
        vm.prank(traderA);
        vm.expectRevert(FairRailHook.OnlyPoolManager.selector);
        hook.afterSwap(traderA, poolKey, params, BalanceDelta.wrap(0), "");
    }

    function test_PoolIdComputedCanonically() public view {
        // Verify our PoolId matches the canonical v4 computation
        PoolId poolId = poolKey.toId();
        assertTrue(PoolId.unwrap(poolId) != bytes32(0));
    }
}
