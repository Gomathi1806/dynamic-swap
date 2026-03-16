// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/src/types/BeforeSwapDelta.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";
import {SwapParams, ModifyLiquidityParams} from "v4-core/src/types/PoolOperation.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title DynamicFeeHookSimple
/// @author DynamicSwap Team
/// @notice Simplified hook for UHI8 hackathon - minimal flags, no protocol fee extraction
/// @dev Uses flags: BEFORE_INITIALIZE | AFTER_INITIALIZE | BEFORE_SWAP | AFTER_SWAP = 0x30C0
/// @dev All swap fees go directly to LPs - no protocol take
contract DynamicFeeHookSimple is IHooks, Ownable2Step {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    using LPFeeLibrary for uint24;

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error InvalidFeeRange();
    error PoolNotInitialized();
    error NotPoolManager();
    error ZeroAddress();

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event PoolRegistered(PoolId indexed poolId, uint24 baseFee, uint24 maxFee);
    event DynamicFeeApplied(
        PoolId indexed poolId,
        uint24 baseFee,
        uint24 dynamicFee,
        uint256 volatility
    );
    event VolatilityUpdated(
        PoolId indexed poolId,
        uint256 oldVolatility,
        uint256 newVolatility
    );

    /*//////////////////////////////////////////////////////////////
                                 STRUCTS
    //////////////////////////////////////////////////////////////*/

    struct PoolConfig {
        uint24 baseFee;
        uint24 maxFee;
        uint160 lastSqrtPriceX96;
        uint32 lastTimestamp;
        uint256 volatility;
        uint256 totalVolume;
        bool initialized;
    }

    struct VolatilityParams {
        uint256 ewmaAlpha;
        uint256 volatilityWindow;
        uint256 feeMultiplier;
    }

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    IPoolManager public immutable poolManager;

    mapping(PoolId => PoolConfig) public poolConfigs;

    VolatilityParams public volatilityParams;
    address public treasury;

    uint24 public constant MIN_FEE = 100; // 0.01%
    uint24 public constant MAX_FEE = 10000; // 1.00%
    uint256 public constant MAX_VOLATILITY = 10000;

    uint256 public totalVolumeProcessed;

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @notice Deploys the simplified DynamicFeeHook
    /// @param _poolManager The Uniswap V4 PoolManager address
    /// @param _treasury The treasury address (owner)
    constructor(
        IPoolManager _poolManager,
        address _treasury
    ) Ownable(_treasury) {
        if (address(_poolManager) == address(0)) revert ZeroAddress();
        if (_treasury == address(0)) revert ZeroAddress();

        poolManager = _poolManager;
        treasury = _treasury;

        volatilityParams = VolatilityParams({
            ewmaAlpha: 2000, // 20% weight to new observations
            volatilityWindow: 300, // 5 minute window
            feeMultiplier: 50 // 0.5 bps per volatility point
        });
    }

    /*//////////////////////////////////////////////////////////////
                          HOOK CALLBACKS
    //////////////////////////////////////////////////////////////*/

    /// @notice Called before pool initialization
    /// @dev Validates that pool uses dynamic fees
    function beforeInitialize(
        address,
        PoolKey calldata key,
        uint160
    ) external view onlyPoolManager returns (bytes4) {
        if (!key.fee.isDynamicFee()) {
            revert InvalidFeeRange();
        }
        return IHooks.beforeInitialize.selector;
    }

    /// @notice Called after pool initialization
    /// @dev Registers pool with default configuration
    function afterInitialize(
        address,
        PoolKey calldata key,
        uint160 sqrtPriceX96,
        int24
    ) external onlyPoolManager returns (bytes4) {
        PoolId poolId = key.toId();

        poolConfigs[poolId] = PoolConfig({
            baseFee: 3000, // 0.30%
            maxFee: 10000, // 1.00%
            lastSqrtPriceX96: sqrtPriceX96,
            lastTimestamp: uint32(block.timestamp),
            volatility: 0,
            totalVolume: 0,
            initialized: true
        });

        emit PoolRegistered(poolId, 3000, 10000);
        return IHooks.afterInitialize.selector;
    }

    /// @notice Called before each swap - calculates dynamic fee
    /// @dev Updates volatility and returns fee override
    function beforeSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata,
        bytes calldata
    ) external onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24) {
        PoolId poolId = key.toId();
        PoolConfig storage config = poolConfigs[poolId];

        if (!config.initialized) {
            return (
                IHooks.beforeSwap.selector,
                BeforeSwapDeltaLibrary.ZERO_DELTA,
                3000 | LPFeeLibrary.OVERRIDE_FEE_FLAG
            );
        }

        (uint160 sqrtPriceX96, , , ) = poolManager.getSlot0(poolId);
        _updateVolatility(poolId, config, sqrtPriceX96);

        uint24 dynamicFee = _calculateDynamicFee(config);

        emit DynamicFeeApplied(
            poolId,
            config.baseFee,
            dynamicFee,
            config.volatility
        );

        return (
            IHooks.beforeSwap.selector,
            BeforeSwapDeltaLibrary.ZERO_DELTA,
            dynamicFee | LPFeeLibrary.OVERRIDE_FEE_FLAG
        );
    }

    /// @notice Called after each swap - tracks volume only
    /// @dev IMPORTANT: Returns 0 delta - does NOT collect protocol fees
    /// @dev This allows us to use 0x30C0 flags without AFTER_SWAP_RETURNS_DELTA_FLAG
    function afterSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta,
        bytes calldata
    ) external onlyPoolManager returns (bytes4, int128) {
        PoolConfig storage config = poolConfigs[key.toId()];

        if (config.initialized) {
            // Track volume only - no fee extraction
            uint256 swapVolume;
            if (params.amountSpecified > 0) {
                swapVolume = uint256(params.amountSpecified);
            } else {
                swapVolume = uint256(-params.amountSpecified);
            }

            config.totalVolume += swapVolume;
            totalVolumeProcessed += swapVolume;
        }

        // CRITICAL: Always return 0 - we don't use AFTER_SWAP_RETURNS_DELTA_FLAG
        return (IHooks.afterSwap.selector, 0);
    }

    /*//////////////////////////////////////////////////////////////
                    UNUSED HOOK CALLBACKS (NO FLAGS)
    //////////////////////////////////////////////////////////////*/

    // These functions exist to satisfy IHooks interface but won't be called
    // because we don't set their flags in the address

    function beforeAddLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        bytes calldata
    ) external pure returns (bytes4) {
        return IHooks.beforeAddLiquidity.selector;
    }

    function afterAddLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure returns (bytes4, BalanceDelta) {
        return (IHooks.afterAddLiquidity.selector, BalanceDelta.wrap(0));
    }

    function beforeRemoveLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        bytes calldata
    ) external pure returns (bytes4) {
        return IHooks.beforeRemoveLiquidity.selector;
    }

    function afterRemoveLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure returns (bytes4, BalanceDelta) {
        return (IHooks.afterRemoveLiquidity.selector, BalanceDelta.wrap(0));
    }

    function beforeDonate(
        address,
        PoolKey calldata,
        uint256,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IHooks.beforeDonate.selector;
    }

    function afterDonate(
        address,
        PoolKey calldata,
        uint256,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IHooks.afterDonate.selector;
    }

    /*//////////////////////////////////////////////////////////////
                        INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Updates volatility using EWMA
    function _updateVolatility(
        PoolId poolId,
        PoolConfig storage config,
        uint160 currentSqrtPriceX96
    ) internal {
        uint32 currentTime = uint32(block.timestamp);
        uint32 timeDelta = currentTime - config.lastTimestamp;

        if (timeDelta == 0) return;

        uint256 priceChange = _calculatePriceChange(
            config.lastSqrtPriceX96,
            currentSqrtPriceX96
        );

        // Annualize the price change
        uint256 annualizedChange = (priceChange * 31536000) / timeDelta;

        uint256 oldVolatility = config.volatility;

        // EWMA: newVol = alpha * observation + (1 - alpha) * oldVol
        uint256 newVolatility = ((annualizedChange *
            volatilityParams.ewmaAlpha) +
            (oldVolatility * (10000 - volatilityParams.ewmaAlpha))) / 10000;

        // Cap volatility
        if (newVolatility > MAX_VOLATILITY) {
            newVolatility = MAX_VOLATILITY;
        }

        config.volatility = newVolatility;
        config.lastSqrtPriceX96 = currentSqrtPriceX96;
        config.lastTimestamp = currentTime;

        if (newVolatility != oldVolatility) {
            emit VolatilityUpdated(poolId, oldVolatility, newVolatility);
        }
    }

    /// @notice Calculates absolute price change in basis points
    function _calculatePriceChange(
        uint160 oldPrice,
        uint160 newPrice
    ) internal pure returns (uint256) {
        if (oldPrice == 0) return 0;
        uint256 diff = newPrice > oldPrice
            ? newPrice - oldPrice
            : oldPrice - newPrice;
        return (diff * 10000) / oldPrice;
    }

    /// @notice Calculates dynamic fee based on current volatility
    function _calculateDynamicFee(
        PoolConfig storage config
    ) internal view returns (uint24) {
        uint256 fee = config.baseFee +
            (config.volatility * volatilityParams.feeMultiplier) /
            100;
        if (fee > config.maxFee) fee = config.maxFee;
        return uint24(fee);
    }

    /*//////////////////////////////////////////////////////////////
                            ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Updates volatility calculation parameters
    function setVolatilityParams(
        uint256 ewmaAlpha,
        uint256 volatilityWindow,
        uint256 feeMultiplier
    ) external onlyOwner {
        require(ewmaAlpha <= 10000, "Alpha too high");
        volatilityParams = VolatilityParams(
            ewmaAlpha,
            volatilityWindow,
            feeMultiplier
        );
    }

    /// @notice Updates pool fee configuration
    function setPoolConfig(
        PoolKey calldata key,
        uint24 baseFee,
        uint24 maxFee
    ) external onlyOwner {
        PoolId poolId = key.toId();
        PoolConfig storage config = poolConfigs[poolId];
        if (!config.initialized) revert PoolNotInitialized();
        if (baseFee < MIN_FEE || maxFee > MAX_FEE || baseFee >= maxFee)
            revert InvalidFeeRange();
        config.baseFee = baseFee;
        config.maxFee = maxFee;
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Gets pool configuration
    function getPoolConfig(
        PoolId poolId
    ) external view returns (PoolConfig memory) {
        return poolConfigs[poolId];
    }

    /// @notice Gets current dynamic fee for a pool
    function getCurrentFee(
        PoolKey calldata key
    ) external view returns (uint24) {
        PoolConfig storage config = poolConfigs[key.toId()];
        if (!config.initialized) return 3000;
        return _calculateDynamicFee(config);
    }

    /// @notice Gets current volatility for a pool
    function getVolatility(
        PoolKey calldata key
    ) external view returns (uint256) {
        return poolConfigs[key.toId()].volatility;
    }

    /// @notice Gets pool statistics
    function getPoolStats(
        PoolKey calldata key
    )
        external
        view
        returns (uint256 volume, uint256 volatility, uint24 currentFee)
    {
        PoolConfig storage config = poolConfigs[key.toId()];
        return (
            config.totalVolume,
            config.volatility,
            _calculateDynamicFee(config)
        );
    }

    /// @notice Allows contract to receive ETH
    receive() external payable {}
}
