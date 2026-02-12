"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { isOwner } from "@/config/contracts";

export function Navbar() {
  const pathname = usePathname();
  const { address } = useAccount();
  const showAdmin = isOwner(address);

  const navItems = [
    { href: "/", label: "Home" },
    { href: "/swap", label: "Swap" },
    { href: "/pools", label: "Pools" },
    { href: "/create-pool", label: "Create Pool" },
  ];

  if (showAdmin) {
    navItems.push({ href: "/admin", label: "Admin" });
  }

  return (
    <nav className="glass sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <span className="text-xl font-bold gradient-text">DynamicSwap</span>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-lg transition-all ${
                  pathname === item.href
                    ? "bg-purple-600/30 text-white"
                    : "text-gray-300 hover:text-white hover:bg-white/10"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Connect Button */}
          <div className="flex items-center gap-4">
            <ConnectButton 
              showBalance={false}
              chainStatus="icon"
              accountStatus="avatar"
            />
          </div>
        </div>
      </div>
    </nav>
  );
}
