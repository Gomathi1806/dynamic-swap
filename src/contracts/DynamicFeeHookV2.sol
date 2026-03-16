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

/// @title DynamicFeeHookV2
/// @author DynamicSwap Team
/// @notice V2 with Asset-Class Specific Liquidity - tailored fee profiles per asset type
/// @dev Implements IHooks interface for Uniswap V4 with asset class categorization
contract DynamicFeeHookV2 is IHooks, Ownable2Step, ReentrancyGuard {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    using LPFeeLibrary for uint24;
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                            ASSET CLASSES
    //////////////////////////////////////////////////////////////*/

    /// @notice Asset class categories for bespoke fee configurations
    enum AssetClass {
        STABLE, // Stablecoin pairs (USDC/USDT) - lowest fees, tight spreads
        BLUE_CHIP, // Major assets (ETH/BTC) - moderate fees
        VOLATILE, // Default - standard volatile pairs
        LONG_TAIL, // Low-cap/meme tokens - highest fees, max protection
        RWA, // Real World Assets - conservative fees
        CUSTOM // User-defined parameters
    }

    /// @notice Fee profile for each asset class
    struct AssetProfile {
        uint24 baseFee; // Base fee in bps (100 = 0.01%)
        uint24 maxFee; // Maximum fee cap
        uint256 lowVolThreshold; // Below this = low volatility
        uint256 highVolThreshold; // Above this = high volatility
        uint256 feeMultiplier; // Volatility → fee scaling factor
        bool enabled;
    }

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error InvalidFeeRange();
    error InvalidProtocolShare();
    error WithdrawFailed();
    error PoolNotInitialized();
    error NotPoolManager();
    error ZeroAddress();
    error InvalidAssetClass();

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event PoolRegistered(
        PoolId indexed poolId,
        AssetClass assetClass,
        uint24 baseFee,
        uint24 maxFee
    );
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
    event AssetProfileUpdated(
        AssetClass indexed assetClass,
        uint24 baseFee,
        uint24 maxFee
    );
    event PoolAssetClassChanged(
        PoolId indexed poolId,
        AssetClass oldClass,
        AssetClass newClass
    );

    /*//////////////////////////////////////////////////////////////
                                 STRUCTS
    //////////////////////////////////////////////////////////////*/

    struct PoolConfig {
        AssetClass assetClass;
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

    /// @notice Pool-specific configurations
    mapping(PoolId => PoolConfig) public poolConfigs;

    /// @notice Accumulated protocol fees per currency
    mapping(Currency => uint256) public accumulatedFees;

    /// @notice Asset class profiles - predefined fee structures
    mapping(AssetClass => AssetProfile) public assetProfiles;

    uint256 public protocolShareBps = 1000; // 10%
    VolatilityParams public volatilityParams;
    address public treasury;

    uint24 public constant MIN_FEE = 10; // 0.001%
    uint24 public constant MAX_FEE = 30000; // 3.00%
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

    constructor(
        IPoolManager _poolManager,
        address _treasury
    ) Ownable(msg.sender) {
        if (address(_poolManager) == address(0)) revert ZeroAddress();
        if (_treasury == address(0)) revert ZeroAddress();

        poolManager = _poolManager;
        treasury = _treasury;

        volatilityParams = VolatilityParams({
            ewmaAlpha: 2000,
            volatilityWindow: 300,
            feeMultiplier: 50
        });

        // Initialize default asset profiles
        _initializeAssetProfiles();
    }

    /*//////////////////////////////////////////////////////////////
                      ASSET PROFILE INITIALIZATION
    //////////////////////////////////////////////////////////////*/

    function _initializeAssetProfiles() internal {
        // STABLE: Stablecoin pairs (USDC/USDT, DAI/USDC)
        // Tight spreads, low fees - these should be cheap to trade
        assetProfiles[AssetClass.STABLE] = AssetProfile({
            baseFee: 100, // 0.01%
            maxFee: 1000, // 0.10%
            lowVolThreshold: 10, // 0.1% volatility
            highVolThreshold: 50, // 0.5% volatility
            feeMultiplier: 100, // Aggressive scaling on depeg
            enabled: true
        });

        // BLUE_CHIP: Major assets (ETH, BTC, major L1 tokens)
        // Moderate fees, reasonable spreads
        assetProfiles[AssetClass.BLUE_CHIP] = AssetProfile({
            baseFee: 500, // 0.05%
            maxFee: 5000, // 0.50%
            lowVolThreshold: 100, // 1% volatility
            highVolThreshold: 500, // 5% volatility
            feeMultiplier: 50,
            enabled: true
        });

        // VOLATILE: Default for most pairs
        // Standard DynamicSwap behavior
        assetProfiles[AssetClass.VOLATILE] = AssetProfile({
            baseFee: 3000, // 0.30%
            maxFee: 10000, // 1.00%
            lowVolThreshold: 200, // 2% volatility
            highVolThreshold: 1000, // 10% volatility
            feeMultiplier: 50,
            enabled: true
        });

        // LONG_TAIL: Low-cap tokens, memecoins
        // Highest fees for maximum LP protection
        assetProfiles[AssetClass.LONG_TAIL] = AssetProfile({
            baseFee: 5000, // 0.50%
            maxFee: 30000, // 3.00%
            lowVolThreshold: 500, // 5% volatility
            highVolThreshold: 2000, // 20% volatility
            feeMultiplier: 100, // Aggressive scaling
            enabled: true
        });

        // RWA: Real World Assets (tokenized securities, commodities)
        // Conservative, predictable fees
        assetProfiles[AssetClass.RWA] = AssetProfile({
            baseFee: 1000, // 0.10%
            maxFee: 5000, // 0.50%
            lowVolThreshold: 50, // 0.5% volatility
            highVolThreshold: 200, // 2% volatility
            feeMultiplier: 30,
            enabled: true
        });

        // CUSTOM: Placeholder for user-defined
        assetProfiles[AssetClass.CUSTOM] = AssetProfile({
            baseFee: 3000,
            maxFee: 10000,
            lowVolThreshold: 200,
            highVolThreshold: 1000,
            feeMultiplier: 50,
            enabled: true
        });
    }

    /*//////////////////////////////////////////////////////////////
                          HOOK CALLBACKS
    //////////////////////////////////////////////////////////////*/

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

    /// @notice Register pool with default VOLATILE asset class
    function afterInitialize(
        address,
        PoolKey calldata key,
        uint160 sqrtPriceX96,
        int24
    ) external onlyPoolManager returns (bytes4) {
        PoolId poolId = key.toId();

        // Default to VOLATILE asset class
        AssetProfile memory profile = assetProfiles[AssetClass.VOLATILE];

        poolConfigs[poolId] = PoolConfig({
            assetClass: AssetClass.VOLATILE,
            baseFee: profile.baseFee,
            maxFee: profile.maxFee,
            lastSqrtPriceX96: sqrtPriceX96,
            lastTimestamp: uint32(block.timestamp),
            volatility: 0,
            totalVolume: 0,
            totalFeesGenerated: 0,
            initialized: true
        });

        emit PoolRegistered(
            poolId,
            AssetClass.VOLATILE,
            profile.baseFee,
            profile.maxFee
        );
        return IHooks.afterInitialize.selector;
    }

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

    /// @notice Calculate and return dynamic fee based on asset class
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

        uint24 dynamicFee = _calculateDynamicFeeV2(config);

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
        uint24 currentFee = _calculateDynamicFeeV2(config);
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
        uint256 annualizedChange = (priceChange * 31536000) / timeDelta;

        uint256 oldVolatility = config.volatility;
        uint256 newVolatility = ((annualizedChange *
            volatilityParams.ewmaAlpha) +
            (oldVolatility * (10000 - volatilityParams.ewmaAlpha))) / 10000;

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

    /// @notice V2 fee calculation using asset class profiles
    function _calculateDynamicFeeV2(
        PoolConfig storage config
    ) internal view returns (uint24) {
        AssetProfile memory profile = assetProfiles[config.assetClass];

        uint256 volatility = config.volatility;
        uint256 fee;

        if (volatility <= profile.lowVolThreshold) {
            // Low volatility: use base fee
            fee = config.baseFee;
        } else if (volatility >= profile.highVolThreshold) {
            // High volatility: use max fee
            fee = config.maxFee;
        } else {
            // Linear interpolation between low and high thresholds
            uint256 range = profile.highVolThreshold - profile.lowVolThreshold;
            uint256 volAboveLow = volatility - profile.lowVolThreshold;
            uint256 feeRange = config.maxFee - config.baseFee;

            fee = config.baseFee + (feeRange * volAboveLow) / range;
        }

        if (fee > config.maxFee) fee = config.maxFee;
        return uint24(fee);
    }

    /*//////////////////////////////////////////////////////////////
                            ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Set asset class for a specific pool
    function setPoolAssetClass(
        PoolKey calldata key,
        AssetClass newClass
    ) external onlyOwner {
        PoolId poolId = key.toId();
        PoolConfig storage config = poolConfigs[poolId];
        if (!config.initialized) revert PoolNotInitialized();

        AssetClass oldClass = config.assetClass;
        AssetProfile memory profile = assetProfiles[newClass];

        config.assetClass = newClass;
        config.baseFee = profile.baseFee;
        config.maxFee = profile.maxFee;

        emit PoolAssetClassChanged(poolId, oldClass, newClass);
    }

    /// @notice Update an asset profile's parameters
    function setAssetProfile(
        AssetClass assetClass,
        uint24 baseFee,
        uint24 maxFee,
        uint256 lowVolThreshold,
        uint256 highVolThreshold,
        uint256 feeMultiplier
    ) external onlyOwner {
        if (baseFee < MIN_FEE || maxFee > MAX_FEE || baseFee >= maxFee)
            revert InvalidFeeRange();

        assetProfiles[assetClass] = AssetProfile({
            baseFee: baseFee,
            maxFee: maxFee,
            lowVolThreshold: lowVolThreshold,
            highVolThreshold: highVolThreshold,
            feeMultiplier: feeMultiplier,
            enabled: true
        });

        emit AssetProfileUpdated(assetClass, baseFee, maxFee);
    }

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

    function setProtocolShare(uint256 newShareBps) external onlyOwner {
        if (newShareBps > MAX_PROTOCOL_SHARE) revert InvalidProtocolShare();
        uint256 oldShare = protocolShareBps;
        protocolShareBps = newShareBps;
        emit ProtocolShareUpdated(oldShare, newShareBps);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    function withdrawFees(Currency currency) external nonReentrant {
        uint256 amount = accumulatedFees[currency];
        if (amount == 0) return;

        accumulatedFees[currency] = 0;

        address tokenAddr = Currency.unwrap(currency);
        if (tokenAddr == address(0)) {
            (bool success, ) = treasury.call{value: amount}("");
            if (!success) revert WithdrawFailed();
        } else {
            IERC20(tokenAddr).safeTransfer(treasury, amount);
        }

        emit FeesWithdrawn(treasury, currency, amount);
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getPoolConfig(
        PoolId poolId
    ) external view returns (PoolConfig memory) {
        return poolConfigs[poolId];
    }

    function getAssetProfile(
        AssetClass assetClass
    ) external view returns (AssetProfile memory) {
        return assetProfiles[assetClass];
    }

    function getCurrentFee(
        PoolKey calldata key
    ) external view returns (uint24) {
        PoolConfig storage config = poolConfigs[key.toId()];
        if (!config.initialized) return 3000;
        return _calculateDynamicFeeV2(config);
    }

    function getVolatility(
        PoolKey calldata key
    ) external view returns (uint256) {
        return poolConfigs[key.toId()].volatility;
    }

    function getPoolAssetClass(
        PoolKey calldata key
    ) external view returns (AssetClass) {
        return poolConfigs[key.toId()].assetClass;
    }

    function getProtocolStats()
        external
        view
        returns (uint256, uint256, uint256)
    {
        return (totalProtocolRevenue, totalVolumeProcessed, protocolShareBps);
    }

    function getPoolStats(
        PoolKey calldata key
    )
        external
        view
        returns (
            uint256 volume,
            uint256 fees,
            uint256 volatility,
            uint24 currentFee,
            AssetClass assetClass
        )
    {
        PoolConfig storage config = poolConfigs[key.toId()];
        return (
            config.totalVolume,
            config.totalFeesGenerated,
            config.volatility,
            _calculateDynamicFeeV2(config),
            config.assetClass
        );
    }

    receive() external payable {}
}
