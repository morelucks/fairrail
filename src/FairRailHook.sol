// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/types/BeforeSwapDelta.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";

import "./IntentMatcher.sol";
import "./MevAuction.sol";

/**
 * @title FairRailHook
 * @notice Uniswap v4 Hook combining Private Intent Matching with LP-Owned MEV Auctions.
 * @dev Protects Liquidity Providers against Loss-Versus-Rebalancing (LVR) and toxic arbitrage leakage
 *      while giving traders improved execution via off-chain intent batch settlement.
 *      Implements the canonical IHooks interface and validates hook address permissions in the constructor.
 */
contract FairRailHook is IHooks {
    using PoolIdLibrary for PoolKey;

    IPoolManager public immutable poolManager;
    IntentMatcher public immutable intentMatcher;
    MevAuction public immutable mevAuction;

    mapping(PoolId => uint256) public totalMatchedVolume;
    mapping(PoolId => uint256) public totalMevRecapturedForLPs;

    event PrivateIntentMatched(PoolId indexed poolId, uint256 amountMatched, uint256 remainingToAMM);
    event MevAuctionTriggered(PoolId indexed poolId, uint256 lpRevenueAccrued);

    error OnlyPoolManager();
    error InvalidHookFlags();

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert OnlyPoolManager();
        _;
    }

    constructor(IPoolManager _poolManager, address _intentMatcher) {
        poolManager = _poolManager;
        intentMatcher = IntentMatcher(_intentMatcher);
        mevAuction = new MevAuction(address(this));

        // Validate that the hook's deploy address encodes the correct permission flags
        Hooks.validateHookPermissions(IHooks(address(this)), getHookPermissions());
    }

    /**
     * @notice Declares hook permissions: beforeSwap and afterSwap enabled
     * @return Hooks.Permissions struct with the canonical v4 permission flags
     */
    function getHookPermissions() public pure returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // ──────────────────────────────────────────────────────
    //  IHooks — Active Callbacks
    // ──────────────────────────────────────────────────────

    /**
     * @notice Executes before swap; checks for available off-chain/batch intent matches before AMM routing
     * @param sender The initial msg.sender for the swap call
     * @param key The key for the pool
     * @param params The parameters for the swap
     * @param hookData Arbitrary data handed into the PoolManager by the swapper
     * @return bytes4 The function selector for the hook
     * @return BeforeSwapDelta The hook's delta (zero — no delta modification)
     * @return uint24 LP fee override (zero — no override)
     */
    function beforeSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata hookData
    ) external onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24) {
        PoolId poolId = key.toId();

        uint256 amountIn = params.amountSpecified < 0
            ? uint256(-params.amountSpecified)
            : uint256(params.amountSpecified);

        // Process private intent matching
        (address tokenIn, address tokenOut) = params.zeroForOne
            ? (Currency.unwrap(key.currency0), Currency.unwrap(key.currency1))
            : (Currency.unwrap(key.currency1), Currency.unwrap(key.currency0));

        IntentMatcher.MatchResult memory matchResult = intentMatcher.processBatchMatching(tokenIn, tokenOut, amountIn);

        if (matchResult.matchedAmount > 0) {
            totalMatchedVolume[poolId] += matchResult.matchedAmount;
            emit PrivateIntentMatched(poolId, matchResult.matchedAmount, matchResult.remainingAmountIn);
        }

        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    /**
     * @notice Executes after swap; triggers LP-owned MEV auction settlement and captures revenue for LPs
     * @param sender The initial msg.sender for the swap call
     * @param key The key for the pool
     * @param params The parameters for the swap
     * @param delta The amount owed to the caller (positive) or owed to the pool (negative)
     * @param hookData Arbitrary data handed into the PoolManager by the swapper
     * @return bytes4 The function selector for the hook
     * @return int128 The hook's delta in unspecified currency (zero — no delta)
     */
    function afterSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) external onlyPoolManager returns (bytes4, int128) {
        PoolId poolId = key.toId();

        // Settle searcher MEV auction for this pool block
        uint256 lpRevenue = mevAuction.settleAuction(PoolId.unwrap(poolId));

        if (lpRevenue > 0) {
            totalMevRecapturedForLPs[poolId] += lpRevenue;
            emit MevAuctionTriggered(poolId, lpRevenue);
        }

        return (IHooks.afterSwap.selector, 0);
    }

    // ──────────────────────────────────────────────────────
    //  IHooks — Inactive Callbacks (no-op stubs for interface compliance)
    // ──────────────────────────────────────────────────────

    function beforeInitialize(address, PoolKey calldata, uint160) external pure returns (bytes4) {
        return IHooks.beforeInitialize.selector;
    }

    function afterInitialize(address, PoolKey calldata, uint160, int24) external pure returns (bytes4) {
        return IHooks.afterInitialize.selector;
    }

    function beforeAddLiquidity(address, PoolKey calldata, IPoolManager.ModifyLiquidityParams calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return IHooks.beforeAddLiquidity.selector;
    }

    function afterAddLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure returns (bytes4, BalanceDelta) {
        return (IHooks.afterAddLiquidity.selector, BalanceDelta.wrap(0));
    }

    function beforeRemoveLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external pure returns (bytes4) {
        return IHooks.beforeRemoveLiquidity.selector;
    }

    function afterRemoveLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure returns (bytes4, BalanceDelta) {
        return (IHooks.afterRemoveLiquidity.selector, BalanceDelta.wrap(0));
    }

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return IHooks.beforeDonate.selector;
    }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return IHooks.afterDonate.selector;
    }

    // ──────────────────────────────────────────────────────
    //  View Helpers
    // ──────────────────────────────────────────────────────

    /**
     * @notice Helper to query overall statistics for a given pool
     * @param poolId The pool identifier
     * @return matchedVolume Total volume matched via private intents
     * @return totalLpMevAccrued Total MEV/LVR revenue captured for LPs
     */
    function getPoolMetrics(PoolId poolId) external view returns (uint256 matchedVolume, uint256 totalLpMevAccrued) {
        return (totalMatchedVolume[poolId], totalMevRecapturedForLPs[poolId]);
    }
}
