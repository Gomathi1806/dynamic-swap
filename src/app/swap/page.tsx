"use client";

import { useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { getContractsByChainId, getTokensByChainId } from "@/config/contracts";

export default function SwapPage() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const contracts = getContractsByChainId(chainId);
  const tokens = getTokensByChainId(chainId);

  const [fromToken, setFromToken] = useState("");
  const [toToken, setToToken] = useState("");
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");

  const tokenList = tokens ? Object.entries(tokens) : [];

  return (
    <div className="max-w-lg mx-auto">
      <div className="glass rounded-2xl p-6">
        <h1 className="text-2xl font-bold mb-6 text-center">Swap</h1>

        {!isConnected ? (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">Connect your wallet to swap</p>
          </div>
        ) : !contracts ? (
          <div className="text-center py-8">
            <p className="text-yellow-400">
              Please switch to a supported network (Base, Celo, or Unichain)
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* From Token */}
            <div className="bg-black/30 rounded-xl p-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-400">From</span>
                <span className="text-sm text-gray-400">Balance: --</span>
              </div>
              <div className="flex gap-4">
                <input
                  type="number"
                  placeholder="0.0"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  className="flex-1 bg-transparent text-2xl outline-none"
                />
                <select
                  value={fromToken}
                  onChange={(e) => setFromToken(e.target.value)}
                  className="bg-purple-600/30 rounded-lg px-4 py-2 outline-none"
                >
                  <option value="">Select</option>
                  {tokenList.map(([key, token]) => (
                    <option key={key} value={key}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Swap Direction Button */}
            <div className="flex justify-center">
              <button
                onClick={() => {
                  setFromToken(toToken);
                  setToToken(fromToken);
                  setFromAmount(toAmount);
                  setToAmount(fromAmount);
                }}
                className="bg-purple-600/30 p-3 rounded-full hover:bg-purple-600/50 transition-all"
              >
                ⇅
              </button>
            </div>

            {/* To Token */}
            <div className="bg-black/30 rounded-xl p-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-400">To</span>
                <span className="text-sm text-gray-400">Balance: --</span>
              </div>
              <div className="flex gap-4">
                <input
                  type="number"
                  placeholder="0.0"
                  value={toAmount}
                  onChange={(e) => setToAmount(e.target.value)}
                  className="flex-1 bg-transparent text-2xl outline-none"
                  readOnly
                />
                <select
                  value={toToken}
                  onChange={(e) => setToToken(e.target.value)}
                  className="bg-purple-600/30 rounded-lg px-4 py-2 outline-none"
                >
                  <option value="">Select</option>
                  {tokenList.map(([key, token]) => (
                    <option key={key} value={key}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Fee Info */}
            <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/20">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Dynamic Fee</span>
                <span className="text-purple-400">0.30% - 1.00%</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-400">Hook</span>
                <span className="text-purple-400 text-xs font-mono">
                  {contracts.hookAddress.slice(0, 10)}...
                </span>
              </div>
            </div>

            {/* Swap Button */}
            <button
              disabled={!fromToken || !toToken || !fromAmount}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!fromToken || !toToken
                ? "Select tokens"
                : !fromAmount
                ? "Enter amount"
                : "Swap"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
