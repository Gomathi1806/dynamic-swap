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
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title DynamicFeeHook
/// @notice Uniswap V4 hook that automatically adjusts swap fees based on market volatility
/// @dev Earns protocol revenue from the dynamic fee spread
contract DynamicFeeHook is IHooks, Ownable, ReentrancyGuard {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    using LPFeeLibrary for uint24;

    // ============ Errors ============
    error InvalidFeeRange();
    error InvalidProtocolShare();
    error WithdrawFailed();
    error PoolNotInitialized();
    error NotPoolManager();
    error ZeroAddress();

    // ============ Events ============
    event PoolInitialized(bytes32 indexed poolId, uint160 sqrtPriceX96);
    event DynamicFeeUpdated(bytes32 indexed poolId, uint24 dynamicFee, uint256 volatility);
    event VolatilityParamsUpdated(uint256 ewmaAlpha, uint256 volatilityWindow, uint256 feeMultiplier);
    event ProtocolShareUpdated(uint256 newShare);
    event TreasuryUpdated(address indexed newTreasury);
    event FeesCollected(address indexed token, uint256 amount);

    // ============ Constants ============
    uint24 public constant MIN_FEE = 100;      // 0.01% minimum
    uint24 public constant MAX_FEE = 10000;    // 1.00% maximum
    uint256 public constant MAX_PROTOCOL_SHARE = 5000; // 50% max
    uint256 public constant BPS_DENOMINATOR = 10000;

    // ============ State Variables ============
    IPoolManager public immutable poolManager;
    address public treasury;
    uint256 public protocolShareBps = 1000; // 10% default

    struct VolatilityParams {
        uint256 ewmaAlpha;        // Weight for new observations (in bps)
        uint256 volatilityWindow; // Time window for volatility calculation
        uint256 feeMultiplier;    // Fee adjustment multiplier
    }
    VolatilityParams public volatilityParams;

    struct PoolState {
        uint160 lastSqrtPriceX96;
        uint256 lastTimestamp;
        uint256 ewmaVolatility;
        bool initialized;
    }
    mapping(bytes32 => PoolState) public poolStates;

    // ============ Constructor ============
    /// @notice Deploys the DynamicFeeHook
    /// @param _poolManager The Uniswap V4 PoolManager address
    /// @param _treasury The address to receive protocol fees
    constructor(
        IPoolManager _poolManager,
        address _treasury
    ) Ownable(msg.sender) {
        if (address(_poolManager) == address(0)) revert ZeroAddress();
        if (_treasury == address(0)) revert ZeroAddress();
        
        poolManager = _poolManager;
        treasury = _treasury;
        
        volatilityParams = VolatilityParams({
            ewmaAlpha: 2000,      // 20% weight to new observations
            volatilityWindow: 300, // 5 minute window
            feeMultiplier: 50     // 0.5 bps per volatility point
        });
    }

    // ============ Hook Permissions ============
    function getHookPermissions() public pure returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: true,
            afterInitialize: true,
            beforeAddLiquidity: true,
            afterAddLiquidity: true,
            beforeRemoveLiquidity: true,
            afterRemoveLiquidity: true,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // ============ Hook Callbacks ============
    function beforeInitialize(
        address,
        PoolKey calldata key,
        uint160 sqrtPriceX96
    ) external returns (bytes4) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        
        bytes32 poolId = key.toId();
        poolStates[poolId] = PoolState({
            lastSqrtPriceX96: sqrtPriceX96,
            lastTimestamp: block.timestamp,
            ewmaVolatility: 0,
            initialized: true
        });
        
        emit PoolInitialized(poolId, sqrtPriceX96);
        return IHooks.beforeInitialize.selector;
    }

    function afterInitialize(
        address,
        PoolKey calldata,
        uint160,
        int24
    ) external pure returns (bytes4) {
        return IHooks.afterInitialize.selector;
    }

    function beforeSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata,
        bytes calldata
    ) external returns (bytes4, BeforeSwapDelta, uint24) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        
        bytes32 poolId = key.toId();
        PoolState storage state = poolStates[poolId];
        
        if (!state.initialized) revert PoolNotInitialized();

        // Calculate dynamic fee based on volatility
        uint24 dynamicFee = _calculateDynamicFee(poolId);
        
        emit DynamicFeeUpdated(poolId, dynamicFee, state.ewmaVolatility);
        
        return (
            IHooks.beforeSwap.selector,
            BeforeSwapDeltaLibrary.ZERO_DELTA,
            dynamicFee | LPFeeLibrary.OVERRIDE_FEE_FLAG
        );
    }

    function afterSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata,
        BalanceDelta,
        bytes calldata
    ) external returns (bytes4, int128) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        
        bytes32 poolId = key.toId();
        _updateVolatility(poolId);
        
        return (IHooks.afterSwap.selector, 0);
    }

    function beforeAddLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external pure returns (bytes4) {
        return IHooks.beforeAddLiquidity.selector;
    }

    function afterAddLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure returns (bytes4, BalanceDelta) {
        return (IHooks.afterAddLiquidity.selector, BalanceDelta.wrap(0));
    }

    function beforeRemoveLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external pure returns (bytes4) {
        return IHooks.beforeRemoveLiquidity.selector;
    }

    function afterRemoveLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure returns (bytes4, BalanceDelta) {
        return (IHooks.afterRemoveLiquidity.selector, BalanceDelta.wrap(0));
    }

    // ============ Internal Functions ============
    function _calculateDynamicFee(bytes32 poolId) internal view returns (uint24) {
        PoolState storage state = poolStates[poolId];
        
        // Base fee + volatility adjustment
        uint256 volatilityFee = (state.ewmaVolatility * volatilityParams.feeMultiplier) / BPS_DENOMINATOR;
        uint256 totalFee = MIN_FEE + volatilityFee;
        
        // Clamp to valid range
        if (totalFee > MAX_FEE) totalFee = MAX_FEE;
        if (totalFee < MIN_FEE) totalFee = MIN_FEE;
        
        return uint24(totalFee);
    }

    function _updateVolatility(bytes32 poolId) internal {
        PoolState storage state = poolStates[poolId];
        
        (uint160 currentSqrtPriceX96,,,) = poolManager.getSlot0(poolId);
        
        if (state.lastTimestamp > 0 && block.timestamp > state.lastTimestamp) {
            // Calculate price change
            uint256 priceDelta;
            if (currentSqrtPriceX96 > state.lastSqrtPriceX96) {
                priceDelta = uint256(currentSqrtPriceX96 - state.lastSqrtPriceX96);
            } else {
                priceDelta = uint256(state.lastSqrtPriceX96 - currentSqrtPriceX96);
            }
            
            // Normalize by last price (in bps)
            uint256 priceChangeBps = (priceDelta * BPS_DENOMINATOR) / state.lastSqrtPriceX96;
            
            // Update EWMA volatility
            uint256 alpha = volatilityParams.ewmaAlpha;
            state.ewmaVolatility = (alpha * priceChangeBps + (BPS_DENOMINATOR - alpha) * state.ewmaVolatility) / BPS_DENOMINATOR;
        }
        
        state.lastSqrtPriceX96 = currentSqrtPriceX96;
        state.lastTimestamp = block.timestamp;
    }

    // ============ View Functions ============
    function getCurrentFee(bytes32 poolId) external view returns (uint24) {
        return _calculateDynamicFee(poolId);
    }

    function getPoolVolatility(bytes32 poolId) external view returns (uint256) {
        return poolStates[poolId].ewmaVolatility;
    }

    // ============ Admin Functions ============
    function setVolatilityParams(
        uint256 _ewmaAlpha,
        uint256 _volatilityWindow,
        uint256 _feeMultiplier
    ) external onlyOwner {
        volatilityParams = VolatilityParams({
            ewmaAlpha: _ewmaAlpha,
            volatilityWindow: _volatilityWindow,
            feeMultiplier: _feeMultiplier
        });
        emit VolatilityParamsUpdated(_ewmaAlpha, _volatilityWindow, _feeMultiplier);
    }

    function setProtocolShare(uint256 _newShare) external onlyOwner {
        if (_newShare > MAX_PROTOCOL_SHARE) revert InvalidProtocolShare();
        protocolShareBps = _newShare;
        emit ProtocolShareUpdated(_newShare);
    }

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function withdrawFees(address token) external nonReentrant {
        uint256 balance;
        if (token == address(0)) {
            balance = address(this).balance;
            if (balance > 0) {
                (bool success,) = treasury.call{value: balance}("");
                if (!success) revert WithdrawFailed();
            }
        } else {
            balance = IERC20(token).balanceOf(address(this));
            if (balance > 0) {
                IERC20(token).transfer(treasury, balance);
            }
        }
        emit FeesCollected(token, balance);
    }

    receive() external payable {}
}
