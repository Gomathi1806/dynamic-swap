// src/components/CreatePoolCard.tsx
"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi";
import { getChainConfig } from "@/config/contracts";
import { getTokensForChain, Token } from "@/config/tokens";

const POOL_MANAGER_ABI = [
  {
    inputs: [
      {
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
        name: "key",
        type: "tuple",
      },
      { name: "sqrtPriceX96", type: "uint160" },
    ],
    name: "initialize",
    outputs: [{ name: "tick", type: "int24" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export function CreatePoolCard() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const config = getChainConfig(chainId);
  const tokens = getTokensForChain(chainId);

  const [token0, setToken0] = useState<Token | null>(null);
  const [token1, setToken1] = useState<Token | null>(null);
  const [initialPrice, setInitialPrice] = useState("1");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Initialize tokens
  useEffect(() => {
    if (tokens.length >= 2) {
      setToken0(tokens[0]);
      setToken1(tokens[1]);
    }
  }, [tokens]);

  // Sort tokens (lower address first)
  const sortTokens = (t0: Token, t1: Token): [Token, Token, boolean] => {
    if (t0.address.toLowerCase() < t1.address.toLowerCase()) {
      return [t0, t1, false];
    }
    return [t1, t0, true];
  };

  // Calculate sqrtPriceX96 from price
  const priceToSqrtPriceX96 = (price: number): bigint => {
    const sqrtPrice = Math.sqrt(price);
    const Q96 = BigInt(2) ** BigInt(96);
    return BigInt(Math.floor(sqrtPrice * Number(Q96)));
  };

  const handleCreatePool = async () => {
    if (!walletClient || !publicClient || !token0 || !token1 || !config) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setTxHash(null);

    try {
      // Sort tokens
      const [currency0, currency1, swapped] = sortTokens(token0, token1);
      
      // Adjust price if tokens were swapped
      let price = parseFloat(initialPrice);
      if (swapped) price = 1 / price;
      
      const sqrtPriceX96 = priceToSqrtPriceX96(price);

      console.log("Creating pool:", {
        currency0: currency0.address,
        currency1: currency1.address,
        fee: "0x800000 (Dynamic)",
        tickSpacing: 200,
        hooks: config.hookAddress,
        sqrtPriceX96: sqrtPriceX96.toString(),
      });

      // Send transaction
      const hash = await walletClient.writeContract({
        address: config.poolManager as `0x${string}`,
        abi: POOL_MANAGER_ABI,
        functionName: "initialize",
        args: [
          {
            currency0: currency0.address as `0x${string}`,
            currency1: currency1.address as `0x${string}`,
            fee: 0x800000,
            tickSpacing: 200,
            hooks: config.hookAddress as `0x${string}`,
          },
          sqrtPriceX96,
        ],
      });

      setTxHash(hash);
      console.log("Transaction sent:", hash);

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        setSuccess(`Pool created successfully!\n\n${token0.symbol}/${token1.symbol} pool is now live.`);
      } else {
        throw new Error("Transaction failed");
      }
    } catch (err: any) {
      console.error("Create pool error:", err);
      
      if (err.message?.includes("PoolAlreadyInitialized") || err.message?.includes("0x7983c051")) {
        setError("This pool already exists!");
      } else if (err.message?.includes("HookAddressNotValid")) {
        setError("Hook address is not valid for this configuration");
      } else if (err.message?.includes("user rejected")) {
        setError("Transaction rejected by user");
      } else {
        setError(err.message || "Failed to create pool");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!config) {
    return (
      <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 text-center">
        <p className="text-gray-400">Please connect to a supported network</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">Create Pool</h2>

      {/* Token Selection */}
      <div className="space-y-3 mb-4">
        <div className="bg-gray-900/50 rounded-xl p-4">
          <label className="text-sm text-gray-400 mb-2 block">Token 1</label>
          <select
            value={token0?.address || ""}
            onChange={(e) => setToken0(tokens.find(t => t.address === e.target.value) || null)}
            className="w-full bg-gray-700 rounded-lg px-4 py-3 font-medium"
          >
            {tokens.map((t) => (
              <option key={t.address} value={t.address}>{t.symbol} - {t.name}</option>
            ))}
          </select>
        </div>

        <div className="bg-gray-900/50 rounded-xl p-4">
          <label className="text-sm text-gray-400 mb-2 block">Token 2</label>
          <select
            value={token1?.address || ""}
            onChange={(e) => setToken1(tokens.find(t => t.address === e.target.value) || null)}
            className="w-full bg-gray-700 rounded-lg px-4 py-3 font-medium"
          >
            {tokens.map((t) => (
              <option key={t.address} value={t.address}>{t.symbol} - {t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Initial Price */}
      <div className="bg-gray-900/50 rounded-xl p-4 mb-4">
        <label className="text-sm text-gray-400 mb-2 block">
          Initial Price ({token0?.symbol || "Token1"} per {token1?.symbol || "Token2"})
        </label>
        <input
          type="number"
          value={initialPrice}
          onChange={(e) => setInitialPrice(e.target.value)}
          placeholder="1.0"
          className="w-full bg-gray-700 rounded-lg px-4 py-3 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Pool Config Info */}
      <div className="bg-purple-500/10 rounded-xl p-4 mb-4 border border-purple-500/20">
        <h3 className="font-semibold text-purple-300 mb-2">Pool Configuration</h3>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>• <strong>Fee:</strong> Dynamic (0.30% - 1.00%)</li>
          <li>• <strong>Tick Spacing:</strong> 200</li>
          <li>• <strong>Hook:</strong> DynamicSwap</li>
          <li>• <strong>Network:</strong> {config.name}</li>
        </ul>
      </div>

      {/* Error/Success */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mb-4">
          <p className="text-green-400 text-sm whitespace-pre-line">{success}</p>
          {txHash && (
            <a
              href={`${config.explorer}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 text-sm mt-2 block"
            >
              View transaction ↗
            </a>
          )}
        </div>
      )}

      {/* Action Button */}
      {!isConnected ? (
        <button disabled className="w-full py-4 bg-gray-700 text-gray-400 rounded-xl font-medium">
          Connect Wallet
        </button>
      ) : (
        <button
          onClick={handleCreatePool}
          disabled={isLoading || !token0 || !token1 || token0.address === token1.address}
          className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white rounded-xl font-medium disabled:opacity-50"
        >
          {isLoading ? "Creating Pool..." : "Create Pool"}
        </button>
      )}

      {token0?.address === token1?.address && (
        <p className="text-yellow-400 text-sm mt-2 text-center">
          Please select two different tokens
        </p>
      )}
    </div>
  );
}
