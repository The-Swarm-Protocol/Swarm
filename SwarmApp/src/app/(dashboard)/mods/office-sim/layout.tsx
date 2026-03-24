/** Office Sim — Shared layout with OfficeProvider.
 *  State (selected agent, filters, demo mode) persists across 2D↔3D navigation.
 */
"use client";

import { OfficeProvider } from "@/components/mods/office-sim/OfficeProvider";

export default function OfficeSimLayout({ children }: { children: React.ReactNode }) {
  return <OfficeProvider>{children}</OfficeProvider>;
}
