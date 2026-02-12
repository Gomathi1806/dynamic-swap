export const DynamicFeeHookABI = [
  {
    "inputs": [
      { "internalType": "contract IPoolManager", "name": "_poolManager", "type": "address" },
      { "internalType": "address", "name": "_treasury", "type": "address" }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  { "inputs": [], "name": "InvalidFeeRange", "type": "error" },
  { "inputs": [], "name": "InvalidProtocolShare", "type": "error" },
  { "inputs": [], "name": "NotPoolManager", "type": "error" },
  { "inputs": [], "name": "PoolNotInitialized", "type": "error" },
  { "inputs": [], "name": "WithdrawFailed", "type": "error" },
  { "inputs": [], "name": "ZeroAddress", "type": "error" },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "poolId", "type": "bytes32" },
      { "indexed": false, "internalType": "uint24", "name": "dynamicFee", "type": "uint24" },
      { "indexed": false, "internalType": "uint256", "name": "volatility", "type": "uint256" }
    ],
    "name": "DynamicFeeUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "previousOwner", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "newOwner", "type": "address" }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "poolId", "type": "bytes32" },
      { "indexed": false, "internalType": "uint160", "name": "sqrtPriceX96", "type": "uint160" }
    ],
    "name": "PoolInitialized",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": false, "internalType": "uint256", "name": "newShare", "type": "uint256" }
    ],
    "name": "ProtocolShareUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "newTreasury", "type": "address" }
    ],
    "name": "TreasuryUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": false, "internalType": "uint256", "name": "ewmaAlpha", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "volatilityWindow", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "feeMultiplier", "type": "uint256" }
    ],
    "name": "VolatilityParamsUpdated",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "MAX_FEE",
    "outputs": [{ "internalType": "uint24", "name": "", "type": "uint24" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MAX_PROTOCOL_SHARE",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MIN_FEE",
    "outputs": [{ "internalType": "uint24", "name": "", "type": "uint24" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "poolId", "type": "bytes32" }],
    "name": "getCurrentFee",
    "outputs": [{ "internalType": "uint24", "name": "", "type": "uint24" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "poolId", "type": "bytes32" }],
    "name": "getPoolVolatility",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getHookPermissions",
    "outputs": [
      {
        "components": [
          { "internalType": "bool", "name": "beforeInitialize", "type": "bool" },
          { "internalType": "bool", "name": "afterInitialize", "type": "bool" },
          { "internalType": "bool", "name": "beforeAddLiquidity", "type": "bool" },
          { "internalType": "bool", "name": "afterAddLiquidity", "type": "bool" },
          { "internalType": "bool", "name": "beforeRemoveLiquidity", "type": "bool" },
          { "internalType": "bool", "name": "afterRemoveLiquidity", "type": "bool" },
          { "internalType": "bool", "name": "beforeSwap", "type": "bool" },
          { "internalType": "bool", "name": "afterSwap", "type": "bool" },
          { "internalType": "bool", "name": "beforeDonate", "type": "bool" },
          { "internalType": "bool", "name": "afterDonate", "type": "bool" },
          { "internalType": "bool", "name": "beforeSwapReturnDelta", "type": "bool" },
          { "internalType": "bool", "name": "afterSwapReturnDelta", "type": "bool" },
          { "internalType": "bool", "name": "afterAddLiquidityReturnDelta", "type": "bool" },
          { "internalType": "bool", "name": "afterRemoveLiquidityReturnDelta", "type": "bool" }
        ],
        "internalType": "struct Hooks.Permissions",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "poolManager",
    "outputs": [{ "internalType": "contract IPoolManager", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "protocolShareBps",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "renounceOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_newShare", "type": "uint256" }],
    "name": "setProtocolShare",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "_treasury", "type": "address" }],
    "name": "setTreasury",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "_ewmaAlpha", "type": "uint256" },
      { "internalType": "uint256", "name": "_volatilityWindow", "type": "uint256" },
      { "internalType": "uint256", "name": "_feeMultiplier", "type": "uint256" }
    ],
    "name": "setVolatilityParams",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "newOwner", "type": "address" }],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "treasury",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "volatilityParams",
    "outputs": [
      { "internalType": "uint256", "name": "ewmaAlpha", "type": "uint256" },
      { "internalType": "uint256", "name": "volatilityWindow", "type": "uint256" },
      { "internalType": "uint256", "name": "feeMultiplier", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "token", "type": "address" }],
    "name": "withdrawFees",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;
