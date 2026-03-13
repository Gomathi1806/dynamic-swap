'use client';

import { useState, useEffect } from 'react';
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits, encodeAbiParameters, parseAbiParameters } from 'viem';
import Link from 'next/link';

// Contract addresses per chain
const CONTRACTS: Record<number, {
  poolManager: `0x${string}`;
  positionManager: `0x${string}`;
  hook: `0x${string}`;
  weth: `0x${string}`;
  usdc: `0x${string}`;
  wethSymbol: string;
  usdcDecimals: number;
}> = {
  8453: {
    poolManager: '0x498581fF718922c3f8e6A244956aF099B2652b2b',
    positionManager: '0x7C5f5A4bBd8fD63184577525326123B519429bDc',
    hook: '0x14a8BF1bB6419bED0986a4c32F8Cd6341744E0c0',
    weth: '0x4200000000000000000000000000000000000006',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    wethSymbol: 'WETH',
    usdcDecimals: 6,
  },
  42220: {
    poolManager: '0x288dc841A52FCA2707c6947B3A777c5E56cd87BC',
    positionManager: '0x4Bb0eAB4907b34a8E58Bd4d7E8E8f0106A39A7DD',
    hook: '0xe96B2C7416596fE707ba40379B909F42F18d7FC0',
    weth: '0x471EcE3750Da237f93B8E339c536989b8978a438',
    usdc: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
    wethSymbol: 'CELO',
    usdcDecimals: 6,
  },
  130: {
    poolManager: '0x1F98400000000000000000000000000000000004',
    positionManager: '0x4529A01c7A0410167c5740C487A8DE60232617bf',
    hook: '0x1f998f20C0f10Ad0017639e60aa39befCc1b20c0',
    weth: '0x4200000000000000000000000000000000000006',
    usdc: '0x078D782b760474a361dDA0AF3839290b0EF57AD6',
    wethSymbol: 'WETH',
    usdcDecimals: 6,
  },
};

const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// Position Manager ABI - modifyLiquidities for V4
const POSITION_MANAGER_ABI = [
  {
    name: 'modifyLiquidities',
    type: 'function',
    inputs: [
      { name: 'unlockData', type: 'bytes' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'payable',
  },
] as const;

type View = 'list' | 'add';
type Step = 'input' | 'approve0' | 'approve1' | 'approved' | 'adding' | 'success' | 'error';

export default function PoolsPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();

  const [view, setView] = useState<View>('list');
  const [step, setStep] = useState<Step>('input');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const [token0Amount, setToken0Amount] = useState('0.001');
  const [token1Amount, setToken1Amount] = useState('10');

  const contracts = CONTRACTS[chainId];

  // Write hooks
  const { writeContractAsync, isPending: isWriting } = useWriteContract();

  // Read balances
  const { data: balance0 } = useReadContract({
    address: contracts?.weth,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  const { data: balance1 } = useReadContract({
    address: contracts?.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  // Read allowances
  const { data: allowance0, refetch: refetchAllowance0 } = useReadContract({
    address: contracts?.weth,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && contracts ? [address, contracts.positionManager] : undefined,
  });

  const { data: allowance1, refetch: refetchAllowance1 } = useReadContract({
    address: contracts?.usdc,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && contracts ? [address, contracts.positionManager] : undefined,
  });

  const amount0Wei = parseUnits(token0Amount || '0', 18);
  const amount1Wei = parseUnits(token1Amount || '0', contracts?.usdcDecimals || 6);

  const needs0Approval = !allowance0 || allowance0 < amount0Wei;
  const needs1Approval = !allowance1 || allowance1 < amount1Wei;

  const getChainName = () => {
    switch (chainId) {
      case 8453: return 'Base';
      case 42220: return 'Celo';
      case 130: return 'Unichain';
      default: return 'Unknown';
    }
  };

  const getExplorerUrl = (hash: string) => {
    switch (chainId) {
      case 8453: return `https://basescan.org/tx/${hash}`;
      case 42220: return `https://celoscan.io/tx/${hash}`;
      case 130: return `https://uniscan.xyz/tx/${hash}`;
      default: return '';
    }
  };

  const formatBalance = (balance: bigint | undefined, decimals: number) => {
    if (!balance) return '0.0000';
    return Number(formatUnits(balance, decimals)).toFixed(4);
  };

  // Handle approval for token 0 (WETH)
  const handleApprove0 = async () => {
    if (!contracts) return;
    setStep('approve0');
    setError(null);

    try {
      const hash = await writeContractAsync({
        address: contracts.weth,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [contracts.positionManager, amount0Wei * 100n], // Large approval
      });

      // Wait for confirmation
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      await refetchAllowance0();

      // Check if we still need approval for token 1
      if (needs1Approval) {
        await handleApprove1();
      } else {
        setStep('approved');
      }
    } catch (err: any) {
      console.error('Approval error:', err);
      setError(err.shortMessage || err.message || 'Approval failed');
      setStep('error');
    }
  };

  // Handle approval for token 1 (USDC)
  const handleApprove1 = async () => {
    if (!contracts) return;
    setStep('approve1');
    setError(null);

    try {
      const hash = await writeContractAsync({
        address: contracts.usdc,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [contracts.positionManager, amount1Wei * 100n], // Large approval
      });

      // Wait for confirmation
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      await refetchAllowance1();
      setStep('approved');
    } catch (err: any) {
      console.error('Approval error:', err);
      setError(err.shortMessage || err.message || 'Approval failed');
      setStep('error');
    }
  };

  // Handle add liquidity
  const handleAddLiquidity = async () => {
    if (!contracts || !address) return;

    setStep('adding');
    setError(null);

    try {
      // Sort tokens for PoolKey
      const [currency0, currency1] = contracts.weth.toLowerCase() < contracts.usdc.toLowerCase()
        ? [contracts.weth, contracts.usdc]
        : [contracts.usdc, contracts.weth];

      // For V4, we need to encode the proper unlockData
      // This is simplified - in production use proper SDK

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      // Simplified action encoding for MINT_POSITION + SETTLE_PAIR
      // Action bytes: 0x00 = MINT_POSITION, 0x10 = SETTLE_PAIR
      const actions = '0x0010' as `0x${string}`;

      // Tick range for full range
      const tickLower = -887200;
      const tickUpper = 887200;

      // Encode mint position params
      const mintParams = encodeAbiParameters(
        parseAbiParameters('address,address,uint24,int24,address,int24,int24,uint256,uint256,uint256,address,bytes'),
        [
          currency0,
          currency1,
          0x800000, // Dynamic fee flag
          200,      // Tick spacing
          contracts.hook,
          tickLower,
          tickUpper,
          amount0Wei,    // liquidity
          amount0Wei * 2n, // amount0Max with slippage
          amount1Wei * 2n, // amount1Max with slippage
          address,
          '0x' as `0x${string}`,
        ]
      );

      // Encode settle pair params
      const settleParams = encodeAbiParameters(
        parseAbiParameters('address,address'),
        [currency0, currency1]
      );

      // Combine into unlockData format
      const unlockData = encodeAbiParameters(
        parseAbiParameters('bytes,bytes[]'),
        [actions, [mintParams, settleParams]]
      );

      const hash = await writeContractAsync({
        address: contracts.positionManager,
        abi: POSITION_MANAGER_ABI,
        functionName: 'modifyLiquidities',
        args: [unlockData, deadline],
        value: amount0Wei, // Send ETH for WETH
      });

      setTxHash(hash);

      // Wait for confirmation
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      setStep('success');
    } catch (err: any) {
      console.error('Add liquidity error:', err);
      setError(err.shortMessage || err.message || 'Transaction failed');
      setStep('error');
    }
  };

  // Start approval flow
  const handleStartApproval = () => {
    if (needs0Approval) {
      handleApprove0();
    } else if (needs1Approval) {
      handleApprove1();
    } else {
      setStep('approved');
    }
  };

  // Reset to input state
  const resetForm = () => {
    setStep('input');
    setError(null);
    setTxHash(null);
  };

  if (!contracts) {
    return (
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-6 text-center">
            <h2 className="text-xl text-red-400 font-bold mb-2">Unsupported Network</h2>
            <p className="text-gray-400">Please switch to Base, Celo, or Unichain</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/10 to-gray-900">
      {/* Navigation */}
      <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              ⚡ DynamicSwap
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/" className="text-gray-400 hover:text-white transition-colors">Home</Link>
              <Link href="/pools" className="text-white font-semibold">Pools</Link>
              <Link href="/swap" className="text-gray-400 hover:text-white transition-colors">Swap</Link>
              <div className="px-3 py-1 bg-purple-900/50 rounded-full text-purple-300 text-sm">
                {getChainName()}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Liquidity Pools</h1>
            <p className="text-gray-400">Earn dynamic fees from 0.30% to 1.00% based on volatility</p>
          </div>
          {view === 'list' && (
            <button
              onClick={() => setView('add')}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl font-semibold transition-all"
            >
              + Add Liquidity
            </button>
          )}
        </div>

        {/* Pool List View */}
        {view === 'list' && (
          <div className="space-y-4">
            {/* Active Pool Card */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold border-2 border-gray-800">E</div>
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold border-2 border-gray-800">$</div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{contracts.wethSymbol} / USDC</h3>
                    <p className="text-sm text-gray-400">Dynamic Fee Pool</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-400">0.30% - 1.00%</div>
                  <div className="text-sm text-gray-400">Dynamic Fee Range</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 py-4 border-t border-gray-700">
                <div>
                  <div className="text-sm text-gray-400">Hook Address</div>
                  <div className="text-white font-mono text-sm truncate">{contracts.hook}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Tick Spacing</div>
                  <div className="text-white font-semibold">200</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Network</div>
                  <div className="text-white font-semibold">{getChainName()}</div>
                </div>
              </div>

              <button
                onClick={() => setView('add')}
                className="w-full mt-4 py-3 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded-xl font-semibold transition-colors border border-purple-500/30"
              >
                Add Liquidity to this Pool
              </button>
            </div>

            {/* Info Card */}
            <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-xl p-6 border border-purple-500/20">
              <h3 className="text-lg font-bold text-white mb-2">💡 How Dynamic Fees Work</h3>
              <p className="text-gray-300 text-sm">
                DynamicSwap automatically adjusts fees based on market volatility. During calm markets,
                fees stay low at 0.30%. When volatility spikes, fees increase up to 1.00% to protect
                liquidity providers from impermanent loss.
              </p>
            </div>
          </div>
        )}

        {/* Add Liquidity View */}
        {view === 'add' && (
          <div className="max-w-lg mx-auto">
            {/* Back Button */}
            <button
              onClick={() => {
                setView('list');
                resetForm();
              }}
              className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Pools
            </button>

            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">
              <h2 className="text-xl font-bold text-white mb-6">Add Liquidity</h2>

              {/* Success State */}
              {step === 'success' && (
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Success!</h3>
                  <p className="text-gray-400 mb-6">Your liquidity has been added to the pool.</p>

                  {txHash && (
                    <a
                      href={getExplorerUrl(txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 mb-6"
                    >
                      View on Explorer
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}

                  <div className="flex gap-4">
                    <button
                      onClick={() => {
                        setView('list');
                        resetForm();
                      }}
                      className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold transition-colors"
                    >
                      View Pools
                    </button>
                    <button
                      onClick={resetForm}
                      className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold transition-colors"
                    >
                      Add More
                    </button>
                  </div>
                </div>
              )}

              {/* Error State */}
              {step === 'error' && (
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Transaction Failed</h3>
                  <p className="text-red-400 text-sm mb-6 max-w-sm mx-auto">{error}</p>

                  <button
                    onClick={resetForm}
                    className="py-3 px-8 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Input/Processing States */}
              {step !== 'success' && step !== 'error' && (
                <>
                  {/* Token 0 Input */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Token 1</span>
                      <span className="text-gray-400">Balance: {formatBalance(balance0, 18)}</span>
                    </div>
                    <div className="flex items-center bg-gray-900/50 rounded-xl p-4 border border-gray-700">
                      <input
                        type="number"
                        value={token0Amount}
                        onChange={(e) => setToken0Amount(e.target.value)}
                        className="flex-1 bg-transparent text-2xl text-white outline-none placeholder-gray-500"
                        placeholder="0.0"
                        disabled={step !== 'input'}
                      />
                      <button
                        onClick={() => balance0 && setToken0Amount(formatUnits(balance0, 18))}
                        className="text-purple-400 text-sm mr-3 hover:text-purple-300"
                      >
                        MAX
                      </button>
                      <div className="bg-gray-700 px-4 py-2 rounded-xl">
                        <span className="text-white font-semibold">{contracts.wethSymbol}</span>
                      </div>
                    </div>
                  </div>

                  {/* Plus Icon */}
                  <div className="flex justify-center my-3">
                    <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center">
                      <span className="text-gray-400 text-xl">+</span>
                    </div>
                  </div>

                  {/* Token 1 Input */}
                  <div className="mb-6">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Token 2</span>
                      <span className="text-gray-400">Balance: {formatBalance(balance1, contracts.usdcDecimals)}</span>
                    </div>
                    <div className="flex items-center bg-gray-900/50 rounded-xl p-4 border border-gray-700">
                      <input
                        type="number"
                        value={token1Amount}
                        onChange={(e) => setToken1Amount(e.target.value)}
                        className="flex-1 bg-transparent text-2xl text-white outline-none placeholder-gray-500"
                        placeholder="0.0"
                        disabled={step !== 'input'}
                      />
                      <button
                        onClick={() => balance1 && setToken1Amount(formatUnits(balance1, contracts.usdcDecimals))}
                        className="text-purple-400 text-sm mr-3 hover:text-purple-300"
                      >
                        MAX
                      </button>
                      <div className="bg-gray-700 px-4 py-2 rounded-xl">
                        <span className="text-white font-semibold">USDC</span>
                      </div>
                    </div>
                  </div>

                  {/* Pool Info */}
                  <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-2 text-purple-300 text-sm">
                      <span className="text-lg">⚡</span>
                      <span>Pool uses Dynamic Fee: 0.30% - 1.00% (Tick spacing: 200)</span>
                    </div>
                  </div>

                  {/* Status Messages */}
                  {step === 'approve0' && (
                    <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4 mb-4">
                      <div className="flex items-center gap-3 text-yellow-300">
                        <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                        <span>Approving {contracts.wethSymbol}... Please confirm in wallet</span>
                      </div>
                    </div>
                  )}

                  {step === 'approve1' && (
                    <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4 mb-4">
                      <div className="flex items-center gap-3 text-yellow-300">
                        <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                        <span>Approving USDC... Please confirm in wallet</span>
                      </div>
                    </div>
                  )}

                  {step === 'approved' && (
                    <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4 mb-4">
                      <div className="flex items-center gap-2 text-green-300">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Tokens approved! Click below to add liquidity.</span>
                      </div>
                    </div>
                  )}

                  {step === 'adding' && (
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 mb-4">
                      <div className="flex items-center gap-3 text-blue-300">
                        <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        <span>Adding liquidity... Please confirm in wallet</span>
                      </div>
                    </div>
                  )}

                  {/* Action Button */}
                  {!isConnected ? (
                    <button
                      disabled
                      className="w-full py-4 bg-gray-700 text-gray-400 rounded-xl font-semibold cursor-not-allowed"
                    >
                      Connect Wallet
                    </button>
                  ) : step === 'input' ? (
                    needs0Approval || needs1Approval ? (
                      <button
                        onClick={handleStartApproval}
                        disabled={!token0Amount || !token1Amount || Number(token0Amount) <= 0 || Number(token1Amount) <= 0}
                        className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all"
                      >
                        Approve Tokens
                      </button>
                    ) : (
                      <button
                        onClick={handleAddLiquidity}
                        disabled={!token0Amount || !token1Amount || Number(token0Amount) <= 0 || Number(token1Amount) <= 0}
                        className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all"
                      >
                        Add Liquidity
                      </button>
                    )
                  ) : step === 'approve0' || step === 'approve1' ? (
                    <button
                      disabled
                      className="w-full py-4 bg-gray-700 text-gray-400 rounded-xl font-semibold cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      Approving...
                    </button>
                  ) : step === 'approved' ? (
                    <button
                      onClick={handleAddLiquidity}
                      className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl font-semibold transition-all"
                    >
                      Add Liquidity
                    </button>
                  ) : step === 'adding' ? (
                    <button
                      disabled
                      className="w-full py-4 bg-gray-700 text-gray-400 rounded-xl font-semibold cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      Adding Liquidity...
                    </button>
                  ) : null}
                </>
              )}
            </div>

            {/* Info Card */}
            {step !== 'success' && step !== 'error' && (
              <div className="mt-6 bg-gray-800/30 rounded-xl p-4">
                <h4 className="text-white font-semibold mb-2">📋 How it works</h4>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>1. Approve both tokens for the Position Manager</li>
                  <li>2. Add liquidity creates a full-range position</li>
                  <li>3. Earn dynamic fees that adjust with volatility</li>
                  <li>4. Higher volatility = higher fees = better LP protection</li>
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
