// src/config/contracts.ts

export interface ChainConfig {
  chainId: number;
  name: string;
  hookAddress: string;
  poolManager: string;
  positionManager: string;
  permit2: string;
  rpcUrl: string;
  explorer: string;
}

export const SUPPORTED_CHAINS: Record<number, ChainConfig> = {
  8453: {
    chainId: 8453,
    name: "Base",
    hookAddress: "0x14a8bf1bb6419bed0986a4c32f8cd6341744e0c0",
    poolManager: "0x498581fF718922c3f8e6A244956aF099B2652b2b",
    positionManager: "0x7C5f5A4bBd8fD63184577525326123B519429bDc",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    rpcUrl: "https://mainnet.base.org",
    explorer: "https://basescan.org",
  },
  10: {
    chainId: 10,
    name: "Optimism",
    hookAddress: "0xb5E6D6cb548033dA8F18e7f177a9aE485d81a0c0",
    poolManager: "0x9a13F98Cb987694C9F086b1F5eB990EeA8264Ec3",
    positionManager: "0x3c3Ea4B57a46241e54610e5f022E5c45859a1017",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    rpcUrl: "https://mainnet.optimism.io",
    explorer: "https://optimistic.etherscan.io",
  },
  42220: {
    chainId: 42220,
    name: "Celo",
    hookAddress: "0xe96B2C7416596fE707ba40379B909F42F18d7FC0",
    poolManager: "0x288dc841A52FCA2707c6947B3A777c5E56cd87BC",
    positionManager: "0xf7965f3981e4D5BC383BfBCb61501763e9068CA9",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    rpcUrl: "https://forno.celo.org",
    explorer: "https://celoscan.io",
  },
};

export function getChainConfig(chainId: number): ChainConfig | null {
  return SUPPORTED_CHAINS[chainId] || null;
}
