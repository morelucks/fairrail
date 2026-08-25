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

    function test_HookPermissions() public view {
        HooksPermissions memory flags = hook.getHookPermissions();
        assertTrue(flags.beforeSwap);
        assertTrue(flags.afterSwap);
        assertFalse(flags.beforeInitialize);
    }

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
    }
}
