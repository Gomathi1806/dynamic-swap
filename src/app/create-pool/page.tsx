// src/app/create-pool/page.tsx
"use client";

export const dynamic = 'force-dynamic';

import { CreatePoolCard } from "@/components/CreatePoolCard";

export default function CreatePoolPage() {
  return (
    <div className="min-h-screen p-6">
      <div className="max-w-lg mx-auto pt-8">
        <h1 className="text-3xl font-bold text-center mb-2">Create Pool</h1>
        <p className="text-gray-400 text-center mb-8">
          Launch a new trading pair with dynamic fees
        </p>

        <CreatePoolCard />

        <div className="mt-6 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
          <h3 className="font-semibold mb-2">Creating a Pool</h3>
          <ul className="text-sm text-gray-400 space-y-2">
            <li>• Select two tokens you want to create a pair for</li>
            <li>• Set the initial price ratio between tokens</li>
            <li>• Pool will use dynamic fees (0.30% - 1.00%)</li>
            <li>• Tick spacing is set to 200 for optimal dynamic fee range</li>
            <li>• After creation, add liquidity to enable trading</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
