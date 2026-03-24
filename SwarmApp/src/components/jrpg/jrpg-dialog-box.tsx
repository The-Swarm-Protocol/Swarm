/** JrpgDialogBox — Reusable JRPG-style dialog box wrapper (FF-style blue gradient + pixel border). */
"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface JrpgDialogBoxProps {
  children: ReactNode;
  className?: string;
  /** Show blinking ▼ cursor at bottom-right */
  showCursor?: boolean;
  /** Optional title displayed at top of dialog */
  title?: string;
}

export function JrpgDialogBox({ children, className, showCursor = false, title }: JrpgDialogBoxProps) {
  return (
    <div className={cn("jrpg-dialog-box relative", className)}>
      {title && (
        <div
          className="text-[9px] text-[#ffd700] uppercase tracking-[2px] mb-3 pb-2 border-b border-[#4dccff]/20"
          style={{ fontFamily: "var(--font-jrpg), monospace" }}
        >
          {title}
        </div>
      )}
      {children}
      {showCursor && (
        <span
          className="absolute bottom-3 right-4 text-[10px] text-[#ffffff] jrpg-cursor-blink"
          aria-hidden="true"
        >
          ▼
        </span>
      )}
    </div>
  );
}
