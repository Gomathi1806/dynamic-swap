'use client';

import { useState, useCallback } from 'react';
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { parseUnits, encodePacked, encodeAbiParameters, parseAbiParameters, keccak256, concat, toHex, pad } from 'viem';

// Uniswap V4 Position Manager Actions
const Actions = {
    MINT_POSITION: 0x00,
    INCREASE_LIQUIDITY: 0x01,
    DECREASE_LIQUIDITY: 0x02,
    BURN_POSITION: 0x03,
    SETTLE_PAIR: 0x10,
    TAKE_PAIR: 0x11,
    SETTLE: 0x12,
    TAKE: 0x13,
    CLOSE_CURRENCY: 0x14,
    CLEAR_OR_TAKE: 0x15,
    SWEEP: 0x17,
};

// Contract addresses per chain
export const V4_CONTRACTS: Record<number, {
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
        weth: '0x471EcE3750Da237f93B8E339c536989b8978a438',
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
    {
        name: 'initializePool',
        type: 'function',
        inputs: [
            {
                name: 'key',
                type: 'tuple',
                components: [
                    { name: 'currency0', type: 'address' },
                    { name: 'currency1', type: 'address' },
                    { name: 'fee', type: 'uint24' },
                    { name: 'tickSpacing', type: 'int24' },
                    { name: 'hooks', type: 'address' },
                ],
            },
            { name: 'sqrtPriceX96', type: 'uint160' },
        ],
        outputs: [{ name: 'tick', type: 'int24' }],
        stateMutability: 'nonpayable',
    },
    {
        name: 'multicall',
        type: 'function',
        inputs: [{ name: 'data', type: 'bytes[]' }],
        outputs: [{ name: 'results', type: 'bytes[]' }],
        stateMutability: 'payable',
    },
] as const;

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
] as const;

// Permit2 ABI for batch approvals
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
    },
] as const;

interface AddLiquidityParams {
    token0Amount: string;
    token1Amount: string;
    tickLower?: number;
    tickUpper?: number;
}

export function useAddLiquidity() {
    const { address } = useAccount();
    const chainId = useChainId();
    const publicClient = usePublicClient();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState<'idle' | 'approving' | 'adding' | 'success' | 'error'>('idle');

    const { writeContractAsync } = useWriteContract();

    const contracts = V4_CONTRACTS[chainId];

    // Sort tokens to get currency0 and currency1
    const sortTokens = useCallback((tokenA: `0x${string}`, tokenB: `0x${string}`) => {
        return tokenA.toLowerCase() < tokenB.toLowerCase()
            ? [tokenA, tokenB] as const
            : [tokenB, tokenA] as const;
    }, []);

    // Encode PoolKey
    const encodePoolKey = useCallback(() => {
        if (!contracts) return null;

        const [currency0, currency1] = sortTokens(contracts.weth, contracts.usdc);

        return {
            currency0,
            currency1,
            fee: 0x800000 as number, // Dynamic fee flag
            tickSpacing: 200 as number,
            hooks: contracts.hook,
        };
    }, [contracts, sortTokens]);

    // Encode actions for Position Manager
    const encodeModifyLiquidityData = useCallback((
        params: AddLiquidityParams,
        poolKey: ReturnType<typeof encodePoolKey>
    ) => {
        if (!poolKey || !address) return null;

        const tickLower = params.tickLower ?? -887200;
        const tickUpper = params.tickUpper ?? 887200;

        // Parse amounts - WETH is 18 decimals, USDC is 6 decimals
        const amount0 = parseUnits(params.token0Amount, 18);
        const amount1 = parseUnits(params.token1Amount, 6);

        // Calculate liquidity based on amounts (simplified)
        const liquidity = amount0 > 0n ? amount0 : 1000000000000000n;

        // Encode MINT_POSITION params
        // struct MintPositionParams {
        //   PoolKey poolKey;
        //   int24 tickLower;
        //   int24 tickUpper;
        //   uint256 liquidity;
        //   uint256 amount0Max;
        //   uint256 amount1Max;
        //   address owner;
        //   bytes hookData;
        // }

        const mintParams = encodeAbiParameters(
            parseAbiParameters([
                '(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey',
                'int24 tickLower',
                'int24 tickUpper',
                'uint256 liquidity',
                'uint256 amount0Max',
                'uint256 amount1Max',
                'address owner',
                'bytes hookData'
            ].join(',')),
            [
                {
                    currency0: poolKey.currency0,
                    currency1: poolKey.currency1,
                    fee: poolKey.fee,
                    tickSpacing: poolKey.tickSpacing,
                    hooks: poolKey.hooks,
                },
                tickLower,
                tickUpper,
                liquidity,
                amount0 * 2n, // Slippage buffer
                amount1 * 2n, // Slippage buffer
                address,
                '0x' as `0x${string}`,
            ]
        );

        // Encode SETTLE_PAIR params
        const settleParams = encodeAbiParameters(
            parseAbiParameters('address currency0, address currency1'),
            [poolKey.currency0, poolKey.currency1]
        );

        // Combine actions into bytes
        // Format: [action0, action1, ...]
        const actions = new Uint8Array([Actions.MINT_POSITION, Actions.SETTLE_PAIR]);
        const actionsHex = `0x${Array.from(actions).map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;

        // Encode full unlockData
        // Format: abi.encode(bytes actions, bytes[] params)
        const unlockData = encodeAbiParameters(
            parseAbiParameters('bytes actions, bytes[] params'),
            [actionsHex, [mintParams, settleParams]]
        );

        return unlockData;
    }, [address]);

    // Check and approve tokens
    const approveTokens = useCallback(async (amount0: bigint, amount1: bigint) => {
        if (!contracts || !address || !publicClient) return false;

        setStep('approving');
        setError(null);

        try {
            // Check current allowances
            const [allowance0, allowance1] = await Promise.all([
                publicClient.readContract({
                    address: contracts.weth,
                    abi: ERC20_ABI,
                    functionName: 'allowance',
                    args: [address, contracts.positionManager],
                }),
                publicClient.readContract({
                    address: contracts.usdc,
                    abi: ERC20_ABI,
                    functionName: 'allowance',
                    args: [address, contracts.positionManager],
                }),
            ]);

            // Approve WETH if needed
            if ((allowance0 as bigint) < amount0) {
                await writeContractAsync({
                    address: contracts.weth,
                    abi: ERC20_ABI,
                    functionName: 'approve',
                    args: [contracts.positionManager, amount0 * 10n],
                });
            }

            // Approve USDC if needed
            if ((allowance1 as bigint) < amount1) {
                await writeContractAsync({
                    address: contracts.usdc,
                    abi: ERC20_ABI,
                    functionName: 'approve',
                    args: [contracts.positionManager, amount1 * 10n],
                });
            }

            return true;
        } catch (err: any) {
            setError(err.message || 'Approval failed');
            setStep('error');
            return false;
        }
    }, [contracts, address, publicClient, writeContractAsync]);

    // Main add liquidity function
    const addLiquidity = useCallback(async (params: AddLiquidityParams) => {
        if (!contracts || !address) {
            setError('Please connect wallet');
            return null;
        }

        setIsLoading(true);
        setError(null);

        try {
            const amount0 = parseUnits(params.token0Amount, 18);
            const amount1 = parseUnits(params.token1Amount, 6);

            // Step 1: Approve tokens
            const approved = await approveTokens(amount0, amount1);
            if (!approved) {
                setIsLoading(false);
                return null;
            }

            // Step 2: Encode pool key and liquidity data
            const poolKey = encodePoolKey();
            if (!poolKey) {
                setError('Failed to encode pool key');
                setStep('error');
                setIsLoading(false);
                return null;
            }

            const unlockData = encodeModifyLiquidityData(params, poolKey);
            if (!unlockData) {
                setError('Failed to encode liquidity data');
                setStep('error');
                setIsLoading(false);
                return null;
            }

            // Step 3: Call modifyLiquidities
            setStep('adding');

            const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

            const hash = await writeContractAsync({
                address: contracts.positionManager,
                abi: POSITION_MANAGER_ABI,
                functionName: 'modifyLiquidities',
                args: [unlockData, deadline],
                value: amount0, // Send ETH value for WETH
            });

            setStep('success');
            setIsLoading(false);
            return hash;

        } catch (err: any) {
            console.error('Add liquidity error:', err);
            setError(err.message || 'Failed to add liquidity');
            setStep('error');
            setIsLoading(false);
            return null;
        }
    }, [contracts, address, approveTokens, encodePoolKey, encodeModifyLiquidityData, writeContractAsync]);

    const reset = useCallback(() => {
        setStep('idle');
        setError(null);
        setIsLoading(false);
    }, []);

    return {
        addLiquidity,
        isLoading,
        error,
        step,
        reset,
        contracts,
    };
}

export default useAddLiquidity;
