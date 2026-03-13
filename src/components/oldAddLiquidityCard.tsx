// src/components/AddLiquidityCard.tsx
"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { getChainConfig } from "@/config/contracts";
import { getTokensForChain, Token } from "@/config/tokens";

const UNISWAP_API_URL = "https://api.uniswap.org/v2";

const ERC20_ABI = [
  { inputs: [{ name: "owner", type: "address" }], name: "balanceOf", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
] as const;

interface AddLiquidityCardProps {
  initialToken0?: string;
  initialToken1?: string;
  onClose?: () => void;
}

export function AddLiquidityCard({ initialToken0, initialToken1, onClose }: AddLiquidityCardProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const config = getChainConfig(chainId);
  const tokens = getTokensForChain(chainId);
  const apiKey = process.env.NEXT_PUBLIC_UNISWAP_API_KEY || "";

  const [token0, setToken0] = useState<Token | null>(null);
  const [token1, setToken1] = useState<Token | null>(null);
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const [balance0, setBalance0] = useState("0");
  const [balance1, setBalance1] = useState("0");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Initialize tokens
  useEffect(() => {
    if (tokens.length >= 2) {
      const t0 = initialToken0 
        ? tokens.find(t => t.address.toLowerCase() === initialToken0.toLowerCase()) 
        : tokens[0];
      const t1 = initialToken1 
        ? tokens.find(t => t.address.toLowerCase() === initialToken1.toLowerCase()) 
        : tokens[1];
      setToken0(t0 || tokens[0]);
      setToken1(t1 || tokens[1]);
    }
  }, [tokens, initialToken0, initialToken1]);

  // Fetch balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!publicClient || !address) return;
      
      for (const [token, setBalance] of [[token0, setBalance0], [token1, setBalance1]] as const) {
        if (token) {
          try {
            const balance = await publicClient.readContract({
              address: token.address as `0x${string}`,
              abi: ERC20_ABI,
              functionName: "balanceOf",
              args: [address],
            });
            setBalance(formatUnits(balance as bigint, token.decimals));
          } catch {
            setBalance("0");
          }
        }
      }
    };
    fetchBalances();
  }, [publicClient, address, token0, token1]);

  // Add liquidity via Uniswap API
  const handleAddLiquidity = async () => {
    if (!walletClient || !publicClient || !token0 || !token1 || !address || !apiKey) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setTxHash(null);

    try {
      // Sort tokens (lower address first - Uniswap requirement)
      let currency0 = token0;
      let currency1 = token1;
      let amt0 = amount0;
      let amt1 = amount1;
      
      if (token0.address.toLowerCase() > token1.address.toLowerCase()) {
        currency0 = token1;
        currency1 = token0;
        amt0 = amount1;
        amt1 = amount0;
      }

      setStep("Creating LP position...");

      // Try Uniswap LP API
      const response = await fetch(`${UNISWAP_API_URL}/lp/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          chainId: chainId,
          token0: currency0.address,
          token1: currency1.address,
          amount0: parseUnits(amt0, currency0.decimals).toString(),
          amount1: parseUnits(amt1, currency1.decimals).toString(),
          fee: 8388608, // 0x800000 - Dynamic fee flag
          tickSpacing: 200,
          tickLower: -887200, // Full range
          tickUpper: 887200,
          recipient: address,
          protocol: "V4",
          slippageTolerance: 50, // 0.5%
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("LP API error:", errorData);
        
        // Check if it's a V4 not supported error
        if (errorData.detail?.includes("V4") || errorData.errorCode === "UNSUPPORTED_PROTOCOL") {
          throw new Error("V4_NOT_SUPPORTED");
        }
        throw new Error(errorData.detail || errorData.message || "LP creation failed");
      }

      const lpData = await response.json();
      console.log("LP response:", lpData);

      // Sign permit if required
      if (lpData.permitData) {
        setStep("Signing permit...");
        const signature = await walletClient.signTypedData({
          domain: lpData.permitData.domain,
          types: lpData.permitData.types,
          primaryType: lpData.permitData.primaryType || "PermitBatch",
          message: lpData.permitData.values,
        });

        // Get final transaction with signature
        const finalResponse = await fetch(`${UNISWAP_API_URL}/lp/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({
            ...lpData.request,
            signature: signature,
          }),
        });

        if (finalResponse.ok) {
          const finalData = await finalResponse.json();
          lpData.transaction = finalData.transaction;
        }
      }

      // Send transaction
      setStep("Confirm in wallet...");
      const hash = await walletClient.sendTransaction({
        to: lpData.transaction.to as `0x${string}`,
        data: lpData.transaction.data as `0x${string}`,
        value: BigInt(lpData.transaction.value || "0"),
      });

      setTxHash(hash);
      setStep("Waiting for confirmation...");
      
      await publicClient.waitForTransactionReceipt({ hash });
      setSuccess(`Added ${amount0} ${token0.symbol} + ${amount1} ${token1.symbol} to pool!`);
      setAmount0("");
      setAmount1("");

    } catch (err: any) {
      console.error("Add liquidity error:", err);
      
      if (err.message === "V4_NOT_SUPPORTED") {
        setError("V4 LP via API is still in beta. Please use the manual method below.");
      } else if (err.message?.includes("User rejected")) {
        setError("Transaction cancelled");
      } else {
        setError(err.message || "Failed to add liquidity");
      }
    } finally {
      setIsLoading(false);
      setStep("");
    }
  };

  // API key check
  if (!apiKey) {
    return (
      <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 max-w-md mx-auto">
        <h2 className="text-xl font-bold mb-4">⚠️ API Key Required</h2>
        <p className="text-gray-300">Add NEXT_PUBLIC_UNISWAP_API_KEY to .env.local</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 text-center">
        <p className="text-gray-400">Connect to a supported network</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Add Liquidity</h2>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        )}
      </div>

      {/* Token 0 */}
      <div className="bg-gray-900/50 rounded-xl p-4 mb-3">
        <div className="flex justify-between mb-2">
          <span className="text-sm text-gray-400">Token 1</span>
          <button 
            onClick={() => setAmount0(balance0)}
            className="text-sm text-purple-400 hover:text-purple-300"
          >
            Balance: {parseFloat(balance0).toFixed(4)} (Max)
          </button>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={amount0}
            onChange={(e) => setAmount0(e.target.value)}
            placeholder="0.0"
            className="bg-transparent text-2xl font-medium w-full focus:outline-none"
          />
          <select
            value={token0?.address || ""}
            onChange={(e) => setToken0(tokens.find(t => t.address === e.target.value) || null)}
            className="bg-gray-700 rounded-lg px-3 py-2 font-medium"
          >
            {tokens.map((t) => (
              <option key={t.address} value={t.address}>{t.symbol}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Plus */}
      <div className="flex justify-center -my-1">
        <div className="bg-gray-700 rounded-lg p-2 text-gray-400">+</div>
      </div>

      {/* Token 1 */}
      <div className="bg-gray-900/50 rounded-xl p-4 mt-3 mb-4">
        <div className="flex justify-between mb-2">
          <span className="text-sm text-gray-400">Token 2</span>
          <button 
            onClick={() => setAmount1(balance1)}
            className="text-sm text-purple-400 hover:text-purple-300"
          >
            Balance: {parseFloat(balance1).toFixed(4)} (Max)
          </button>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={amount1}
            onChange={(e) => setAmount1(e.target.value)}
            placeholder="0.0"
            className="bg-transparent text-2xl font-medium w-full focus:outline-none"
          />
          <select
            value={token1?.address || ""}
            onChange={(e) => setToken1(tokens.find(t => t.address === e.target.value) || null)}
            className="bg-gray-700 rounded-lg px-3 py-2 font-medium"
          >
            {tokens.map((t) => (
              <option key={t.address} value={t.address}>{t.symbol}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Pool Info */}
      <div className="bg-purple-500/10 rounded-xl p-3 mb-4 border border-purple-500/20">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-400">Pool Type</span>
          <span className="text-purple-300">DynamicSwap V4</span>
        </div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-400">Fee Range</span>
          <span className="text-purple-300">0.30% - 1.00%</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Position Range</span>
          <span className="text-gray-300">Full Range</span>
        </div>
      </div>

      {/* Step Indicator */}
      {step && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span className="text-blue-400 text-sm">{step}</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
          <p className="text-red-400 text-sm mb-2">{error}</p>
          {error.includes("beta") && (
            <a
              href={`https://app.uniswap.org/add/${token0?.address}/${token1?.address}?chain=${config.name.toLowerCase()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white text-sm rounded-lg transition-colors"
            >
              Add via Uniswap ↗
            </a>
          )}
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mb-4">
          <p className="text-green-400 text-sm">{success}</p>
          {txHash && (
            <a
              href={`${config.explorer}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 text-sm mt-1 block"
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
      ) : !amount0 || !amount1 || parseFloat(amount0) === 0 || parseFloat(amount1) === 0 ? (
        <button disabled className="w-full py-4 bg-gray-700 text-gray-400 rounded-xl font-medium">
          Enter Amounts
        </button>
      ) : parseFloat(amount0) > parseFloat(balance0) || parseFloat(amount1) > parseFloat(balance1) ? (
        <button disabled className="w-full py-4 bg-red-500/50 text-white rounded-xl font-medium">
          Insufficient Balance
        </button>
      ) : (
        <button
          onClick={handleAddLiquidity}
          disabled={isLoading}
          className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white rounded-xl font-medium disabled:opacity-50 transition-all"
        >
          {isLoading ? "Processing..." : "Add Liquidity"}
        </button>
      )}

      {/* Info */}
      <p className="text-xs text-gray-500 text-center mt-3">
        Your position will earn dynamic fees from trades
      </p>
    </div>
  );
}
