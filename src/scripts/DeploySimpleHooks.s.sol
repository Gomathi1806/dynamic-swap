// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {DynamicFeeHookSimple} from "../src/DynamicFeeHookSimple.sol";

/// @title DeployViaCreate2
/// @notice Deploys hook using the deterministic CREATE2 Deployer Proxy
/// @dev This deployer exists at the same address on ALL EVM chains
contract DeploySimpleHookBase is Script {
    // Base Mainnet
    address constant POOL_MANAGER = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
    address constant TREASURY = 0x22bc13d2936f738bc820A6934FA8eC60EA51a621;

    // CREATE2 Deployer Proxy - same on all EVM chains
    address constant CREATE2_DEPLOYER =
        0x4e59b44847b379578588920cA78FbF26c0B4956C;

    // === FILL IN FROM MINING SCRIPT (with DEPLOYER = CREATE2_DEPLOYER) ===
    bytes32 constant SALT =
        0x000000000000000000000000000000000000000000000000000000000000514b;
    address constant EXPECTED_ADDRESS =
        0xCED22Ff119c151b9CaD797941dAC215B67E5b0c0;

    // =====================================================================

    function run() external {
        require(SALT != bytes32(0), "Salt not set! Run mining script first");
        require(EXPECTED_ADDRESS != address(0), "Expected address not set!");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console2.log("============================================");
        console2.log("Deploying DynamicFeeHookSimple to BASE");
        console2.log("============================================");
        console2.log("");
        console2.log("Using CREATE2 Deployer:", CREATE2_DEPLOYER);
        console2.log("Treasury:", TREASURY);
        console2.log("Expected Address:", EXPECTED_ADDRESS);
        console2.log("Salt:", vm.toString(SALT));
        console2.log("");

        // Build the creation code with constructor args
        bytes memory creationCode = abi.encodePacked(
            type(DynamicFeeHookSimple).creationCode,
            abi.encode(IPoolManager(POOL_MANAGER), TREASURY)
        );

        // CREATE2 Deployer expects: salt ++ creationCode
        bytes memory deployData = abi.encodePacked(SALT, creationCode);

        vm.startBroadcast(deployerPrivateKey);

        // Call the CREATE2 Deployer
        (bool success, bytes memory result) = CREATE2_DEPLOYER.call(deployData);
        require(success, "CREATE2 deployment failed");

        // Extract deployed address from return data
        address deployedAddress;
        assembly {
            deployedAddress := mload(add(result, 20))
        }

        vm.stopBroadcast();

        // Verify the address matches
        require(
            deployedAddress == EXPECTED_ADDRESS,
            string(
                abi.encodePacked(
                    "Address mismatch! Got: ",
                    vm.toString(deployedAddress),
                    " Expected: ",
                    vm.toString(EXPECTED_ADDRESS)
                )
            )
        );

        // Verify flags
        uint160 flags = uint160(deployedAddress) & 0xFFFF;

        console2.log("");
        console2.log("============================================");
        console2.log("DEPLOYMENT SUCCESSFUL!");
        console2.log("============================================");
        console2.log("");
        console2.log("Hook Address:", deployedAddress);
        console2.log("Address Flags:", flags);
        console2.log("");
        console2.log("Verify on BaseScan:");
        console2.log(
            "https://basescan.org/address/",
            vm.toString(deployedAddress)
        );
        console2.log("");
    }
}

/// @title DeploySimpleHookOptimism
/// @notice Deploy to Optimism for OP Grant
contract DeploySimpleHookOptimism is Script {
    address constant POOL_MANAGER = 0x9a13F98Cb987694C9F086b1F5eB990EeA8264Ec3;
    address constant TREASURY = 0x22bc13d2936f738bc820A6934FA8eC60EA51a621;
    address constant CREATE2_DEPLOYER =
        0x4e59b44847b379578588920cA78FbF26c0B4956C;

    // === FILL IN FROM MINING SCRIPT ===
    bytes32 constant SALT =
        0x000000000000000000000000000000000000000000000000000000000000b91f;
    address constant EXPECTED_ADDRESS =
        0xFefcBfDa5342E8e4d1Cb882D01dFb17779B330C0;

    // ==================================

    function run() external {
        require(SALT != bytes32(0), "Salt not set!");
        require(EXPECTED_ADDRESS != address(0), "Expected address not set!");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console2.log("Deploying DynamicFeeHookSimple to OPTIMISM");
        console2.log("Expected Address:", EXPECTED_ADDRESS);

        bytes memory creationCode = abi.encodePacked(
            type(DynamicFeeHookSimple).creationCode,
            abi.encode(IPoolManager(POOL_MANAGER), TREASURY)
        );

        bytes memory deployData = abi.encodePacked(SALT, creationCode);

        vm.startBroadcast(deployerPrivateKey);
        (bool success, bytes memory result) = CREATE2_DEPLOYER.call(deployData);
        require(success, "CREATE2 deployment failed");

        address deployedAddress;
        assembly {
            deployedAddress := mload(add(result, 20))
        }
        vm.stopBroadcast();

        require(deployedAddress == EXPECTED_ADDRESS, "Address mismatch!");
        console2.log("SUCCESS! Hook deployed at:", deployedAddress);
    }
}

/// @title DeploySimpleHookUnichain
contract DeploySimpleHookUnichain is Script {
    address constant POOL_MANAGER = 0x1F98400000000000000000000000000000000004;
    address constant TREASURY = 0x22bc13d2936f738bc820A6934FA8eC60EA51a621;
    address constant CREATE2_DEPLOYER =
        0x4e59b44847b379578588920cA78FbF26c0B4956C;

    // === FILL IN FROM MINING SCRIPT ===
    bytes32 constant SALT =
        0x0000000000000000000000000000000000000000000000000000000000002727;
    address constant EXPECTED_ADDRESS =
        0xca5d18d24A62Bbe924Ba615F85e4Ac95377e30C0;

    // ==================================

    function run() external {
        require(SALT != bytes32(0), "Salt not set!");
        require(EXPECTED_ADDRESS != address(0), "Expected address not set!");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console2.log("Deploying DynamicFeeHookSimple to UNICHAIN");
        console2.log("Expected Address:", EXPECTED_ADDRESS);

        bytes memory creationCode = abi.encodePacked(
            type(DynamicFeeHookSimple).creationCode,
            abi.encode(IPoolManager(POOL_MANAGER), TREASURY)
        );

        bytes memory deployData = abi.encodePacked(SALT, creationCode);

        vm.startBroadcast(deployerPrivateKey);
        (bool success, bytes memory result) = CREATE2_DEPLOYER.call(deployData);
        require(success, "CREATE2 deployment failed");

        address deployedAddress;
        assembly {
            deployedAddress := mload(add(result, 20))
        }
        vm.stopBroadcast();

        require(deployedAddress == EXPECTED_ADDRESS, "Address mismatch!");
        console2.log("SUCCESS! Hook deployed at:", deployedAddress);
    }
}

/// @title DeploySimpleHookCelo
contract DeploySimpleHookCelo is Script {
    address constant POOL_MANAGER = 0x288dc841A52FCA2707c6947B3A777c5E56cd87BC;
    address constant TREASURY = 0x22bc13d2936f738bc820A6934FA8eC60EA51a621;
    address constant CREATE2_DEPLOYER =
        0x4e59b44847b379578588920cA78FbF26c0B4956C;

    // === FILL IN FROM MINING SCRIPT ===
    bytes32 constant SALT =
        0x0000000000000000000000000000000000000000000000000000000000005b70;
    address constant EXPECTED_ADDRESS =
        0x7E2873516C7344Bfe201f981d0A7Bb6A6dEBf0c0;

    // ==================================

    function run() external {
        require(SALT != bytes32(0), "Salt not set!");
        require(EXPECTED_ADDRESS != address(0), "Expected address not set!");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console2.log("Deploying DynamicFeeHookSimple to CELO");
        console2.log("Expected Address:", EXPECTED_ADDRESS);

        bytes memory creationCode = abi.encodePacked(
            type(DynamicFeeHookSimple).creationCode,
            abi.encode(IPoolManager(POOL_MANAGER), TREASURY)
        );

        bytes memory deployData = abi.encodePacked(SALT, creationCode);

        vm.startBroadcast(deployerPrivateKey);
        (bool success, bytes memory result) = CREATE2_DEPLOYER.call(deployData);
        require(success, "CREATE2 deployment failed");

        address deployedAddress;
        assembly {
            deployedAddress := mload(add(result, 20))
        }
        vm.stopBroadcast();

        require(deployedAddress == EXPECTED_ADDRESS, "Address mismatch!");
        console2.log("SUCCESS! Hook deployed at:", deployedAddress);
    }
}
