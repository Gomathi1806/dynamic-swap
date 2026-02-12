"use client";

import { useState } from "react";
import { useAccount, useChainId, useWriteContract } from "wagmi";
import { getContractsByChainId, getTokensByChainId } from "@/config/contracts";

// PositionManager ABI (only the functions we need)
const PositionManagerABI = [
  {
    "inputs": [
      {
        "components": [
          { "internalType": "Currency", "name": "currency0", "type": "address" },
          { "internalType": "Currency", "name": "currency1", "type": "address" },
          { "internalType": "uint24", "name": "fee", "type": "uint24" },
          { "internalType": "int24", "name": "tickSpacing", "type": "int24" },
          { "internalType": "address", "name": "hooks", "type": "address" }
        ],
        "internalType": "struct PoolKey",
        "name": "key",
        "type": "tuple"
      },
      { "internalType": "uint160", "name": "sqrtPriceX96", "type": "uint160" }
    ],
    "name": "initializePool",
    "outputs": [{ "internalType": "int24", "name": "tick", "type": "int24" }],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

// Helper to calculate sqrtPriceX96 from price
function priceToSqrtPriceX96(price: number, decimals0: number, decimals1: number): bigint {
  // Adjust for decimal differences
  const adjustedPrice = price * Math.pow(10, decimals0 - decimals1);
  // sqrtPriceX96 = sqrt(price) * 2^96
  const sqrtPrice = Math.sqrt(adjustedPrice);
  const sqrtPriceX96 = BigInt(Math.floor(sqrtPrice * 2 ** 96));
  return sqrtPriceX96;
}

// Helper to sort tokens (currency0 must be < currency1)
function sortTokens(tokenA: string, tokenB: string): [string, string, boolean] {
  const addressA = tokenA.toLowerCase();
  const addressB = tokenB.toLowerCase();
  if (addressA < addressB) {
    return [tokenA, tokenB, false]; // not swapped
  } else {
    return [tokenB, tokenA, true]; // swapped
  }
}

export default function CreatePoolPage() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const contracts = getContractsByChainId(chainId);
  const tokens = getTokensByChainId(chainId);

  const [token0Key, setToken0Key] = useState("");
  const [token1Key, setToken1Key] = useState("");
  const [tickSpacing, setTickSpacing] = useState("60");
  const [initialPrice, setInitialPrice] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [txHash, setTxHash] = useState("");

  const { writeContractAsync } = useWriteContract();

  const tokenList = tokens ? Object.entries(tokens) : [];

  const tickSpacings = [
    { value: "1", label: "1 (0.01% pools)" },
    { value: "10", label: "10 (0.05% pools)" },
    { value: "60", label: "60 (0.30% pools) - Recommended" },
    { value: "200", label: "200 (1.00% pools)" },
  ];

  const handleCreatePool = async () => {
    if (!contracts || !tokens || !token0Key || !token1Key || !initialPrice) {
      setError("Please fill in all fields");
      return;
    }

    setIsCreating(true);
    setError("");
    setSuccess("");

    try {
      const token0Data = tokens[token0Key as keyof typeof tokens];
      const token1Data = tokens[token1Key as keyof typeof tokens];

      if (!token0Data || !token1Data) {
        throw new Error("Invalid token selection");
      }

      // Get token addresses (use WETH address for native ETH)
      let token0Address = token0Data.address;
      let token1Address = token1Data.address;

      // Handle native token (address 0x0) - need to use WETH
      if (token0Address === "0x0000000000000000000000000000000000000000") {
        const wethToken = tokens["WETH" as keyof typeof tokens];
        if (wethToken) token0Address = wethToken.address;
      }
      if (token1Address === "0x0000000000000000000000000000000000000000") {
        const wethToken = tokens["WETH" as keyof typeof tokens];
        if (wethToken) token1Address = wethToken.address;
      }

      // Sort tokens (currency0 must be < currency1 in Uniswap V4)
      const [currency0, currency1, swapped] = sortTokens(token0Address, token1Address);

      // Calculate sqrtPriceX96
      let price = parseFloat(initialPrice);
      const decimals0 = swapped ? token1Data.decimals : token0Data.decimals;
      const decimals1 = swapped ? token0Data.decimals : token1Data.decimals;
      
      // If tokens were swapped, invert the price
      if (swapped) {
        price = 1 / price;
      }

      const sqrtPriceX96 = priceToSqrtPriceX96(price, decimals0, decimals1);

      console.log("Creating pool with:", {
        currency0,
        currency1,
        tickSpacing: parseInt(tickSpacing),
        hook: contracts.hookAddress,
        sqrtPriceX96: sqrtPriceX96.toString(),
        swapped,
      });

      // Create PoolKey
      const poolKey = {
        currency0: currency0 as `0x${string}`,
        currency1: currency1 as `0x${string}`,
        fee: 0x800000, // Dynamic fee flag (indicates hook controls fees)
        tickSpacing: parseInt(tickSpacing),
        hooks: contracts.hookAddress as `0x${string}`,
      };

      // Call initializePool on PositionManager
      const hash = await writeContractAsync({
        address: contracts.positionManager as `0x${string}`,
        abi: PositionManagerABI,
        functionName: "initializePool",
        args: [poolKey, sqrtPriceX96],
      });

      setTxHash(hash);
      setSuccess(`Pool created successfully!`);
      
      // Reset form
      setToken0Key("");
      setToken1Key("");
      setInitialPrice("");

    } catch (err: any) {
      console.error("Error creating pool:", err);
      
      // Parse common errors
      if (err.message?.includes("PoolAlreadyInitialized")) {
        setError("This pool already exists! Try different tokens or tick spacing.");
      } else if (err.message?.includes("user rejected")) {
        setError("Transaction rejected by user");
      } else if (err.message?.includes("insufficient funds")) {
        setError("Insufficient funds for gas");
      } else {
        setError(err.message || "Failed to create pool");
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="glass rounded-2xl p-6">
        <h1 className="text-2xl font-bold mb-2">Create Pool</h1>
        <p className="text-gray-400 mb-6">
          Create a new liquidity pool using the DynamicSwap hook
        </p>

        {!isConnected ? (
          <div className="text-center py-8">
            <p className="text-gray-400">Connect your wallet to create a pool</p>
          </div>
        ) : !contracts ? (
          <div className="text-center py-8">
            <p className="text-yellow-400">
              Please switch to a supported network (Base, Celo, or Unichain)
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Network Info */}
            <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-purple-400">⛓️</span>
                <span className="font-semibold">{contracts.name}</span>
              </div>
              <p className="text-sm text-gray-400">
                Hook: {contracts.hookAddress.slice(0, 20)}...
              </p>
              <p className="text-sm text-gray-400">
                PositionManager: {contracts.positionManager.slice(0, 20)}...
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-4">
                <p className="text-green-400 text-sm">{success}</p>
                {txHash && (
                  <a
                    href={`${contracts.explorer}/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 text-sm underline mt-2 block"
                  >
                    View on Explorer →
                  </a>
                )}
              </div>
            )}

            {/* Token Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Token 0</label>
                <select
                  value={token0Key}
                  onChange={(e) => setToken0Key(e.target.value)}
                  className="w-full input-field"
                  disabled={isCreating}
                >
                  <option value="">Select token</option>
                  {tokenList.map(([key, token]) => (
                    <option key={key} value={key} disabled={key === token1Key}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Token 1</label>
                <select
                  value={token1Key}
                  onChange={(e) => setToken1Key(e.target.value)}
                  className="w-full input-field"
                  disabled={isCreating}
                >
                  <option value="">Select token</option>
                  {tokenList.map(([key, token]) => (
                    <option key={key} value={key} disabled={key === token0Key}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom Token Input */}
            <div className="bg-black/20 rounded-xl p-4">
              <p className="text-sm text-gray-400 mb-2">💡 Need a different token?</p>
              <p className="text-xs text-gray-500">
                Contact us to add popular tokens or edit src/config/contracts.ts to add custom tokens.
              </p>
            </div>

            {/* Tick Spacing */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Tick Spacing</label>
              <select
                value={tickSpacing}
                onChange={(e) => setTickSpacing(e.target.value)}
                className="w-full input-field"
                disabled={isCreating}
              >
                {tickSpacings.map((ts) => (
                  <option key={ts.value} value={ts.value}>
                    {ts.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Lower tick spacing = more price precision, higher gas costs
              </p>
            </div>

            {/* Initial Price */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Initial Price ({token1Key || "Token1"} per {token0Key || "Token0"})
              </label>
              <input
                type="number"
                placeholder="e.g., 2500 for WETH/USDC"
                value={initialPrice}
                onChange={(e) => setInitialPrice(e.target.value)}
                className="w-full input-field"
                disabled={isCreating}
                step="any"
              />
              <p className="text-xs text-gray-500 mt-1">
                Example: If 1 WETH = 2500 USDC, enter 2500
              </p>
            </div>

            {/* Pool Preview */}
            {token0Key && token1Key && initialPrice && (
              <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/20">
                <h3 className="font-semibold text-sm mb-2">Pool Preview</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-400">Pair:</div>
                  <div>{token0Key}/{token1Key}</div>
                  <div className="text-gray-400">Tick Spacing:</div>
                  <div>{tickSpacing}</div>
                  <div className="text-gray-400">Initial Price:</div>
                  <div>1 {token0Key} = {initialPrice} {token1Key}</div>
                  <div className="text-gray-400">Hook:</div>
                  <div className="text-purple-400">DynamicSwap ✓</div>
                </div>
              </div>
            )}

            {/* Hook Info */}
            <div className="bg-black/30 rounded-xl p-4 space-y-2">
              <h3 className="font-semibold text-sm">DynamicSwap Hook Features:</h3>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>✓ Dynamic fees: 0.30% - 1.00%</li>
                <li>✓ Volatility-based adjustment</li>
                <li>✓ LP protection from impermanent loss</li>
                <li>✓ EWMA price tracking</li>
              </ul>
            </div>

            {/* Create Button */}
            <button
              onClick={handleCreatePool}
              disabled={!token0Key || !token1Key || !initialPrice || isCreating}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating Pool...
                </>
              ) : !token0Key || !token1Key ? (
                "Select both tokens"
              ) : !initialPrice ? (
                "Enter initial price"
              ) : (
                "Create Pool"
              )}
            </button>

            {/* Important Note */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <p className="text-yellow-400 text-sm font-semibold mb-1">⚠️ Important</p>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• Creating a pool only initializes it - you still need to add liquidity separately</li>
                <li>• Make sure the initial price matches market price to avoid arbitrage</li>
                <li>• Pool creation costs gas but no tokens are deposited yet</li>
                <li>• Pools cannot be deleted once created</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
