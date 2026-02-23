// src/components/SwapCard.tsx
"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi";
import { parseUnits, formatUnits, maxUint256 } from "viem";
import { getChainConfig, SUPPORTED_CHAINS } from "@/config/contracts";
import { getTokensForChain, Token } from "@/config/tokens";

const ERC20_ABI = [
  { inputs: [{ name: "owner", type: "address" }], name: "balanceOf", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], name: "approve", outputs: [{ type: "bool" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], name: "allowance", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
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

  const [tokenIn, setTokenIn] = useState<Token | null>(null);
  const [tokenOut, setTokenOut] = useState<Token | null>(null);
  const [amountIn, setAmountIn] = useState("");
  const [amountOut, setAmountOut] = useState("~0.00");
  const [balanceIn, setBalanceIn] = useState("0");
  const [isLoading, setIsLoading] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  // Fetch balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (!publicClient || !address || !tokenIn) return;
      try {
        const balance = await publicClient.readContract({
          address: tokenIn.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address],
        });
        setBalanceIn(formatUnits(balance as bigint, tokenIn.decimals));
      } catch {
        setBalanceIn("0");
      }
    };
    fetchBalance();
  }, [publicClient, address, tokenIn]);

  // Check approval
  useEffect(() => {
    const checkApproval = async () => {
      if (!publicClient || !address || !tokenIn || !config || !amountIn || parseFloat(amountIn) === 0) {
        setNeedsApproval(false);
        return;
      }
      try {
        const allowance = await publicClient.readContract({
          address: tokenIn.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [address, config.permit2 as `0x${string}`],
        });
        const amount = parseUnits(amountIn, tokenIn.decimals);
        setNeedsApproval((allowance as bigint) < amount);
      } catch {
        setNeedsApproval(true);
      }
    };
    checkApproval();
  }, [publicClient, address, tokenIn, config, amountIn]);

  // Estimate output (simple 1:1 for demo - real would use quoter)
  useEffect(() => {
    if (amountIn && parseFloat(amountIn) > 0 && tokenIn && tokenOut) {
      // Simple estimate - in production use Quoter contract
      const fee = 0.003; // 0.3% base fee
      const estimated = parseFloat(amountIn) * (1 - fee);
      setAmountOut(`~${estimated.toFixed(6)}`);
    } else {
      setAmountOut("~0.00");
    }
  }, [amountIn, tokenIn, tokenOut]);

  const handleApprove = async () => {
    if (!walletClient || !publicClient || !tokenIn || !config) return;
    setIsApproving(true);
    setError(null);
    try {
      const hash = await walletClient.writeContract({
        address: tokenIn.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [config.permit2 as `0x${string}`, maxUint256],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setNeedsApproval(false);
      setSuccess("Token approved!");
    } catch (err: any) {
      setError(err.message || "Approval failed");
    } finally {
      setIsApproving(false);
    }
  };

  const handleSwap = async () => {
    if (!walletClient || !tokenIn || !tokenOut || !config) return;
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      // Note: Full V4 swap requires Universal Router encoding
      // For now, show helpful message
      setSuccess(
        `Token approved for swap!\n\n` +
        `To complete: Use Uniswap at app.uniswap.org\n` +
        `Pool: ${tokenIn.symbol}/${tokenOut.symbol}\n` +
        `Amount: ${amountIn} ${tokenIn.symbol}`
      );
    } catch (err: any) {
      setError(err.message || "Swap failed");
    } finally {
      setIsLoading(false);
    }
  };

  const switchTokens = () => {
    const temp = tokenIn;
    setTokenIn(tokenOut);
    setTokenOut(temp);
    setAmountIn("");
  };

  if (!config) {
    return (
      <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 text-center">
        <p className="text-gray-400">Please connect to a supported network (Base, Optimism, or Celo)</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">Swap</h2>

      {/* Token In */}
      <div className="bg-gray-900/50 rounded-xl p-4 mb-2">
        <div className="flex justify-between mb-2">
          <span className="text-sm text-gray-400">You pay</span>
          <span className="text-sm text-gray-400">
            Balance: {parseFloat(balanceIn).toFixed(4)}
          </span>
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
            onChange={(e) => setTokenIn(tokens.find(t => t.address === e.target.value) || null)}
            className="bg-gray-700 rounded-lg px-3 py-2 font-medium"
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
          className="bg-gray-700 hover:bg-gray-600 rounded-xl p-2 border-4 border-gray-800"
        >
          ↓↑
        </button>
      </div>

      {/* Token Out */}
      <div className="bg-gray-900/50 rounded-xl p-4 mt-2 mb-4">
        <div className="flex justify-between mb-2">
          <span className="text-sm text-gray-400">You receive</span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={amountOut}
            readOnly
            className="bg-transparent text-2xl font-medium w-full focus:outline-none text-gray-400"
          />
          <select
            value={tokenOut?.address || ""}
            onChange={(e) => setTokenOut(tokens.find(t => t.address === e.target.value) || null)}
            className="bg-gray-700 rounded-lg px-3 py-2 font-medium"
          >
            {tokens.map((t) => (
              <option key={t.address} value={t.address}>{t.symbol}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Fee Info */}
      <div className="bg-purple-500/10 rounded-xl p-3 mb-4 border border-purple-500/20">
        <p className="text-sm text-purple-300">
          ⚡ Dynamic Fee: 0.30% - 1.00% based on volatility
        </p>
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
        </div>
      )}

      {/* Action Button */}
      {!isConnected ? (
        <button disabled className="w-full py-4 bg-gray-700 text-gray-400 rounded-xl font-medium">
          Connect Wallet
        </button>
      ) : needsApproval ? (
        <button
          onClick={handleApprove}
          disabled={isApproving}
          className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white rounded-xl font-medium disabled:opacity-50"
        >
          {isApproving ? "Approving..." : `Approve ${tokenIn?.symbol}`}
        </button>
      ) : (
        <button
          onClick={handleSwap}
          disabled={isLoading || !amountIn || parseFloat(amountIn) === 0}
          className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white rounded-xl font-medium disabled:opacity-50"
        >
          {isLoading ? "Swapping..." : "Swap"}
        </button>
      )}
    </div>
  );
}
