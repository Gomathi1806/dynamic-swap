# DynamicSwap Frontend

Complete frontend for DynamicSwap - a Uniswap V4 DEX with volatility-based dynamic fees.

## Features

- ✅ **Automatic Pool Discovery** - Pools are discovered from blockchain events, no manual adding
- ✅ **Multi-Chain Support** - Base, Optimism, and Celo
- ✅ **Dynamic Fee Display** - Shows "Dynamic (0.30%-1.00%)" instead of raw fee values
- ✅ **Swap Interface** - Token swap with approval flow
- ✅ **Add Liquidity** - Add liquidity to existing pools
- ✅ **Create Pool** - Launch new trading pairs
- ✅ **RainbowKit** - Easy wallet connection

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Get a WalletConnect Project ID (free)
# Go to: https://cloud.walletconnect.com/
# Create a new project and copy the Project ID

# 3. Create .env.local file
echo "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here" > .env.local

# 4. Run the dev server
npm run dev

# 5. Open http://localhost:3000
```

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout with providers
│   ├── page.tsx             # Home page
│   ├── globals.css          # Global styles
│   ├── pools/
│   │   └── page.tsx         # Pools page with auto-discovery
│   ├── swap/
│   │   └── page.tsx         # Swap page
│   └── create-pool/
│       └── page.tsx         # Create pool page
├── components/
│   ├── Providers.tsx        # Wagmi + RainbowKit providers
│   ├── Navbar.tsx           # Navigation bar
│   ├── PoolCard.tsx         # Pool display card
│   ├── SwapCard.tsx         # Swap interface
│   ├── AddLiquidityCard.tsx # Add liquidity interface
│   └── CreatePoolCard.tsx   # Create pool interface
├── config/
│   ├── contracts.ts         # Contract addresses per chain
│   ├── tokens.ts            # Token lists per chain
│   └── wagmi.ts             # Wagmi configuration
└── hooks/
    └── usePoolDiscovery.ts  # Auto pool discovery hook
```

## How Pool Discovery Works

The frontend automatically discovers pools by:

1. Querying `Initialize` events from the PoolManager contract
2. Filtering events where `hooks` address matches DynamicSwap hook
3. Fetching token info (symbol, decimals) for each pool
4. Displaying pools in real-time

No manual pool registration needed - any pool created with the DynamicSwap hook appears automatically!

## Deployed Hook Addresses

| Chain | Hook Address |
|-------|--------------|
| Base | `0x14a8bf1bb6419bed0986a4c32f8cd6341744e0c0` |
| Optimism | `0xb5E6D6cb548033dA8F18e7f177a9aE485d81a0c0` |
| Celo | `0xe96B2C7416596fE707ba40379B909F42F18d7FC0` |

## Adding New Chains

To add support for a new chain:

1. Add chain config to `src/config/contracts.ts`:
```typescript
export const SUPPORTED_CHAINS: Record<number, ChainConfig> = {
  // ... existing chains
  NEW_CHAIN_ID: {
    chainId: NEW_CHAIN_ID,
    name: "New Chain",
    hookAddress: "0x...",
    poolManager: "0x...",
    // ... other addresses
  },
};
```

2. Add tokens to `src/config/tokens.ts`:
```typescript
export const TOKENS: Record<number, Token[]> = {
  // ... existing chains
  NEW_CHAIN_ID: [
    { address: "0x...", symbol: "TOKEN", name: "Token Name", decimals: 18 },
  ],
};
```

3. Add chain to wagmi config in `src/config/wagmi.ts`

## Important Notes

### Swap & Liquidity Limitations

Full V4 swap and liquidity operations require complex encoding through Universal Router. The current implementation:

1. **Handles token approvals** - Approves tokens to Permit2/PositionManager
2. **Shows helpful guidance** - Directs users to complete transactions via Uniswap interface

For full swap/liquidity functionality, you would need to:
- Integrate with Uniswap's Universal Router
- Implement proper V4 action encoding
- Handle the unlock callback pattern

### Environment Variables

Required:
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` - Get free at https://cloud.walletconnect.com/

## Build & Deploy

```bash
# Build for production
npm run build

# Start production server
npm start
```

Deploy to Vercel, Netlify, or any Node.js hosting platform.

## License

MIT
