// src/config/wagmi.ts
"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { base, optimism, celo } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "DynamicSwap",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo-project-id",
  chains: [base, optimism, celo],
  transports: {
    [base.id]: http("https://mainnet.base.org"),
    [optimism.id]: http("https://mainnet.optimism.io"),
    [celo.id]: http("https://forno.celo.org"),
  },
  ssr: true,
});
