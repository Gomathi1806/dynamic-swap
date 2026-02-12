import { NextResponse } from "next/server";

export async function GET() {
  // Create SVG image for Open Graph (1200x630)
  const svg = `
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#111827"/>
          <stop offset="50%" style="stop-color:#581c87"/>
          <stop offset="100%" style="stop-color:#111827"/>
        </linearGradient>
        <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#8b5cf6"/>
          <stop offset="100%" style="stop-color:#ec4899"/>
        </linearGradient>
      </defs>
      
      <!-- Background -->
      <rect width="1200" height="630" fill="url(#bg)"/>
      
      <!-- Decorative circles -->
      <circle cx="100" cy="100" r="200" fill="rgba(139,92,246,0.1)"/>
      <circle cx="1100" cy="530" r="250" fill="rgba(236,72,153,0.1)"/>
      
      <!-- Main content -->
      <text x="600" y="200" text-anchor="middle" font-size="100" fill="#8b5cf6">⚡</text>
      
      <text x="600" y="320" text-anchor="middle" font-family="Arial, sans-serif" font-size="80" font-weight="bold" fill="white">
        DynamicSwap
      </text>
      
      <text x="600" y="400" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" fill="#d1d5db">
        Smart Liquidity Protection on Uniswap V4
      </text>
      
      <!-- Stats bar -->
      <rect x="200" y="460" width="800" height="80" rx="20" fill="rgba(255,255,255,0.05)" stroke="rgba(139,92,246,0.3)" stroke-width="1"/>
      
      <text x="350" y="510" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#a78bfa">3 Networks</text>
      <text x="600" y="510" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#a78bfa">0.30%-1.00% Fees</text>
      <text x="850" y="510" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#a78bfa">Permissionless</text>
      
      <!-- URL -->
      <text x="600" y="590" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#6b7280">
        dynamicswap.xyz
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
