// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title MevAuction
 * @notice Implements LP-owned MEV & Loss-Versus-Rebalancing (LVR) auctions for FairRail
 * @dev Auctions backrunning/arbitrage rights after AMM pool execution, capturing value directly for LPs.
 */
contract MevAuction {
    struct Bid {
        address searcher;
        uint256 amount;
        uint256 blockNumber;
        bytes32 poolId;
    }

    address public immutable hook;
    mapping(bytes32 => Bid) public highestBids;
    mapping(bytes32 => uint256) public totalLpRevenuePool;
    mapping(address => uint256) public pendingRefunds;
    uint256 public protocolTreasury;

    event BidSubmitted(
        bytes32 indexed poolId,
        address indexed searcher,
        uint256 bidAmount,
        uint256 blockNumber
    );

    event AuctionSettled(
        bytes32 indexed poolId,
        address indexed winner,
        uint256 revenueToLPs
    );

    error Unauthorized();
    error BidTooLow();
    error AuctionExpired();
    error WithdrawFailed();
    error NothingToWithdraw();

    modifier onlyHook() {
        if (msg.sender != hook) revert Unauthorized();
        _;
    }

    constructor(address _hook) {
        hook = _hook;
    }

    /**
     * @notice Searchers submit bids for backrunning opportunity rights on specific pool trades
     * @param poolId Identifier of the targeted Uniswap v4 pool
     */
    function submitBid(bytes32 poolId) external payable {
        if (msg.value == 0) revert BidTooLow();

        Bid storage currentBid = highestBids[poolId];
        if (currentBid.blockNumber == block.number && msg.value <= currentBid.amount) {
            revert BidTooLow();
        }

        // Credit refund to previous bidder if same block (pull-based pattern)
        if (currentBid.blockNumber == block.number && currentBid.amount > 0) {
            pendingRefunds[currentBid.searcher] += currentBid.amount;
        }

        highestBids[poolId] = Bid({
            searcher: msg.sender,
            amount: msg.value,
            blockNumber: block.number,
            poolId: poolId
        });

        emit BidSubmitted(poolId, msg.sender, msg.value, block.number);
    }

    /**
     * @notice Settles auction for a pool block and records proceeds for LP fee distribution
     * @param poolId Identifier of the Uniswap v4 pool
     */
    function settleAuction(bytes32 poolId) external onlyHook returns (uint256 lpRevenue) {
        Bid memory winningBid = highestBids[poolId];
        if (winningBid.amount > 0 && winningBid.blockNumber == block.number) {
            // Allocate 80% directly to LP pool revenue, 20% to hook protocol treasury/incentives
            lpRevenue = (winningBid.amount * 80) / 100;
            uint256 protocolShare = winningBid.amount - lpRevenue;
            totalLpRevenuePool[poolId] += lpRevenue;
            protocolTreasury += protocolShare;

            delete highestBids[poolId];
            emit AuctionSettled(poolId, winningBid.searcher, lpRevenue);
        }
    }

    /**
     * @notice Allows outbid searchers to withdraw their refunded bids (pull pattern)
     */
    function withdrawRefund() external {
        uint256 amount = pendingRefunds[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        pendingRefunds[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert WithdrawFailed();
    }

    /**
     * @notice Allows the hook contract to withdraw accumulated protocol treasury
     */
    function withdrawProtocolTreasury(address to) external onlyHook {
        uint256 amount = protocolTreasury;
        if (amount == 0) revert NothingToWithdraw();
        protocolTreasury = 0;
        (bool success, ) = payable(to).call{value: amount}("");
        if (!success) revert WithdrawFailed();
    }

    /**
     * @notice Returns total accrued MEV/LVR yield captured for a given pool
     */
    function getAccruedLpRevenue(bytes32 poolId) external view returns (uint256) {
        return totalLpRevenuePool[poolId];
    }
}
