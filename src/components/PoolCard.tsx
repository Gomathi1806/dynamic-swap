// src/components/PoolCard.tsx
"use client";

import Link from "next/link";
import { Pool } from "@/hooks/usePoolDiscovery";
import { SUPPORTED_CHAINS } from "@/config/contracts";

interface PoolCardProps {
  pool: Pool;
}

export function PoolCard({ pool }: PoolCardProps) {
  const config = SUPPORTED_CHAINS[pool.chainId];
  const explorerUrl = config ? `${config.explorer}/tx/${pool.txHash}` : "#";

  // Dynamic fee display
  const isDynamicFee = pool.fee === 0x800000 || pool.fee === 8388608;
  const feeDisplay = isDynamicFee ? "Dynamic" : `${(pool.fee / 10000).toFixed(2)}%`;

  return (
    <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700 hover:border-purple-500/50 transition-all">
      <div className="flex items-center justify-between">
        {/* Token Pair */}
        <div className="flex items-center gap-4">
          <div className="flex -space-x-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg border-2 border-gray-800">
              {pool.token0.symbol.charAt(0)}
            </div>
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold text-lg border-2 border-gray-800">
              {pool.token1.symbol.charAt(0)}
            </div>
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">
              {pool.token0.symbol} / {pool.token1.symbol}
            </h3>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-400">{pool.chainName}</span>
              <span className="text-gray-600">•</span>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300"
              >
                View tx ↗
              </a>
            </div>
          </div>
        </div>

        {/* Info & Actions */}
        <div className="flex items-center gap-6">
          {/* Fee Badge */}
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase">Fee</p>
            <p className={`font-semibold ${isDynamicFee ? "text-purple-400" : "text-white"}`}>
              {feeDisplay}
            </p>
          </div>

          {/* Tick Spacing */}
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase">Tick</p>
            <p className="font-semibold text-white">{pool.tickSpacing}</p>
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <Link
              href={`/swap?chainId=${pool.chainId}&token0=${pool.token0.address}&token1=${pool.token1.address}`}
              className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-medium rounded-xl transition-all"
            >
              Swap
            </Link>
            <Link
              href={`/pools?action=add&chainId=${pool.chainId}&token0=${pool.token0.address}&token1=${pool.token1.address}`}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-all"
            >
              + Liquidity
            </Link>
          </div>
        </div>
      </div>

      {/* Dynamic Fee Info */}
      {isDynamicFee && (
        <div className="mt-4 p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
          <p className="text-sm text-purple-300">
            ⚡ <strong>Dynamic Fee:</strong> Adjusts between 0.30% - 1.00% based on market volatility
          </p>
        </div>
      )}
    </div>
  );
}
