/** JrpgContext — Provides JRPG label mappings when the JRPG skin is active.
 *  Components can use `useJrpg().label("Fleet")` to get "Party Members" when JRPG is on. */
"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSkin } from "@/contexts/SkinContext";

/** Map of standard Swarm labels → JRPG equivalents */
const JRPG_LABELS: Record<string, string> = {
  // ── Sidebar sections ──
  Command: "Guild Hall",
  Deploy: "Summon",
  Coordinate: "Quest Board",
  Platform: "Kingdom",
  Modifications: "Enchantments",
  Admin: "Throne Room",

  // ── Sidebar items ──
  Dashboard: "Guild Hall",
  Credit: "Treasury",
  Activity: "Battle Log",
  Health: "White Magic",
  "Agent Map": "World Map",
  Logs: "Chronicle",
  Fleet: "Party Members",
  Projects: "Campaigns",
  Marketplace: "Item Shop",
  Team: "Fellowship",
  Compute: "Forge",
  Computers: "Anvils",
  Workspaces: "Camps",
  "Task Board": "Quest Board",
  "Job Board": "Bounty Board",
  Channels: "Tavern",
  Approvals: "Royal Decree",
  Workflows: "Spell Chains",
  Scheduler: "Time Magic",
  Organizations: "Kingdoms",
  "Usage & Billing": "Gold Ledger",
  Storage: "Vault",
  Cerebro: "Oracle",
  Publisher: "Scribe",
  Docs: "Tome",
  Settings: "Config",

  // ── Header / general ──
  Swarm: "Guild",
  Agents: "Party",
  agents: "party members",
  Tasks: "Quests",
  tasks: "quests",
  Credits: "Gold (G)",
  credits: "gold",
  Connected: "In Party",
  Online: "Active",
  Offline: "Resting",
  Busy: "In Battle",

  // ── Admin ──
  "Credit Ops": "Gold Ops",
  Risk: "Threat Level",

  // ── Status ──
  running: "fighting",
  idle: "resting",
  error: "KO",
  completed: "victory",
};

interface JrpgContextValue {
  /** Whether the JRPG skin is currently active */
  isJrpg: boolean;
  /** Returns the JRPG label for a key, or the key itself if not mapped */
  label: (key: string) => string;
  /** Full label mapping dictionary */
  labels: Record<string, string>;
}

const JrpgContext = createContext<JrpgContextValue>({
  isJrpg: false,
  label: (key: string) => key,
  labels: {},
});

export function JrpgProvider({ children }: { children: ReactNode }) {
  const { skin } = useSkin();
  const isJrpg = skin === "jrpg";

  const value = useMemo<JrpgContextValue>(() => ({
    isJrpg,
    label: (key: string) => (isJrpg ? JRPG_LABELS[key] ?? key : key),
    labels: isJrpg ? JRPG_LABELS : {},
  }), [isJrpg]);

  return (
    <JrpgContext.Provider value={value}>
      {children}
    </JrpgContext.Provider>
  );
}

export function useJrpg() {
  return useContext(JrpgContext);
}
