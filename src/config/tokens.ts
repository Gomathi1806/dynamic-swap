// src/config/tokens.ts

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

// Common tokens per chain
export const TOKENS: Record<number, Token[]> = {
  // Base
  8453: [
    { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", name: "Wrapped Ether", decimals: 18 },
    { address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", symbol: "USDC", name: "USD Coin", decimals: 6 },
    { address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", symbol: "DAI", name: "Dai", decimals: 18 },
  ],
  // Optimism
  10: [
    { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", name: "Wrapped Ether", decimals: 18 },
    { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", symbol: "USDC", name: "USD Coin", decimals: 6 },
    { address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", symbol: "USDT", name: "Tether", decimals: 6 },
    { address: "0x4200000000000000000000000000000000000042", symbol: "OP", name: "Optimism", decimals: 18 },
  ],
  // Celo
  42220: [
    { address: "0x471EcE3750Da237f93B8E339c536989b8978a438", symbol: "CELO", name: "Celo", decimals: 18 },
    { address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", symbol: "cUSD", name: "Celo Dollar", decimals: 18 },
    { address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", symbol: "cEUR", name: "Celo Euro", decimals: 18 },
    { address: "0x66803FB87aBd4aaC3cbB3fAD7C3aa01f6F3FB207", symbol: "WBTC", name: "Wrapped Bitcoin", decimals: 8 },
  ],
};

export function getTokensForChain(chainId: number): Token[] {
  return TOKENS[chainId] || [];
}

export function findToken(chainId: number, address: string): Token | undefined {
  return TOKENS[chainId]?.find(t => t.address.toLowerCase() === address.toLowerCase());
}
