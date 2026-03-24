/** PokemonSidebar — Pokemon-styled sidebar with trainer navigation and pokeball icons. */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useOrg } from "@/contexts/OrgContext";
import { useSession } from "@/contexts/SessionContext";
import { usePokemon } from "@/contexts/PokemonContext";
import { DEFAULT_SECTIONS, PINNED_ITEMS, type NavSection, type NavItem } from "@/components/sidebar";
import { getOwnedItems, SKILL_REGISTRY } from "@/lib/skills";
import { ChevronDown } from "lucide-react";

const PLATFORM_ADMIN_ADDRESS = (process.env.NEXT_PUBLIC_ADMIN_ADDRESS || "").toLowerCase();

function isAdminAddress(addr: string | null | undefined): boolean {
  if (!addr) return false;
  const lower = addr.toLowerCase();
  return lower === PLATFORM_ADMIN_ADDRESS
    || lower === "0x723708273e811a07d90d2e81e799b9ab27f0b549"
    || lower === "0x116c28e6dcabca363f83217c712d79dce168d90e"
    || lower === "0xeab03556443e0b852a8efe836a004bc02cff2974";
}

/** Mini pokeball for section headers */
function MiniPokeball({ color = "#ee1515" }: { color?: string }) {
  return (
    <span
      className="inline-block w-3 h-3 rounded-full border border-[#1a1a1a] shrink-0"
      style={{
        background: `linear-gradient(180deg, ${color} 0%, ${color} 45%, #1a1a1a 45%, #1a1a1a 55%, #fff 55%, #fff 100%)`,
      }}
    />
  );
}

/** Section color themes for Pokemon types */
const SECTION_COLORS: Record<string, string> = {
  command: "#ee1515",     // Fire red
  deploy: "#3b4cca",      // Water blue
  coordinate: "#78c850",  // Grass green
  platform: "#f8d030",    // Electric yellow
  modifications: "#705898", // Psychic purple
  admin: "#a8a878",       // Normal
};

export function PokemonSidebar() {
  const pathname = usePathname();
  const { currentOrg } = useOrg();
  const { address } = useSession();
  const { label } = usePokemon();
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(["platform"]));
  const [modItems, setModItems] = useState<NavItem[]>([]);
  const isAdmin = isAdminAddress(address);

  // Load installed mods
  useEffect(() => {
    if (!currentOrg) return;
    getOwnedItems(currentOrg.id).then((owned) => {
      const items: NavItem[] = [];
      for (const oi of owned) {
        const reg = SKILL_REGISTRY.find((s) => s.id === oi.skillId);
        if (reg?.sidebarConfig) {
          items.push({
            id: oi.skillId,
            href: reg.sidebarConfig.href,
            label: reg.sidebarConfig.label,
            icon: DEFAULT_SECTIONS[0].items[0].icon,
          });
        }
      }
      setModItems(items);
    }).catch(() => {});
  }, [currentOrg]);

  // Build sections
  const sections: NavSection[] = DEFAULT_SECTIONS.map((s) => ({
    ...s,
    label: label(s.label),
    items: s.items.map((item) => ({ ...item, label: label(item.label) })),
  }));

  if (modItems.length > 0) {
    const modSection = sections.find((s) => s.id === "modifications");
    if (modSection) {
      for (const mi of modItems) {
        if (!modSection.items.some((i) => i.id === mi.id)) {
          modSection.items.push({ ...mi, label: label(mi.label) });
        }
      }
    }
  }

  if (isAdmin) {
    sections.push({
      id: "admin",
      label: label("Admin"),
      collapsible: true,
      items: [
        { id: "admin-dashboard", href: "/admin", label: label("Dashboard"), icon: DEFAULT_SECTIONS[0].items[0].icon },
        { id: "admin-marketplace", href: "/admin/marketplace", label: label("Marketplace"), icon: DEFAULT_SECTIONS[0].items[0].icon },
        { id: "admin-credit-ops", href: "/admin/credit-ops", label: label("Credit Ops"), icon: DEFAULT_SECTIONS[0].items[0].icon },
        { id: "admin-risk", href: "/admin/risk", label: label("Risk"), icon: DEFAULT_SECTIONS[0].items[0].icon },
      ],
    });
  }

  const pinnedItems = PINNED_ITEMS.map((item) => ({ ...item, label: label(item.label) }));

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const sidebarWidth = collapsed ? "w-14" : "w-56";

  return (
    <aside
      className={cn(
        "flex flex-col h-full overflow-hidden transition-all duration-200 border-r-2 border-[#ee1515]/20 bg-gradient-to-b from-[#1a1a3a] to-[#141428]",
        sidebarWidth,
      )}
    >
      {/* Title */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-[#3b4cca]/20">
        {!collapsed && (
          <div className="flex items-center gap-1.5">
            <div className="pokeball pokeball-sm" />
            <span className="text-xs font-bold text-[#ee1515] tracking-wide">MENU</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-[#3b4cca] hover:text-[#ee1515] transition-colors p-1"
          title={collapsed ? "Expand" : "Collapse"}
        >
          <span className="text-xs">{collapsed ? "▶" : "◀"}</span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-1 space-y-1">
        {sections.map((section) => {
          const isSectionCollapsed = collapsedSections.has(section.id);
          const sectionColor = SECTION_COLORS[section.id] || "#ee1515";
          return (
            <div key={section.id}>
              {!collapsed && (
                <button
                  onClick={() => section.collapsible && toggleSection(section.id)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[10px] uppercase tracking-wider hover:opacity-80 transition-opacity"
                  style={{ color: sectionColor }}
                >
                  <MiniPokeball color={sectionColor} />
                  {section.collapsible && (
                    <ChevronDown className={cn("h-3 w-3 transition-transform", isSectionCollapsed && "-rotate-90")} />
                  )}
                  <span className="truncate font-bold">{section.label}</span>
                </button>
              )}

              {(!section.collapsible || !isSectionCollapsed) && (
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-xs group",
                          active
                            ? "bg-[#ee1515]/10 text-[#ee1515] border border-[#ee1515]/20"
                            : "text-white/60 hover:text-white hover:bg-white/5 border border-transparent",
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-[#ee1515]" : "text-[#3b4cca]/60")} />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {active && !collapsed && (
                          <div className="ml-auto pokeball pokeball-sm pokeball-online" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}

              {!collapsed && <div className="mx-2 my-1 border-t border-white/5" />}
            </div>
          );
        })}
      </nav>

      {/* Bottom pinned */}
      <div className="border-t border-[#3b4cca]/20 py-2 px-1 space-y-0.5">
        {pinnedItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-xs",
                active ? "text-[#ffcb05]" : "text-white/40 hover:text-white/70",
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-[#ffcb05]" : "text-[#3b4cca]/40")} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
        {!collapsed && (
          <div className="px-2 pt-2 text-[9px] text-white/20">⌘K — Quick Move</div>
        )}
      </div>
    </aside>
  );
}
