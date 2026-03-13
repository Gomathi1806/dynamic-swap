// src/hooks/usePoolDiscovery.ts
"use client";

import { useEffect, useState, useCallback } from "react";
import { createPublicClient, http, parseAbiItem } from "viem";
import { base, optimism, celo } from "viem/chains";
import { SUPPORTED_CHAINS } from "@/config/contracts";

const ERC20_ABI = [
  { inputs: [], name: "symbol", outputs: [{ type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "decimals", outputs: [{ type: "uint8" }], stateMutability: "view", type: "function" },
] as const;

const INITIALIZE_EVENT = parseAbiItem(
  "event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)"
);

export interface Pool {
  id: string;
  poolId: string;
  token0: { address: string; symbol: string; decimals: number };
  token1: { address: string; symbol: string; decimals: number };
  fee: number;
  tickSpacing: number;
  hookAddress: string;
  chainId: number;
  chainName: string;
  txHash: string;
  blockNumber: bigint;
}

// Known token info
const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  "0x4200000000000000000000000000000000000006": { symbol: "WETH", decimals: 18 },
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": { symbol: "USDC", decimals: 6 },
  "0x0b2c639c533813f4aa9d7837caf62653d097ff85": { symbol: "USDC", decimals: 6 },
  "0x471ece3750da237f93b8e339c536989b8978a438": { symbol: "CELO", decimals: 18 },
  "0x765de816845861e75a25fca122bb6898b8b1282a": { symbol: "cUSD", decimals: 18 },
  "0xd8763cba276a3738e6de85b4b3bf5fded6d6ca73": { symbol: "cEUR", decimals: 18 },
  "0x66803fb87abd4aac3cbb3fad7c3aa01f6f3fb207": { symbol: "WBTC", decimals: 8 },
};

// Known pools - will be shown even if event discovery fails
// NOTE: txHash can be empty "" - PoolCard should handle this
const KNOWN_POOLS: Pool[] = [
  // Base - WETH/USDC
  {
    id: "8453-weth-usdc",
    poolId: "0x",
    token0: { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 },
    token1: { address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", symbol: "USDC", decimals: 6 },
    fee: 0x800000,
    tickSpacing: 200,
    hookAddress: "0x14a8bf1bb6419bed0986a4c32f8cd6341744e0c0",
    chainId: 8453,
    chainName: "Base",
    txHash: "0xd9f1654f387125061b3299412f4e275a3ff1c21b6f7261cab319bcb350e63821",
    blockNumber: BigInt(0),
  },
  // Optimism - USDC/WETH
  {
    id: "10-usdc-weth",
    poolId: "0x",
    token0: { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", symbol: "USDC", decimals: 6 },
    token1: { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 },
    fee: 0x800000,
    tickSpacing: 200,
    hookAddress: "0xb5E6D6cb548033dA8F18e7f177a9aE485d81a0c0",
    chainId: 10,
    chainName: "Optimism",
    txHash: "0xf7606db4c7a4134775a314c72e271ee03208e3b75231d6f59fff2b6f543e44cb",
    blockNumber: BigInt(0),
  },
  // Celo - CELO/cUSD (txHash empty - will be discovered or hidden)
  {
    id: "42220-celo-cusd",
    poolId: "0x",
    token0: { address: "0x471EcE3750Da237f93B8E339c536989b8978a438", symbol: "CELO", decimals: 18 },
    token1: { address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", symbol: "cUSD", decimals: 18 },
    fee: 0x800000,
    tickSpacing: 200,
    hookAddress: "0xe96B2C7416596fE707ba40379B909F42F18d7FC0",
    chainId: 42220,
    chainName: "Celo",
    txHash: "", // Empty - will be discovered from events or link will be hidden
    blockNumber: BigInt(0),
  },
  // Celo - WBTC/cUSD
  {
    id: "42220-wbtc-cusd",
    poolId: "0x",
    token0: { address: "0x66803fb87abd4aac3cbb3fad7c3aa01f6f3fb207", symbol: "WBTC", decimals: 8 },
    token1: { address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", symbol: "cUSD", decimals: 18 },
    fee: 0x800000,
    tickSpacing: 200,
    hookAddress: "0xe96B2C7416596fE707ba40379B909F42F18d7FC0",
    chainId: 42220,
    chainName: "Celo",
    txHash: "0x0029c7f162c4e1d37209cbe35990eab9c52243a14d6ab40ce0a8f2f4d6bc71ef",
    blockNumber: BigInt(0),
  },
];

const CHAIN_CONFIGS: Record<number, { chain: any; rpc: string }> = {
  8453: { chain: base, rpc: "https://mainnet.base.org" },
  10: { chain: optimism, rpc: "https://mainnet.optimism.io" },
  42220: { chain: celo, rpc: "https://forno.celo.org" },
};

async function getTokenInfo(client: any, address: string): Promise<{ symbol: string; decimals: number }> {
  const addressLower = address.toLowerCase();
  if (KNOWN_TOKENS[addressLower]) return KNOWN_TOKENS[addressLower];

  try {
    const [symbol, decimals] = await Promise.all([
      client.readContract({ address: address as `0x${string}`, abi: ERC20_ABI, functionName: "symbol" }),
      client.readContract({ address: address as `0x${string}`, abi: ERC20_ABI, functionName: "decimals" }),
    ]);
    return { symbol: symbol as string, decimals: Number(decimals) };
  } catch {
    return { symbol: address.slice(0, 6) + "..." + address.slice(-4), decimals: 18 };
  }
}

async function discoverPoolsForChain(chainId: number): Promise<Pool[]> {
  const chainConfig = SUPPORTED_CHAINS[chainId];
  const rpcConfig = CHAIN_CONFIGS[chainId];
  if (!chainConfig || !rpcConfig) return [];

  try {
    const client = createPublicClient({
      chain: rpcConfig.chain,
      transport: http(rpcConfig.rpc, { timeout: 30000 }),
    });

    const currentBlock = await client.getBlockNumber();
    const fromBlock = currentBlock > BigInt(3000000) ? currentBlock - BigInt(3000000) : BigInt(0);

    console.log(`[${chainConfig.name}] Scanning blocks ${fromBlock} to ${currentBlock}...`);

    const logs = await client.getLogs({
      address: chainConfig.poolManager as `0x${string}`,
      event: INITIALIZE_EVENT,
      fromBlock,
      toBlock: currentBlock,
    });

    console.log(`[${chainConfig.name}] Found ${logs.length} Initialize events`);

    const hookLower = chainConfig.hookAddress.toLowerCase();
    const filtered = logs.filter((l: any) => {
      const hooks = l.args?.hooks?.toLowerCase();
      const tickSpacing = Number(l.args?.tickSpacing);
      return hooks === hookLower && tickSpacing === 200;
    });
    
    console.log(`[${chainConfig.name}] Found ${filtered.length} valid DynamicSwap pools`);

    const pools: Pool[] = await Promise.all(
      filtered.map(async (log: any) => {
        const [t0, t1] = await Promise.all([
          getTokenInfo(client, log.args.currency0),
          getTokenInfo(client, log.args.currency1),
        ]);

        return {
          id: `${chainId}-${log.args.currency0}-${log.args.currency1}`.toLowerCase(),
          poolId: log.args.id,
          token0: { address: log.args.currency0, ...t0 },
          token1: { address: log.args.currency1, ...t1 },
          fee: Number(log.args.fee),
          tickSpacing: Number(log.args.tickSpacing),
          hookAddress: log.args.hooks,
          chainId,
          chainName: chainConfig.name,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
        };
      })
    );

    return pools;
  } catch (err: any) {
    console.error(`[${chainConfig.name}] Discovery failed:`, err.message);
    return [];
  }
}

function mergePools(discovered: Pool[], known: Pool[]): Pool[] {
  const poolMap = new Map<string, Pool>();

  known.forEach((p) => {
    const key = `${p.chainId}-${p.token0.address.toLowerCase()}-${p.token1.address.toLowerCase()}`;
    poolMap.set(key, p);
  });

  // Discovered pools override known (they have actual tx hash)
  discovered.forEach((p) => {
    const key = `${p.chainId}-${p.token0.address.toLowerCase()}-${p.token1.address.toLowerCase()}`;
    poolMap.set(key, p);
  });

  return Array.from(poolMap.values());
}

export function usePoolDiscovery(chainId?: number) {
  const [pools, setPools] = useState<Pool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const discoverPools = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const knownForChain = chainId
      ? KNOWN_POOLS.filter((p) => p.chainId === chainId)
      : KNOWN_POOLS;
    setPools(knownForChain);

    try {
      const chainIds = chainId ? [chainId] : Object.keys(SUPPORTED_CHAINS).map(Number);
      let allDiscovered: Pool[] = [];

      for (const cid of chainIds) {
        try {
          const chainPools = await discoverPoolsForChain(cid);
          allDiscovered = [...allDiscovered, ...chainPools];
        } catch (err) {
          console.error(`Chain ${cid} discovery failed`);
        }
      }

      const merged = mergePools(allDiscovered, knownForChain);
      setPools(merged);
      console.log(`Total pools: ${merged.length}`);
    } catch (err: any) {
      console.error("Pool discovery error:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [chainId]);

  useEffect(() => {
    discoverPools();
  }, [discoverPools]);

  return { pools, isLoading, error, refetch: discoverPools };
}
