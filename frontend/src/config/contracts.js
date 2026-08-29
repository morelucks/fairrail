export const CONTRACT_ADDRESSES = {
  FairRailHook: '0x7f18f2f796ed2beb1c5ff625fa9d3280cd4940c8',
  IntentMatcher: '0x88b222cc2c5ab1d5a67379c44a6bcca80be9e829',
  MevAuction: '0x08c8ababe136a66e10d5c20f6553f9726284343c',
  PoolManager: '0x000000000004444c5dc75cB358380D2e3dE08A90',
};

export const CHAIN_CONFIG = {
  chainId: '0xaa36a7', // 11155111
  chainIdDecimal: 11155111,
  chainName: 'Ethereum Sepolia Testnet',
  rpcUrl: 'https://ethereum-sepolia.publicnode.com',
  explorerUrl: 'https://sepolia.etherscan.io',
};

export const INTENT_MATCHER_ABI = [
  'function userNonces(address trader) view returns (uint256)',
  'function executedIntents(bytes32 hash) view returns (bool)',
  'function DOMAIN_SEPARATOR() view returns (bytes32)',
  'function TRADE_INTENT_TYPEHASH() view returns (bytes32)',
  'function getDigest((address trader,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 nonce,uint256 deadline,bytes signature)) view returns (bytes32)',
  'function matchDirectIntents((address trader,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 nonce,uint256 deadline,bytes signature), (address trader,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 nonce,uint256 deadline,bytes signature)) returns (uint256 matchedInA, uint256 matchedInB)',
  'function submitPendingIntent((address trader,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 nonce,uint256 deadline,bytes signature))',
  'function pendingIntentCount(address tokenIn, address tokenOut) view returns (uint256)',
  'function processBatchMatching(address tokenIn, address tokenOut, uint256 incomingAmount) returns ((uint256 matchedAmount, uint256 remainingAmountIn, uint256 filledAmountOut))',
  'function cleanupPendingIntents(address tokenIn, address tokenOut) returns (uint256 removed)',
  'event IntentMatched(bytes32 indexed intentHash, address indexed trader, address tokenIn, address tokenOut, uint256 matchedAmount, uint256 outputAmount)',
  'event PendingIntentSubmitted(address indexed trader, address tokenIn, address tokenOut, uint256 amountIn, uint256 deadline)',
];

export const MEV_AUCTION_ABI = [
  'function hook() view returns (address)',
  'function highestBids(bytes32 poolId) view returns (address searcher, uint256 amount, uint256 blockNumber, bytes32 poolId)',
  'function totalLpRevenuePool(bytes32 poolId) view returns (uint256)',
  'function pendingRefunds(address searcher) view returns (uint256)',
  'function protocolTreasury() view returns (uint256)',
  'function submitBid(bytes32 poolId) payable',
  'function withdrawRefund()',
  'function getAccruedLpRevenue(bytes32 poolId) view returns (uint256)',
  'event BidSubmitted(bytes32 indexed poolId, address indexed searcher, uint256 bidAmount, uint256 blockNumber)',
  'event AuctionSettled(bytes32 indexed poolId, address indexed winner, uint256 revenueToLPs)',
  'event LpRevenueWithdrawn(bytes32 indexed poolId, address indexed recipient, uint256 amount)',
];

export const FAIR_RAIL_HOOK_ABI = [
  'function poolManager() view returns (address)',
  'function intentMatcher() view returns (address)',
  'function mevAuction() view returns (address)',
  'function totalMatchedVolume(bytes32 poolId) view returns (uint256)',
  'function totalMevRecapturedForLPs(bytes32 poolId) view returns (uint256)',
  'function getPoolMetrics(bytes32 poolId) view returns (uint256 matchedVolume, uint256 totalLpMevAccrued)',
  'function claimLpRevenue(bytes32 poolId, address recipient) returns (uint256 amount)',
  'event PrivateIntentMatched(bytes32 indexed poolId, uint256 amountMatched, uint256 remainingToAMM)',
  'event MevAuctionTriggered(bytes32 indexed poolId, uint256 lpRevenueAccrued)',
  'event LpRevenueClaimed(bytes32 indexed poolId, address indexed recipient, uint256 amount)',
];
