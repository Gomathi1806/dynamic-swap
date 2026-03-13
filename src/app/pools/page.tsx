'use client';

import { useState } from 'react';
import { useAccount, useChainId, useWriteContract, useReadContract, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits, encodeAbiParameters, encodePacked, maxUint160, maxUint48 } from 'viem';
import Link from 'next/link';

// Permit2 address is the same on all chains
const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3' as const;

// Contract addresses per chain
const CONTRACTS: Record<number, {
  poolManager: `0x${string}`;
  positionManager: `0x${string}`;
  hook: `0x${string}`;
  weth: `0x${string}`;
  usdc: `0x${string}`;
  wethSymbol: string;
  usdcDecimals: number;
  chainName: string;
  explorer: string;
}> = {
  8453: {
    poolManager: '0x498581fF718922c3f8e6A244956aF099B2652b2b',
    positionManager: '0x7C5f5A4bBd8fD63184577525326123B519429bDc',
    hook: '0x14a8BF1bB6419bED0986a4c32F8Cd6341744E0c0',
    weth: '0x4200000000000000000000000000000000000006',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    wethSymbol: 'WETH',
    usdcDecimals: 6,
    chainName: 'Base',
    explorer: 'https://basescan.org',
  },
  42220: {
    poolManager: '0x288dc841A52FCA2707c6947B3A777c5E56cd87BC',
    positionManager: '0x4Bb0eAB4907b34a8E58Bd4d7E8E8f0106A39A7DD',
    hook: '0xe96B2C7416596fE707ba40379B909F42F18d7FC0',
    weth: '0x471EcE3750Da237f93B8E339c536989b8978a438',
    usdc: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
    wethSymbol: 'CELO',
    usdcDecimals: 6,
    chainName: 'Celo',
    explorer: 'https://celoscan.io',
  },
  130: {
    poolManager: '0x1F98400000000000000000000000000000000004',
    positionManager: '0x4529A01c7A0410167c5740C487A8DE60232617bf',
    hook: '0x1f998f20C0f10Ad0017639e60aa39befCc1b20c0',
    weth: '0x4200000000000000000000000000000000000006',
    usdc: '0x078D782b760474a361dDA0AF3839290b0EF57AD6',
    wethSymbol: 'WETH',
    usdcDecimals: 6,
    chainName: 'Unichain',
    explorer: 'https://uniscan.xyz',
  },
};

// Actions from Uniswap V4 Position Manager
const Actions = {
  MINT_POSITION: 0,
  SETTLE_PAIR: 16,
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

// Permit2 AllowanceTransfer ABI
const PERMIT2_ABI = [
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
      { name: 'nonce', type: 'uint48' },
    ],
    stateMutability: 'view',
  },
] as const;

// Position Manager ABI
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
type Step = 'input' | 'approving-erc20' | 'approving-permit2' | 'adding' | 'success' | 'error';

export default function PoolsPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();

  const [view, setView] = useState<View>('list');
  const [step, setStep] = useState<Step>('input');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const [token0Amount, setToken0Amount] = useState('0.001');
  const [token1Amount, setToken1Amount] = useState('10');

  const contracts = CONTRACTS[chainId];

  const { writeContractAsync } = useWriteContract();

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

  // Read ERC20 allowances to Permit2
  const { data: erc20Allowance0, refetch: refetchErc20Allowance0 } = useReadContract({
    address: contracts?.weth,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, PERMIT2_ADDRESS] : undefined,
  });

  const { data: erc20Allowance1, refetch: refetchErc20Allowance1 } = useReadContract({
    address: contracts?.usdc,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, PERMIT2_ADDRESS] : undefined,
  });

  // Read Permit2 allowances to Position Manager
  const { data: permit2Allowance0, refetch: refetchPermit2Allowance0 } = useReadContract({
    address: PERMIT2_ADDRESS,
    abi: PERMIT2_ABI,
    functionName: 'allowance',
    args: address && contracts ? [address, contracts.weth, contracts.positionManager] : undefined,
  });

  const { data: permit2Allowance1, refetch: refetchPermit2Allowance1 } = useReadContract({
    address: PERMIT2_ADDRESS,
    abi: PERMIT2_ABI,
    functionName: 'allowance',
    args: address && contracts ? [address, contracts.usdc, contracts.positionManager] : undefined,
  });

  const amount0Wei = parseUnits(token0Amount || '0', 18);
  const amount1Wei = parseUnits(token1Amount || '0', contracts?.usdcDecimals || 6);

  // Check if ERC20 approval to Permit2 is needed
  const needsErc20Approval0 = !erc20Allowance0 || (erc20Allowance0 as bigint) < amount0Wei;
  const needsErc20Approval1 = !erc20Allowance1 || (erc20Allowance1 as bigint) < amount1Wei;
  const needsAnyErc20Approval = needsErc20Approval0 || needsErc20Approval1;

  // Check if Permit2 approval to Position Manager is needed
  const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
  const needsPermit2Approval0 = !permit2Allowance0 ||
    (permit2Allowance0 as [bigint, number, number])[0] < BigInt(amount0Wei) ||
    BigInt((permit2Allowance0 as [bigint, number, number])[1]) < currentTimestamp;
  const needsPermit2Approval1 = !permit2Allowance1 ||
    (permit2Allowance1 as [bigint, number, number])[0] < BigInt(amount1Wei) ||
    BigInt((permit2Allowance1 as [bigint, number, number])[1]) < currentTimestamp;
  const needsAnyPermit2Approval = needsPermit2Approval0 || needsPermit2Approval1;

  const formatBalance = (balance: bigint | undefined, decimals: number) => {
    if (!balance) return '0.0000';
    return Number(formatUnits(balance, decimals)).toFixed(4);
  };

  const getExplorerTxUrl = (hash: string) => {
    return `${contracts?.explorer}/tx/${hash}`;
  };

  // Sort tokens to get currency0 < currency1
  const getSortedCurrencies = (): [string, string, boolean] => {
    if (!contracts) return ['', '', false];
    const wethLower = contracts.weth.toLowerCase();
    const usdcLower = contracts.usdc.toLowerCase();
    const wethIsFirst = wethLower < usdcLower;
    return wethIsFirst
      ? [contracts.weth, contracts.usdc, true]
      : [contracts.usdc, contracts.weth, false];
  };

  // Encode the modifyLiquidities call
  const encodeModifyLiquiditiesData = (): `0x${string}` => {
    if (!contracts || !address) throw new Error('Missing contracts or address');

    const [currency0, currency1, wethIsFirst] = getSortedCurrencies();

    // Calculate amounts based on which token is currency0
    const amt0 = wethIsFirst ? amount0Wei : amount1Wei;
    const amt1 = wethIsFirst ? amount1Wei : amount0Wei;

    // Tick range for full range liquidity (tick spacing 200)
    const tickLower = -887200;
    const tickUpper = 887200;

    // Liquidity calculation - use a reasonable amount
    const liquidity = amt0 > 0n ? amt0 * 1000n : 1000000000000000n;

    // Actions: MINT_POSITION + SETTLE_PAIR (using encodePacked as per docs)
    const actions = encodePacked(
      ['uint8', 'uint8'],
      [Actions.MINT_POSITION, Actions.SETTLE_PAIR]
    );

    // Encode MINT_POSITION params
    const mintParams = encodeAbiParameters(
      [
        {
          type: 'tuple',
          components: [
            { type: 'address', name: 'currency0' },
            { type: 'address', name: 'currency1' },
            { type: 'uint24', name: 'fee' },
            { type: 'int24', name: 'tickSpacing' },
            { type: 'address', name: 'hooks' },
          ],
        },
        { type: 'int24' },  // tickLower
        { type: 'int24' },  // tickUpper
        { type: 'uint256' }, // liquidity
        { type: 'uint128' }, // amount0Max
        { type: 'uint128' }, // amount1Max
        { type: 'address' }, // owner
        { type: 'bytes' },   // hookData
      ],
      [
        {
          currency0: currency0 as `0x${string}`,
          currency1: currency1 as `0x${string}`,
          fee: 0x800000, // Dynamic fee flag
          tickSpacing: 200,
          hooks: contracts.hook,
        },
        tickLower,
        tickUpper,
        liquidity,
        BigInt(amt0) * 10n, // amount0Max with large slippage tolerance
        BigInt(amt1) * 10n, // amount1Max with large slippage tolerance
        address,
        '0x' as `0x${string}`, // empty hookData
      ]
    );

    // Encode SETTLE_PAIR params
    const settleParams = encodeAbiParameters(
      [{ type: 'address' }, { type: 'address' }],
      [currency0 as `0x${string}`, currency1 as `0x${string}`]
    );

    // Final unlockData = abi.encode(actions, params[])
    const unlockData = encodeAbiParameters(
      [{ type: 'bytes' }, { type: 'bytes[]' }],
      [actions, [mintParams, settleParams]]
    );

    return unlockData;
  };

  // Main flow handler
  const handleStartFlow = async () => {
    if (!contracts || !publicClient || !address) return;

    setError(null);

    try {
      // Step 1: ERC20 approvals to Permit2
      if (needsAnyErc20Approval) {
        setStep('approving-erc20');

        if (needsErc20Approval0) {
          setStatusMessage(`Approving ${contracts.wethSymbol} for Permit2...`);
          const hash = await writeContractAsync({
            address: contracts.weth,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [PERMIT2_ADDRESS, amount0Wei * 1000n],
          });
          await publicClient.waitForTransactionReceipt({ hash });
          await refetchErc20Allowance0();
        }

        if (needsErc20Approval1) {
          setStatusMessage('Approving USDC for Permit2...');
          const hash = await writeContractAsync({
            address: contracts.usdc,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [PERMIT2_ADDRESS, amount1Wei * 1000n],
          });
          await publicClient.waitForTransactionReceipt({ hash });
          await refetchErc20Allowance1();
        }
      }

      // Step 2: Permit2 approvals to Position Manager
      if (needsAnyPermit2Approval) {
        setStep('approving-permit2');

        // Set expiration to 30 days from now
        const expiration = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60);

        if (needsPermit2Approval0) {
          setStatusMessage(`Approving ${contracts.wethSymbol} via Permit2...`);
          const hash = await writeContractAsync({
            address: PERMIT2_ADDRESS,
            abi: PERMIT2_ABI,
            functionName: 'approve',
            args: [
              contracts.weth,
              contracts.positionManager,
              maxUint160, // Max amount
              Number(expiration), // 30 days expiration
            ],
          });
          await publicClient.waitForTransactionReceipt({ hash });
          await refetchPermit2Allowance0();
        }

        if (needsPermit2Approval1) {
          setStatusMessage('Approving USDC via Permit2...');
          const hash = await writeContractAsync({
            address: PERMIT2_ADDRESS,
            abi: PERMIT2_ABI,
            functionName: 'approve',
            args: [
              contracts.usdc,
              contracts.positionManager,
              maxUint160, // Max amount
              Number(expiration), // 30 days expiration
            ],
          });
          await publicClient.waitForTransactionReceipt({ hash });
          await refetchPermit2Allowance1();
        }
      }

      // Step 3: Add liquidity
      setStep('adding');
      setStatusMessage('Adding liquidity... Please confirm in wallet');

      const unlockData = encodeModifyLiquiditiesData();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour

      const hash = await writeContractAsync({
        address: contracts.positionManager,
        abi: POSITION_MANAGER_ABI,
        functionName: 'modifyLiquidities',
        args: [unlockData, deadline],
        value: 0n, // Using wrapped tokens, not native ETH
      });

      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      setStep('success');

    } catch (err: any) {
      console.error('Transaction error:', err);
      setError(err.shortMessage || err.message || 'Transaction failed');
      setStep('error');
    }
  };

  // Reset form
  const resetForm = () => {
    setStep('input');
    setError(null);
    setTxHash(null);
    setStatusMessage('');
  };

  // Calculate approval status for display
  const getApprovalStatus = () => {
    const steps = [];
    if (needsErc20Approval0) steps.push(`Approve ${contracts?.wethSymbol} → Permit2`);
    if (needsErc20Approval1) steps.push('Approve USDC → Permit2');
    if (needsPermit2Approval0) steps.push(`Approve ${contracts?.wethSymbol} → Position Manager`);
    if (needsPermit2Approval1) steps.push('Approve USDC → Position Manager');
    return steps;
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
                {contracts.chainName}
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
                  <a
                    href={`${contracts.explorer}/address/${contracts.hook}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 font-mono text-sm truncate block"
                  >
                    {contracts.hook.slice(0, 10)}...{contracts.hook.slice(-8)}
                  </a>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Tick Spacing</div>
                  <div className="text-white font-semibold">200</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Network</div>
                  <div className="text-white font-semibold">{contracts.chainName}</div>
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
                  <h3 className="text-2xl font-bold text-white mb-2">Liquidity Added!</h3>
                  <p className="text-gray-400 mb-6">Your position has been created successfully.</p>

                  {txHash && (
                    <a
                      href={getExplorerTxUrl(txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 mb-6"
                    >
                      View Transaction
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
                  <p className="text-red-400 text-sm mb-6 max-w-sm mx-auto break-words">{error}</p>

                  <button
                    onClick={resetForm}
                    className="py-3 px-8 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Input/Processing States */}
              {(step === 'input' || step === 'approving-erc20' || step === 'approving-permit2' || step === 'adding') && (
                <>
                  {/* Token 0 Input */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Token 1</span>
                      <span className="text-gray-400">Balance: {formatBalance(balance0 as bigint | undefined, 18)}</span>
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
                        onClick={() => balance0 && setToken0Amount(formatUnits(balance0 as bigint, 18))}
                        className="text-purple-400 text-sm mr-3 hover:text-purple-300"
                        disabled={step !== 'input'}
                      >
                        MAX
                      </button>
                      <div className="bg-gray-700 px-4 py-2 rounded-xl flex items-center gap-2">
                        {!needsErc20Approval0 && !needsPermit2Approval0 && <span className="text-green-400 text-sm">✓</span>}
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
                      <span className="text-gray-400">Balance: {formatBalance(balance1 as bigint | undefined, contracts.usdcDecimals)}</span>
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
                        onClick={() => balance1 && setToken1Amount(formatUnits(balance1 as bigint, contracts.usdcDecimals))}
                        className="text-purple-400 text-sm mr-3 hover:text-purple-300"
                        disabled={step !== 'input'}
                      >
                        MAX
                      </button>
                      <div className="bg-gray-700 px-4 py-2 rounded-xl flex items-center gap-2">
                        {!needsErc20Approval1 && !needsPermit2Approval1 && <span className="text-green-400 text-sm">✓</span>}
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
                  {step !== 'input' && (
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 mb-4">
                      <div className="flex items-center gap-3 text-blue-300">
                        <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        <span>{statusMessage}</span>
                      </div>
                    </div>
                  )}

                  {/* Pending Approvals Info */}
                  {step === 'input' && (needsAnyErc20Approval || needsAnyPermit2Approval) && (
                    <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4 mb-4">
                      <h4 className="text-yellow-300 font-semibold mb-2">📝 Approvals Needed</h4>
                      <ul className="text-sm text-yellow-300/80 space-y-1">
                        {getApprovalStatus().map((s, i) => (
                          <li key={i}>• {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* All Approved Info */}
                  {step === 'input' && !needsAnyErc20Approval && !needsAnyPermit2Approval && (
                    <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4 mb-4">
                      <div className="flex items-center gap-2 text-green-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>All approvals in place! Ready to add liquidity.</span>
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
                  ) : step !== 'input' ? (
                    <button
                      disabled
                      className="w-full py-4 bg-gray-700 text-gray-400 rounded-xl font-semibold cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </button>
                  ) : (
                    <button
                      onClick={handleStartFlow}
                      disabled={!token0Amount || !token1Amount || Number(token0Amount) <= 0 || Number(token1Amount) <= 0}
                      className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all"
                    >
                      {needsAnyErc20Approval || needsAnyPermit2Approval
                        ? 'Approve & Add Liquidity'
                        : 'Add Liquidity'}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Info Card */}
            {step === 'input' && (
              <div className="mt-6 bg-gray-800/30 rounded-xl p-4">
                <h4 className="text-white font-semibold mb-2">📋 Process Overview</h4>
                <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
                  <li className={!needsAnyErc20Approval ? 'text-green-400' : ''}>
                    {!needsAnyErc20Approval && '✓ '}Approve tokens for Permit2
                  </li>
                  <li className={!needsAnyPermit2Approval ? 'text-green-400' : ''}>
                    {!needsAnyPermit2Approval && '✓ '}Approve Position Manager via Permit2
                  </li>
                  <li>Add liquidity to the pool</li>
                  <li>Receive LP position NFT & start earning fees!</li>
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
