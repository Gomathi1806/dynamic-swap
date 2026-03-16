// src/components/HookStatus.tsx
import React, { useEffect, useState } from 'react';
import { createPublicClient, http, formatUnits } from 'viem';
import { base, optimism, celo } from 'viem/chains';
import { SUPPORTED_CHAINS, DYNAMIC_FEE_HOOK_ABI } from '../config/contracts';

// Define Unichain since it might not be in viem yet
const unichain = {
  id: 130,
  name: 'Unichain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.unichain.org'] },
  },
  blockExplorers: {
    default: { name: 'Uniscan', url: 'https://uniscan.xyz' },
  },
} as const;

const CHAIN_MAP: Record<number, any> = {
  8453: base,
  10: optimism,
  130: unichain,
  42220: celo,
};

interface HookStatusProps {
  chainId: number;
}

interface HookData {
  currentFee: number;
  volatility: number;
  minFee: number;
  maxFee: number;
  lastPrice: bigint;
  loading: boolean;
  error: string | null;
}

export const HookStatus: React.FC<HookStatusProps> = ({ chainId }) => {
  const [hookData, setHookData] = useState<HookData>({
    currentFee: 0,
    volatility: 0,
    minFee: 3000,
    maxFee: 10000,
    lastPrice: BigInt(0),
    loading: true,
    error: null,
  });

  useEffect(() => {
    const fetchHookData = async () => {
      const chainConfig = SUPPORTED_CHAINS[chainId];
      if (!chainConfig) {
        setHookData(prev => ({ ...prev, loading: false, error: 'Chain not supported' }));
        return;
      }

      try {
        const client = createPublicClient({
          chain: CHAIN_MAP[chainId],
          transport: http(chainConfig.rpcUrl),
        });

        const [currentFee, volatility, minFee, maxFee, lastPrice] = await Promise.all([
          client.readContract({
            address: chainConfig.hook,
            abi: DYNAMIC_FEE_HOOK_ABI,
            functionName: 'getCurrentFee',
          }),
          client.readContract({
            address: chainConfig.hook,
            abi: DYNAMIC_FEE_HOOK_ABI,
            functionName: 'ewmaVolatility',
          }),
          client.readContract({
            address: chainConfig.hook,
            abi: DYNAMIC_FEE_HOOK_ABI,
            functionName: 'MIN_FEE',
          }),
          client.readContract({
            address: chainConfig.hook,
            abi: DYNAMIC_FEE_HOOK_ABI,
            functionName: 'MAX_FEE',
          }),
          client.readContract({
            address: chainConfig.hook,
            abi: DYNAMIC_FEE_HOOK_ABI,
            functionName: 'lastPrice',
          }),
        ]);

        setHookData({
          currentFee: Number(currentFee),
          volatility: Number(volatility),
          minFee: Number(minFee),
          maxFee: Number(maxFee),
          lastPrice: lastPrice as bigint,
          loading: false,
          error: null,
        });
      } catch (error: any) {
        console.error('Error fetching hook data:', error);
        setHookData(prev => ({
          ...prev,
          loading: false,
          error: error.message || 'Failed to fetch hook data',
        }));
      }
    };

    fetchHookData();
    const interval = setInterval(fetchHookData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [chainId]);

  const feePercentage = (hookData.currentFee / 10000).toFixed(2);
  const minFeePercentage = (hookData.minFee / 10000).toFixed(2);
  const maxFeePercentage = (hookData.maxFee / 10000).toFixed(2);
  
  // Calculate fee position in range (0-100%)
  const feePosition = hookData.maxFee > hookData.minFee
    ? ((hookData.currentFee - hookData.minFee) / (hookData.maxFee - hookData.minFee)) * 100
    : 0;

  if (hookData.loading) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="h-10 bg-gray-700 rounded w-1/2"></div>
      </div>
    );
  }

  if (hookData.error) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-xl p-6">
        <p className="text-red-400">Error: {hookData.error}</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 shadow-xl">
      <h3 className="text-lg font-semibold text-gray-300 mb-4">
        🔄 Dynamic Fee Status
      </h3>

      {/* Current Fee Display */}
      <div className="mb-6">
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-4xl font-bold text-green-400">
            {feePercentage}%
          </span>
          <span className="text-gray-500">current fee</span>
        </div>

        {/* Fee Range Bar */}
        <div className="relative h-3 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="absolute h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-500"
            style={{ width: `${feePosition}%` }}
          />
          <div
            className="absolute w-3 h-3 bg-white rounded-full shadow-lg transform -translate-x-1/2 transition-all duration-500"
            style={{ left: `${feePosition}%` }}
          />
        </div>

        <div className="flex justify-between mt-1 text-xs text-gray-500">
          <span>{minFeePercentage}% (min)</span>
          <span>{maxFeePercentage}% (max)</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-700/50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Volatility (EWMA)</p>
          <p className="text-lg font-mono text-blue-400">
            {hookData.volatility.toLocaleString()}
          </p>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Fee Range</p>
          <p className="text-lg font-mono text-purple-400">
            {minFeePercentage}% - {maxFeePercentage}%
          </p>
        </div>
      </div>

      {/* Chain Info */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <p className="text-xs text-gray-500">
          Hook: {SUPPORTED_CHAINS[chainId]?.hook.slice(0, 10)}...
          <a
            href={`${SUPPORTED_CHAINS[chainId]?.explorer}/address/${SUPPORTED_CHAINS[chainId]?.hook}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 text-blue-400 hover:text-blue-300"
          >
            View ↗
          </a>
        </p>
      </div>
    </div>
  );
};

export default HookStatus;

