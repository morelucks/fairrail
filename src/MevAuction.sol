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

    event BidSubmitted(
        bytes32 indexed poolId,
        address indexed searcher,
        uint256 bidAmount,
        uint256 blockNumber
    );

    error Unauthorized();
    error BidTooLow();
    error AuctionExpired();

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

        // Refund previous bidder if same block
        if (currentBid.blockNumber == block.number && currentBid.amount > 0) {
            payable(currentBid.searcher).transfer(currentBid.amount);
        }

        highestBids[poolId] = Bid({
            searcher: msg.sender,
            amount: msg.value,
            blockNumber: block.number,
            poolId: poolId
        });

        emit BidSubmitted(poolId, msg.sender, msg.value, block.number);
    }
}
