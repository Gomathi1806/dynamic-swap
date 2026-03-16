// src/components/ChainSelector.tsx
import React from 'react';
import { SUPPORTED_CHAINS, ChainConfig } from '../config/contracts';

interface ChainSelectorProps {
  currentChainId: number;
  onChainChange: (chainId: number) => void;
}

const CHAIN_LOGOS: Record<number, string> = {
  8453: '🔵', // Base
  10: '🔴', // Optimism
  130: '🦄', // Unichain
  42220: '🟡', // Celo
};

const CHAIN_COLORS: Record<number, string> = {
  8453: 'bg-blue-500 hover:bg-blue-600',
  10: 'bg-red-500 hover:bg-red-600',
  130: 'bg-pink-500 hover:bg-pink-600',
  42220: 'bg-yellow-500 hover:bg-yellow-600',
};

export const ChainSelector: React.FC<ChainSelectorProps> = ({
  currentChainId,
  onChainChange,
}) => {
  const chains = Object.values(SUPPORTED_CHAINS);

  return (
    <div className="flex gap-2 p-2 bg-gray-800 rounded-lg">
      {chains.map((chain: ChainConfig) => (
        <button
          key={chain.chainId}
          onClick={() => onChainChange(chain.chainId)}
          className={`
            px-4 py-2 rounded-lg font-medium transition-all
            ${currentChainId === chain.chainId
              ? `${CHAIN_COLORS[chain.chainId]} text-white shadow-lg scale-105`
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }
          `}
        >
          <span className="mr-2">{CHAIN_LOGOS[chain.chainId]}</span>
          {chain.name}
        </button>
      ))}
    </div>
  );
};

// Hook for chain switching with wallet
export const useChainSwitch = () => {
  const switchChain = async (chainId: number) => {
    if (!window.ethereum) {
      console.error('No wallet detected');
      return false;
    }

    const chain = SUPPORTED_CHAINS[chainId];
    if (!chain) {
      console.error('Unsupported chain');
      return false;
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
      return true;
    } catch (switchError: any) {
      // Chain not added to wallet, try to add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${chainId.toString(16)}`,
                chainName: chain.name,
                rpcUrls: [chain.rpcUrl],
                blockExplorerUrls: [chain.explorer],
                nativeCurrency: chainId === 42220
                  ? { name: 'CELO', symbol: 'CELO', decimals: 18 }
                  : { name: 'Ether', symbol: 'ETH', decimals: 18 },
              },
            ],
          });
          return true;
        } catch (addError) {
          console.error('Failed to add chain:', addError);
          return false;
        }
      }
      console.error('Failed to switch chain:', switchError);
      return false;
    }
  };

  return { switchChain };
};

export default ChainSelector;
