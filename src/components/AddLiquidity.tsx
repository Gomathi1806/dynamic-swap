'use client';

import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi';
import { parseUnits, formatUnits, Address, encodeFunctionData } from 'viem';

// Chain configurations
const CHAIN_CONFIG: Record<number, {
  name: string;
  hookAddress: Address;
  poolManager: Address;
  positionManager: Address;
  tokens: {
    [key: string]: { address: Address; decimals: number; symbol: string };
  };
  poolKey: {
    currency0: Address;
    currency1: Address;
    fee: number;
    tickSpacing: number;
  };
}> = {
  8453: { // Base
    name: 'Base',
    hookAddress: '0xCED22Ff119c151b9CaD797941dAC215B67E5b0c0',
    poolManager: '0x498581fF718922c3f8e6A244956aF099B2652b2b',
    positionManager: '0x7C5f5A4bBd8fD63184577525326123B519429bDc',
    tokens: {
      WETH: { address: '0x4200000000000000000000000000000000000006', decimals: 18, symbol: 'WETH' },
      USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, symbol: 'USDC' },
    },
    poolKey: {
      currency0: '0x4200000000000000000000000000000000000006', // WETH (lower address)
      currency1: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
      fee: 0x800000,
      tickSpacing: 200,
    },
  },
  10: { // Optimism
    name: 'Optimism',
    hookAddress: '0xFefcBfDa5342E8e4d1Cb882D01dFb17779B330C0',
    poolManager: '0x9a13F98Cb987694C9F086b1F5eB990EeA8264Ec3',
    positionManager: '0x3C3Ea4B57a46241e54610e5f022E5c45859A1017',
    tokens: {
      USDC: { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6, symbol: 'USDC' },
      WETH: { address: '0x4200000000000000000000000000000000000006', decimals: 18, symbol: 'WETH' },
    },
    poolKey: {
      currency0: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // USDC (lower address)
      currency1: '0x4200000000000000000000000000000000000006', // WETH
      fee: 0x800000,
      tickSpacing: 200,
    },
  },
  130: { // Unichain
    name: 'Unichain',
    hookAddress: '0xca5d18d24A62Bbe924Ba615F85e4Ac95377e30C0',
    poolManager: '0x1F98400000000000000000000000000000000004',
    positionManager: '0x4529A01c7A0410167c5740C487A8DE60232617bf',
    tokens: {
      USDC: { address: '0x078D782b760474a361dDA0AF3839290b0EF57AD6', decimals: 6, symbol: 'USDC' },
      WETH: { address: '0x4200000000000000000000000000000000000006', decimals: 18, symbol: 'WETH' },
    },
    poolKey: {
      currency0: '0x078D782b760474a361dDA0AF3839290b0EF57AD6', // USDC
      currency1: '0x4200000000000000000000000000000000000006', // WETH
      fee: 0x800000,
      tickSpacing: 200,
    },
  },
  42220: { // Celo
    name: 'Celo',
    hookAddress: '0x7E2873516C7344Bfe201f981d0A7Bb6A6dEBf0c0',
    poolManager: '0x288dc841A52FCA2707c6947B3A777c5E56cd87BC',
    positionManager: '0xf7965f3981e4D5BC383BfBCb61501763e9068CA9',
    tokens: {
      CELO: { address: '0x471EcE3750Da237f93B8E339c536989b8978a438', decimals: 18, symbol: 'CELO' },
      cUSD: { address: '0x765DE816845861e75A25fCA122bb6898B8B1282a', decimals: 18, symbol: 'cUSD' },
    },
    poolKey: {
      currency0: '0x471EcE3750Da237f93B8E339c536989b8978a438', // CELO
      currency1: '0x765DE816845861e75A25fCA122bb6898B8B1282a', // cUSD
      fee: 0x800000,
      tickSpacing: 200,
    },
  },
};

// ERC20 ABI
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

const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

// Full range ticks for tickSpacing=200
const TICK_LOWER = -887200;
const TICK_UPPER = 887200;

type ApprovalStep = 'none' | 'token0' | 'token1' | 'ready';

export function AddLiquidityFixed() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [amount0, setAmount0] = useState<string>('');
  const [amount1, setAmount1] = useState<string>('');
  const [balance0, setBalance0] = useState<string>('0');
  const [balance1, setBalance1] = useState<string>('0');
  const [approvalStep, setApprovalStep] = useState<ApprovalStep>('none');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');

  const config = CHAIN_CONFIG[chainId];
  
  // Get token symbols
  const tokenSymbols = config ? Object.keys(config.tokens) : [];
  const token0Symbol = tokenSymbols[0] || 'Token0';
  const token1Symbol = tokenSymbols[1] || 'Token1';
  const token0Config = config?.tokens[token0Symbol];
  const token1Config = config?.tokens[token1Symbol];

  // Fetch balances
  useEffect(() => {
    async function fetchBalances() {
      if (!config || !publicClient || !address) return;
      
      try {
        const bal0 = await publicClient.readContract({
          address: token0Config!.address,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address],
        });
        setBalance0(formatUnits(bal0, token0Config!.decimals));
        
        const bal1 = await publicClient.readContract({
          address: token1Config!.address,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address],
        });
        setBalance1(formatUnits(bal1, token1Config!.decimals));
      } catch (error) {
        console.error('Error fetching balances:', error);
      }
    }
    fetchBalances();
  }, [config, publicClient, address, token0Config, token1Config]);

  // Check approvals
  useEffect(() => {
    async function checkApprovals() {
      if (!config || !publicClient || !address || !amount0 || !amount1) {
        setApprovalStep('none');
        return;
      }
      
      try {
        const parsedAmount0 = parseUnits(amount0 || '0', token0Config!.decimals);
        const parsedAmount1 = parseUnits(amount1 || '0', token1Config!.decimals);
        
        // Check token0 allowance
        const allowance0 = await publicClient.readContract({
          address: token0Config!.address,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address, PERMIT2],
        });
        
        if (allowance0 < parsedAmount0) {
          setApprovalStep('token0');
          return;
        }
        
        // Check token1 allowance
        const allowance1 = await publicClient.readContract({
          address: token1Config!.address,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address, PERMIT2],
        });
        
        if (allowance1 < parsedAmount1) {
          setApprovalStep('token1');
          return;
        }
        
        setApprovalStep('ready');
      } catch (error) {
        console.error('Error checking approvals:', error);
        setApprovalStep('none');
      }
    }
    checkApprovals();
  }, [config, publicClient, address, amount0, amount1, token0Config, token1Config]);

  const handleApprove = async (tokenIndex: 0 | 1) => {
    if (!walletClient || !config) return;
    
    const tokenConfig = tokenIndex === 0 ? token0Config : token1Config;
    const tokenSymbol = tokenIndex === 0 ? token0Symbol : token1Symbol;
    
    setIsLoading(true);
    setStatus(`Approving ${tokenSymbol}...`);
    
    try {
      const maxAmount = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
      
      const hash = await walletClient.writeContract({
        address: tokenConfig!.address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [PERMIT2, maxAmount],
      });
      
      setTxHash(hash);
      setStatus(`Waiting for ${tokenSymbol} approval confirmation...`);
      
      await publicClient?.waitForTransactionReceipt({ hash });
      
      setStatus(`${tokenSymbol} approved! ✅`);
      
      // Re-check approvals
      if (tokenIndex === 0) {
        setApprovalStep('token1');
      } else {
        setApprovalStep('ready');
      }
    } catch (error: any) {
      console.error('Approval failed:', error);
      setStatus(`Approval failed: ${error.shortMessage || error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddLiquidity = async () => {
    if (!walletClient || !config || !amount0 || !amount1) return;
    
    setIsLoading(true);
    setStatus('Preparing liquidity transaction...');
    
    try {
      // Note: Full implementation would call PositionManager.mint()
      // This requires encoding complex calldata with PoolKey, tick range, etc.
      
      setStatus('Adding liquidity requires PositionManager integration.');
      setStatus('Use the Foundry script for now: AddLiquidityMultichain.s.sol');
      
      // Example of what the call would look like:
      // const hash = await walletClient.writeContract({
      //   address: config.positionManager,
      //   abi: POSITION_MANAGER_ABI,
      //   functionName: 'mint',
      //   args: [poolKey, tickLower, tickUpper, liquidity, amount0Max, amount1Max, recipient, deadline],
      // });
      
    } catch (error: any) {
      console.error('Add liquidity failed:', error);
      setStatus(`Failed: ${error.shortMessage || error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-gray-900/50 rounded-xl border border-gray-700 p-6 text-center">
        <p className="text-gray-400">Connect your wallet to add liquidity</p>
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
        <h2 className="text-2xl font-bold text-white">Add Liquidity</h2>
        <p className="text-gray-400">Earn dynamic fees from 0.30% to 1.00%</p>
      </div>

      {/* Pool Info */}
      <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl p-4 border border-purple-500/30">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-300">Pool</span>
          <span className="font-bold text-white">{token0Symbol}/{token1Symbol}</span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-300">⚡ Fee</span>
          <span className="text-green-400">Dynamic (0.30% - 1.00%)</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-300">Network</span>
          <span className="text-white">{config.name}</span>
        </div>
      </div>

      {/* Approval Status */}
      <div className="bg-gray-900/50 rounded-xl border border-gray-700 p-4">
        <h3 className="font-semibold text-white mb-3">Approval Status</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">{token0Symbol}</span>
            <span className={approvalStep === 'token0' || approvalStep === 'none' ? 'text-yellow-400' : 'text-green-400'}>
              {approvalStep === 'token0' || approvalStep === 'none' ? '⏳ Needs approval' : '✅ Approved'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">{token1Symbol}</span>
            <span className={approvalStep === 'ready' ? 'text-green-400' : 'text-yellow-400'}>
              {approvalStep === 'ready' ? '✅ Approved' : '⏳ Needs approval'}
            </span>
          </div>
        </div>
      </div>

      {/* Input Card */}
      <div className="bg-gray-900/50 rounded-xl border border-gray-700 p-4 space-y-4">
        {/* Token 0 Input */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">{token0Symbol}</span>
            <span className="text-gray-400">
              Balance: {parseFloat(balance0).toFixed(4)}
            </span>
          </div>
          <div className="flex space-x-2">
            <input
              type="number"
              value={amount0}
              onChange={(e) => setAmount0(e.target.value)}
              placeholder="0.0"
              className="flex-1 bg-gray-800 rounded-lg px-4 py-3 text-white text-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={() => setAmount0(balance0)}
              className="bg-gray-800 px-4 py-2 rounded-lg text-purple-400 hover:text-purple-300"
            >
              MAX
            </button>
          </div>
        </div>

        {/* Plus Icon */}
        <div className="flex justify-center">
          <div className="bg-gray-800 p-2 rounded-full">
            <span className="text-gray-400 text-xl">+</span>
          </div>
        </div>

        {/* Token 1 Input */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">{token1Symbol}</span>
            <span className="text-gray-400">
              Balance: {parseFloat(balance1).toFixed(4)}
            </span>
          </div>
          <div className="flex space-x-2">
            <input
              type="number"
              value={amount1}
              onChange={(e) => setAmount1(e.target.value)}
              placeholder="0.0"
              className="flex-1 bg-gray-800 rounded-lg px-4 py-3 text-white text-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={() => setAmount1(balance1)}
              className="bg-gray-800 px-4 py-2 rounded-lg text-purple-400 hover:text-purple-300"
            >
              MAX
            </button>
          </div>
        </div>

        {/* Status */}
        {status && (
          <div className="bg-gray-800 rounded-lg p-3 text-sm text-gray-300">
            {status}
            {txHash && (
              <a 
                href={`https://basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-purple-400 mt-1 hover:underline"
              >
                View transaction →
              </a>
            )}
          </div>
        )}

        {/* Action Button */}
        {approvalStep === 'token0' && (
          <button
            onClick={() => handleApprove(0)}
            disabled={isLoading || !amount0}
            className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white font-bold py-4 rounded-xl transition"
          >
            {isLoading ? 'Approving...' : `Approve ${token0Symbol}`}
          </button>
        )}
        
        {approvalStep === 'token1' && (
          <button
            onClick={() => handleApprove(1)}
            disabled={isLoading || !amount1}
            className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white font-bold py-4 rounded-xl transition"
          >
            {isLoading ? 'Approving...' : `Approve ${token1Symbol}`}
          </button>
        )}
        
        {approvalStep === 'ready' && (
          <button
            onClick={handleAddLiquidity}
            disabled={isLoading || !amount0 || !amount1}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-bold py-4 rounded-xl transition"
          >
            {isLoading ? 'Adding Liquidity...' : 'Add Liquidity'}
          </button>
        )}
        
        {approvalStep === 'none' && (
          <button
            disabled
            className="w-full bg-gray-600 text-gray-400 font-bold py-4 rounded-xl"
          >
            Enter amounts
          </button>
        )}
      </div>

      {/* Info */}
      <div className="bg-gray-900/50 rounded-xl border border-gray-700 p-4">
        <h3 className="font-semibold text-white mb-2">Position Details</h3>
        <div className="space-y-1 text-sm text-gray-400">
          <p>• Full range position (all prices)</p>
          <p>• Tick spacing: 200</p>
          <p>• Range: {TICK_LOWER} to {TICK_UPPER}</p>
          <p>• Earns fees from ALL swaps in the pool</p>
        </div>
      </div>
    </div>
  );
}

export default AddLiquidityFixed;
