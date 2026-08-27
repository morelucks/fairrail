// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/IntentMatcher.sol";
import "../src/FairRailHook.sol";

contract DeployFairRail is Script {
    function run() external {
        // WARNING: Fallback is Anvil's default account #0 — NEVER use on mainnet/testnet without setting PRIVATE_KEY env var
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address poolManager = vm.envOr("POOL_MANAGER", address(0x000000000004444c5dc75cB358380D2e3dE08A90));

        vm.startBroadcast(deployerPrivateKey);

        IntentMatcher matcher = new IntentMatcher();
        console.log("IntentMatcher deployed to:", address(matcher));

        FairRailHook hook = new FairRailHook(poolManager, address(matcher));
        console.log("FairRailHook deployed to:", address(hook));
        console.log("MevAuction contract deployed to:", address(hook.mevAuction()));

        vm.stopBroadcast();
    }
}
