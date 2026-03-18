# ⚡ DynamicSwap

> **Uniswap V4 Dynamic Fee Hook** — Smart liquidity protection through volatility-based fee adjustment

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen?style=for-the-badge)](https://dynamicswap.vercel.app)
[![Base](https://img.shields.io/badge/Base-Deployed-blue?style=for-the-badge)](https://basescan.org/address/0xCED22Ff119c151b9CaD797941dAC215B67E5b0c0)
[![Optimism](https://img.shields.io/badge/Optimism-Deployed-red?style=for-the-badge)](https://optimistic.etherscan.io/address/0xFefcBfDa5342E8e4d1Cb882D01dFb17779B330C0)
[![Unichain](https://img.shields.io/badge/Unichain-Deployed-pink?style=for-the-badge)](https://uniscan.xyz/address/0xca5d18d24A62Bbe924Ba615F85e4Ac95377e30C0)
[![Celo](https://img.shields.io/badge/Celo-Deployed-yellow?style=for-the-badge)](https://celoscan.io/address/0x7E2873516C7344Bfe201f981d0A7Bb6A6dEBf0c0)

---

## 🎯 Problem

Liquidity Providers (LPs) on traditional AMMs face a critical challenge: **static fees don't adapt to market conditions**. During high volatility, LPs suffer impermanent loss while earning the same fees as calm markets. This creates a lose-lose situation where LPs are undercompensated during risky periods.

## 💡 Solution

**DynamicSwap** is a Uniswap V4 hook that automatically adjusts swap fees based on real-time price volatility using an Exponentially Weighted Moving Average (EWMA) algorithm.

- 📉 **Low Volatility** → Lower fees (0.30%) → Attracts more trading volume
- 📈 **High Volatility** → Higher fees (up to 1.00%) → Protects LPs from impermanent loss

---

**Specialized Markets Fit**
✅ Chain-localized: Deployed on Base, Optimism, Unichain, Celo with chain-specific tuning
✅ Asset-aware: Fee curves optimized for volatile pairs (ETH/USDC, CELO/cUSD)
✅ L2-native: Optimized for fast L2 block times
## 🌐 Live Deployments

| Chain | Hook Contract | Pool Status | Explorer |
|-------|--------------|-------------|----------|
| **Base** | `0xCED22Ff119c151b9CaD797941dAC215B67E5b0c0` | ✅ Active | [View](https://basescan.org/address/0xCED22Ff119c151b9CaD797941dAC215B67E5b0c0) |
| **Optimism** | `0xFefcBfDa5342E8e4d1Cb882D01dFb17779B330C0` | ✅ Active | [View](https://optimistic.etherscan.io/address/0xFefcBfDa5342E8e4d1Cb882D01dFb17779B330C0) |
| **Unichain** | `0xca5d18d24A62Bbe924Ba615F85e4Ac95377e30C0` | ✅ Active | [View](https://uniscan.xyz/address/0xca5d18d24A62Bbe924Ba615F85e4Ac95377e30C0) |
| **Celo** | `0x7E2873516C7344Bfe201f981d0A7Bb6A6dEBf0c0` | ✅ Active | [View](https://celoscan.io/address/0x7E2873516C7344Bfe201f981d0A7Bb6A6dEBf0c0) |

**🔗 Live App:** [https://dynamicswap.vercel.app](https://dynamicswap.vercel.app)

**👤 Owner:** `0x22bc13d2936f738bc820A6934FA8eC60EA51a621`

---
** Technical Highlights**

Uses beforeSwap to return dynamic fee override
EWMA volatility tracking via afterSwap
Fee range: MIN_FEE=100 (0.01%), MAX_FEE=10000 (1.00%)
Pools initialized with full-range liquidity

--
## ✨ Features

### 🔄 Dynamic Fee Adjustment
- **Real-time volatility tracking** using EWMA algorithm
- **Automatic fee scaling** from 0.30% to 1.00%
- **Per-swap updates** ensure fees always reflect current market conditions

### 🛡️ LP Protection
- **Higher fees during volatility** compensate for impermanent loss risk
- **Lower fees during stability** attract more volume and generate consistent returns
- **No manual intervention** required — fully automated

### 🌍 Multi-Chain Support
- **4 chains** deployed and operational
- **Consistent behavior** across all networks
- **Chain-specific optimizations** for gas efficiency

### 📊 Transparent Metrics
- **On-chain volatility data** readable by anyone
- **Current fee display** in real-time on frontend
- **Historical tracking** for analysis

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      DynamicSwap Hook                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ beforeSwap  │───▶│  Calculate  │───▶│   Return    │     │
│  │   Hook      │    │ Dynamic Fee │    │  Fee Override│     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────┐    ┌─────────────┐                        │
│  │ afterSwap   │───▶│   Update    │                        │
│  │   Hook      │    │  Volatility │                        │
│  └─────────────┘    └─────────────┘                        │
│                            │                                 │
│                            ▼                                 │
│                    ┌─────────────┐                          │
│                    │    EWMA     │                          │
│                    │  Algorithm  │                          │
│                    └─────────────┘                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Hook Flow

1. **beforeSwap**: Calculates current fee based on stored volatility, returns fee override
2. **afterSwap**: Measures price change from swap, updates EWMA volatility
3. **Fee Calculation**: Linear interpolation between MIN_FEE (0.30%) and MAX_FEE (1.00%)

---

## 📐 Fee Algorithm

```solidity
// EWMA Volatility Update
newVolatility = α × oldVolatility + (1 - α) × priceChange

// Dynamic Fee Calculation
if (volatility >= threshold) {
    fee = MAX_FEE  // 1.00%
} else {
    fee = MIN_FEE + (MAX_FEE - MIN_FEE) × (volatility / threshold)
}
```

**Parameters:**
| Parameter | Value | Description |
|-----------|-------|-------------|
| MIN_FEE | 3000 (0.30%) | Fee during low volatility |
| MAX_FEE | 10000 (1.00%) | Fee during high volatility |
| ALPHA | 0.94 | EWMA decay factor |
| THRESHOLD | 1% | Price change for max fee |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Foundry (for contracts)
- Git

### Frontend Setup

```bash
# Clone repository
git clone https://github.com/Gomathi1806/dynamic-swap.git
cd dynamic-swap

# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

### Contract Development

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Navigate to contracts
cd contracts

# Install dependencies
forge install

# Build
forge build

# Test
forge test
```

---

## 📁 Project Structure

```
dynamic-swap/
├── src/                          # Next.js Frontend
│   ├── app/                      # App Router pages
│   │   ├── page.tsx             # Home page
│   │   ├── swap/                # Swap interface
│   │   └── pools/               # Pool listing
│   ├── components/              # React components
│   │   ├── HookStatus.tsx       # Dynamic fee display
│   │   ├── ChainSelector.tsx    # Multi-chain switcher
│   │   └── Navbar.tsx           # Navigation
│   └── config/                  # Configuration
│       └── contracts.ts         # Chain & contract addresses
├── contracts/                    # Solidity Contracts
│   └── src/
│       └── DynamicFeeHookSimple.sol
├── public/                       # Static assets
├── deployments.json             # Deployment addresses
└── README.md
```

---

## 🔑 Contract Addresses

### Pool Managers (Uniswap V4 Official)
| Chain | Pool Manager |
|-------|-------------|
| Base | `0x498581fF718922c3f8e6A244956aF099B2652b2b` |
| Optimism | `0x9a13F98Cb987694C9F086b1F5eB990EeA8264Ec3` |
| Unichain | `0x1F98400000000000000000000000000000000004` |
| Celo | `0x288dc841A52FCA2707c6947B3A777c5E56cd87BC` |

### Position Managers
| Chain | Position Manager |
|-------|-----------------|
| Base | `0x7C5f5A4bBd8fD63184577525326123B519429bDc` |
| Optimism | `0x3C3Ea4B57a46241e54610e5f022E5c45859A1017` |
| Unichain | `0x4529A01c7A0410167c5740C487A8DE60232617bf` |
| Celo | `0xf7965f3981e4D5BC383BfBCb61501763e9068CA9` |

### Common (All Chains)
| Contract | Address |
|----------|---------|
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

---

## 🧪 Pool Configuration

| Parameter | Value |
|-----------|-------|
| Fee Flag | `0x800000` (Dynamic) |
| Tick Spacing | 200 |
| Hooks | DynamicFeeHookSimple |

### Active Pools

| Chain | Pair | Status |
|-------|------|--------|
| Base | WETH/USDC | ✅ Live |
| Optimism | USDC/WETH | ✅ Live |
| Unichain | USDC/WETH | ✅ Live |
| Celo | CELO/cUSD | ✅ Live |

---

## 📊 Hook Functions

| Function | Access | Description |
|----------|--------|-------------|
| `getCurrentFee()` | Public | Get current dynamic fee |
| `MIN_FEE()` | Public | Minimum fee (3000 = 0.30%) |
| `MAX_FEE()` | Public | Maximum fee (10000 = 1.00%) |
| `ewmaVolatility()` | Public | Current EWMA volatility |
| `lastPrice(poolId)` | Public | Last recorded price |
| `poolInitialized(poolId)` | Public | Check if pool is active |

---

## 🔐 Security Considerations

- ✅ **No admin keys** — Hook behavior is deterministic
- ✅ **Non-upgradeable** — Contract code is immutable
- ✅ **Open source** — Fully auditable code
- ✅ **Battle-tested math** — EWMA is a standard algorithm
- ✅ **Bounded fees** — Cannot exceed MAX_FEE

---


**What's Next **

Chainlink oracle integration for external volatility data
Insurance reserve accumulation from fees
IL protection payouts to LPs
---

## 🏆 Hackathon Submission

**UHI8 - Uniswap Hook Incubator**

### What We Built
A production-ready Uniswap V4 hook that dynamically adjusts swap fees based on real-time market volatility, deployed across 4 mainnet chains.

### Key Achievements
- ✅ **4 mainnet deployments** (Base, Optimism, Unichain, Celo)
- ✅ **Working pools** with liquidity on all chains
- ✅ **Live frontend** at dynamicswap.vercel.app
- ✅ **Real-time dynamic fees** responding to market conditions

### Innovation
- First multi-chain EWMA-based dynamic fee hook
- Automated LP protection without governance overhead
- Seamless integration with Uniswap V4's new hook architecture

---


---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [Uniswap Foundation](https://uniswap.org) — V4 Core & Periphery
- [UHI8 Hackathon](https://uniswap.org) — Hook Incubator Program
- [OpenZeppelin](https://openzeppelin.com) — Security Libraries

---

<div align="center">

**⚡ Built for the future of DeFi ⚡**

[Live Demo](https://dynamicswap.vercel.app) · [Report Bug](https://github.com/Gomathi1806/dynamic-swap/issues) · [Request Feature](https://github.com/Gomathi1806/dynamic-swap/issues)

</div>
