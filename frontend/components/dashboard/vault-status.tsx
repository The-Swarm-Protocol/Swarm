"use client";

import { useMemo } from "react";
import { Shield, User, Hash, Palette } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { shortAddr, formatTimestamp } from "@/lib/utils";
import type { VaultData } from "@/types";

const BRAND_COLORS = [
  { label: "Primary", hex: "#00D4AA" },
  { label: "Secondary", hex: "#FF6B35" },
  { label: "Background", hex: "#0A0A1A" },
  { label: "Accent", hex: "#7B61FF" },
];

interface VaultStatusProps {
  vault: VaultData;
}

function HexMatrix({ hex }: { hex: string }) {
  const chars = hex.replace(/^0x/, "").slice(0, 192);
  const rows: string[] = [];
  for (let i = 0; i < chars.length; i += 32) {
    rows.push(chars.slice(i, i + 32));
  }

  return (
    <div className="font-mono text-xs leading-relaxed space-y-1 overflow-hidden">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-[2px]">
          {row.split("").map((ch, j) => (
            <span
              key={j}
              className="text-primary"
              style={{ opacity: 0.3 + ((j * 7 + i * 13) % 5) * 0.15 }}
            >
              {ch}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function VaultStatus({ vault }: VaultStatusProps) {
  const updatedAt = useMemo(() => formatTimestamp(vault.lastUpdated), [vault.lastUpdated]);

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Vault Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Brand</p>
            <p className="text-lg font-semibold text-foreground">
              {vault.brandName}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Campaigns</p>
            <p className="text-lg font-semibold text-primary">
              {vault.campaignCount}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          <span>Agent: </span>
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
            {shortAddr(vault.agentAddress)}
          </code>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <Hash className="h-3 w-3" />
            Encrypted Guidelines
          </p>
          <div className="relative group bg-background/50 rounded-lg p-3 border border-border/50 cursor-default">
            <HexMatrix hex={vault.encryptedGuidelines} />
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 rounded-lg bg-popover border border-border text-xs text-popover-foreground shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
              AES-256 encrypted. Only the AI CMO agent holds the decryption key.
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <Palette className="h-3 w-3" />
            Brand colors loaded from chain:
          </p>
          <div className="flex items-center gap-3">
            {BRAND_COLORS.map((c) => (
              <div key={c.label} className="flex flex-col items-center gap-1">
                <div
                  className="h-8 w-8 rounded-md border border-border/50"
                  style={{ backgroundColor: c.hex }}
                />
                <span className="text-[10px] text-muted-foreground">
                  {c.label}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-1.5 italic">
            Colors: read from encrypted vault
          </p>
        </div>

        <p className="text-xs text-muted-foreground text-right">
          Updated {updatedAt}
        </p>
      </CardContent>
    </Card>
  );
}
