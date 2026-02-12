# ⚡ DynamicSwap

Uniswap V4 Dynamic Fee Hook - Smart liquidity protection through volatility-based fee adjustment.

## 🌐 Live Deployments

| Chain | Hook Address | Explorer |
|-------|--------------|----------|
| **Base** | `0x2c80c5cd9fecc3e32dfaa654e022738480a4909a` | [BaseScan](https://basescan.org/address/0x2c80c5cd9fecc3e32dfaa654e022738480a4909a) |
| **Celo** | `0x91f2c11dBa99F642470Dc548b566208bE2Ce48F6` | [CeloScan](https://celoscan.io/address/0x91f2c11dBa99F642470Dc548b566208bE2Ce48F6) |
| **Unichain** | `0xf67f15838B39c5c9CeB187f5e5Cae0a625F0Be35` | [Uniscan](https://uniscan.xyz/address/0xf67f15838B39c5c9CeB187f5e5Cae0a625F0Be35) |

**Owner:** `0x22bc13d2936f738bc820A6934FA8eC60EA51a621`

---

## 📋 Table of Contents

1. [Quick Start](#-quick-start)
2. [Frontend Setup](#-frontend-setup)
3. [Contracts Setup](#-contracts-setup)
4. [Deployment Guide](#-deployment-guide)
5. [Farcaster & Base Mini App](#-farcaster--base-mini-app)
6. [Architecture](#-architecture)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm / npm / yarn
- Foundry (for contracts)

### Clone and Install

```bash
# Clone the repo
git clone https://github.com/yourusername/dynamicswap.git
cd dynamicswap

# Install frontend dependencies
npm install

# Install contract dependencies
cd contracts
forge install
```

---

## 🖥️ Frontend Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Build for Production

```bash
npm run build
npm start
```

---

## 📜 Contracts Setup

### 1. Install Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### 2. Install Dependencies

```bash
cd contracts
forge install foundry-rs/forge-std
forge install Uniswap/v4-core
forge install Uniswap/v4-periphery
forge install OpenZeppelin/openzeppelin-contracts
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
PRIVATE_KEY=your_private_key_without_0x
BASESCAN_API_KEY=your_key
CELOSCAN_API_KEY=your_key
UNISCAN_API_KEY=your_key
```

### 4. Build Contracts

```bash
forge build
```

---

## 🚢 Deployment Guide

### Deploy to Base

```bash
cd contracts
source .env

forge script script/Deploy.s.sol:DeployBase \
  --rpc-url https://mainnet.base.org \
  --broadcast \
  -vvvv
```

### Deploy to Celo

```bash
forge script script/Deploy.s.sol:DeployCelo \
  --rpc-url https://forno.celo.org \
  --broadcast \
  -vvvv
```

### Deploy to Unichain

```bash
forge script script/Deploy.s.sol:DeployUnichain \
  --rpc-url https://mainnet.unichain.org \
  --broadcast \
  --skip-simulation \
  -vvvv
```

### Verify Contracts

```bash
# Base
forge verify-contract \
  --chain-id 8453 \
  --constructor-args $(cast abi-encode "constructor(address,address)" "0x498581fF718922c3f8e6A244956aF099B2652b2b" "YOUR_ADDRESS") \
  --etherscan-api-key $BASESCAN_API_KEY \
  HOOK_ADDRESS \
  src/DynamicFeeHook.sol:DynamicFeeHook

# Celo
forge verify-contract \
  --chain-id 42220 \
  --constructor-args $(cast abi-encode "constructor(address,address)" "0x288dc841A52FCA2707c6947B3A777c5E56cd87BC" "YOUR_ADDRESS") \
  --etherscan-api-key $CELOSCAN_API_KEY \
  HOOK_ADDRESS \
  src/DynamicFeeHook.sol:DynamicFeeHook

# Unichain
forge verify-contract \
  --chain-id 130 \
  --constructor-args $(cast abi-encode "constructor(address,address)" "0x1F98400000000000000000000000000000000004" "YOUR_ADDRESS") \
  --etherscan-api-key $UNISCAN_API_KEY \
  HOOK_ADDRESS \
  src/DynamicFeeHook.sol:DynamicFeeHook
```

### Verify Ownership

```bash
# Check owner on each chain
cast call HOOK_ADDRESS "owner()(address)" --rpc-url RPC_URL
```

---

## 🖼️ Farcaster & Base Mini App

### Farcaster Frame Setup

1. **Generate Account Association**
   - Go to: https://warpcast.com/~/developers/frames
   - Generate signature for your domain

2. **Update farcaster.json**
   Edit `public/.well-known/farcaster.json`:
   ```json
   {
     "accountAssociation": {
       "header": "YOUR_HEADER",
       "payload": "YOUR_PAYLOAD",
       "signature": "YOUR_SIGNATURE"
     }
   }
   ```

3. **Test Frame**
   - Use Frame Validator: https://warpcast.com/~/developers/frames
   - Enter your URL and verify

### Base Mini App Setup

1. **Register App**
   - Go to: https://base.org/builders
   - Register your app
   - Get app_id

2. **Update layout.tsx**
   The app_id is already configured in `src/app/layout.tsx`:
   ```tsx
   other: {
     'base:app_id': '69829eb85d29a',
   }
   ```

3. **Deploy to Vercel**
   ```bash
   npm run build
   vercel deploy --prod
   ```

---

## 🏗️ Architecture

### Project Structure

```
dynamicswap/
├── src/                    # Next.js frontend
│   ├── app/               # App router pages
│   │   ├── api/          # API routes (frames, OG images)
│   │   ├── admin/        # Admin dashboard
│   │   ├── pools/        # Pool listing
│   │   ├── swap/         # Swap interface
│   │   └── create-pool/  # Pool creation
│   ├── components/        # React components
│   └── config/           # Contracts, wagmi config
├── contracts/             # Foundry project
│   ├── src/              # Solidity contracts
│   ├── script/           # Deployment scripts
│   └── test/             # Contract tests
├── public/               # Static assets
│   └── .well-known/      # Farcaster manifest
└── README.md
```

### Hook Features

- **Dynamic Fees**: 0.30% - 1.00% based on volatility
- **EWMA Tracking**: Exponentially weighted moving average for price volatility
- **LP Protection**: Higher fees during volatile periods
- **Protocol Revenue**: 10% of dynamic spread (configurable)

### Contract Functions

| Function | Access | Description |
|----------|--------|-------------|
| `getCurrentFee(poolId)` | Public | Get current dynamic fee |
| `getPoolVolatility(poolId)` | Public | Get EWMA volatility |
| `setVolatilityParams()` | Owner | Update volatility parameters |
| `setProtocolShare()` | Owner | Update protocol share (max 50%) |
| `setTreasury()` | Owner | Update treasury address |
| `withdrawFees()` | Anyone | Withdraw collected fees to treasury |

---

## 🔑 Key Addresses

### Pool Managers

| Chain | Address |
|-------|---------|
| Base | `0x498581fF718922c3f8e6A244956aF099B2652b2b` |
| Celo | `0x288dc841A52FCA2707c6947B3A777c5E56cd87BC` |
| Unichain | `0x1F98400000000000000000000000000000000004` |

### Common Addresses (All Chains)

| Contract | Address |
|----------|---------|
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

---

## 📞 Support

- **Twitter**: [@DynamicSwap](https://twitter.com/dynamicswap)
- **Discord**: [Join our community](https://discord.gg/dynamicswap)
- **Email**: support@dynamicswap.xyz

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.
