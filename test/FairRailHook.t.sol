// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/IntentMatcher.sol";
import "../src/MevAuction.sol";
import "../src/FairRailHook.sol";

contract FairRailHookTest is Test {
    FairRailHook public hook;
    IntentMatcher public matcher;
    MevAuction public auction;

    address public poolManager = address(0x1111111111111111111111111111111111111111);
    address public traderA = address(0xAAAA);
    address public traderB = address(0xBBBB);
    address public searcher = address(0xCCCC);
    address public searcher2 = address(0xDDDD);

    address public token0 = address(0x1000);
    address public token1 = address(0x2000);

    PoolKey public poolKey;

    function setUp() public {
        matcher = new IntentMatcher();
        hook = new FairRailHook(poolManager, address(matcher));
        auction = hook.mevAuction();

        poolKey = PoolKey({
            currency0: token0,
            currency1: token1,
            fee: 3000,
            tickSpacing: 60,
            hooks: address(hook)
        });
    }

    // ──────────────────────────────────────────────────────
    //  Hook Permission Tests
    // ──────────────────────────────────────────────────────

    function test_HookPermissions() public view {
        HooksPermissions memory flags = hook.getHookPermissions();
        assertTrue(flags.beforeSwap);
        assertTrue(flags.afterSwap);
        assertFalse(flags.beforeInitialize);
    }

    // ──────────────────────────────────────────────────────
    //  IntentMatcher Tests
    // ──────────────────────────────────────────────────────

    function test_IntentSchemaHash() public view {
        IntentMatcher.TradeIntent memory intent = IntentMatcher.TradeIntent({
            trader: traderA,
            tokenIn: token0,
            tokenOut: token1,
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
            tokenIn: token0,
            tokenOut: token1,
            amountIn: 10 ether,
            minAmountOut: 10 ether,
            nonce: 1,
            deadline: block.timestamp + 100,
            signature: ""
        });

        IntentMatcher.TradeIntent memory intentB = IntentMatcher.TradeIntent({
            trader: traderB,
            tokenIn: token1,
            tokenOut: token0,
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
        IntentMatcher.MatchResult memory res = matcher.processBatchMatching(token0, token1, 100 ether);
        assertEq(res.matchedAmount, 40 ether);
        assertEq(res.remainingAmountIn, 60 ether);
    }

    function test_RevertExpiredIntent() public {
        IntentMatcher.TradeIntent memory intentA = IntentMatcher.TradeIntent({
            trader: traderA,
            tokenIn: token0,
            tokenOut: token1,
            amountIn: 10 ether,
            minAmountOut: 10 ether,
            nonce: 1,
            deadline: block.timestamp - 1, // already expired
            signature: ""
        });

        IntentMatcher.TradeIntent memory intentB = IntentMatcher.TradeIntent({
            trader: traderB,
            tokenIn: token1,
            tokenOut: token0,
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
            tokenIn: token0,
            tokenOut: token1,
            amountIn: 10 ether,
            minAmountOut: 10 ether,
            nonce: 1,
            deadline: block.timestamp + 100,
            signature: ""
        });

        IntentMatcher.TradeIntent memory intentB = IntentMatcher.TradeIntent({
            trader: traderB,
            tokenIn: token1,
            tokenOut: token0,
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
            tokenIn: token0,
            tokenOut: token1,
            amountIn: 10 ether,
            minAmountOut: 10 ether,
            nonce: 1,
            deadline: block.timestamp + 100,
            signature: ""
        });

        // intentB wants token2 as output, not token0 — tokens don't cross-match
        IntentMatcher.TradeIntent memory intentB = IntentMatcher.TradeIntent({
            trader: traderB,
            tokenIn: token1,
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
        bytes32 poolId = keccak256(abi.encode(poolKey));

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
        bytes32 poolId = keccak256(abi.encode(poolKey));

        vm.expectRevert(MevAuction.BidTooLow.selector);
        auction.submitBid{value: 0}(poolId);
    }

    function test_RevertBidTooLow() public {
        bytes32 poolId = keccak256(abi.encode(poolKey));

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
        bytes32 poolId = keccak256(abi.encode(poolKey));

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
        bytes32 poolId = keccak256(abi.encode(poolKey));

        // Random address trying to settle — should revert
        vm.prank(traderA);
        vm.expectRevert(MevAuction.Unauthorized.selector);
        auction.settleAuction(poolId);
    }

    function test_ProtocolTreasuryWithdrawal() public {
        bytes32 poolId = keccak256(abi.encode(poolKey));

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
        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: -10 ether,
            sqrtPriceLimitX96: 0
        });

        vm.prank(poolManager);
        (bytes4 selector,,) = hook.beforeSwap(traderA, poolKey, params, "");
        assertEq(selector, FairRailHook.beforeSwap.selector);

        bytes32 poolId = keccak256(abi.encode(poolKey));
        (uint256 matchedVol,) = hook.getPoolMetrics(poolId);
        assertEq(matchedVol, 4 ether); // 40% of 10 ether
    }

    function test_AfterSwapHookCallback() public {
        bytes32 poolId = keccak256(abi.encode(poolKey));

        // Submit searcher bid first
        vm.deal(searcher, 2 ether);
        vm.prank(searcher);
        auction.submitBid{value: 1 ether}(poolId);

        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: -10 ether,
            sqrtPriceLimitX96: 0
        });

        vm.prank(poolManager);
        (bytes4 selector,) = hook.afterSwap(traderA, poolKey, params, 0, "");
        assertEq(selector, FairRailHook.afterSwap.selector);

        (, uint256 totalLpMev) = hook.getPoolMetrics(poolId);
        assertEq(totalLpMev, 0.8 ether);
    }

    function test_RevertBeforeSwapUnauthorized() public {
        SwapParams memory params = SwapParams({
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
        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: -10 ether,
            sqrtPriceLimitX96: 0
        });

        // Calling from non-poolManager should revert
        vm.prank(traderA);
        vm.expectRevert(FairRailHook.OnlyPoolManager.selector);
        hook.afterSwap(traderA, poolKey, params, 0, "");
    }
}
