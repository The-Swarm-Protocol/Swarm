/** DashboardShell — Skin-aware layout wrapper. Renders JRPG, Pokemon, or standard chrome based on active skin. */
"use client";

import { useSkin } from "@/contexts/SkinContext";
import { HeaderWrapper as Header } from "@/components/header-wrapper";
import { Sidebar } from "@/components/sidebar";
import { DashboardBackground } from "@/components/dashboard-bg";
import dynamic from "next/dynamic";

// ── JRPG skin components (code-split) ──
const JrpgSidebar = dynamic(
  () => import("@/components/jrpg/jrpg-sidebar").then((m) => ({ default: m.JrpgSidebar })),
  { ssr: false }
);
const JrpgHeader = dynamic(
  () => import("@/components/jrpg/jrpg-header").then((m) => ({ default: m.JrpgHeader })),
  { ssr: false }
);
const JrpgBackground = dynamic(
  () => import("@/components/jrpg/jrpg-background").then((m) => ({ default: m.JrpgBackground })),
  { ssr: false }
);

// ── Pokemon skin components (code-split) ──
const PokemonSidebar = dynamic(
  () => import("@/components/pokemon/pokemon-sidebar").then((m) => ({ default: m.PokemonSidebar })),
  { ssr: false }
);
const PokemonHeader = dynamic(
  () => import("@/components/pokemon/pokemon-header").then((m) => ({ default: m.PokemonHeader })),
  { ssr: false }
);
const PokemonBackground = dynamic(
  () => import("@/components/pokemon/pokemon-background").then((m) => ({ default: m.PokemonBackground })),
  { ssr: false }
);

/** Resolve skin-specific components, falling back to standard chrome */
function getSkinComponents(skin: string) {
  switch (skin) {
    case "jrpg":
      return { Background: JrpgBackground, HeaderComp: JrpgHeader, SidebarComp: JrpgSidebar };
    case "pokemon":
      return { Background: PokemonBackground, HeaderComp: PokemonHeader, SidebarComp: PokemonSidebar };
    default:
      return null;
  }
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { skin } = useSkin();
  const skinComponents = getSkinComponents(skin);

  return (
    <div className="min-h-screen relative bg-background">
      {skinComponents ? <skinComponents.Background /> : <DashboardBackground />}
      <div className="relative z-10 flex flex-col h-screen">
        {skinComponents ? <skinComponents.HeaderComp /> : <Header />}
        <div className="flex flex-1 overflow-hidden">
          {skinComponents ? <skinComponents.SidebarComp /> : <Sidebar />}
          <main className="flex-1 min-w-0 overflow-y-auto px-2 py-1">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
