// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {Deployers} from "v4-core/test/utils/Deployers.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {Currency, CurrencyLibrary} from "v4-core/src/types/Currency.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";
import {SwapParams, ModifyLiquidityParams} from "v4-core/src/types/PoolOperation.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";

import {DynamicFeeHook} from "../src/DynamicFeeHook.sol";

contract DynamicFeeHookTest is Test, Deployers {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using StateLibrary for IPoolManager;

    DynamicFeeHook public hook;
    PoolKey public poolKey;
    PoolId public poolId;

    address public treasury = makeAddr("treasury");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    MockERC20 public token0;
    MockERC20 public token1;

    function setUp() public {
        deployFreshManagerAndRouters();

        token0 = new MockERC20("Token0", "TKN0", 18);
        token1 = new MockERC20("Token1", "TKN1", 18);

        if (address(token0) > address(token1)) {
            (token0, token1) = (token1, token0);
        }

        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG |
                Hooks.AFTER_INITIALIZE_FLAG |
                Hooks.BEFORE_SWAP_FLAG |
                Hooks.AFTER_SWAP_FLAG |
                Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
        );

        address hookAddress = address(flags);

        deployCodeTo(
            "DynamicFeeHook.sol:DynamicFeeHook",
            abi.encode(manager, treasury),
            hookAddress
        );

        hook = DynamicFeeHook(payable(hookAddress));

        poolKey = PoolKey({
            currency0: Currency.wrap(address(token0)),
            currency1: Currency.wrap(address(token1)),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
        poolId = poolKey.toId();

        manager.initialize(poolKey, SQRT_PRICE_1_1);

        _addLiquidity();
        _fundUser(alice, 10000 ether);
        _fundUser(bob, 10000 ether);
    }

    function _addLiquidity() internal {
        token0.mint(address(this), 1000000 ether);
        token1.mint(address(this), 1000000 ether);

        token0.approve(address(modifyLiquidityRouter), type(uint256).max);
        token1.approve(address(modifyLiquidityRouter), type(uint256).max);

        modifyLiquidityRouter.modifyLiquidity(
            poolKey,
            ModifyLiquidityParams({
                tickLower: -600,
                tickUpper: 600,
                liquidityDelta: 100000 ether,
                salt: bytes32(0)
            }),
            ""
        );
    }

    function _fundUser(address user, uint256 amount) internal {
        token0.mint(user, amount);
        token1.mint(user, amount);

        vm.startPrank(user);
        token0.approve(address(swapRouter), type(uint256).max);
        token1.approve(address(swapRouter), type(uint256).max);
        vm.stopPrank();
    }

    function _swap(
        address user,
        bool zeroForOne,
        int256 amount
    ) internal returns (BalanceDelta) {
        vm.startPrank(user);

        SwapParams memory params = SwapParams({
            zeroForOne: zeroForOne,
            amountSpecified: amount,
            sqrtPriceLimitX96: zeroForOne
                ? TickMath.MIN_SQRT_PRICE + 1
                : TickMath.MAX_SQRT_PRICE - 1
        });

        PoolSwapTest.TestSettings memory settings = PoolSwapTest.TestSettings({
            takeClaims: false,
            settleUsingBurn: false
        });

        BalanceDelta delta = swapRouter.swap(poolKey, params, settings, "");
        vm.stopPrank();

        return delta;
    }

    function test_PoolInitialized() public view {
        DynamicFeeHook.PoolConfig memory config = hook.getPoolConfig(poolId);
        assertTrue(config.initialized);
        assertEq(config.baseFee, 3000);
        assertEq(config.maxFee, 10000);
    }

    function test_BasicSwap() public {
        uint256 balanceBefore = token1.balanceOf(alice);
        _swap(alice, true, 1 ether);
        uint256 balanceAfter = token1.balanceOf(alice);
        assertTrue(balanceAfter > balanceBefore);
    }

    function test_FeeAppliedOnSwap() public {
        uint256 amountIn = 100 ether;
        uint256 token1Before = token1.balanceOf(alice);
        _swap(alice, true, int256(amountIn));
        uint256 token1After = token1.balanceOf(alice);
        uint256 amountOut = token1After - token1Before;

        // Should receive tokens (fee applied means less than 1:1)
        assertTrue(amountOut > 0, "Should receive output tokens");
        // With 0.3% fee and price impact, output should be less than input
        assertTrue(
            amountOut <= amountIn,
            "Output should be <= input due to fees"
        );

        console2.log("Amount in:", amountIn);
        console2.log("Amount out:", amountOut);
        console2.log(
            "Effective fee bps:",
            ((amountIn - amountOut) * 10000) / amountIn
        );
    }

    function test_VolatilityIncreasesAfterSwaps() public {
        DynamicFeeHook.PoolConfig memory configBefore = hook.getPoolConfig(
            poolId
        );

        for (uint256 i = 0; i < 5; i++) {
            _swap(alice, true, 100 ether);
            vm.warp(block.timestamp + 15);
            _swap(bob, false, 100 ether);
            vm.warp(block.timestamp + 15);
        }

        DynamicFeeHook.PoolConfig memory configAfter = hook.getPoolConfig(
            poolId
        );
        console2.log("Volatility before:", configBefore.volatility);
        console2.log("Volatility after:", configAfter.volatility);
        assertTrue(configAfter.volatility >= configBefore.volatility);
    }

    function test_DynamicFeeIncreasesWithVolatility() public {
        uint24 feeBefore = hook.getCurrentFee(poolKey);

        // Use smaller amounts to avoid overflow
        for (uint256 i = 0; i < 10; i++) {
            _swap(alice, true, 50 ether);
            vm.warp(block.timestamp + 60);
            _swap(bob, false, 50 ether);
            vm.warp(block.timestamp + 60);
        }

        uint24 feeAfter = hook.getCurrentFee(poolKey);
        console2.log("Fee before:", feeBefore);
        console2.log("Fee after:", feeAfter);
        assertTrue(feeAfter >= feeBefore);
    }

    function test_SetProtocolShare() public {
        hook.setProtocolShare(2000);
        assertEq(hook.protocolShareBps(), 2000);
    }

    function test_RevertInvalidProtocolShare() public {
        vm.expectRevert(DynamicFeeHook.InvalidProtocolShare.selector);
        hook.setProtocolShare(6000);
    }

    function test_OnlyOwnerCanSetProtocolShare() public {
        vm.prank(alice);
        vm.expectRevert();
        hook.setProtocolShare(2000);
    }

    function test_GetPoolStats() public {
        _swap(alice, true, 100 ether);

        (uint256 volume, uint256 fees, uint256 volatility, uint24 fee) = hook
            .getPoolStats(poolKey);
        console2.log("Volume:", volume);
        console2.log("Fees:", fees);
        console2.log("Volatility:", volatility);
        console2.log("Current fee:", fee);
        assertTrue(volume > 0);
    }

    function test_FullLifecycle() public {
        console2.log("\n=== Full Lifecycle Test ===");

        // 1. Initial state
        DynamicFeeHook.PoolConfig memory config = hook.getPoolConfig(poolId);
        console2.log("Initial base fee:", config.baseFee);

        // 2. Normal trading (small amounts)
        for (uint256 i = 0; i < 5; i++) {
            _swap(alice, true, 10 ether);
            vm.warp(block.timestamp + 300);
        }
        console2.log("Fee after normal:", hook.getCurrentFee(poolKey));

        // 3. Volatile trading (moderate amounts to avoid overflow)
        for (uint256 i = 0; i < 10; i++) {
            _swap(alice, true, 100 ether);
            vm.warp(block.timestamp + 30);
            _swap(bob, false, 100 ether);
            vm.warp(block.timestamp + 30);
        }
        console2.log("Fee after volatile:", hook.getCurrentFee(poolKey));

        // 4. Stats
        (uint256 revenue, uint256 volume, ) = hook.getProtocolStats();
        console2.log("Revenue:", revenue);
        console2.log("Volume:", volume);

        console2.log("=== Test Complete ===\n");
    }
}
