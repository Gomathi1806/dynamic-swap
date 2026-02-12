import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, celo } from "wagmi/chains";
import { http } from "viem";

// Define Unichain
const unichain = {
  id: 130,
  name: "Unichain",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: { http: ["https://mainnet.unichain.org"] },
    public: { http: ["https://mainnet.unichain.org"] },
  },
  blockExplorers: {
    default: { name: "Uniscan", url: "https://uniscan.xyz" },
  },
} as const;

export const config = getDefaultConfig({
  appName: "DynamicSwap",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",
  chains: [base, celo, unichain],
  transports: {
    [base.id]: http("https://mainnet.base.org"),
    [celo.id]: http("https://forno.celo.org"),
    [unichain.id]: http("https://mainnet.unichain.org"),
  },
  ssr: true,
});

export { unichain };
