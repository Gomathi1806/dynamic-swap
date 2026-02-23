// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DynamicSwap - Volatility-Based Dynamic Fee DEX",
  description: "Uniswap V4 DEX with automatic fee adjustment based on market volatility. Fees range from 0.30% to 1.00%.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} text-white min-h-screen`}>
        <Providers>
          <Navbar />
          <main className="pb-20">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
