'use client';

import { useState, useEffect } from 'react';
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits, encodeFunctionData, encodeAbiParameters, parseAbiParameters } from 'viem';
import { useRouter } from 'next/navigation';

// Contract addresses per chain
const CONTRACTS: Record<number, {
  poolManager: `0x${string}`;
  positionManager: `0x${string}`;
  hook: `0x${string}`;
  weth: `0x${string}`;
  usdc: `0x${string}`;
  permit2: `0x${string}`;
}> = {
  8453: { // Base
    poolManager: '0x498581fF718922c3f8e6A244956aF099B2652b2b',
    positionManager: '0x7C5f5A4bBd8fD63184577525326123B519429bDc',
    hook: '0x14a8BF1bB6419bED0986a4c32F8Cd6341744E0c0',
    weth: '0x4200000000000000000000000000000000000006',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  },
  42220: { // Celo
    poolManager: '0x288dc841A52FCA2707c6947B3A777c5E56cd87BC',
    positionManager: '0x4Bb0eAB4907b34a8E58Bd4d7E8E8f0106A39A7DD',
    hook: '0xe96B2C7416596fE707ba40379B909F42F18d7FC0',
    weth: '0x471EcE3750Da237f93B8E339c536989b8978a438', // CELO
    usdc: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  },
  130: { // Unichain
    poolManager: '0x1F98400000000000000000000000000000000004',
    positionManager: '0x4529A01c7A0410167c5740C487A8DE60232617bf',
    hook: '0x1f998f20C0f10Ad0017639e60aa39befCc1b20c0',
    weth: '0x4200000000000000000000000000000000000006',
    usdc: '0x078D782b760474a361dDA0AF3839290b0EF57AD6',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  },
};

// ABIs
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

// Position Manager ABI for modifyLiquidities
const POSITION_MANAGER_ABI = [
  {
    name: 'modifyLiquidities',
    type: 'function',
    inputs: [
      { name: 'unlockData', type: 'bytes' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    name: 'multicall',
    type: 'function',
    inputs: [{ name: 'data', type: 'bytes[]' }],
    outputs: [{ name: 'results', type: 'bytes[]' }],
    stateMutability: 'payable',
  },
] as const;

// Actions enum for Position Manager
const Actions = {
  MINT_POSITION: 0,
  INCREASE_LIQUIDITY: 1,
  DECREASE_LIQUIDITY: 2,
  BURN_POSITION: 3,
  SETTLE_PAIR: 16,
  TAKE_PAIR: 17,
  SETTLE: 18,
  TAKE: 19,
  CLOSE_CURRENCY: 20,
  SWEEP: 23,
};

type Step = 'input' | 'approving' | 'approved' | 'adding' | 'success' | 'error';

export default function AddLiquidity() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const [token0Amount, setToken0Amount] = useState('0.001');
  const [token1Amount, setToken1Amount] = useState('10');
  const [step, setStep] = useState<Step>('input');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const contracts = CONTRACTS[chainId];

  // Write contract hooks
  const { writeContract: approveToken0, data: approve0Hash, isPending: isApproving0 } = useWriteContract();
  const { writeContract: approveToken1, data: approve1Hash, isPending: isApproving1 } = useWriteContract();
  const { writeContract: addLiquidity, data: addLiquidityHash, isPending: isAddingLiquidity } = useWriteContract();

  // Wait for transactions
  const { isSuccess: approve0Success } = useWaitForTransactionReceipt({ hash: approve0Hash });
  const { isSuccess: approve1Success } = useWaitForTransactionReceipt({ hash: approve1Hash });
  const { isSuccess: addLiquiditySuccess, isError: addLiquidityError } = useWaitForTransactionReceipt({ hash: addLiquidityHash });

  // Check allowances
  const { data: allowance0 } = useReadContract({
    address: contracts?.weth,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, contracts?.positionManager] : undefined,
  });

  const { data: allowance1 } = useReadContract({
    address: contracts?.usdc,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, contracts?.positionManager] : undefined,
  });

  // Check balances
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

  // Update step based on transaction status
  useEffect(() => {
    if (approve0Success && approve1Success && step === 'approving') {
      setStep('approved');
    }
  }, [approve0Success, approve1Success, step]);

  useEffect(() => {
    if (addLiquiditySuccess) {
      setStep('success');
      setTxHash(addLiquidityHash || null);
    }
    if (addLiquidityError) {
      setStep('error');
      setError('Liquidity transaction failed');
    }
  }, [addLiquiditySuccess, addLiquidityError, addLiquidityHash]);

  if (!contracts) {
    return (
      <div className="p-6 bg-red-900/50 rounded-xl text-red-200">
        Unsupported chain. Please switch to Base, Celo, or Unichain.
      </div>
    );
  }

  const amount0Wei = parseUnits(token0Amount || '0', 18);
  const amount1Wei = parseUnits(token1Amount || '0', 6); // USDC is 6 decimals

  const needs0Approval = !allowance0 || allowance0 < amount0Wei;
  const needs1Approval = !allowance1 || allowance1 < amount1Wei;
  const needsApproval = needs0Approval || needs1Approval;

  // Encode the modifyLiquidities call data for Uniswap V4 Position Manager
  const encodeAddLiquidityData = () => {
    // PoolKey structure
    const currency0 = contracts.weth < contracts.usdc ? contracts.weth : contracts.usdc;
    const currency1 = contracts.weth < contracts.usdc ? contracts.usdc : contracts.weth;

    // Tick range for full range liquidity
    const tickLower = -887200; // Near MIN_TICK for tick spacing 200
    const tickUpper = 887200;  // Near MAX_TICK for tick spacing 200

    // Amount of liquidity to add (simplified - in production use proper calculation)
    const liquidityDelta = amount0Wei; // Simplified

    // Encode actions for MINT_POSITION + SETTLE_PAIR
    const actions = new Uint8Array([Actions.MINT_POSITION, Actions.SETTLE_PAIR]);

    // Params for MINT_POSITION
    const mintParams = encodeAbiParameters(
      parseAbiParameters('address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks, int24 tickLower, int24 tickUpper, uint256 liquidity, uint256 amount0Max, uint256 amount1Max, address owner, bytes hookData'),
      [
        currency0,
        currency1,
        0x800000, // Dynamic fee flag
        200,      // Tick spacing
        contracts.hook,
        tickLower,
        tickUpper,
        liquidityDelta,
        amount0Wei * 2n, // Slippage buffer
        amount1Wei * 2n, // Slippage buffer
        address!,
        '0x' as `0x${string}`,
      ]
    );

    // Params for SETTLE_PAIR
    const settleParams = encodeAbiParameters(
      parseAbiParameters('address currency0, address currency1'),
      [currency0, currency1]
    );

    return { actions, params: [mintParams, settleParams] };
  };

  const handleApprove = async () => {
    if (!address) return;
    setStep('approving');
    setError(null);

    try {
      if (needs0Approval) {
        await approveToken0({
          address: contracts.weth,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [contracts.positionManager, amount0Wei * 10n], // 10x for buffer
        });
      }

      if (needs1Approval) {
        await approveToken1({
          address: contracts.usdc,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [contracts.positionManager, amount1Wei * 10n], // 10x for buffer
        });
      }
    } catch (err: any) {
      setStep('error');
      setError(err.message || 'Approval failed');
    }
  };

  const handleAddLiquidity = async () => {
    if (!address) return;
    setStep('adding');
    setError(null);

    try {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour

      // For V4, we need to use the Position Manager's modifyLiquidities
      // This is a simplified version - in production you'd use proper encoding

      // Encode the unlock data
      const { actions, params } = encodeAddLiquidityData();

      // Combine actions and params into unlockData
      // Format: abi.encode(actions[], params[])
      const unlockData = encodeAbiParameters(
        parseAbiParameters('bytes actions, bytes[] params'),
        [
          `0x${Buffer.from(actions).toString('hex')}` as `0x${string}`,
          params as readonly `0x${string}`[],
        ]
      );

      await addLiquidity({
        address: contracts.positionManager,
        abi: POSITION_MANAGER_ABI,
        functionName: 'modifyLiquidities',
        args: [unlockData, deadline],
        value: contracts.weth === '0x4200000000000000000000000000000000000006' ? amount0Wei : 0n,
      });
    } catch (err: any) {
      setStep('error');
      setError(err.message || 'Add liquidity failed');
    }
  };

  const getExplorerUrl = () => {
    if (!txHash) return '';
    switch (chainId) {
      case 8453: return `https://basescan.org/tx/${txHash}`;
      case 42220: return `https://celoscan.io/tx/${txHash}`;
      case 130: return `https://uniscan.xyz/tx/${txHash}`;
      default: return '';
    }
  };

  const formatBalance = (balance: bigint | undefined, decimals: number) => {
    if (!balance) return '0';
    return (Number(balance) / 10 ** decimals).toFixed(4);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 p-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push('/pools')}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Pools
          </button>
          <h1 className="text-2xl font-bold text-white">Add Liquidity</h1>
          <div className="w-24" /> {/* Spacer */}
        </div>

        {/* Main Card */}
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">

          {/* Success State */}
          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Liquidity Added!</h2>
              <p className="text-gray-400 mb-4">
                Your position has been created successfully.
              </p>
              {txHash && (
                <a
                  href={getExplorerUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 underline mb-4 inline-block"
                >
                  View on Explorer →
                </a>
              )}
              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => router.push('/pools')}
                  className="flex-1 py-3 px-6 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold transition-colors"
                >
                  View Pools
                </button>
                <button
                  onClick={() => {
                    setStep('input');
                    setTxHash(null);
                  }}
                  className="flex-1 py-3 px-6 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold transition-colors"
                >
                  Add More
                </button>
              </div>
            </div>
          )}

          {/* Error State */}
          {step === 'error' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Transaction Failed</h2>
              <p className="text-red-400 mb-4 text-sm">{error}</p>
              <button
                onClick={() => {
                  setStep('input');
                  setError(null);
                }}
                className="py-3 px-6 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Input/Approving/Adding States */}
          {(step === 'input' || step === 'approving' || step === 'approved' || step === 'adding') && (
            <>
              {/* Token 0 Input */}
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-400 mb-2">
                  <span>Token 1</span>
                  <span>Balance: {formatBalance(balance0, 18)}</span>
                </div>
                <div className="flex items-center bg-gray-900/50 rounded-xl p-4">
                  <input
                    type="number"
                    value={token0Amount}
                    onChange={(e) => setToken0Amount(e.target.value)}
                    className="flex-1 bg-transparent text-2xl text-white outline-none"
                    placeholder="0.0"
                    disabled={step !== 'input'}
                  />
                  <div className="flex items-center gap-2 bg-gray-700 px-4 py-2 rounded-xl">
                    <span className="text-white font-semibold">WETH</span>
                  </div>
                </div>
              </div>

              {/* Plus Icon */}
              <div className="flex justify-center my-2">
                <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
                  <span className="text-gray-400">+</span>
                </div>
              </div>

              {/* Token 1 Input */}
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-400 mb-2">
                  <span>Token 2</span>
                  <span>Balance: {formatBalance(balance1, 6)}</span>
                </div>
                <div className="flex items-center bg-gray-900/50 rounded-xl p-4">
                  <input
                    type="number"
                    value={token1Amount}
                    onChange={(e) => setToken1Amount(e.target.value)}
                    className="flex-1 bg-transparent text-2xl text-white outline-none"
                    placeholder="0.0"
                    disabled={step !== 'input'}
                  />
                  <div className="flex items-center gap-2 bg-gray-700 px-4 py-2 rounded-xl">
                    <span className="text-white font-semibold">USDC</span>
                  </div>
                </div>
              </div>

              {/* Pool Info */}
              <div className="bg-purple-900/30 border border-purple-500/30 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 text-purple-300">
                  <span className="text-lg">⚡</span>
                  <span>Pool uses Dynamic Fee: 0.30% - 1.00% (Tick spacing: 200)</span>
                </div>
              </div>

              {/* Status Messages */}
              {step === 'approving' && (
                <div className="bg-yellow-900/30 border border-yellow-500/30 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 text-yellow-300">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Approving tokens... Please confirm in wallet</span>
                  </div>
                </div>
              )}

              {step === 'approved' && (
                <div className="bg-green-900/30 border border-green-500/30 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 text-green-300">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Tokens approved! Ready to add liquidity.</span>
                  </div>
                </div>
              )}

              {step === 'adding' && (
                <div className="bg-blue-900/30 border border-blue-500/30 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 text-blue-300">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Adding liquidity... Please confirm in wallet</span>
                  </div>
                </div>
              )}

              {/* Action Button */}
              {!isConnected ? (
                <button
                  className="w-full py-4 bg-gray-600 text-gray-300 rounded-xl font-semibold cursor-not-allowed"
                  disabled
                >
                  Connect Wallet
                </button>
              ) : step === 'input' && needsApproval ? (
                <button
                  onClick={handleApprove}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl font-semibold transition-all"
                >
                  Approve Tokens
                </button>
              ) : step === 'approving' ? (
                <button
                  className="w-full py-4 bg-gray-600 text-gray-300 rounded-xl font-semibold cursor-not-allowed flex items-center justify-center gap-2"
                  disabled
                >
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Approving...
                </button>
              ) : step === 'approved' || (step === 'input' && !needsApproval) ? (
                <button
                  onClick={handleAddLiquidity}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl font-semibold transition-all"
                >
                  Add Liquidity
                </button>
              ) : step === 'adding' ? (
                <button
                  className="w-full py-4 bg-gray-600 text-gray-300 rounded-xl font-semibold cursor-not-allowed flex items-center justify-center gap-2"
                  disabled
                >
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Adding Liquidity...
                </button>
              ) : null}
            </>
          )}
        </div>

        {/* Info Card */}
        {step !== 'success' && step !== 'error' && (
          <div className="mt-4 bg-gray-800/30 rounded-xl p-4 text-sm text-gray-400">
            <h3 className="text-white font-semibold mb-2">How it works</h3>
            <ul className="space-y-1">
              <li>• Approve tokens for the Position Manager</li>
              <li>• Add liquidity creates a full-range position</li>
              <li>• Earn dynamic fees from 0.30% to 1.00% based on volatility</li>
              <li>• Higher volatility = higher fees = better LP protection</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
