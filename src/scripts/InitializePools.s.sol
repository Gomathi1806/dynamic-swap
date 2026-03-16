// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";

/// @notice Interface for Position Manager
interface IPositionManager {
    function initializePool(
        PoolKey calldata key,
        uint160 sqrtPriceX96
    ) external returns (int24 tick);
}

/// @title InitializePoolBase
/// @notice Initialize WETH/USDC pool on Base with DynamicFeeHook
contract InitializePoolBase is Script {
    // Base Mainnet Addresses
    address constant POSITION_MANAGER = 0x7C5f5A4bBd8fD63184577525326123B519429bDc;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    
    // YOUR DEPLOYED HOOK
    address constant HOOK = 0xCED22Ff119c151b9CaD797941dAC215B67E5b0c0;
    
    // Pool parameters
    uint24 constant DYNAMIC_FEE_FLAG = 0x800000;
    int24 constant TICK_SPACING = 200;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console2.log("============================================");
        console2.log("Initializing WETH/USDC Pool on BASE");
        console2.log("============================================");
        console2.log("");
        console2.log("Hook:", HOOK);
        console2.log("Position Manager:", POSITION_MANAGER);
        console2.log("");

        // Sort currencies (WETH < USDC by address)
        // 0x4200...0006 < 0x8335...2913 ✓
        Currency currency0 = Currency.wrap(WETH);
        Currency currency1 = Currency.wrap(USDC);
        
        // Verify sorting
        require(Currency.unwrap(currency0) < Currency.unwrap(currency1), "Currencies not sorted!");

        PoolKey memory poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: DYNAMIC_FEE_FLAG,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(HOOK)
        });

        // Calculate sqrtPriceX96 for ~$2000 ETH/USDC
        // Price = USDC per ETH = 2000
        // Since USDC has 6 decimals and WETH has 18 decimals:
        // price = 2000 * 10^6 / 10^18 = 2000 * 10^-12
        // sqrtPriceX96 = sqrt(price) * 2^96
        // For ETH = $2000: sqrtPriceX96 ≈ 3543191142285914205922034688
        uint160 sqrtPriceX96 = 3543191142285914205922034688;

        console2.log("Pool Key:");
        console2.log("  currency0 (WETH):", Currency.unwrap(currency0));
        console2.log("  currency1 (USDC):", Currency.unwrap(currency1));
        console2.log("  fee:", DYNAMIC_FEE_FLAG);
        console2.log("  tickSpacing:", TICK_SPACING);
        console2.log("  hooks:", address(poolKey.hooks));
        console2.log("");
        console2.log("sqrtPriceX96:", sqrtPriceX96);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        int24 tick = IPositionManager(POSITION_MANAGER).initializePool(
            poolKey,
            sqrtPriceX96
        );

        vm.stopBroadcast();

        console2.log("============================================");
        console2.log("POOL INITIALIZED!");
        console2.log("============================================");
        console2.log("Initial tick:", tick);
        console2.log("");
        console2.log("Next step: Add liquidity!");
    }
}

/// @title InitializePoolOptimism
/// @notice Initialize WETH/USDC pool on Optimism
contract InitializePoolOptimism is Script {
    // Optimism Mainnet Addresses
    address constant POSITION_MANAGER = 0x3C3Ea4B57a46241e54610e5f022E5c45859A1017;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant USDC = 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85;
    
    // YOUR DEPLOYED HOOK (checksummed)
    address constant HOOK = 0xFefcBfDa5342E8e4d1Cb882D01dFb17779B330C0;
    
    uint24 constant DYNAMIC_FEE_FLAG = 0x800000;
    int24 constant TICK_SPACING = 200;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console2.log("============================================");
        console2.log("Initializing WETH/USDC Pool on OPTIMISM");
        console2.log("============================================");
        console2.log("Hook:", HOOK);

        // Sort currencies
        // 0x0b2C...Ff85 < 0x4200...0006 ? Let's check
        // USDC: 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85
        // WETH: 0x4200000000000000000000000000000000000006
        // 0x0b2C < 0x4200, so USDC is currency0!
        
        Currency currency0 = Currency.wrap(USDC); // Lower address
        Currency currency1 = Currency.wrap(WETH); // Higher address
        
        require(Currency.unwrap(currency0) < Currency.unwrap(currency1), "Currencies not sorted!");

        PoolKey memory poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: DYNAMIC_FEE_FLAG,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(HOOK)
        });

        // For USDC/WETH (inverted): price = 1/2000 = 0.0005
        // sqrtPriceX96 = sqrt(0.0005 * 10^12) * 2^96
        // ≈ 1771595571142957102961517568
        uint160 sqrtPriceX96 = 1771595571142957102961517568;

        vm.startBroadcast(deployerPrivateKey);

        int24 tick = IPositionManager(POSITION_MANAGER).initializePool(
            poolKey,
            sqrtPriceX96
        );

        vm.stopBroadcast();

        console2.log("POOL INITIALIZED! Tick:", tick);
    }
}

/// @title InitializePoolUnichain
/// @notice Initialize WETH/USDC pool on Unichain
contract InitializePoolUnichain is Script {
    // Unichain Mainnet Addresses
    address constant POSITION_MANAGER = 0x4529A01c7A0410167c5740C487A8DE60232617bf;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant USDC = 0x078D782b760474a361dDA0AF3839290b0EF57AD6;
    
    // YOUR DEPLOYED HOOK
    address constant HOOK = 0xca5d18d24A62Bbe924Ba615F85e4Ac95377e30C0;
    
    uint24 constant DYNAMIC_FEE_FLAG = 0x800000;
    int24 constant TICK_SPACING = 200;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console2.log("============================================");
        console2.log("Initializing WETH/USDC Pool on UNICHAIN");
        console2.log("============================================");
        console2.log("Hook:", HOOK);

        // Sort currencies
        // USDC: 0x078D782b760474a361dDA0AF3839290b0EF57AD6
        // WETH: 0x4200000000000000000000000000000000000006
        // 0x078D < 0x4200, so USDC is currency0!
        
        Currency currency0 = Currency.wrap(USDC);
        Currency currency1 = Currency.wrap(WETH);
        
        require(Currency.unwrap(currency0) < Currency.unwrap(currency1), "Currencies not sorted!");

        PoolKey memory poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: DYNAMIC_FEE_FLAG,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(HOOK)
        });

        // For USDC/WETH (inverted price)
        uint160 sqrtPriceX96 = 1771595571142957102961517568;

        vm.startBroadcast(deployerPrivateKey);

        int24 tick = IPositionManager(POSITION_MANAGER).initializePool(
            poolKey,
            sqrtPriceX96
        );

        vm.stopBroadcast();

        console2.log("POOL INITIALIZED! Tick:", tick);
    }
}

/// @title InitializePoolCelo
/// @notice Initialize CELO/cUSD pool on Celo
contract InitializePoolCelo is Script {
    // Celo Mainnet Addresses (checksummed)
    address constant POSITION_MANAGER = 0x3AE15c3d1AcB2e5cB4879b32F33605e9fcbD6330;
    address constant CELO = 0x471EcE3750Da237f93B8E339c536989b8978a438;
    address constant CUSD = 0x765DE816845861e75A25fCA122bb6898B8B1282a;
    
    // YOUR DEPLOYED HOOK
    address constant HOOK = 0x7E2873516C7344Bfe201f981d0A7Bb6A6dEBf0c0;
    
    uint24 constant DYNAMIC_FEE_FLAG = 0x800000;
    int24 constant TICK_SPACING = 200;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console2.log("============================================");
        console2.log("Initializing CELO/cUSD Pool on CELO");
        console2.log("============================================");
        console2.log("Hook:", HOOK);

        // Sort currencies
        // CELO: 0x471EcE3750Da237f93B8E339c536989b8978a438
        // cUSD: 0x765DE816845861e75A25fCA122bb6898B8B1282a
        // 0x471E < 0x765D, so CELO is currency0
        
        Currency currency0 = Currency.wrap(CELO);
        Currency currency1 = Currency.wrap(CUSD);
        
        require(Currency.unwrap(currency0) < Currency.unwrap(currency1), "Currencies not sorted!");

        PoolKey memory poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: DYNAMIC_FEE_FLAG,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(HOOK)
        });

        // For CELO/cUSD at ~$0.50 per CELO
        // sqrtPriceX96 = sqrt(0.5) * 2^96 ≈ 56022770974786139918731827968
        uint160 sqrtPriceX96 = 56022770974786139918731827968;

        vm.startBroadcast(deployerPrivateKey);

        int24 tick = IPositionManager(POSITION_MANAGER).initializePool(
            poolKey,
            sqrtPriceX96
        );

        vm.stopBroadcast();

        console2.log("POOL INITIALIZED! Tick:", tick);
    }
}
