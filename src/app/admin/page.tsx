"use client";

import { useState } from "react";
import { useAccount, useChainId, useReadContract, useWriteContract } from "wagmi";
import { getContractsByChainId, isOwner, CONTRACTS } from "@/config/contracts";
import { DynamicFeeHookABI } from "@/config/abi";

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contracts = getContractsByChainId(chainId);
  const isAdmin = isOwner(address);

  // Form states
  const [newProtocolShare, setNewProtocolShare] = useState("");
  const [newTreasury, setNewTreasury] = useState("");
  const [ewmaAlpha, setEwmaAlpha] = useState("");
  const [volatilityWindow, setVolatilityWindow] = useState("");
  const [feeMultiplier, setFeeMultiplier] = useState("");

  // Read current values
  const { data: protocolShare } = useReadContract({
    address: contracts?.hookAddress as `0x${string}`,
    abi: DynamicFeeHookABI,
    functionName: "protocolShareBps",
    query: { enabled: !!contracts },
  });

  const { data: treasury } = useReadContract({
    address: contracts?.hookAddress as `0x${string}`,
    abi: DynamicFeeHookABI,
    functionName: "treasury",
    query: { enabled: !!contracts },
  });

  const { data: volatilityParams } = useReadContract({
    address: contracts?.hookAddress as `0x${string}`,
    abi: DynamicFeeHookABI,
    functionName: "volatilityParams",
    query: { enabled: !!contracts },
  });

  const { writeContract } = useWriteContract();

  if (!isConnected) {
    return (
      <div className="glass rounded-2xl p-8 text-center max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
        <p className="text-gray-400">Connect your wallet to access admin functions</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="glass rounded-2xl p-8 text-center max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
        <p className="text-red-400">You are not the owner of this hook</p>
        <p className="text-sm text-gray-400 mt-2">
          Connected: {address?.slice(0, 10)}...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-gray-400">Manage DynamicSwap hook settings</p>
      </div>

      {/* Network Selector */}
      <div className="glass rounded-2xl p-6">
        <h2 className="text-xl font-bold mb-4">Select Network</h2>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(CONTRACTS).map(([key, contract]) => (
            <button
              key={key}
              className={`p-4 rounded-xl transition-all ${
                chainId === contract.chainId
                  ? "bg-purple-600 text-white"
                  : "bg-white/10 hover:bg-white/20"
              }`}
            >
              <div className="font-semibold">{contract.name}</div>
              <div className="text-xs opacity-75">Chain ID: {contract.chainId}</div>
            </button>
          ))}
        </div>
      </div>

      {contracts && (
        <>
          {/* Current Settings */}
          <div className="glass rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-4">Current Settings</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-black/30 rounded-xl p-4">
                <p className="text-sm text-gray-400">Protocol Share</p>
                <p className="text-xl font-bold">{protocolShare?.toString() || "..."} bps</p>
              </div>
              <div className="bg-black/30 rounded-xl p-4">
                <p className="text-sm text-gray-400">Treasury</p>
                <p className="text-sm font-mono">{treasury?.slice(0, 10) || "..."}...</p>
              </div>
              <div className="bg-black/30 rounded-xl p-4">
                <p className="text-sm text-gray-400">EWMA Alpha</p>
                <p className="text-xl font-bold">
                  {volatilityParams?.[0]?.toString() || "..."}
                </p>
              </div>
              <div className="bg-black/30 rounded-xl p-4">
                <p className="text-sm text-gray-400">Volatility Window</p>
                <p className="text-xl font-bold">
                  {volatilityParams?.[1]?.toString() || "..."}s
                </p>
              </div>
            </div>
          </div>

          {/* Update Protocol Share */}
          <div className="glass rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-4">Update Protocol Share</h2>
            <div className="flex gap-4">
              <input
                type="number"
                placeholder="New share in bps (e.g., 1000 = 10%)"
                value={newProtocolShare}
                onChange={(e) => setNewProtocolShare(e.target.value)}
                className="flex-1 input-field"
              />
              <button
                onClick={() => {
                  if (!contracts || !newProtocolShare) return;
                  writeContract({
                    address: contracts.hookAddress as `0x${string}`,
                    abi: DynamicFeeHookABI,
                    functionName: "setProtocolShare",
                    args: [BigInt(newProtocolShare)],
                  });
                }}
                className="btn-primary"
              >
                Update
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">Max: 5000 bps (50%)</p>
          </div>

          {/* Update Treasury */}
          <div className="glass rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-4">Update Treasury</h2>
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="New treasury address"
                value={newTreasury}
                onChange={(e) => setNewTreasury(e.target.value)}
                className="flex-1 input-field font-mono"
              />
              <button
                onClick={() => {
                  if (!contracts || !newTreasury) return;
                  writeContract({
                    address: contracts.hookAddress as `0x${string}`,
                    abi: DynamicFeeHookABI,
                    functionName: "setTreasury",
                    args: [newTreasury as `0x${string}`],
                  });
                }}
                className="btn-primary"
              >
                Update
              </button>
            </div>
          </div>

          {/* Update Volatility Params */}
          <div className="glass rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-4">Update Volatility Parameters</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-sm text-gray-400">EWMA Alpha</label>
                <input
                  type="number"
                  placeholder="2000"
                  value={ewmaAlpha}
                  onChange={(e) => setEwmaAlpha(e.target.value)}
                  className="w-full input-field mt-1"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400">Window (seconds)</label>
                <input
                  type="number"
                  placeholder="300"
                  value={volatilityWindow}
                  onChange={(e) => setVolatilityWindow(e.target.value)}
                  className="w-full input-field mt-1"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400">Fee Multiplier</label>
                <input
                  type="number"
                  placeholder="50"
                  value={feeMultiplier}
                  onChange={(e) => setFeeMultiplier(e.target.value)}
                  className="w-full input-field mt-1"
                />
              </div>
            </div>
            <button
              onClick={() => {
                if (!contracts || !ewmaAlpha || !volatilityWindow || !feeMultiplier) return;
                writeContract({
                  address: contracts.hookAddress as `0x${string}`,
                  abi: DynamicFeeHookABI,
                  functionName: "setVolatilityParams",
                  args: [BigInt(ewmaAlpha), BigInt(volatilityWindow), BigInt(feeMultiplier)],
                });
              }}
              className="btn-primary"
            >
              Update Parameters
            </button>
          </div>
        </>
      )}
    </div>
  );
}
