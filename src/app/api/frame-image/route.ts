import { NextResponse } from "next/server";

export async function GET() {
  // Create SVG image for Farcaster frame (1.91:1 aspect ratio = 1200x628)
  const svg = `
    <svg width="1200" height="628" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1f1135"/>
          <stop offset="50%" style="stop-color:#4c1d95"/>
          <stop offset="100%" style="stop-color:#1f1135"/>
        </linearGradient>
        <linearGradient id="text-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#8b5cf6"/>
          <stop offset="50%" style="stop-color:#ec4899"/>
          <stop offset="100%" style="stop-color:#8b5cf6"/>
        </linearGradient>
      </defs>
      
      <!-- Background -->
      <rect width="1200" height="628" fill="url(#bg)"/>
      
      <!-- Grid pattern -->
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(139,92,246,0.1)" stroke-width="1"/>
      </pattern>
      <rect width="1200" height="628" fill="url(#grid)"/>
      
      <!-- Logo/Icon -->
      <text x="600" y="180" text-anchor="middle" font-size="80" fill="#8b5cf6">⚡</text>
      
      <!-- Title -->
      <text x="600" y="280" text-anchor="middle" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="url(#text-gradient)">
        DynamicSwap
      </text>
      
      <!-- Subtitle -->
      <text x="600" y="350" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#d1d5db">
        Uniswap V4 Dynamic Fee Hook
      </text>
      
      <!-- Features -->
      <text x="600" y="430" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#a78bfa">
        🛡️ LP Protection  •  📈 0.30% - 1.00% Dynamic Fees  •  ⛓️ Multi-Chain
      </text>
      
      <!-- Networks -->
      <text x="600" y="500" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#9ca3af">
        Live on Base • Celo • Unichain
      </text>
      
      <!-- CTA -->
      <rect x="450" y="540" width="300" height="50" rx="25" fill="#8b5cf6"/>
      <text x="600" y="572" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="white">
        Start Trading →
      </text>
    </svg>
  `;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
