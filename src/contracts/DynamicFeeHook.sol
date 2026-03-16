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
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title DynamicFeeHook
/// @author Dynamic Fee Protocol
/// @notice Automatically adjusts swap fees based on volatility - earns from the spread
/// @dev Implements IHooks interface for Uniswap V4
contract DynamicFeeHook is IHooks, Ownable2Step, ReentrancyGuard {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    using LPFeeLibrary for uint24;
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error InvalidFeeRange();
    error InvalidProtocolShare();
    error WithdrawFailed();
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
    event ProtocolFeeCollected(
        PoolId indexed poolId,
        uint256 amount,
        Currency currency
    );
    event VolatilityUpdated(
        PoolId indexed poolId,
        uint256 oldVolatility,
        uint256 newVolatility
    );
    event FeesWithdrawn(address indexed to, Currency currency, uint256 amount);
    event TreasuryUpdated(
        address indexed oldTreasury,
        address indexed newTreasury
    );
    event ProtocolShareUpdated(uint256 oldShare, uint256 newShare);
    event VolatilityParamsUpdated(
        uint256 ewmaAlpha,
        uint256 volatilityWindow,
        uint256 feeMultiplier
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
        uint256 totalFeesGenerated;
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
    mapping(Currency => uint256) public accumulatedFees;

    uint256 public protocolShareBps = 1000; // 10%
    VolatilityParams public volatilityParams;
    address public treasury;

    uint24 public constant MIN_FEE = 100; // 0.01%
    uint24 public constant MAX_FEE = 10000; // 1.00%
    uint256 public constant MAX_PROTOCOL_SHARE = 5000; // 50%
    uint256 public constant MAX_VOLATILITY = 10000;

    uint256 public totalProtocolRevenue;
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

    /// @notice Deploys the DynamicFeeHook
    /// @param _poolManager The Uniswap V4 PoolManager address
    /// @param _treasury The address to receive protocol fees
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

        uint24 baseFee = 3000; // 0.30%
        uint24 maxFee = 10000; // 1.00%

        poolConfigs[poolId] = PoolConfig({
            baseFee: baseFee,
            maxFee: maxFee,
            lastSqrtPriceX96: sqrtPriceX96,
            lastTimestamp: uint32(block.timestamp),
            volatility: 0,
            totalVolume: 0,
            totalFeesGenerated: 0,
            initialized: true
        });

        emit PoolRegistered(poolId, baseFee, maxFee);
        return IHooks.afterInitialize.selector;
    }

    /// @notice Called before adding liquidity
    function beforeAddLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        bytes calldata
    ) external pure returns (bytes4) {
        return IHooks.beforeAddLiquidity.selector;
    }

    /// @notice Called after adding liquidity
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

    /// @notice Called before removing liquidity
    function beforeRemoveLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        bytes calldata
    ) external pure returns (bytes4) {
        return IHooks.beforeRemoveLiquidity.selector;
    }

    /// @notice Called after removing liquidity
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

    /// @notice Called after each swap - collects protocol fee from spread
    /// @dev Takes protocol share of fee spread above base fee
    function afterSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata
    ) external onlyPoolManager returns (bytes4, int128) {
        PoolId poolId = key.toId();
        PoolConfig storage config = poolConfigs[poolId];

        if (!config.initialized) {
            return (IHooks.afterSwap.selector, 0);
        }

        // Track volume
        uint256 swapVolume;
        if (params.amountSpecified > 0) {
            swapVolume = uint256(params.amountSpecified);
        } else {
            swapVolume = uint256(-params.amountSpecified);
        }

        config.totalVolume += swapVolume;
        totalVolumeProcessed += swapVolume;

        // Calculate protocol fee from spread
        uint24 currentFee = _calculateDynamicFee(config);
        int128 protocolFee = 0;

        if (currentFee > config.baseFee) {
            uint24 feeSpread = currentFee - config.baseFee;
            int128 outputAmount = params.zeroForOne
                ? -delta.amount1()
                : -delta.amount0();

            if (outputAmount > 0) {
                uint256 absOutput = uint256(uint128(outputAmount));
                uint256 spreadValue = (absOutput * feeSpread) / 1e6;
                protocolFee = int128(
                    uint128((spreadValue * protocolShareBps) / 10000)
                );

                Currency outputCurrency = params.zeroForOne
                    ? key.currency1
                    : key.currency0;
                accumulatedFees[outputCurrency] += uint256(
                    uint128(protocolFee)
                );
                totalProtocolRevenue += uint256(uint128(protocolFee));
                config.totalFeesGenerated += uint256(uint128(protocolFee));

                emit ProtocolFeeCollected(
                    poolId,
                    uint256(uint128(protocolFee)),
                    outputCurrency
                );
            }
        }

        return (IHooks.afterSwap.selector, protocolFee);
    }

    /// @notice Called before donation
    function beforeDonate(
        address,
        PoolKey calldata,
        uint256,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IHooks.beforeDonate.selector;
    }

    /// @notice Called after donation
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
    /// @param poolId The pool identifier
    /// @param config The pool configuration storage pointer
    /// @param currentSqrtPriceX96 The current sqrt price
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
    /// @param ewmaAlpha Weight for new observations (in bps, max 10000)
    /// @param volatilityWindow Time window in seconds (unused, for future)
    /// @param feeMultiplier Multiplier for fee calculation
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
        emit VolatilityParamsUpdated(
            ewmaAlpha,
            volatilityWindow,
            feeMultiplier
        );
    }

    /// @notice Updates protocol fee share
    /// @param newShareBps New share in basis points (max 5000 = 50%)
    function setProtocolShare(uint256 newShareBps) external onlyOwner {
        if (newShareBps > MAX_PROTOCOL_SHARE) revert InvalidProtocolShare();
        uint256 oldShare = protocolShareBps;
        protocolShareBps = newShareBps;
        emit ProtocolShareUpdated(oldShare, newShareBps);
    }

    /// @notice Updates treasury address
    /// @param newTreasury New treasury address
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    /// @notice Updates pool fee configuration
    /// @param key The pool key
    /// @param baseFee New base fee
    /// @param maxFee New max fee
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

    /// @notice Withdraws accumulated fees to treasury
    /// @param currency The currency to withdraw
    function withdrawFees(Currency currency) external nonReentrant {
        uint256 amount = accumulatedFees[currency];
        if (amount == 0) return;

        // Clear before transfer (CEI pattern)
        accumulatedFees[currency] = 0;

        address tokenAddr = Currency.unwrap(currency);
        if (tokenAddr == address(0)) {
            // Native ETH
            (bool success, ) = treasury.call{value: amount}("");
            if (!success) revert WithdrawFailed();
        } else {
            // ERC20 - using SafeERC20
            IERC20(tokenAddr).safeTransfer(treasury, amount);
        }

        emit FeesWithdrawn(treasury, currency, amount);
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

    /// @notice Estimates fee at given volatility level
    function estimateFee(
        PoolKey calldata key,
        uint256 volatility
    ) external view returns (uint24) {
        PoolConfig storage config = poolConfigs[key.toId()];
        uint256 fee = config.baseFee +
            (volatility * volatilityParams.feeMultiplier) /
            100;
        if (fee > config.maxFee) fee = config.maxFee;
        return uint24(fee);
    }

    /// @notice Gets protocol-wide statistics
    function getProtocolStats()
        external
        view
        returns (uint256, uint256, uint256)
    {
        return (totalProtocolRevenue, totalVolumeProcessed, protocolShareBps);
    }

    /// @notice Gets per-pool statistics
    function getPoolStats(
        PoolKey calldata key
    ) external view returns (uint256, uint256, uint256, uint24) {
        PoolConfig storage config = poolConfigs[key.toId()];
        return (
            config.totalVolume,
            config.totalFeesGenerated,
            config.volatility,
            _calculateDynamicFee(config)
        );
    }

    /// @notice Allows contract to receive ETH
    receive() external payable {}
}
