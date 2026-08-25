// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./IntentMatcher.sol";
import "./MevAuction.sol";

/// @notice Minimal Hook Permissions struct matching Uniswap v4 standards
struct HooksPermissions {
    bool beforeInitialize;
    bool afterInitialize;
    bool beforeAddLiquidity;
    bool afterAddLiquidity;
    bool beforeRemoveLiquidity;
    bool afterRemoveLiquidity;
    bool beforeSwap;
    bool afterSwap;
    bool beforeDonate;
    bool afterDonate;
    bool beforeSwapReturnDelta;
    bool afterSwapReturnDelta;
    bool afterAddLiquidityReturnDelta;
    bool afterRemoveLiquidityReturnDelta;
}

/// @notice Minimal SwapParams representation
struct SwapParams {
    bool zeroForOne;
    int256 amountSpecified;
    uint160 sqrtPriceLimitX96;
}

/// @notice Minimal Key representation for Pool identifier
struct PoolKey {
    address currency0;
    address currency1;
    uint24 fee;
    int24 tickSpacing;
    address hooks;
}

/**
 * @title FairRailHook
 * @notice Uniswap v4 Hook combining Private Intent Matching with LP-Owned MEV Auctions.
 * @dev Protects Liquidity Providers against Loss-Versus-Rebalancing (LVR) and toxic arbitrage leakage
 *      while giving traders improved execution via off-chain intent batch settlement.
 */
contract FairRailHook {
    address public immutable poolManager;
    IntentMatcher public immutable intentMatcher;
    MevAuction public mevAuction;

    mapping(bytes32 => uint256) public totalMatchedVolume;
    mapping(bytes32 => uint256) public totalMevRecapturedForLPs;

    event PrivateIntentMatched(bytes32 indexed poolId, uint256 amountMatched, uint256 remainingToAMM);
    event MevAuctionTriggered(bytes32 indexed poolId, uint256 lpRevenueAccrued);

    error OnlyPoolManager();
    error InvalidHookFlags();

    modifier onlyPoolManager() {
        if (msg.sender != poolManager) revert OnlyPoolManager();
        _;
    }

    constructor(address _poolManager, address _intentMatcher) {
        poolManager = _poolManager;
        intentMatcher = IntentMatcher(_intentMatcher);
        mevAuction = new MevAuction(address(this));
    }

    /**
     * @notice Declares hook permissions: beforeSwap and afterSwap enabled
     */
    function getHookPermissions() public pure returns (HooksPermissions memory) {
        return HooksPermissions({
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

    /**
     * @notice Helper to query overall statistics for a given pool
     */
    function getPoolMetrics(bytes32 poolId) external view returns (uint256 matchedVolume, uint256 totalLpMevAccrued) {
        return (totalMatchedVolume[poolId], totalMevRecapturedForLPs[poolId]);
    }
}
