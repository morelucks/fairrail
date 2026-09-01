export const CONTRACT_ADDRESSES = {
  FairRailHook: '0x7f18f2f796ed2beb1c5ff625fa9d3280cd4940c8',
  IntentMatcher: '0x88b222cc2c5ab1d5a67379c44a6bcca80be9e829',
  MevAuction: '0x08c8ababe136a66e10d5c20f6553f9726284343c',
  PoolManager: '0x000000000004444c5dc75cB358380D2e3dE08A90',
  // Across Protocol V3
  AcrossSpokePool: '0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5',
  // Chainlink Price Feeds (Sepolia)
  ChainlinkETHUSD: '0x694AA1769357215DE4FAC081bf1f309aDC325306',
  ChainlinkLINKUSD: '0xc59E3633BAAC7321a9122920fA9328029651786f',
};

export const CHAIN_CONFIG = {
  chainId: '0xaa36a7', // 11155111
  chainIdDecimal: 11155111,
  chainName: 'Ethereum Sepolia Testnet',
  rpcUrl: 'https://ethereum-sepolia.publicnode.com',
  explorerUrl: 'https://sepolia.etherscan.io',
};

export const INTENT_MATCHER_ABI = [
  // --- Existing ---
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
  // --- Ownership ---
  'function owner() view returns (address)',
  'function transferOwnership(address newOwner)',
  // --- Across Protocol V3 ---
  'function spokePool() view returns (address)',
  'function handleV3AcrossMessage(address tokenSent, uint256 amount, address relayer, bytes message)',
  'event CrossChainIntentReceived(address indexed trader, address tokenSent, uint256 amount, address relayer)',
  // --- Chainlink Price Feeds ---
  'function priceFeeds(address token) view returns (address)',
  'function maxPriceDeviationBps() view returns (uint256)',
  'function maxPriceStaleness() view returns (uint256)',
  'function oracleValidationEnabled() view returns (bool)',
  'function setPriceFeed(address token, address feed)',
  'function setMaxPriceDeviationBps(uint256 bps)',
  'function setMaxPriceStaleness(uint256 seconds)',
  'function setOracleValidationEnabled(bool enabled)',
  'function getLatestPrice(address token) view returns (uint256 price, uint8 feedDecimals)',
  'function validateMatchPrice(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut) view returns (bool valid)',
  // --- Internal Batch Matching (Chainlink Automation) ---
  'function processInternalBatchMatching(address tokenIn, address tokenOut) returns (uint256 totalMatched)',
  'event InternalBatchMatched(address indexed tokenIn, address indexed tokenOut, uint256 totalMatched)',
  'event OracleValidationToggled(bool enabled)',
  'event PriceFeedUpdated(address indexed token, address indexed feed)',
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

// Across Protocol V3 SpokePool ABI (subset for cross-chain intent deposits)
export const ACROSS_SPOKE_POOL_ABI = [
  'function depositV3(address depositor, address recipient, address inputToken, address outputToken, uint256 inputAmount, uint256 outputAmount, uint256 destinationChainId, address exclusiveRelayer, uint32 quoteTimestamp, uint32 fillDeadline, uint32 exclusivityDeadline, bytes calldata message) external',
];
