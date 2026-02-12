// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {DynamicFeeHook} from "../src/DynamicFeeHook.sol";

/// @title DeployBase - Deploy to Base Mainnet
contract DeployBase is Script {
    address constant POOL_MANAGER = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address treasury = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);
        
        console2.log("=== Deploying to BASE ===");
        console2.log("Chain ID: 8453");
        console2.log("Treasury:", treasury);
        console2.log("PoolManager:", POOL_MANAGER);
        
        DynamicFeeHook hook = new DynamicFeeHook(
            IPoolManager(POOL_MANAGER),
            treasury
        );
        
        console2.log("\n=== Deployment Successful ===");
        console2.log("DynamicFeeHook:", address(hook));
        console2.log("Owner:", hook.owner());
        
        vm.stopBroadcast();
    }
}

/// @title DeployCelo - Deploy to Celo Mainnet
contract DeployCelo is Script {
    address constant POOL_MANAGER = 0x288dc841A52FCA2707c6947B3A777c5E56cd87BC;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address treasury = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);
        
        console2.log("=== Deploying to CELO ===");
        console2.log("Chain ID: 42220");
        console2.log("Treasury:", treasury);
        console2.log("PoolManager:", POOL_MANAGER);
        
        DynamicFeeHook hook = new DynamicFeeHook(
            IPoolManager(POOL_MANAGER),
            treasury
        );
        
        console2.log("\n=== Deployment Successful ===");
        console2.log("DynamicFeeHook:", address(hook));
        console2.log("Owner:", hook.owner());
        
        vm.stopBroadcast();
    }
}

/// @title DeployUnichain - Deploy to Unichain Mainnet
contract DeployUnichain is Script {
    address constant POOL_MANAGER = 0x1F98400000000000000000000000000000000004;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address treasury = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);
        
        console2.log("=== Deploying to UNICHAIN ===");
        console2.log("Chain ID: 130");
        console2.log("Treasury:", treasury);
        console2.log("PoolManager:", POOL_MANAGER);
        
        DynamicFeeHook hook = new DynamicFeeHook(
            IPoolManager(POOL_MANAGER),
            treasury
        );
        
        console2.log("\n=== Deployment Successful ===");
        console2.log("DynamicFeeHook:", address(hook));
        console2.log("Owner:", hook.owner());
        
        vm.stopBroadcast();
    }
}

/// @title ConfigureHook - Configure deployed hook settings
contract ConfigureHook is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address hookAddress = vm.envAddress("HOOK_ADDRESS");
        
        vm.startBroadcast(deployerPrivateKey);
        
        DynamicFeeHook hook = DynamicFeeHook(payable(hookAddress));
        
        // Configure with balanced settings
        hook.setVolatilityParams(2000, 300, 50);
        hook.setProtocolShare(1000); // 10%
        
        console2.log("Hook configured!");
        console2.log("EWMA Alpha: 2000");
        console2.log("Volatility Window: 300s");
        console2.log("Fee Multiplier: 50");
        console2.log("Protocol Share: 10%");
        
        vm.stopBroadcast();
    }
}
