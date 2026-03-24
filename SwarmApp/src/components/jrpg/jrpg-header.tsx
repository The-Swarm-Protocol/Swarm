/** JrpgHeader — 16-bit JRPG party stats banner replacing the standard header. */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import Link from "next/link";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { thirdwebClient } from "@/lib/thirdweb-client";
import { WALLET_CHAINS, DEFAULT_CHAIN } from "@/lib/chains";
import { swarmWallets } from "@/lib/wallets";
import { useOrg } from "@/contexts/OrgContext";
import { useSession } from "@/contexts/SessionContext";
import { useJrpg } from "@/contexts/JrpgContext";
import { NotificationCenter } from "@/components/notification-center";
import { useThirdwebAuth } from "@/hooks/useThirdwebAuth";

/** Compact wallet display for JRPG header */
function JrpgWalletDisplay() {
  const account = useActiveAccount();
  const { address: sessionAddress, authenticated, logout } = useSession();
  const authConfig = useThirdwebAuth();
  const [showMenu, setShowMenu] = useState(false);

  if (account) {
    return <ConnectButton client={thirdwebClient} wallets={swarmWallets} chain={DEFAULT_CHAIN} chains={WALLET_CHAINS} />;
  }

  if (authenticated && sessionAddress) {
    const truncated = `${sessionAddress.slice(0, 6)}...${sessionAddress.slice(-4)}`;
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu((prev) => !prev)}
          className="flex items-center gap-1.5 px-2 py-1 border-2 border-[#4dccff]/40 bg-[#0a0a2e]/80 text-[#4dccff] text-[8px] hover:border-[#ffd700] transition-colors"
          style={{ fontFamily: "var(--font-jrpg), monospace" }}
          title={sessionAddress}
        >
          <span className="w-1.5 h-1.5 bg-[#00ff88] shadow-[0_0_4px_#00ff88]" />
          {truncated}
        </button>
        {showMenu && (
          <div className="absolute right-0 top-full mt-1 jrpg-dialog-box z-50 min-w-[140px] py-1">
            <div onClick={() => setShowMenu(false)} className="px-2 py-1.5 text-[8px]">
              <ConnectButton client={thirdwebClient} wallets={swarmWallets} chain={DEFAULT_CHAIN} chains={WALLET_CHAINS} connectButton={{ label: "Connect" }} />
            </div>
            <button
              onClick={async () => { setShowMenu(false); await logout(); }}
              className="w-full text-left px-2 py-1.5 text-[8px] text-[#ff4444] hover:text-[#ff6666]"
              style={{ fontFamily: "var(--font-jrpg), monospace" }}
            >
              Escape
            </button>
          </div>
        )}
      </div>
    );
  }

  return <ConnectButton client={thirdwebClient} wallets={swarmWallets} chain={DEFAULT_CHAIN} chains={WALLET_CHAINS} connectButton={{ label: "Join" }} />;
}

export function JrpgHeader() {
  const { theme, setTheme } = useTheme();
  const { currentOrg } = useOrg();
  const { label } = useJrpg();
  const account = useActiveAccount();
  const isConnected = !!account;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const orgName = currentOrg?.name || "No Guild";

  return (
    <header
      className="sticky top-0 z-50 w-full jrpg-pixel-border bg-gradient-to-r from-[#1a1a4e] via-[#12124a] to-[#1a1a4e]"
      style={{ borderTop: "none", borderLeft: "none", borderRight: "none" }}
    >
      <div className="flex h-12 items-center justify-between px-4">
        {/* Left: Guild name */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-[10px] text-[#ffd700]" style={{ fontFamily: "var(--font-jrpg), monospace" }}>
              ⚔
            </span>
            <span
              className="text-[10px] text-[#ffd700] tracking-wider group-hover:text-[#ffffff] transition-colors"
              style={{ fontFamily: "var(--font-jrpg), monospace" }}
            >
              SWARM
            </span>
          </Link>
          <div className="h-4 w-px bg-[#4dccff]/20" />
          <span
            className="text-[8px] text-[#c8c8ff]/80 tracking-wide"
            style={{ fontFamily: "var(--font-jrpg), monospace" }}
          >
            {label("Swarm")}: {orgName}
          </span>
        </div>

        {/* Center: Party stats */}
        <div className="hidden md:flex items-center gap-4">
          <StatChip label="HP" color="#00ff88" />
          <StatChip label="MP" color="#4dccff" />
          <StatChip label="G" color="#ffd700" value="∞" />
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          {isConnected && <NotificationCenter />}
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-1.5 border-2 border-[#4dccff]/30 hover:border-[#ffd700] bg-[#0a0a2e]/60 text-[#4dccff] hover:text-[#ffd700] transition-all"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
          )}
          <JrpgWalletDisplay />
        </div>
      </div>
    </header>
  );
}

/** Mini stat chip for the header party stats bar */
function StatChip({ label, color, value }: { label: string; color: string; value?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="text-[7px] tracking-wider"
        style={{ fontFamily: "var(--font-jrpg), monospace", color }}
      >
        {label}
      </span>
      {value ? (
        <span
          className="text-[8px] text-[#ffffff]"
          style={{ fontFamily: "var(--font-jrpg), monospace" }}
        >
          {value}
        </span>
      ) : (
        <div className="jrpg-hp-bar w-16">
          <div
            className="h-full transition-all"
            style={{
              width: "85%",
              background: `linear-gradient(180deg, ${color} 0%, ${color}88 100%)`,
            }}
          />
        </div>
      )}
    </div>
  );
}
