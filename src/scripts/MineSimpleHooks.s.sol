// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {DynamicFeeHookSimple} from "../src/DynamicFeeHookSimple.sol";
import {HookMiner} from "../test/utils/HookMiner.sol";

/// @title MineSimpleHookBase
/// @notice Mine a valid hook address for Base mainnet
/// @dev Run locally: forge script script/MineSimpleHooks.s.sol:MineSimpleHookBase -vvv
contract MineSimpleHookBase is Script {
    // Base Mainnet Configuration
    address constant POOL_MANAGER = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
    address constant TREASURY = 0x22bc13d2936f738bc820A6934FA8eC60EA51a621;

    // CRITICAL: Use CREATE2 Deployer Proxy - this is what we'll deploy through
    address constant CREATE2_DEPLOYER =
        0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external view {
        console2.log("============================================");
        console2.log("Mining Hook Address for BASE MAINNET");
        console2.log("============================================");
        console2.log("");
        console2.log("Chain ID: 8453");
        console2.log("Pool Manager:", POOL_MANAGER);
        console2.log("Treasury:", TREASURY);
        console2.log("CREATE2 Deployer:", CREATE2_DEPLOYER);
        console2.log("");

        // Required flags: BEFORE_INITIALIZE | AFTER_INITIALIZE | BEFORE_SWAP | AFTER_SWAP = 0x30C0
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG |
                Hooks.AFTER_INITIALIZE_FLAG |
                Hooks.BEFORE_SWAP_FLAG |
                Hooks.AFTER_SWAP_FLAG
        );

        console2.log("Required flags: 0x30C0 (12480)");
        console2.log("");
        console2.log("Mining... this may take a moment...");
        console2.log("");

        bytes memory constructorArgs = abi.encode(
            IPoolManager(POOL_MANAGER),
            TREASURY
        );

        (address hookAddress, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER, // Use CREATE2 Deployer Proxy
            flags,
            type(DynamicFeeHookSimple).creationCode,
            constructorArgs
        );

        // Verify flags
        uint160 addressFlags = uint160(hookAddress) & 0xFFFF;

        bool hasBeforeInit = (addressFlags &
            uint160(Hooks.BEFORE_INITIALIZE_FLAG)) != 0;
        bool hasAfterInit = (addressFlags &
            uint160(Hooks.AFTER_INITIALIZE_FLAG)) != 0;
        bool hasBeforeSwap = (addressFlags & uint160(Hooks.BEFORE_SWAP_FLAG)) !=
            0;
        bool hasAfterSwap = (addressFlags & uint160(Hooks.AFTER_SWAP_FLAG)) !=
            0;

        console2.log("============================================");
        console2.log("MINING RESULTS");
        console2.log("============================================");
        console2.log("");
        console2.log("Hook Address:", hookAddress);
        console2.log("Salt:", vm.toString(salt));
        console2.log("Salt (uint256):", uint256(salt));
        console2.log("");
        console2.log("Address last 4 hex:", addressFlags);
        console2.log("");
        console2.log("Flag verification:");
        console2.log("  BEFORE_INITIALIZE:", hasBeforeInit ? "YES" : "NO");
        console2.log("  AFTER_INITIALIZE:", hasAfterInit ? "YES" : "NO");
        console2.log("  BEFORE_SWAP:", hasBeforeSwap ? "YES" : "NO");
        console2.log("  AFTER_SWAP:", hasAfterSwap ? "YES" : "NO");
        console2.log("");

        require(hasBeforeInit, "Missing BEFORE_INITIALIZE");
        require(hasAfterInit, "Missing AFTER_INITIALIZE");
        require(hasBeforeSwap, "Missing BEFORE_SWAP");
        require(hasAfterSwap, "Missing AFTER_SWAP");

        console2.log("============================================");
        console2.log("SUCCESS! Copy these to DeploySimpleHooks.s.sol");
        console2.log("============================================");
        console2.log("");
        console2.log("bytes32 constant SALT =", vm.toString(salt), ";");
        console2.log(
            "address constant EXPECTED_ADDRESS =",
            vm.toString(hookAddress),
            ";"
        );
        console2.log("");
    }
}

/// @title MineSimpleHookOptimism (REQUIRED FOR OP GRANT)
contract MineSimpleHookOptimism is Script {
    address constant POOL_MANAGER = 0x9a13F98Cb987694C9F086b1F5eB990EeA8264Ec3;
    address constant TREASURY = 0x22bc13d2936f738bc820A6934FA8eC60EA51a621;
    address constant CREATE2_DEPLOYER =
        0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external view {
        console2.log("============================================");
        console2.log("Mining Hook Address for OPTIMISM MAINNET");
        console2.log("============================================");
        console2.log("Chain ID: 10");
        console2.log("Pool Manager:", POOL_MANAGER);
        console2.log("CREATE2 Deployer:", CREATE2_DEPLOYER);
        console2.log("");

        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG |
                Hooks.AFTER_INITIALIZE_FLAG |
                Hooks.BEFORE_SWAP_FLAG |
                Hooks.AFTER_SWAP_FLAG
        );

        bytes memory constructorArgs = abi.encode(
            IPoolManager(POOL_MANAGER),
            TREASURY
        );

        (address hookAddress, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            flags,
            type(DynamicFeeHookSimple).creationCode,
            constructorArgs
        );

        uint160 addressFlags = uint160(hookAddress) & 0xFFFF;

        console2.log("============================================");
        console2.log("SUCCESS!");
        console2.log("============================================");
        console2.log("Hook Address:", hookAddress);
        console2.log("Salt:", vm.toString(salt));
        console2.log("Address flags:", addressFlags);
        console2.log("");
        console2.log("bytes32 constant SALT =", vm.toString(salt), ";");
        console2.log(
            "address constant EXPECTED_ADDRESS =",
            vm.toString(hookAddress),
            ";"
        );
    }
}

/// @title MineSimpleHookUnichain
contract MineSimpleHookUnichain is Script {
    address constant POOL_MANAGER = 0x1F98400000000000000000000000000000000004;
    address constant TREASURY = 0x22bc13d2936f738bc820A6934FA8eC60EA51a621;
    address constant CREATE2_DEPLOYER =
        0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external view {
        console2.log("============================================");
        console2.log("Mining Hook Address for UNICHAIN MAINNET");
        console2.log("============================================");
        console2.log("Chain ID: 130");
        console2.log("Pool Manager:", POOL_MANAGER);
        console2.log("CREATE2 Deployer:", CREATE2_DEPLOYER);
        console2.log("");

        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG |
                Hooks.AFTER_INITIALIZE_FLAG |
                Hooks.BEFORE_SWAP_FLAG |
                Hooks.AFTER_SWAP_FLAG
        );

        bytes memory constructorArgs = abi.encode(
            IPoolManager(POOL_MANAGER),
            TREASURY
        );

        (address hookAddress, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            flags,
            type(DynamicFeeHookSimple).creationCode,
            constructorArgs
        );

        uint160 addressFlags = uint160(hookAddress) & 0xFFFF;

        console2.log("============================================");
        console2.log("SUCCESS!");
        console2.log("============================================");
        console2.log("Hook Address:", hookAddress);
        console2.log("Salt:", vm.toString(salt));
        console2.log("Address flags:", addressFlags);
        console2.log("");
        console2.log("bytes32 constant SALT =", vm.toString(salt), ";");
        console2.log(
            "address constant EXPECTED_ADDRESS =",
            vm.toString(hookAddress),
            ";"
        );
    }
}

/// @title MineSimpleHookCelo
contract MineSimpleHookCelo is Script {
    address constant POOL_MANAGER = 0x288dc841A52FCA2707c6947B3A777c5E56cd87BC;
    address constant TREASURY = 0x22bc13d2936f738bc820A6934FA8eC60EA51a621;
    address constant CREATE2_DEPLOYER =
        0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external view {
        console2.log("============================================");
        console2.log("Mining Hook Address for CELO MAINNET");
        console2.log("============================================");
        console2.log("Chain ID: 42220");
        console2.log("Pool Manager:", POOL_MANAGER);
        console2.log("CREATE2 Deployer:", CREATE2_DEPLOYER);
        console2.log("");

        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG |
                Hooks.AFTER_INITIALIZE_FLAG |
                Hooks.BEFORE_SWAP_FLAG |
                Hooks.AFTER_SWAP_FLAG
        );

        bytes memory constructorArgs = abi.encode(
            IPoolManager(POOL_MANAGER),
            TREASURY
        );

        (address hookAddress, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            flags,
            type(DynamicFeeHookSimple).creationCode,
            constructorArgs
        );

        uint160 addressFlags = uint160(hookAddress) & 0xFFFF;

        console2.log("============================================");
        console2.log("SUCCESS!");
        console2.log("============================================");
        console2.log("Hook Address:", hookAddress);
        console2.log("Salt:", vm.toString(salt));
        console2.log("Address flags:", addressFlags);
        console2.log("");
        console2.log("bytes32 constant SALT =", vm.toString(salt), ";");
        console2.log(
            "address constant EXPECTED_ADDRESS =",
            vm.toString(hookAddress),
            ";"
        );
    }
}
