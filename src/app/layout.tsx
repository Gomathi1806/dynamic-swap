import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dynamicswap.xyz";

export const metadata: Metadata = {
  title: "DynamicSwap - Uniswap V4 Dynamic Fee Hook",
  description: "Protect your liquidity with dynamic fees that adjust based on market volatility",
  metadataBase: new URL(appUrl),
  
  // Base Mini App
  other: {
    "base:app_id": "69829eb85d29a",
  },
  
  // Open Graph
  openGraph: {
    title: "DynamicSwap - Smart Liquidity Protection",
    description: "Uniswap V4 hook with dynamic fees (0.30% - 1.00%) based on volatility",
    url: appUrl,
    siteName: "DynamicSwap",
    images: [
      {
        url: `${appUrl}/api/og`,
        width: 1200,
        height: 630,
        alt: "DynamicSwap",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  
  // Twitter/X
  twitter: {
    card: "summary_large_image",
    title: "DynamicSwap - Smart Liquidity Protection",
    description: "Uniswap V4 hook with dynamic fees based on volatility",
    images: [`${appUrl}/api/og`],
  },
  
  // Farcaster Frame
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Farcaster Frame Meta Tags */}
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content={`${appUrl}/api/frame-image`} />
        <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
        <meta property="fc:frame:button:1" content="🔄 Swap" />
        <meta property="fc:frame:button:1:action" content="link" />
        <meta property="fc:frame:button:1:target" content={`${appUrl}/swap`} />
        <meta property="fc:frame:button:2" content="💧 Add Liquidity" />
        <meta property="fc:frame:button:2:action" content="link" />
        <meta property="fc:frame:button:2:target" content={`${appUrl}/pools`} />
        <meta property="fc:frame:button:3" content="📊 View Pools" />
        <meta property="fc:frame:button:3:action" content="link" />
        <meta property="fc:frame:button:3:target" content={`${appUrl}/pools`} />
      </head>
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
            <Navbar />
            <main className="container mx-auto px-4 py-8">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
