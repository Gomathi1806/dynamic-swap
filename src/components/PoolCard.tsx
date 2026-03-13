// src/components/PoolCard.tsx
"use client";

import Link from "next/link";
import { Pool } from "@/hooks/usePoolDiscovery";

interface PoolCardProps {
  pool: Pool;
  onAddLiquidity?: (pool: Pool) => void;
}

// Get block explorer URL for chain
function getExplorerUrl(chainId: number): string {
  switch (chainId) {
    case 8453: return "https://basescan.org";
    case 10: return "https://optimistic.etherscan.io";
    case 42220: return "https://celoscan.io";
    default: return "https://etherscan.io";
  }
}

export function PoolCard({ pool, onAddLiquidity }: PoolCardProps) {
  const explorer = getExplorerUrl(pool.chainId);
  
  // Check if we have a valid tx hash
  const hasValidTxHash = pool.txHash && pool.txHash.length > 2 && pool.txHash !== "0x";
  
  // Dynamic fee check
  const isDynamicFee = pool.fee === 0x800000 || pool.fee === 8388608;
  const feeDisplay = isDynamicFee ? "Dynamic" : `${(pool.fee / 10000).toFixed(2)}%`;

  return (
    <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700 hover:border-purple-500/50 transition-colors">
      {/* Pool Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Token Icons */}
          <div className="flex -space-x-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-sm font-bold border-2 border-gray-800">
              {pool.token0.symbol.slice(0, 1)}
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-sm font-bold border-2 border-gray-800">
              {pool.token1.symbol.slice(0, 1)}
            </div>
          </div>
          
          {/* Pool Name */}
          <div>
            <h3 className="font-semibold text-lg">
              {pool.token0.symbol} / {pool.token1.symbol}
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>{pool.chainName}</span>
              {hasValidTxHash ? (
                <>
                  <span>•</span>
                  <a 
                    href={`${explorer}/tx/${pool.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300"
                  >
                    View tx ↗
                  </a>
                </>
              ) : (
                <>
                  <span>•</span>
                  <span className="text-gray-500">No tx available</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Fee & Tick */}
        <div className="text-right">
          <div className="text-sm text-gray-400">FEE</div>
          <div className={`font-medium ${isDynamicFee ? 'text-purple-400' : 'text-white'}`}>
            {feeDisplay}
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-sm text-gray-400">TICK</div>
          <div className="font-medium">{pool.tickSpacing}</div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Link
            href={`/swap?token0=${pool.token0.address}&token1=${pool.token1.address}`}
            className="px-4 py-2 bg-pink-500 hover:bg-pink-600 rounded-lg font-medium transition-colors"
          >
            Swap
          </Link>
          <button
            onClick={() => onAddLiquidity?.(pool)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
          >
            + Liquidity
          </button>
        </div>
      </div>

      {/* Dynamic Fee Info */}
      {isDynamicFee && (
        <div className="bg-purple-500/10 rounded-lg p-3 border border-purple-500/20">
          <p className="text-sm text-purple-300">
            ⚡ Dynamic Fee: Adjusts between 0.30% - 1.00% based on market volatility
          </p>
        </div>
      )}
    </div>
  );
}
