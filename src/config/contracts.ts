// src/config/contracts.ts
// Updated: March 14, 2026
// DynamicSwap Multi-Chain Configuration

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorer: string;
  hook: `0x${string}`;
  poolManager: `0x${string}`;
  positionManager: `0x${string}`;
  permit2: `0x${string}`;
  quoter: `0x${string}`;
  stateView: `0x${string}`;
  universalRouter: `0x${string}`;
  tokens: {
    token0: {
      address: `0x${string}`;
      symbol: string;
      decimals: number;
      name: string;
    };
    token1: {
      address: `0x${string}`;
      symbol: string;
      decimals: number;
      name: string;
    };
  };
  poolKey: {
    fee: number;
    tickSpacing: number;
  };
}

export const SUPPORTED_CHAINS: Record<number, ChainConfig> = {
  // Base Mainnet
  8453: {
    chainId: 8453,
    name: "Base",
    rpcUrl: "https://mainnet.base.org",
    explorer: "https://basescan.org",
    hook: "0xCED22Ff119c151b9CaD797941dAC215B67E5b0c0",
    poolManager: "0x498581fF718922c3f8e6A244956aF099B2652b2b",
    positionManager: "0x7C5f5A4bBd8fD63184577525326123B519429bDc",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    quoter: "0x0d5e0f971ed27fbff6c2837bf31316121532048d",
    stateView: "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71",
    universalRouter: "0x6ff5693b99212da76ad316178a184ab56d299b43",
    tokens: {
      token0: {
        address: "0x4200000000000000000000000000000000000006",
        symbol: "WETH",
        decimals: 18,
        name: "Wrapped Ether",
      },
      token1: {
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        symbol: "USDC",
        decimals: 6,
        name: "USD Coin",
      },
    },
    poolKey: {
      fee: 0x800000,
      tickSpacing: 200,
    },
  },

  // Optimism Mainnet
  10: {
    chainId: 10,
    name: "Optimism",
    rpcUrl: "https://mainnet.optimism.io",
    explorer: "https://optimistic.etherscan.io",
    hook: "0xFefcBfDa5342E8e4d1Cb882D01dFb17779B330C0",
    poolManager: "0x9a13F98Cb987694C9F086b1F5eB990EeA8264Ec3",
    positionManager: "0x3C3Ea4B57a46241e54610e5f022E5c45859A1017",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    quoter: "0x1f3131a13296fb91c90870043742c3cdbff1a8d7",
    stateView: "0xc18a3169788f4f75a170290584eca6395c75ecdb",
    universalRouter: "0x851116d9223fabed8e56c0e6b8ad0c31d98b3507",
    tokens: {
      token0: {
        address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
        symbol: "USDC",
        decimals: 6,
        name: "USD Coin",
      },
      token1: {
        address: "0x4200000000000000000000000000000000000006",
        symbol: "WETH",
        decimals: 18,
        name: "Wrapped Ether",
      },
    },
    poolKey: {
      fee: 0x800000,
      tickSpacing: 200,
    },
  },

  // Unichain Mainnet
  130: {
    chainId: 130,
    name: "Unichain",
    rpcUrl: "https://mainnet.unichain.org",
    explorer: "https://uniscan.xyz",
    hook: "0xca5d18d24A62Bbe924Ba615F85e4Ac95377e30C0",
    poolManager: "0x1F98400000000000000000000000000000000004",
    positionManager: "0x4529A01c7A0410167c5740C487A8DE60232617bf",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    quoter: "0x333e3c607b141b18ff6de9f258db6e77fe7491e0",
    stateView: "0x86e8631a016f9068c3f085faf484ee3f5fdee8f2",
    universalRouter: "0xef740bf23acae26f6492b10de645d6b98dc8eaf3",
    tokens: {
      token0: {
        address: "0x078D782b760474a361dDA0AF3839290b0EF57AD6",
        symbol: "USDC",
        decimals: 6,
        name: "USD Coin",
      },
      token1: {
        address: "0x4200000000000000000000000000000000000006",
        symbol: "WETH",
        decimals: 18,
        name: "Wrapped Ether",
      },
    },
    poolKey: {
      fee: 0x800000,
      tickSpacing: 200,
    },
  },

  // Celo Mainnet
  42220: {
    chainId: 42220,
    name: "Celo",
    rpcUrl: "https://forno.celo.org",
    explorer: "https://celoscan.io",
    hook: "0x7E2873516C7344Bfe201f981d0A7Bb6A6dEBf0c0",
    poolManager: "0x288dc841A52FCA2707c6947B3A777c5E56cd87BC",
    positionManager: "0xf7965f3981e4D5BC383BfBCb61501763e9068CA9",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    quoter: "0x28566da1093609182dff2cb2a91cfd72e61d66cd",
    stateView: "0xbc21f8720babf4b20d195ee5c6e99c52b76f2bfb",
    universalRouter: "0xcb695bc5d3aa22cad1e6df07801b061a05a0233a",
    tokens: {
      token0: {
        address: "0x471EcE3750Da237f93B8E339c536989b8978a438",
        symbol: "CELO",
        decimals: 18,
        name: "Celo",
      },
      token1: {
        address: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
        symbol: "cUSD",
        decimals: 18,
        name: "Celo Dollar",
      },
    },
    poolKey: {
      fee: 0x800000,
      tickSpacing: 200,
    },
  },
};

// Default chain
export const DEFAULT_CHAIN_ID = 8453; // Base

// Helper functions
export function getChainConfig(chainId: number): ChainConfig | undefined {
  return SUPPORTED_CHAINS[chainId];
}

export function getSupportedChainIds(): number[] {
  return Object.keys(SUPPORTED_CHAINS).map(Number);
}

export function isChainSupported(chainId: number): boolean {
  return chainId in SUPPORTED_CHAINS;
}

// Hook ABI for reading dynamic fee
export const DYNAMIC_FEE_HOOK_ABI = [
  {
    inputs: [],
    name: "getCurrentVolatility",
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getCurrentFee",
    outputs: [{ type: "uint24", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "lastPrice",
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "ewmaVolatility",
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "MIN_FEE",
    outputs: [{ type: "uint24", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "MAX_FEE",
    outputs: [{ type: "uint24", name: "" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Pool Manager ABI for pool operations
export const POOL_MANAGER_ABI = [
  {
    inputs: [{ type: "bytes32", name: "poolId" }],
    name: "getSlot0",
    outputs: [
      { type: "uint160", name: "sqrtPriceX96" },
      { type: "int24", name: "tick" },
      { type: "uint24", name: "protocolFee" },
      { type: "uint24", name: "lpFee" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
