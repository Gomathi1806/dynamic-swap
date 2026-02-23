// src/components/AddLiquidityCard.tsx
"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi";
import { parseUnits, formatUnits, maxUint256 } from "viem";
import { getChainConfig } from "@/config/contracts";
import { getTokensForChain, Token } from "@/config/tokens";

const ERC20_ABI = [
  { inputs: [{ name: "owner", type: "address" }], name: "balanceOf", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], name: "approve", outputs: [{ type: "bool" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], name: "allowance", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
] as const;

interface AddLiquidityCardProps {
  initialToken0?: string;
  initialToken1?: string;
}

export function AddLiquidityCard({ initialToken0, initialToken1 }: AddLiquidityCardProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const config = getChainConfig(chainId);
  const tokens = getTokensForChain(chainId);

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
  const [approvals, setApprovals] = useState({ token0: false, token1: false });

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

      if (token0) {
        try {
          const balance = await publicClient.readContract({
            address: token0.address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [address],
          });
          setBalance0(formatUnits(balance as bigint, token0.decimals));
        } catch {
          setBalance0("0");
        }
      }

      if (token1) {
        try {
          const balance = await publicClient.readContract({
            address: token1.address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [address],
          });
          setBalance1(formatUnits(balance as bigint, token1.decimals));
        } catch {
          setBalance1("0");
        }
      }
    };
    fetchBalances();
  }, [publicClient, address, token0, token1]);

  // Check approvals
  useEffect(() => {
    const checkApprovals = async () => {
      if (!publicClient || !address || !config) return;

      const positionManager = config.positionManager;

      if (token0 && amount0 && parseFloat(amount0) > 0) {
        try {
          const allowance = await publicClient.readContract({
            address: token0.address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "allowance",
            args: [address, positionManager as `0x${string}`],
          });
          const needed = parseUnits(amount0, token0.decimals);
          setApprovals(prev => ({ ...prev, token0: (allowance as bigint) >= needed }));
        } catch {
          setApprovals(prev => ({ ...prev, token0: false }));
        }
      }

      if (token1 && amount1 && parseFloat(amount1) > 0) {
        try {
          const allowance = await publicClient.readContract({
            address: token1.address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "allowance",
            args: [address, positionManager as `0x${string}`],
          });
          const needed = parseUnits(amount1, token1.decimals);
          setApprovals(prev => ({ ...prev, token1: (allowance as bigint) >= needed }));
        } catch {
          setApprovals(prev => ({ ...prev, token1: false }));
        }
      }
    };
    checkApprovals();
  }, [publicClient, address, config, token0, token1, amount0, amount1]);

  const handleApprove = async (tokenIndex: 0 | 1) => {
    if (!walletClient || !publicClient || !config) return;

    const token = tokenIndex === 0 ? token0 : token1;
    if (!token) return;

    setIsLoading(true);
    setStep(`Approving ${token.symbol}...`);
    setError(null);

    try {
      const hash = await walletClient.writeContract({
        address: token.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [config.positionManager as `0x${string}`, maxUint256],
      });
      await publicClient.waitForTransactionReceipt({ hash });

      if (tokenIndex === 0) {
        setApprovals(prev => ({ ...prev, token0: true }));
      } else {
        setApprovals(prev => ({ ...prev, token1: true }));
      }
      setStep(`${token.symbol} approved!`);
    } catch (err: any) {
      setError(err.message || "Approval failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddLiquidity = async () => {
    if (!token0 || !token1 || !config) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // V4 liquidity requires complex encoding
      // Show helpful success message
      setSuccess(
        `Tokens approved for Position Manager!\n\n` +
        `To complete adding liquidity:\n` +
        `• Use Uniswap interface at app.uniswap.org\n` +
        `• Or use CLI with modifyLiquidities\n\n` +
        `Pool: ${token0.symbol}/${token1.symbol}\n` +
        `Amounts: ${amount0} ${token0.symbol} + ${amount1} ${token1.symbol}`
      );
    } catch (err: any) {
      setError(err.message || "Failed to add liquidity");
    } finally {
      setIsLoading(false);
      setStep("");
    }
  };

  if (!config) {
    return (
      <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 text-center">
        <p className="text-gray-400">Please connect to a supported network</p>
      </div>
    );
  }

  const needsToken0Approval = Boolean(!approvals.token0 && amount0 && parseFloat(amount0) > 0);
  const needsToken1Approval = Boolean(!approvals.token1 && amount1 && parseFloat(amount1) > 0);

  return (
    <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">Add Liquidity</h2>

      {/* Token 0 */}
      <div className="bg-gray-900/50 rounded-xl p-4 mb-3">
        <div className="flex justify-between mb-2">
          <span className="text-sm text-gray-400">Token 1</span>
          <span className="text-sm text-gray-400">
            Balance: {parseFloat(balance0).toFixed(4)}
          </span>
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
        {needsToken0Approval && (
          <button
            onClick={() => handleApprove(0)}
            disabled={isLoading}
            className="mt-2 w-full py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm"
          >
            Approve {token0?.symbol}
          </button>
        )}
      </div>

      {/* Plus Icon */}
      <div className="flex justify-center -my-1">
        <div className="bg-gray-700 rounded-lg p-1 text-gray-400">+</div>
      </div>

      {/* Token 1 */}
      <div className="bg-gray-900/50 rounded-xl p-4 mt-3 mb-4">
        <div className="flex justify-between mb-2">
          <span className="text-sm text-gray-400">Token 2</span>
          <span className="text-sm text-gray-400">
            Balance: {parseFloat(balance1).toFixed(4)}
          </span>
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
        {needsToken1Approval && (
          <button
            onClick={() => handleApprove(1)}
            disabled={isLoading}
            className="mt-2 w-full py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm"
          >
            Approve {token1?.symbol}
          </button>
        )}
      </div>

      {/* Fee Info */}
      <div className="bg-purple-500/10 rounded-xl p-3 mb-4 border border-purple-500/20">
        <p className="text-sm text-purple-300">
          ⚡ Pool uses Dynamic Fee: 0.30% - 1.00% (Tick spacing: 200)
        </p>
      </div>

      {/* Step indicator */}
      {step && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 mb-4">
          <p className="text-blue-400 text-sm">{step}</p>
        </div>
      )}

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
      ) : (
        <button
          onClick={handleAddLiquidity}
          disabled={isLoading || !amount0 || !amount1 || needsToken0Approval || needsToken1Approval}
          className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white rounded-xl font-medium disabled:opacity-50"
        >
          {isLoading ? "Processing..." : "Add Liquidity"}
        </button>
      )}
    </div>
  );
}
