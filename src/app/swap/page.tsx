// src/app/swap/page.tsx
"use client";

export const dynamic = 'force-dynamic';

import { useSearchParams } from "next/navigation";
import { SwapCard } from "@/components/oldSwapCard";

export default function SwapPage() {
  const searchParams = useSearchParams();
  const token0 = searchParams.get("token0");
  const token1 = searchParams.get("token1");

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-lg mx-auto pt-8">
        <h1 className="text-3xl font-bold text-center mb-2">Swap</h1>
        <p className="text-gray-400 text-center mb-8">
          Trade tokens with dynamic fees based on volatility
        </p>

        <SwapCard
          initialToken0={token0 || undefined}
          initialToken1={token1 || undefined}
        />

        <div className="mt-6 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
          <h3 className="font-semibold mb-2">About Dynamic Fees</h3>
          <p className="text-sm text-gray-400">
            Unlike traditional DEXs with fixed fees, DynamicSwap automatically adjusts fees
            based on market volatility. During calm markets, you pay as low as 0.30%.
            During volatile periods, fees increase up to 1.00% to protect liquidity providers.
          </p>
        </div>
      </div>
    </div>
  );
}
