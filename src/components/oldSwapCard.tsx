// src/components/SwapCard.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { getChainConfig } from "@/config/contracts";
import { getTokensForChain, Token } from "@/config/tokens";

// Uniswap API
const UNISWAP_API_URL = "https://api.uniswap.org/v2";

const ERC20_ABI = [
  { inputs: [{ name: "owner", type: "address" }], name: "balanceOf", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
] as const;

interface SwapCardProps {
  initialToken0?: string;
  initialToken1?: string;
}

export function SwapCard({ initialToken0, initialToken1 }: SwapCardProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const config = getChainConfig(chainId);
  const tokens = getTokensForChain(chainId);
  const apiKey = process.env.NEXT_PUBLIC_UNISWAP_API_KEY || "";

  const [tokenIn, setTokenIn] = useState<Token | null>(null);
  const [tokenOut, setTokenOut] = useState<Token | null>(null);
  const [amountIn, setAmountIn] = useState("");
  const [amountOut, setAmountOut] = useState("");
  const [balanceIn, setBalanceIn] = useState("0");
  const [balanceOut, setBalanceOut] = useState("0");
  const [quote, setQuote] = useState<any>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [swapStep, setSwapStep] = useState("");

  // Initialize tokens
  useEffect(() => {
    if (tokens.length >= 2) {
      const t0 = initialToken0 
        ? tokens.find(t => t.address.toLowerCase() === initialToken0.toLowerCase()) 
        : tokens[0];
      const t1 = initialToken1 
        ? tokens.find(t => t.address.toLowerCase() === initialToken1.toLowerCase()) 
        : tokens[1];
      setTokenIn(t0 || tokens[0]);
      setTokenOut(t1 || tokens[1]);
    }
  }, [tokens, initialToken0, initialToken1]);

  // Fetch balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!publicClient || !address) return;
      
      if (tokenIn) {
        try {
          const balance = await publicClient.readContract({
            address: tokenIn.address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [address],
          });
          setBalanceIn(formatUnits(balance as bigint, tokenIn.decimals));
        } catch { setBalanceIn("0"); }
      }

      if (tokenOut) {
        try {
          const balance = await publicClient.readContract({
            address: tokenOut.address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [address],
          });
          setBalanceOut(formatUnits(balance as bigint, tokenOut.decimals));
        } catch { setBalanceOut("0"); }
      }
    };
    fetchBalances();
  }, [publicClient, address, tokenIn, tokenOut]);

  // Fetch quote
  const fetchQuote = useCallback(async () => {
    if (!tokenIn || !tokenOut || !amountIn || parseFloat(amountIn) === 0 || !address || !apiKey) {
      setAmountOut("");
      setQuote(null);
      return;
    }

    setIsLoadingQuote(true);
    setError(null);

    try {
      const amountInWei = parseUnits(amountIn, tokenIn.decimals).toString();

      const response = await fetch(`${UNISWAP_API_URL}/quote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
          tokenInChainId: chainId,
          tokenOutChainId: chainId,
          amount: amountInWei,
          type: "EXACT_INPUT",
          swapper: address,
          slippageTolerance: 50,
          protocols: ["V4", "V3", "V2"],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || errorData.errorCode || "No route found");
      }

      const data = await response.json();
      console.log("Quote response:", data);
      setQuote(data);

      // Parse output amount
      let outputAmount = "0";
      if (data.quote?.output?.amount) {
        outputAmount = formatUnits(BigInt(data.quote.output.amount), tokenOut.decimals);
      } else if (data.quote?.amountOut) {
        outputAmount = formatUnits(BigInt(data.quote.amountOut), tokenOut.decimals);
      }
      setAmountOut(parseFloat(outputAmount).toFixed(6));

    } catch (err: any) {
      console.error("Quote error:", err);
      setAmountOut("");
      setQuote(null);
      if (err.message && !err.message.includes("No route")) {
        setError(err.message);
      }
    } finally {
      setIsLoadingQuote(false);
    }
  }, [tokenIn, tokenOut, amountIn, address, chainId, apiKey]);

  // Debounced quote
  useEffect(() => {
    const timer = setTimeout(fetchQuote, 500);
    return () => clearTimeout(timer);
  }, [fetchQuote]);

  // Execute swap
  const handleSwap = async () => {
    if (!walletClient || !publicClient || !quote || !address || !tokenIn || !tokenOut) return;

    setIsSwapping(true);
    setError(null);
    setSuccess(null);
    setTxHash(null);

    try {
      let signature: string | undefined;
      const permitData = quote.permitData;

      // Step 1: Sign Permit2 if needed
      if (permitData) {
        setSwapStep("Signing permit (1/2)...");
        console.log("Signing permit2...", permitData);
        
        signature = await walletClient.signTypedData({
          domain: permitData.domain,
          types: permitData.types,
          primaryType: "PermitSingle",
          message: permitData.values,
        });
        console.log("Permit signed!");
      }

      // Step 2: Get swap transaction
      setSwapStep("Building transaction (2/2)...");
      
      const swapBody: any = {
        quote: quote,
      };
      
      if (signature && permitData) {
        swapBody.signature = signature;
        swapBody.permitData = permitData;
      }

      const swapResponse = await fetch(`${UNISWAP_API_URL}/swap`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(swapBody),
      });

      if (!swapResponse.ok) {
        const errorData = await swapResponse.json();
        console.error("Swap API error:", errorData);
        throw new Error(errorData.detail || errorData.message || "Failed to build swap");
      }

      const swapData = await swapResponse.json();
      console.log("Swap data:", swapData);

      // Step 3: Send transaction
      setSwapStep("Confirm in wallet...");
      
      const hash = await walletClient.sendTransaction({
        to: swapData.swap.to as `0x${string}`,
        data: swapData.swap.data as `0x${string}`,
        value: BigInt(swapData.swap.value || "0"),
      });

      setTxHash(hash);
      setSwapStep("Waiting for confirmation...");

      await publicClient.waitForTransactionReceipt({ hash });
      
      setSuccess(`Swapped ${amountIn} ${tokenIn.symbol} for ~${amountOut} ${tokenOut.symbol}`);
      setAmountIn("");
      setAmountOut("");
      setQuote(null);

    } catch (err: any) {
      console.error("Swap error:", err);
      if (err.message?.includes("User rejected")) {
        setError("Transaction cancelled");
      } else {
        setError(err.message || "Swap failed");
      }
    } finally {
      setIsSwapping(false);
      setSwapStep("");
    }
  };

  const switchTokens = () => {
    const temp = tokenIn;
    setTokenIn(tokenOut);
    setTokenOut(temp);
    setAmountIn(amountOut);
    setAmountOut("");
    setQuote(null);
  };

  const setMaxAmount = () => {
    setAmountIn(balanceIn);
  };

  // API key check
  if (!apiKey) {
    return (
      <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 max-w-md mx-auto">
        <h2 className="text-xl font-bold mb-4">⚠️ API Key Required</h2>
        <p className="text-gray-300 mb-4">Add your Uniswap API key to <code className="bg-gray-700 px-1 rounded">.env.local</code>:</p>
        <code className="block bg-gray-900 p-3 rounded text-sm text-green-400 break-all">
          NEXT_PUBLIC_UNISWAP_API_KEY=your_key_here
        </code>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 text-center">
        <p className="text-gray-400">Connect to Base, Optimism, or Celo</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Swap</h2>
        <span className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">
          Powered by DynamicSwap
        </span>
      </div>

      {/* Token In */}
      <div className="bg-gray-900/50 rounded-xl p-4 mb-2">
        <div className="flex justify-between mb-2">
          <span className="text-sm text-gray-400">You pay</span>
          <button 
            onClick={setMaxAmount}
            className="text-sm text-purple-400 hover:text-purple-300"
          >
            Balance: {parseFloat(balanceIn).toFixed(4)} (Max)
          </button>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
            placeholder="0.0"
            className="bg-transparent text-2xl font-medium w-full focus:outline-none"
          />
          <select
            value={tokenIn?.address || ""}
            onChange={(e) => {
              const token = tokens.find(t => t.address === e.target.value);
              if (token) setTokenIn(token);
            }}
            className="bg-gray-700 rounded-lg px-3 py-2 font-medium min-w-[100px]"
          >
            {tokens.map((t) => (
              <option key={t.address} value={t.address}>{t.symbol}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Switch Button */}
      <div className="flex justify-center -my-2 relative z-10">
        <button
          onClick={switchTokens}
          className="bg-gray-700 hover:bg-gray-600 rounded-xl p-2 border-4 border-gray-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </button>
      </div>

      {/* Token Out */}
      <div className="bg-gray-900/50 rounded-xl p-4 mt-2 mb-4">
        <div className="flex justify-between mb-2">
          <span className="text-sm text-gray-400">You receive</span>
          <span className="text-sm text-gray-400">
            Balance: {parseFloat(balanceOut).toFixed(4)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={isLoadingQuote ? "..." : amountOut || "0.0"}
            readOnly
            className="bg-transparent text-2xl font-medium w-full focus:outline-none text-gray-300"
          />
          <select
            value={tokenOut?.address || ""}
            onChange={(e) => {
              const token = tokens.find(t => t.address === e.target.value);
              if (token) setTokenOut(token);
            }}
            className="bg-gray-700 rounded-lg px-3 py-2 font-medium min-w-[100px]"
          >
            {tokens.map((t) => (
              <option key={t.address} value={t.address}>{t.symbol}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Quote Details */}
      {quote && (
        <div className="bg-purple-500/10 rounded-xl p-3 mb-4 border border-purple-500/20 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Route</span>
            <span className="text-purple-300">{quote.routing || "Classic"}</span>
          </div>
          {quote.quote?.priceImpact && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Price Impact</span>
              <span className={parseFloat(quote.quote.priceImpact) > 1 ? "text-yellow-400" : "text-gray-300"}>
                {quote.quote.priceImpact}%
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Slippage</span>
            <span className="text-gray-300">0.5%</span>
          </div>
        </div>
      )}

      {/* Dynamic Fee Info */}
      <div className="bg-gray-700/30 rounded-xl p-3 mb-4">
        <p className="text-sm text-gray-400">
          ⚡ Routes through DynamicSwap V4 pools with 0.30%-1.00% dynamic fees
        </p>
      </div>

      {/* Swap Step Indicator */}
      {swapStep && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span className="text-blue-400 text-sm">{swapStep}</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mb-4">
          <p className="text-green-400 text-sm">{success}</p>
          {txHash && config && (
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
      ) : !amountIn || parseFloat(amountIn) === 0 ? (
        <button disabled className="w-full py-4 bg-gray-700 text-gray-400 rounded-xl font-medium">
          Enter Amount
        </button>
      ) : parseFloat(amountIn) > parseFloat(balanceIn) ? (
        <button disabled className="w-full py-4 bg-red-500/50 text-white rounded-xl font-medium">
          Insufficient {tokenIn?.symbol} Balance
        </button>
      ) : isLoadingQuote ? (
        <button disabled className="w-full py-4 bg-gray-700 text-gray-400 rounded-xl font-medium">
          Getting Quote...
        </button>
      ) : !quote ? (
        <button disabled className="w-full py-4 bg-gray-700 text-gray-400 rounded-xl font-medium">
          No Route Found
        </button>
      ) : (
        <button
          onClick={handleSwap}
          disabled={isSwapping}
          className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white rounded-xl font-medium disabled:opacity-50 transition-all"
        >
          {isSwapping ? "Swapping..." : "Swap"}
        </button>
      )}
    </div>
  );
}
