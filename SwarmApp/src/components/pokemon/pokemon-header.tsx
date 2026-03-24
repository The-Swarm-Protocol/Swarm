/** PokemonHeader — Trainer HUD header with pokeball belt showing registered agents. */
"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import Link from "next/link";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { thirdwebClient } from "@/lib/thirdweb-client";
import { WALLET_CHAINS, DEFAULT_CHAIN } from "@/lib/chains";
import { swarmWallets } from "@/lib/wallets";
import { useOrg } from "@/contexts/OrgContext";
import { useSession } from "@/contexts/SessionContext";
import { usePokemon } from "@/contexts/PokemonContext";
import { NotificationCenter } from "@/components/notification-center";
import { useThirdwebAuth } from "@/hooks/useThirdwebAuth";

/** Pokeball component — CSS-only pokeball */
function Pokeball({ status, name, size = "sm" }: { status?: "online" | "busy" | "offline"; name?: string; size?: "sm" | "md" }) {
  const sizeClass = size === "md" ? "pokeball" : "pokeball pokeball-sm";
  const statusClass = status === "online" ? "pokeball-online" : status === "busy" ? "pokeball-busy" : status === "offline" ? "pokeball-offline" : "";

  return (
    <div className="flex flex-col items-center gap-0.5" title={name || "Empty slot"}>
      <div className={`${sizeClass} ${statusClass} ${!name ? "pokeball-empty" : ""}`} />
      {name && size === "md" && (
        <span className="text-[7px] text-white/60 truncate max-w-[40px]">{name}</span>
      )}
    </div>
  );
}

/** Compact wallet display for Pokemon header */
function PokemonWalletDisplay() {
  const account = useActiveAccount();
  const { address: sessionAddress, authenticated, logout } = useSession();
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
          className="flex items-center gap-1.5 px-2 py-1 rounded-full border-2 border-[#3b4cca]/40 bg-[#141428]/80 text-[#3b4cca] text-xs hover:border-[#ee1515] transition-colors"
          title={sessionAddress}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#78c850] shadow-[0_0_4px_#78c850]" />
          {truncated}
        </button>
        {showMenu && (
          <div className="absolute right-0 top-full mt-1 bg-[#1a1a3a] border border-[#3b4cca]/30 rounded-xl z-50 min-w-[140px] py-1 shadow-lg">
            <div onClick={() => setShowMenu(false)} className="px-2 py-1.5 text-xs">
              <ConnectButton client={thirdwebClient} wallets={swarmWallets} chain={DEFAULT_CHAIN} chains={WALLET_CHAINS} connectButton={{ label: "Connect" }} />
            </div>
            <button
              onClick={async () => { setShowMenu(false); await logout(); }}
              className="w-full text-left px-2 py-1.5 text-xs text-[#ee1515] hover:text-[#ff4444]"
            >
              Log Out
            </button>
          </div>
        )}
      </div>
    );
  }

  return <ConnectButton client={thirdwebClient} wallets={swarmWallets} chain={DEFAULT_CHAIN} chains={WALLET_CHAINS} connectButton={{ label: "Join" }} />;
}

export function PokemonHeader() {
  const { theme, setTheme } = useTheme();
  const { currentOrg } = useOrg();
  const { label } = usePokemon();
  const account = useActiveAccount();
  const isConnected = !!account;
  const [mounted, setMounted] = useState(false);
  const [agents, setAgents] = useState<{ id: string; name: string; status: string }[]>([]);
  useEffect(() => setMounted(true), []);

  // Fetch agents for the pokeball belt
  useEffect(() => {
    if (!currentOrg) return;
    const fetchAgents = async () => {
      try {
        const res = await fetch(`/api/agents?orgId=${currentOrg.id}`);
        if (res.ok) {
          const data = await res.json();
          setAgents((data.agents || data || []).slice(0, 6));
        }
      } catch { /* ignore */ }
    };
    fetchAgents();
  }, [currentOrg]);

  const orgName = currentOrg?.name || "No Team";
  const maxSlots = 6; // Pokemon party max

  return (
    <header className="sticky top-0 z-50 w-full border-b-2 border-[#ee1515]/30 bg-gradient-to-r from-[#1a1a3a] via-[#141428] to-[#1a1a3a]">
      <div className="flex h-14 items-center justify-between px-4">
        {/* Left: Trainer info */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="pokeball pokeball-sm" />
            <span className="text-sm font-bold text-[#ee1515] group-hover:text-[#ffcb05] transition-colors">
              SWARM
            </span>
          </Link>
          <div className="h-5 w-px bg-[#3b4cca]/20" />
          <span className="text-xs text-white/60">
            {label("Swarm")}: <span className="text-[#ffcb05]">{orgName}</span>
          </span>
        </div>

        {/* Center: Pokeball belt — shows agents as pokeballs */}
        <div className="hidden md:flex items-center gap-2 px-4 py-1 rounded-full bg-[#1a1a3a]/80 border border-[#3b4cca]/20">
          <span className="text-[10px] text-white/40 mr-1">{label("Agents")}:</span>
          {Array.from({ length: maxSlots }).map((_, i) => {
            const agent = agents[i];
            return (
              <Pokeball
                key={i}
                name={agent?.name}
                status={agent ? (agent.status === "online" ? "online" : agent.status === "busy" ? "busy" : "offline") : undefined}
                size="sm"
              />
            );
          })}
          <span className="text-[10px] text-white/30 ml-1">{agents.length}/{maxSlots}</span>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          {isConnected && <NotificationCenter />}
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-1.5 rounded-full border-2 border-[#3b4cca]/30 hover:border-[#ee1515] bg-[#141428]/60 text-[#3b4cca] hover:text-[#ee1515] transition-all"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
          )}
          <PokemonWalletDisplay />
        </div>
      </div>
    </header>
  );
}
