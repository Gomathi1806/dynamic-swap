// src/app/pools/page.tsx
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useChainId } from "wagmi";
import Link from "next/link";
import { usePoolDiscovery } from "@/hooks/usePoolDiscovery";
import { PoolCard } from "@/components/PoolCard";
import { AddLiquidityCard } from "@/components/AddLiquidityCard";
import { getChainConfig, SUPPORTED_CHAINS } from "@/config/contracts";

export default function PoolsPage() {
  const searchParams = useSearchParams();
  const chainId = useChainId();
  const config = getChainConfig(chainId);

  // Check if we should show add liquidity modal
  const action = searchParams.get("action");
  const token0Param = searchParams.get("token0");
  const token1Param = searchParams.get("token1");
  const showAddLiquidity = action === "add";

  // Filter state
  const [selectedChain, setSelectedChain] = useState<number | null>(null);

  // Discover pools (all chains or specific chain)
  const { pools, isLoading, error, refetch } = usePoolDiscovery(selectedChain || undefined);

  // Filter pools by selected chain
  const filteredPools = selectedChain 
    ? pools.filter(p => p.chainId === selectedChain)
    : pools;

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Pools</h1>
            <p className="text-gray-400">
              Pools using DynamicSwap hook - automatically discovered from blockchain
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium transition-all disabled:opacity-50"
            >
              {isLoading ? "Refreshing..." : "🔄 Refresh"}
            </button>
            <Link
              href="/create-pool"
              className="px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white rounded-xl font-medium transition-all"
            >
              + Create Pool
            </Link>
          </div>
        </div>

        {/* Chain Filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedChain(null)}
            className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
              selectedChain === null
                ? "bg-purple-500 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            All Chains ({pools.length})
          </button>
          {Object.values(SUPPORTED_CHAINS).map((chain) => {
            const count = pools.filter(p => p.chainId === chain.chainId).length;
            return (
              <button
                key={chain.chainId}
                onClick={() => setSelectedChain(chain.chainId)}
                className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
                  selectedChain === chain.chainId
                    ? "bg-purple-500 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {chain.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Discovering pools from blockchain...</p>
            <p className="text-gray-500 text-sm mt-2">This may take a few seconds</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
            <p className="text-red-400">Error: {error}</p>
            <button
              onClick={() => refetch()}
              className="mt-2 text-sm text-purple-400 hover:text-purple-300"
            >
              Try again
            </button>
          </div>
        )}

        {/* Pool List */}
        {!isLoading && !error && (
          <div className="space-y-4">
            {filteredPools.length > 0 ? (
              filteredPools.map((pool) => (
                <PoolCard key={pool.id} pool={pool} />
              ))
            ) : (
              <div className="text-center py-16 bg-gray-800/30 rounded-2xl border border-gray-700">
                <p className="text-gray-400 mb-4">
                  {pools.length === 0 
                    ? "No pools found. Be the first to create one!"
                    : "No pools found for this chain."}
                </p>
                <Link
                  href="/create-pool"
                  className="inline-block px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl font-medium"
                >
                  Create Pool
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 p-4 bg-purple-500/10 rounded-xl border border-purple-500/20">
          <h3 className="font-semibold text-purple-300 mb-2">💡 How Pool Discovery Works</h3>
          <p className="text-sm text-gray-300">
            Pools are automatically discovered by scanning blockchain events. When anyone creates a pool 
            using DynamicSwap hook, it will appear here automatically - no manual adding required!
          </p>
        </div>

        {/* Add Liquidity Modal */}
        {showAddLiquidity && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="relative">
              <Link
                href="/pools"
                className="absolute -top-10 right-0 text-gray-400 hover:text-white"
              >
                ✕ Close
              </Link>
              <AddLiquidityCard 
                initialToken0={token0Param || undefined} 
                initialToken1={token1Param || undefined} 
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
