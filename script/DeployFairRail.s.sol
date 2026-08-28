// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import "../src/IntentMatcher.sol";
import "../src/FairRailHook.sol";

contract DeployFairRail is Script {
    function run() external {
        // PRIVATE_KEY must be set via environment variable — script will revert if missing
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address poolManager = vm.envOr("POOL_MANAGER", address(0x000000000004444c5dc75cB358380D2e3dE08A90));

        vm.startBroadcast(deployerPrivateKey);

        IntentMatcher matcher = new IntentMatcher();
        console.log("IntentMatcher deployed to:", address(matcher));

        // NOTE: FairRailHook must be deployed to an address whose lowest bits encode
        // the correct hook permissions (beforeSwap=0x80, afterSwap=0x40).
        // Use CREATE2 with salt mining or a hook deployer to achieve the correct address.
        FairRailHook hook = new FairRailHook(IPoolManager(poolManager), address(matcher));
        console.log("FairRailHook deployed to:", address(hook));
        console.log("MevAuction contract deployed to:", address(hook.mevAuction()));

        vm.stopBroadcast();
    }
}
