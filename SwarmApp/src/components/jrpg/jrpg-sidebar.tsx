/** JrpgSidebar — 16-bit JRPG-styled vertical menu replacing the standard sidebar. */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useOrg } from "@/contexts/OrgContext";
import { useSession } from "@/contexts/SessionContext";
import { useJrpg } from "@/contexts/JrpgContext";
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

export function JrpgSidebar() {
  const pathname = usePathname();
  const { currentOrg } = useOrg();
  const { address } = useSession();
  const { label } = useJrpg();
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(["platform"]));
  const [modItems, setModItems] = useState<NavItem[]>([]);
  const isAdmin = isAdminAddress(address);

  // Load installed mods for the sidebar
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
            icon: DEFAULT_SECTIONS[0].items[0].icon, // fallback icon
          });
        }
      }
      setModItems(items);
    }).catch(() => {});
  }, [currentOrg]);

  // Build sections with JRPG labels
  const sections: NavSection[] = DEFAULT_SECTIONS.map((s) => ({
    ...s,
    label: label(s.label),
    items: s.items.map((item) => ({
      ...item,
      label: label(item.label),
    })),
  }));

  // Add mod items to the modifications section
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

  // Add admin section if applicable
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

  const pinnedItems = PINNED_ITEMS.map((item) => ({
    ...item,
    label: label(item.label),
  }));

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
        "jrpg-pixel-border flex flex-col h-full overflow-hidden transition-all duration-200 bg-gradient-to-b from-[#1a1a4e] to-[#0d0d3a]",
        sidebarWidth,
      )}
    >
      {/* Title */}
      <div className="flex items-center justify-between px-3 py-3 border-b-2 border-[#c8c8ff]/30">
        {!collapsed && (
          <span className="text-[9px] text-[#ffd700] tracking-widest uppercase font-bold" style={{ fontFamily: "var(--font-jrpg), monospace" }}>
            Menu
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-[#4dccff] hover:text-[#ffd700] transition-colors p-1"
          title={collapsed ? "Expand" : "Collapse"}
        >
          <span className="text-xs">{collapsed ? "▶" : "◀"}</span>
        </button>
      </div>

      {/* Navigation sections */}
      <nav className="flex-1 overflow-y-auto py-2 px-1 space-y-1">
        {sections.map((section) => {
          const isSectionCollapsed = collapsedSections.has(section.id);
          return (
            <div key={section.id}>
              {/* Section header */}
              {!collapsed && (
                <button
                  onClick={() => section.collapsible && toggleSection(section.id)}
                  className="w-full flex items-center gap-1 px-2 py-1.5 text-[8px] uppercase tracking-[2px] text-[#4dccff]/70 hover:text-[#4dccff] transition-colors"
                  style={{ fontFamily: "var(--font-jrpg), monospace" }}
                >
                  {section.collapsible && (
                    <ChevronDown
                      className={cn("h-3 w-3 transition-transform", isSectionCollapsed && "-rotate-90")}
                    />
                  )}
                  <span className="truncate">{section.label}</span>
                </button>
              )}

              {/* Section items */}
              {(!section.collapsible || !isSectionCollapsed) && (
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 transition-all text-[9px] group",
                          active
                            ? "text-[#ffd700]"
                            : "text-[#c8c8ff]/80 hover:text-[#ffffff]",
                        )}
                        style={{ fontFamily: "var(--font-jrpg), monospace" }}
                        title={collapsed ? item.label : undefined}
                      >
                        {/* JRPG cursor indicator */}
                        {!collapsed && (
                          <span
                            className={cn(
                              "text-[10px] transition-opacity w-3",
                              active ? "opacity-100 text-[#ffd700] jrpg-cursor-blink" : "opacity-0 group-hover:opacity-50",
                            )}
                          >
                            ▶
                          </span>
                        )}

                        {/* Icon */}
                        <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-[#ffd700]" : "text-[#4dccff]/60")} />

                        {/* Label */}
                        {!collapsed && (
                          <span className="truncate">{item.label}</span>
                        )}

                        {/* Active glow dot */}
                        {active && !collapsed && (
                          <span className="ml-auto w-1.5 h-1.5 bg-[#ffd700] shadow-[0_0_4px_#ffd700]" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Section separator */}
              {!collapsed && (
                <div className="mx-2 my-1 border-t border-[#4dccff]/10" />
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom pinned items */}
      <div className="border-t-2 border-[#c8c8ff]/30 py-2 px-1 space-y-0.5">
        {pinnedItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 transition-all text-[9px]",
                active ? "text-[#ffd700]" : "text-[#c8c8ff]/60 hover:text-[#ffffff]",
              )}
              style={{ fontFamily: "var(--font-jrpg), monospace" }}
              title={collapsed ? item.label : undefined}
            >
              {!collapsed && (
                <span className={cn("text-[10px] w-3", active ? "opacity-100 text-[#ffd700]" : "opacity-0")}>
                  ▶
                </span>
              )}
              <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-[#ffd700]" : "text-[#4dccff]/40")} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}

        {/* Command bar hint */}
        {!collapsed && (
          <div className="px-2 pt-2 text-[7px] text-[#4dccff]/30" style={{ fontFamily: "var(--font-jrpg), monospace" }}>
            ⌘K — Quick Cast
          </div>
        )}
      </div>
    </aside>
  );
}
