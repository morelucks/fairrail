// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {IntentMatcher} from "../src/IntentMatcher.sol";
import {FairRailHook} from "../src/FairRailHook.sol";

/**
 * @title DeployFairRail
 * @notice Deployment script that uses CREATE2 salt mining to deploy FairRailHook
 *         at an address whose lowest bits encode the correct Uniswap v4 hook permission flags.
 * @dev Usage:
 *   PRIVATE_KEY=0x... forge script script/DeployFairRail.s.sol --broadcast --rpc-url <rpc>
 *   Optionally set POOL_MANAGER=0x... to override the default PoolManager address.
 */
contract DeployFairRail is Script {
    // Maximum iterations for salt mining to prevent infinite loops
    uint256 constant MAX_LOOP = 200_000;

    function run() external {
        // PRIVATE_KEY must be set via environment variable — script will revert if missing
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address poolManager = vm.envOr("POOL_MANAGER", address(0x000000000004444c5dc75cB358380D2e3dE08A90));

        // The CREATE2 deployer for `new Contract{salt}()` is the broadcast address (msg.sender)
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy IntentMatcher (no address constraints)
        IntentMatcher matcher = new IntentMatcher();
        console.log("IntentMatcher deployed to:", address(matcher));

        // 2. Mine a CREATE2 salt that produces a hook address with the required permission flags
        uint160 hookFlags = uint160(
            Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );

        bytes memory constructorArgs = abi.encode(IPoolManager(poolManager), address(matcher));
        bytes memory creationCode = abi.encodePacked(type(FairRailHook).creationCode, constructorArgs);

        // Use deployer (broadcast address) since Solidity's `new {salt}` uses msg.sender as CREATE2 deployer
        (address hookAddress, bytes32 salt) = _mineSalt(deployer, hookFlags, creationCode);
        console.log("Mined hook address:", hookAddress);
        console.log("Using salt:");
        console.logBytes32(salt);

        // 3. Deploy FairRailHook via CREATE2 with the mined salt
        FairRailHook hook = new FairRailHook{salt: salt}(IPoolManager(poolManager), address(matcher));

        require(address(hook) == hookAddress, "DeployFairRail: hook address mismatch");
        console.log("FairRailHook deployed to:", address(hook));
        console.log("MevAuction contract deployed to:", address(hook.mevAuction()));

        // 4. Verify hook permissions are correctly encoded in the address
        require(
            uint160(address(hook)) & uint160(Hooks.BEFORE_SWAP_FLAG) != 0,
            "DeployFairRail: BEFORE_SWAP_FLAG not set"
        );
        require(
            uint160(address(hook)) & uint160(Hooks.AFTER_SWAP_FLAG) != 0,
            "DeployFairRail: AFTER_SWAP_FLAG not set"
        );
        require(
            uint160(address(hook)) & uint160(Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG) != 0,
            "DeployFairRail: BEFORE_SWAP_RETURNS_DELTA_FLAG not set"
        );

        vm.stopBroadcast();
    }

    /**
     * @notice Mines a CREATE2 salt that produces a contract address with the desired hook flags
     * @param deployer The CREATE2 deployer address
     * @param flags The required hook permission flags (masked to bottom 14 bits)
     * @param creationCodeWithArgs The full creation code including constructor arguments
     * @return hookAddress The computed hook address
     * @return salt The salt that produces the correct address
     */
    function _mineSalt(
        address deployer,
        uint160 flags,
        bytes memory creationCodeWithArgs
    ) internal view returns (address hookAddress, bytes32 salt) {
        uint160 flagMask = Hooks.ALL_HOOK_MASK;
        flags = flags & flagMask;

        bytes32 initCodeHash = keccak256(creationCodeWithArgs);

        for (uint256 i = 0; i < MAX_LOOP; i++) {
            salt = bytes32(i);
            hookAddress = address(
                uint160(
                    uint256(keccak256(abi.encodePacked(bytes1(0xFF), deployer, salt, initCodeHash)))
                )
            );

            if (uint160(hookAddress) & flagMask == flags && hookAddress.code.length == 0) {
                return (hookAddress, salt);
            }
        }
        revert("DeployFairRail: could not find valid salt within MAX_LOOP iterations");
    }
}
