"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  EXPLORER_BASE,
  BRAND_VAULT_ADDRESS,
  BRAND_REGISTRY_ADDRESS,
  AGENT_TREASURY_ADDRESS,
  explorerContract,
} from "@/lib/constants";

interface HeaderProps {
  lastRefresh: Date | null;
}

export function Header({ lastRefresh }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const contracts = [
    { label: "BrandVault", addr: BRAND_VAULT_ADDRESS },
    { label: "Registry", addr: BRAND_REGISTRY_ADDRESS },
    { label: "Treasury", addr: AGENT_TREASURY_ADDRESS },
  ];

  return (
    <header className="border-b border-border relative">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-2xl font-bold text-primary hover:opacity-80 transition-opacity"
          >
            BrandMover
          </Link>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            Live on Hedera Testnet
          </span>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-3">
          {contracts.map((c) => (
            <a
              key={c.label}
              href={explorerContract(c.addr)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              {c.label}
              <ExternalLink className="h-3 w-3" />
            </a>
          ))}
          <div className="w-px h-5 bg-border mx-1" />
          {lastRefresh && (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
              </span>
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <ThemeToggle />
        </nav>

        {/* Mobile Navigation Toggle */}
        <div className="md:hidden flex items-center space-x-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-background border-b border-border shadow-lg z-50">
          <nav className="container mx-auto px-4 py-4 space-y-3">
            {contracts.map((c) => (
              <a
                key={c.label}
                href={explorerContract(c.addr)}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-foreground hover:text-primary transition-colors py-2 flex items-center gap-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                {c.label}
                <ExternalLink className="h-3 w-3" />
              </a>
            ))}
            <a
              href={EXPLORER_BASE}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-foreground hover:text-primary transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              HashScan Explorer
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
