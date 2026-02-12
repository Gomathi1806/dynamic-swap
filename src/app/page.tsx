"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { CONTRACTS } from "@/config/contracts";

export default function Home() {
  const { isConnected } = useAccount();

  const stats = [
    { label: "Networks", value: "3", sublabel: "Base • Celo • Unichain" },
    { label: "Fee Range", value: "0.30% - 1.00%", sublabel: "Dynamic based on volatility" },
    { label: "Protocol Share", value: "10%", sublabel: "Of dynamic spread" },
  ];

  const features = [
    {
      icon: "🛡️",
      title: "LP Protection",
      description: "Higher fees during volatile periods protect liquidity providers from impermanent loss",
    },
    {
      icon: "📈",
      title: "Dynamic Fees",
      description: "Fees automatically adjust from 0.30% to 1.00% based on real-time market volatility",
    },
    {
      icon: "⚡",
      title: "Multi-Chain",
      description: "Deployed on Base, Celo, and Unichain with identical functionality across all networks",
    },
    {
      icon: "🔒",
      title: "Permissionless",
      description: "Anyone can create pools using our hook - no approval needed",
    },
  ];

  const networks = [
    { name: "Base", chainId: 8453, hook: CONTRACTS.base.hookAddress, color: "from-blue-500 to-blue-600" },
    { name: "Celo", chainId: 42220, hook: CONTRACTS.celo.hookAddress, color: "from-green-500 to-green-600" },
    { name: "Unichain", chainId: 130, hook: CONTRACTS.unichain.hookAddress, color: "from-pink-500 to-pink-600" },
  ];

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="text-center py-16">
        <h1 className="text-5xl md:text-7xl font-bold mb-6">
          <span className="gradient-text">Smart Liquidity</span>
          <br />
          <span className="text-white">Protection</span>
        </h1>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-8">
          Uniswap V4 hook that automatically adjusts swap fees based on market volatility, 
          protecting LPs from impermanent loss.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/swap" className="btn-primary">
            Start Swapping
          </Link>
          <Link href="/create-pool" className="btn-secondary">
            Create Pool
          </Link>
        </div>
      </section>

      {/* Stats Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="glass rounded-2xl p-6 text-center card-hover">
            <div className="text-3xl font-bold gradient-text mb-2">{stat.value}</div>
            <div className="text-lg text-white mb-1">{stat.label}</div>
            <div className="text-sm text-gray-400">{stat.sublabel}</div>
          </div>
        ))}
      </section>

      {/* Networks Section */}
      <section>
        <h2 className="text-3xl font-bold text-center mb-8">Deployed Networks</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {networks.map((network) => (
            <div key={network.chainId} className="glass rounded-2xl p-6 card-hover">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${network.color} flex items-center justify-center mb-4`}>
                <span className="text-2xl">⛓️</span>
              </div>
              <h3 className="text-xl font-bold mb-2">{network.name}</h3>
              <p className="text-sm text-gray-400 mb-4">Chain ID: {network.chainId}</p>
              <div className="bg-black/30 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Hook Address</p>
                <p className="text-xs font-mono text-purple-400 break-all">{network.hook}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section>
        <h2 className="text-3xl font-bold text-center mb-8">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature, i) => (
            <div key={i} className="glass rounded-2xl p-6 card-hover">
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
              <p className="text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="glass rounded-2xl p-8 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
        <p className="text-gray-300 mb-6 max-w-xl mx-auto">
          Connect your wallet to start swapping with dynamic fee protection or create your own pool.
        </p>
        {!isConnected ? (
          <p className="text-purple-400">Connect your wallet to continue →</p>
        ) : (
          <div className="flex justify-center gap-4">
            <Link href="/swap" className="btn-primary">Swap Now</Link>
            <Link href="/pools" className="btn-secondary">View Pools</Link>
          </div>
        )}
      </section>
    </div>
  );
}
