/** PokemonContext — Provides Pokemon label mappings when the Pokemon skin is active. */
"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSkin } from "@/contexts/SkinContext";

/** Map of standard Swarm labels → Pokemon equivalents */
const POKEMON_LABELS: Record<string, string> = {
  // ── Sidebar sections ──
  Command: "Trainer Hub",
  Deploy: "Catch",
  Coordinate: "Gym",
  Platform: "League",
  Modifications: "TMs & HMs",
  Admin: "Prof. Oak",

  // ── Sidebar items ──
  Dashboard: "Trainer Hub",
  Credit: "PokeDollars",
  Activity: "Battle Log",
  Health: "Pokemon Center",
  "Agent Map": "Region Map",
  Logs: "Pokedex Log",
  Fleet: "Pokemon Team",
  Projects: "Expeditions",
  Marketplace: "PokeMart",
  Team: "Trainers",
  Compute: "PC Box",
  Computers: "PC Storage",
  Workspaces: "Safari Zone",
  "Task Board": "Gym Challenges",
  "Job Board": "Bounty Board",
  Channels: "Pokemon Center Chat",
  Approvals: "Badge Check",
  Workflows: "Move Combos",
  Scheduler: "Day Care",
  Organizations: "Pokemon League",
  "Usage & Billing": "PokeDollar Ledger",
  Storage: "PC Box",
  Cerebro: "Professor",
  Publisher: "PokeMart Seller",
  Docs: "Pokedex",
  Settings: "Trainer Card",

  // ── Header / general ──
  Swarm: "Team",
  Agents: "Pokemon",
  agents: "pokemon",
  Tasks: "Battles",
  tasks: "battles",
  Credits: "PD",
  credits: "pokedollars",
  Connected: "In Party",
  Online: "Ready",
  Offline: "In PC",
  Busy: "In Battle",

  // ── Status ──
  running: "battling",
  idle: "resting",
  error: "fainted",
  completed: "victory",
};

interface PokemonContextValue {
  isPokemon: boolean;
  label: (key: string) => string;
  labels: Record<string, string>;
}

const PokemonContext = createContext<PokemonContextValue>({
  isPokemon: false,
  label: (key: string) => key,
  labels: {},
});

export function PokemonProvider({ children }: { children: ReactNode }) {
  const { skin } = useSkin();
  const isPokemon = skin === "pokemon";

  const value = useMemo<PokemonContextValue>(() => ({
    isPokemon,
    label: (key: string) => (isPokemon ? POKEMON_LABELS[key] ?? key : key),
    labels: isPokemon ? POKEMON_LABELS : {},
  }), [isPokemon]);

  return (
    <PokemonContext.Provider value={value}>
      {children}
    </PokemonContext.Provider>
  );
}

export function usePokemon() {
  return useContext(PokemonContext);
}
