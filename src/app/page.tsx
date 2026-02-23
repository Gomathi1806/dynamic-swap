// src/app/page.tsx
"use client";

import Link from "next/link";
import { useAccount, useChainId } from "wagmi";
import { getChainConfig, SUPPORTED_CHAINS } from "@/config/contracts";

export default function HomePage() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const config = getChainConfig(chainId);

  return (
    <div className="min-h-[calc(100vh-64px)]">
      {/* Hero */}
      <section className="py-20 px-4 text-center">
        <h1 className="text-5xl md:text-7xl font-bold mb-6">
          <span className="bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
            Dynamic Fees
          </span>
          <br />
          <span className="text-white">for DeFi</span>
        </h1>

        <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
          Uniswap V4 DEX with volatility-based fee adjustment.
          Fees automatically scale from 0.30% to 1.00% based on market conditions.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/swap"
            className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-semibold rounded-xl text-lg transition-all"
          >
            Start Swapping
          </Link>
          <Link
            href="/pools"
            className="px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl text-lg border border-gray-700 transition-all"
          >
            View Pools
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
          <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-xl font-semibold mb-2">Dynamic Fees</h3>
            <p className="text-gray-400">
              Fees automatically adjust between 0.30% - 1.00% based on real-time volatility.
            </p>
          </div>

          <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
            <div className="text-4xl mb-4">🛡️</div>
            <h3 className="text-xl font-semibold mb-2">LP Protection</h3>
            <p className="text-gray-400">
              Higher fees during volatile periods protect liquidity providers from impermanent loss.
            </p>
          </div>

          <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
            <div className="text-4xl mb-4">🔗</div>
            <h3 className="text-xl font-semibold mb-2">Multi-Chain</h3>
            <p className="text-gray-400">
              Deployed on Base, Optimism, and Celo with more chains coming soon.
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-4 bg-gray-900/50">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
              {Object.keys(SUPPORTED_CHAINS).length}
            </div>
            <div className="text-gray-400 mt-1">Networks</div>
          </div>
          <div>
            <div className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
              0.30%
            </div>
            <div className="text-gray-400 mt-1">Min Fee</div>
          </div>
          <div>
            <div className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
              1.00%
            </div>
            <div className="text-gray-400 mt-1">Max Fee</div>
          </div>
          <div>
            <div className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
              +35%
            </div>
            <div className="text-gray-400 mt-1">LP Gains</div>
          </div>
        </div>
      </section>

      {/* Connected Network */}
      {isConnected && config && (
        <section className="py-8 px-4 text-center">
          <div className="inline-block bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Connected to</p>
            <p className="text-xl font-semibold">{config.name}</p>
            <p className="text-xs text-gray-500 mt-1 font-mono">
              Hook: {config.hookAddress.slice(0, 10)}...{config.hookAddress.slice(-8)}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
