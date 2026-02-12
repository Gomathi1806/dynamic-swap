"use client";

import { useState } from "react";
import { useAccount, useChainId } from "wagmi";
import Link from "next/link";
import { getContractsByChainId, isOwner } from "@/config/contracts";

export default function PoolsPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contracts = getContractsByChainId(chainId);
  const [filter, setFilter] = useState("all");

  // Real pools - will be fetched from blockchain in production
  // Currently empty until pools are created with liquidity
  const pools: Array<{
    id: string;
    token0: string;
    token1: string;
    fee: string;
    tvl: string;
    volume24h: string;
    verified: boolean;
    creator: string;
  }> = [];

  const filters = [
    { key: "all", label: "All Pools" },
    { key: "verified", label: "Verified" },
    { key: "community", label: "Community" },
    { key: "myPools", label: "My Pools" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Pools</h1>
          <p className="text-gray-400">
            Pools using DynamicSwap hook on {contracts?.name || "this network"}
          </p>
        </div>
        <Link href="/create-pool" className="btn-primary">
          + Create Pool
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg transition-all ${
              filter === f.key
                ? "bg-purple-600 text-white"
                : "bg-white/10 text-gray-300 hover:bg-white/20"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Pool List */}
      {!isConnected ? (
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-gray-400">Connect your wallet to view pools</p>
        </div>
      ) : !contracts ? (
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-yellow-400">
            Please switch to a supported network (Base, Celo, or Unichain)
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {pools.map((pool) => (
            <div key={pool.id} className="glass rounded-2xl p-6 card-hover">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-2">
                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center border-2 border-gray-800">
                      {pool.token0.charAt(0)}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center border-2 border-gray-800">
                      {pool.token1.charAt(0)}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg">
                        {pool.token0}/{pool.token1}
                      </h3>
                      {pool.verified && (
                        <span className="badge-verified">✓ Verified</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 font-mono">{pool.id}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-6">
                  <div>
                    <p className="text-sm text-gray-400">TVL</p>
                    <p className="font-bold text-green-400">{pool.tvl}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">24h Volume</p>
                    <p className="font-bold">{pool.volume24h}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Dynamic Fee</p>
                    <p className="font-bold text-purple-400">{pool.fee}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button className="btn-secondary text-sm">Add Liquidity</button>
                  <button className="btn-primary text-sm">Swap</button>
                </div>
              </div>
            </div>
          ))}

          {pools.length === 0 && (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-gray-400 mb-4">No pools found on this network</p>
              <Link href="/create-pool" className="btn-primary">
                Create the first pool
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
