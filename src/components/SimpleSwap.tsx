'use client';

import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi';
import { parseUnits, formatUnits, encodeFunctionData, Address } from 'viem';

// Chain configurations
const CHAIN_CONFIG: Record<number, {
  name: string;
  hookAddress: Address;
  poolManager: Address;
  swapRouter: Address;
  tokens: {
    [key: string]: { address: Address; decimals: number; symbol: string };
  };
}> = {
  8453: { // Base
    name: 'Base',
    hookAddress: '0xCED22Ff119c151b9CaD797941dAC215B67E5b0c0',
    poolManager: '0x498581fF718922c3f8e6A244956aF099B2652b2b',
    swapRouter: '0x6fF5693b99212Da76ad316178A184AB56D299b43',
    tokens: {
      WETH: { address: '0x4200000000000000000000000000000000000006', decimals: 18, symbol: 'WETH' },
      USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, symbol: 'USDC' },
    },
  },
  10: { // Optimism
    name: 'Optimism',
    hookAddress: '0xFefcBfDa5342E8e4d1Cb882D01dFb17779B330C0',
    poolManager: '0x9a13F98Cb987694C9F086b1F5eB990EeA8264Ec3',
    swapRouter: '0x851116D9223fabED8E56C0E6b8Ad0c31d98B3507',
    tokens: {
      WETH: { address: '0x4200000000000000000000000000000000000006', decimals: 18, symbol: 'WETH' },
      USDC: { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6, symbol: 'USDC' },
    },
  },
  130: { // Unichain
    name: 'Unichain',
    hookAddress: '0xca5d18d24A62Bbe924Ba615F85e4Ac95377e30C0',
    poolManager: '0x1F98400000000000000000000000000000000004',
    swapRouter: '0xf70536B3bcC1bD1a972dc186A2cf84cC6da6Be5D',
    tokens: {
      WETH: { address: '0x4200000000000000000000000000000000000006', decimals: 18, symbol: 'WETH' },
      USDC: { address: '0x078D782b760474a361dDA0AF3839290b0EF57AD6', decimals: 6, symbol: 'USDC' },
    },
  },
  42220: { // Celo
    name: 'Celo',
    hookAddress: '0x7E2873516C7344Bfe201f981d0A7Bb6A6dEBf0c0',
    poolManager: '0x288dc841A52FCA2707c6947B3A777c5E56cd87BC',
    swapRouter: '0x3A9d48AB9751398BbFa63ad67599Bb04e4BdF98b',
    tokens: {
      CELO: { address: '0x471EcE3750Da237f93B8E339c536989b8978a438', decimals: 18, symbol: 'CELO' },
      cUSD: { address: '0x765DE816845861e75A25fCA122bb6898B8B1282a', decimals: 18, symbol: 'cUSD' },
    },
  },
};

// ERC20 ABI for approvals and balance checks
const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

// Hook ABI for reading current fee
const HOOK_ABI = [
  {
    name: 'getCurrentFee',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint24' }],
  },
  {
    name: 'MIN_FEE',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint24' }],
  },
  {
    name: 'MAX_FEE',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint24' }],
  },
] as const;

const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

export function SimpleSwap() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [tokenIn, setTokenIn] = useState<string>('');
  const [tokenOut, setTokenOut] = useState<string>('');
  const [amountIn, setAmountIn] = useState<string>('');
  const [estimatedOut, setEstimatedOut] = useState<string>('');
  const [currentFee, setCurrentFee] = useState<number>(0.30);
  const [balance, setBalance] = useState<string>('0');
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('');

  const config = CHAIN_CONFIG[chainId];
  const tokenList = config ? Object.keys(config.tokens) : [];

  // Set default tokens when chain changes
  useEffect(() => {
    if (config) {
      const tokens = Object.keys(config.tokens);
      if (tokens.length >= 2) {
        setTokenIn(tokens[0]);
        setTokenOut(tokens[1]);
      }
    }
  }, [chainId, config]);

  // Fetch current fee from hook
  useEffect(() => {
    async function fetchFee() {
      if (!config || !publicClient) return;
      try {
        const fee = await publicClient.readContract({
          address: config.hookAddress,
          abi: HOOK_ABI,
          functionName: 'getCurrentFee',
        });
        setCurrentFee(Number(fee) / 10000); // Convert to percentage
      } catch (error) {
        console.error('Error fetching fee:', error);
        setCurrentFee(0.30); // Default
      }
    }
    fetchFee();
  }, [config, publicClient]);

  // Fetch balance when token or address changes
  useEffect(() => {
    async function fetchBalance() {
      if (!config || !publicClient || !address || !tokenIn) return;
      try {
        const tokenConfig = config.tokens[tokenIn];
        const bal = await publicClient.readContract({
          address: tokenConfig.address,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address],
        });
        setBalance(formatUnits(bal, tokenConfig.decimals));
      } catch (error) {
        console.error('Error fetching balance:', error);
        setBalance('0');
      }
    }
    fetchBalance();
  }, [config, publicClient, address, tokenIn]);

  // Check allowance
  useEffect(() => {
    async function checkAllowance() {
      if (!config || !publicClient || !address || !tokenIn || !amountIn) return;
      try {
        const tokenConfig = config.tokens[tokenIn];
        const amount = parseUnits(amountIn || '0', tokenConfig.decimals);
        const allowance = await publicClient.readContract({
          address: tokenConfig.address,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address, PERMIT2],
        });
        setIsApproved(allowance >= amount);
      } catch (error) {
        console.error('Error checking allowance:', error);
        setIsApproved(false);
      }
    }
    checkAllowance();
  }, [config, publicClient, address, tokenIn, amountIn]);

  // Estimate output (simple calculation - in production use quoter)
  useEffect(() => {
    if (!amountIn || !tokenIn || !tokenOut || !config) {
      setEstimatedOut('');
      return;
    }
    
    // Simple estimation (not accurate - just for demo)
    // In production, you'd call a quoter contract
    const inputAmount = parseFloat(amountIn);
    const feeMultiplier = 1 - (currentFee / 100);
    
    // Mock price (WETH = ~$2000, USDC = $1)
    let price = 1;
    if ((tokenIn === 'WETH' && tokenOut === 'USDC') || (tokenIn === 'CELO' && tokenOut === 'cUSD')) {
      price = 2000; // ETH/USDC rough price
    } else if ((tokenIn === 'USDC' && tokenOut === 'WETH') || (tokenIn === 'cUSD' && tokenOut === 'CELO')) {
      price = 1 / 2000;
    }
    
    const estimated = inputAmount * price * feeMultiplier;
    setEstimatedOut(estimated.toFixed(tokenOut === 'USDC' || tokenOut === 'cUSD' ? 2 : 6));
  }, [amountIn, tokenIn, tokenOut, currentFee, config]);

  const handleApprove = async () => {
    if (!walletClient || !config || !tokenIn) return;
    setIsLoading(true);
    setStatus('Approving tokens...');
    
    try {
      const tokenConfig = config.tokens[tokenIn];
      const maxAmount = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
      
      const hash = await walletClient.writeContract({
        address: tokenConfig.address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [PERMIT2, maxAmount],
      });
      
      setStatus(`Approval tx: ${hash.slice(0, 10)}...`);
      await publicClient?.waitForTransactionReceipt({ hash });
      setIsApproved(true);
      setStatus('Approved! Ready to swap.');
    } catch (error: any) {
      console.error('Approval failed:', error);
      setStatus(`Approval failed: ${error.message?.slice(0, 50)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwap = async () => {
    if (!walletClient || !config || !tokenIn || !tokenOut || !amountIn) return;
    setIsLoading(true);
    setStatus('Swapping...');
    
    try {
      // Note: This is a simplified example
      // In production, you'd encode proper swap params for the SwapRouter
      
      setStatus('Swap functionality requires SwapRouter integration.');
      setStatus('For demo: Use Uniswap interface with your pool address.');
      
      // The actual swap would look like:
      // const hash = await walletClient.writeContract({
      //   address: config.swapRouter,
      //   abi: SWAP_ROUTER_ABI,
      //   functionName: 'swap',
      //   args: [poolKey, swapParams, ...],
      // });
      
    } catch (error: any) {
      console.error('Swap failed:', error);
      setStatus(`Swap failed: ${error.message?.slice(0, 50)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const switchTokens = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountIn('');
    setEstimatedOut('');
  };

  if (!isConnected) {
    return (
      <div className="bg-gray-900/50 rounded-xl border border-gray-700 p-6 text-center">
        <p className="text-gray-400">Connect your wallet to swap</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="bg-gray-900/50 rounded-xl border border-gray-700 p-6 text-center">
        <p className="text-gray-400">Please switch to a supported network</p>
        <p className="text-sm text-gray-500 mt-2">Base, Optimism, Unichain, or Celo</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white">Swap</h2>
        <p className="text-gray-400">Trade with dynamic fees based on volatility</p>
      </div>

      {/* Current Fee Display */}
      <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl p-4 border border-purple-500/30">
        <div className="flex items-center justify-between">
          <span className="text-gray-300">⚡ Current Dynamic Fee</span>
          <span className={`font-bold ${currentFee > 0.30 ? 'text-yellow-400' : 'text-green-400'}`}>
            {currentFee.toFixed(2)}%
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Fee range: 0.30% - 1.00% based on volatility
        </p>
      </div>

      {/* Swap Card */}
      <div className="bg-gray-900/50 rounded-xl border border-gray-700 p-4 space-y-4">
        {/* Token In */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">You pay</span>
            <span className="text-gray-400">
              Balance: {parseFloat(balance).toFixed(4)} {tokenIn}
            </span>
          </div>
          <div className="flex space-x-2">
            <input
              type="number"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              placeholder="0.0"
              className="flex-1 bg-gray-800 rounded-lg px-4 py-3 text-white text-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <select
              value={tokenIn}
              onChange={(e) => setTokenIn(e.target.value)}
              className="bg-gray-800 rounded-lg px-4 py-3 text-white font-medium focus:outline-none"
            >
              {tokenList.map((token) => (
                <option key={token} value={token}>{token}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setAmountIn(balance)}
            className="text-xs text-purple-400 hover:text-purple-300"
          >
            Use Max
          </button>
        </div>

        {/* Switch Button */}
        <div className="flex justify-center">
          <button
            onClick={switchTokens}
            className="bg-gray-800 p-2 rounded-full hover:bg-gray-700 transition"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </div>

        {/* Token Out */}
        <div className="space-y-2">
          <span className="text-gray-400 text-sm">You receive (estimated)</span>
          <div className="flex space-x-2">
            <input
              type="text"
              value={estimatedOut}
              readOnly
              placeholder="0.0"
              className="flex-1 bg-gray-800 rounded-lg px-4 py-3 text-white text-xl"
            />
            <select
              value={tokenOut}
              onChange={(e) => setTokenOut(e.target.value)}
              className="bg-gray-800 rounded-lg px-4 py-3 text-white font-medium focus:outline-none"
            >
              {tokenList.map((token) => (
                <option key={token} value={token}>{token}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Status */}
        {status && (
          <div className="bg-gray-800 rounded-lg p-3 text-sm text-gray-300">
            {status}
          </div>
        )}

        {/* Action Button */}
        {!isApproved && amountIn ? (
          <button
            onClick={handleApprove}
            disabled={isLoading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-bold py-4 rounded-xl transition"
          >
            {isLoading ? 'Approving...' : `Approve ${tokenIn}`}
          </button>
        ) : (
          <button
            onClick={handleSwap}
            disabled={isLoading || !amountIn || tokenIn === tokenOut}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-bold py-4 rounded-xl transition"
          >
            {isLoading ? 'Swapping...' : 'Swap'}
          </button>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-gray-900/50 rounded-xl border border-gray-700 p-4">
        <h3 className="font-semibold text-white mb-2">About Dynamic Fees</h3>
        <p className="text-sm text-gray-400">
          Unlike traditional DEXs with fixed fees, DynamicSwap automatically adjusts fees 
          based on market volatility. During calm markets, you pay as low as 0.30%. 
          During volatile periods, fees increase up to 1.00% to protect liquidity providers.
        </p>
      </div>

      {/* Network Badge */}
      <div className="text-center">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-800 text-gray-300">
          Connected to {config.name}
        </span>
      </div>
    </div>
  );
}

export default SimpleSwap;
