
export const CONTRACTS = {
  // Base Mainnet (Chain ID: 8453)
  base: {
    chainId: 8453,
    name: "Base",
    hookAddress: "0x14a8bf1bb6419bed0986a4c32f8cd6341744e0c0", // NEW!
    poolManager: "0x498581fF718922c3f8e6A244956aF099B2652b2b",
    positionManager: "0x7C5f5A4bBd8fD63184577525326123B519429bDc",
    universalRouter: "0x6fF5693b99212Da76ad316178A184AB56D299b43",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    stateView: "0xA3c0c9b65baD0b08107Aa264b0f3dB444b867A71",
    quoter: "0x0d5e0F971ED27FBfF6c2837bf31316121532048D",
    rpcUrl: "https://mainnet.base.org",
    explorer: "https://basescan.org",
    owner: "0x22bc13d2936f738bc820A6934FA8eC60EA51a621",
    tickSpacing: 200, // ADD THIS!
  },

  // Celo Mainnet (Chain ID: 42220)
  celo: {
    chainId: 42220,
    name: "Celo",
    hookAddress: "0xe96B2C7416596fE707ba40379B909F42F18d7FC0", // Already correct
    poolManager: "0x288dc841A52FCA2707c6947B3A777c5E56cd87BC",
    positionManager: "0xf7965f3981e4d5bc383bfbcb61501763e9068ca9",
    universalRouter: "0x643770e279d5d0733f21d6dc03a8efbabf3255b4",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    stateView: "0xCb6367bAedFC2C53C7fdd9e08da492Be8a6984D7",
    quoter: "0x3012F791C57528953696bDa2D00d7Ab05f900b29",
    rpcUrl: "https://forno.celo.org",
    explorer: "https://celoscan.io",
    owner: "0x22bc13d2936f738bc820A6934FA8eC60EA51a621",
    tickSpacing: 200,
  },

  // Optimism Mainnet (Chain ID: 10)
  optimism: {
    chainId: 10,
    name: "Optimism",
    hookAddress: "0xb5E6D6cb548033dA8F18e7f177a9aE485d81a0c0", // NEW!
    poolManager: "0x9a13F98Cb987694C9F086b1F5eB990EeA8264Ec3",
    positionManager: "0x3c3Ea4B57a46241e54610e5f022E5c45859a1017",
    universalRouter: "0x851116D9223FABeD8E56c0E6b8Ad0c31D98b3507",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    stateView: "0xc18a73BA321B20844Fa123f7D97aCD5CC46527FA",
    quoter: "0x1f3131a13296FB91c90870043742C3cdBFCe5c9a",
    rpcUrl: "https://mainnet.optimism.io",
    explorer: "https://optimistic.etherscan.io",
    owner: "0x22bc13d2936f738bc820A6934FA8eC60EA51a621",
    tickSpacing: 200,
  },
};


  // Celo Mainnet (Chain ID: 42220)
interface ChainConfig {
  chainId: number;
  name: string;
  hookAddress: string;
  poolManager: string;
  positionManager: string;
  universalRouter: string;
  permit2: string;
  stateView: string;
  quoter: string;
  rpcUrl: string;
  explorer: string;
  owner: string;
  tickSpacing: number;  // ADD THIS
}

  

// Owner wallet address
export const OWNER_ADDRESS = "0x22bc13d2936f738bc820A6934FA8eC60EA51a621";

// Comprehensive token lists by chain
export const TOKENS = {
  base: {
    // Native & Wrapped
    ETH: { address: "0x0000000000000000000000000000000000000000", symbol: "ETH", decimals: 18, name: "Ether" },
    WETH: { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18, name: "Wrapped Ether" },
    
    // Stablecoins
    USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6, name: "USD Coin" },
    USDbC: { address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", symbol: "USDbC", decimals: 6, name: "USD Base Coin" },
    DAI: { address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", symbol: "DAI", decimals: 18, name: "Dai Stablecoin" },
    USDT: { address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", symbol: "USDT", decimals: 6, name: "Tether USD" },
    
    // DeFi Tokens
    cbETH: { address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", symbol: "cbETH", decimals: 18, name: "Coinbase Wrapped Staked ETH" },
    rETH: { address: "0xB6fe221Fe9EeF5aBa221c348bA20A1Bf5e73624c", symbol: "rETH", decimals: 18, name: "Rocket Pool ETH" },
    wstETH: { address: "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452", symbol: "wstETH", decimals: 18, name: "Wrapped stETH" },
    
    // Popular Tokens
    AERO: { address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631", symbol: "AERO", decimals: 18, name: "Aerodrome" },
    BRETT: { address: "0x532f27101965dd16442E59d40670FaF5eBB142E4", symbol: "BRETT", decimals: 18, name: "Brett" },
    DEGEN: { address: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed", symbol: "DEGEN", decimals: 18, name: "Degen" },
    TOSHI: { address: "0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4", symbol: "TOSHI", decimals: 18, name: "Toshi" },
  },
  
  celo: {
    // Native & Wrapped
    CELO: { address: "0x0000000000000000000000000000000000000000", symbol: "CELO", decimals: 18, name: "Celo" },
    
    // Celo Stablecoins
    cUSD: { address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", symbol: "cUSD", decimals: 18, name: "Celo Dollar" },
    cEUR: { address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", symbol: "cEUR", decimals: 18, name: "Celo Euro" },
    cREAL: { address: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787", symbol: "cREAL", decimals: 18, name: "Celo Brazilian Real" },
    
    // Bridged Stablecoins
    USDC: { address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", symbol: "USDC", decimals: 6, name: "USD Coin" },
    USDT: { address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", symbol: "USDT", decimals: 6, name: "Tether USD" },
    DAI: { address: "0xE4fE50cdD716522A56204352f00AA110F731932d", symbol: "DAI", decimals: 18, name: "Dai Stablecoin" },
    
    // Bridged Assets
    WETH: { address: "0x66803FB87aBd4aaC3cbB3fAd7C3aa01f6F3FB207", symbol: "WETH", decimals: 18, name: "Wrapped Ether" },
    WBTC: { address: "0xBAAB46E28388d2779e6E31Fd00cF0e5Ad95E327B", symbol: "WBTC", decimals: 8, name: "Wrapped Bitcoin" },
    
    // Celo Ecosystem
    UBE: { address: "0x00Be915B9dCf56a3CBE739D9B9c202ca692409EC", symbol: "UBE", decimals: 18, name: "Ubeswap" },
    PACT: { address: "0x46c9757C5497c5B1f2eb73aE79b6B67D119B0B58", symbol: "PACT", decimals: 18, name: "impactMarket" },
  },
  
  unichain: {
    // Native & Wrapped
    ETH: { address: "0x0000000000000000000000000000000000000000", symbol: "ETH", decimals: 18, name: "Ether" },
    WETH: { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18, name: "Wrapped Ether" },
    
    // Stablecoins
    USDC: { address: "0x078D782b760474a361dDA0AF3839290b0EF57AD6", symbol: "USDC", decimals: 6, name: "USD Coin" },
    USDT: { address: "0x588CE4F028D8e7B53B687865d6A67b3A54C75518", symbol: "USDT", decimals: 6, name: "Tether USD" },
    DAI: { address: "0x20CAb320A855b39F724131C69424F4dEB5d20e02", symbol: "DAI", decimals: 18, name: "Dai Stablecoin" },
    
    // Other Tokens (add more as they become available on Unichain)
    UNI: { address: "0x8f187aA05619a017077f5308904739877ce9eA21", symbol: "UNI", decimals: 18, name: "Uniswap" },
    WBTC: { address: "0x927B51f251480d4D935deB5741b126a590B24F40", symbol: "WBTC", decimals: 8, name: "Wrapped Bitcoin" },
  },
};

// Get contract config by chain ID
export function getContractsByChainId(chainId: number) {
  return Object.values(CONTRACTS).find((c) => c.chainId === chainId);
}

// Get tokens by chain ID
export function getTokensByChainId(chainId: number) {
  const chain = Object.entries(CONTRACTS).find(([_, c]) => c.chainId === chainId);
  if (!chain) return null;
  return TOKENS[chain[0] as keyof typeof TOKENS];
}

// Check if address is owner
export function isOwner(address: string | undefined): boolean {
  if (!address) return false;
  return address.toLowerCase() === OWNER_ADDRESS.toLowerCase();
}

// Get token by address
export function getTokenByAddress(chainId: number, address: string) {
  const tokens = getTokensByChainId(chainId);
  if (!tokens) return null;
  return Object.values(tokens).find(
    (t) => t.address.toLowerCase() === address.toLowerCase()
  );
}
