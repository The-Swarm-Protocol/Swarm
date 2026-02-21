import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Convert tinybars (bigint or number) to HBAR display string */
export function toHbar(tinybars: bigint | number | string): string {
  const val = Number(tinybars);
  if (val === 0) return "0";
  const hbar = val / 1e8;
  if (hbar >= 1000) return `${(hbar / 1000).toFixed(1)}K`;
  if (hbar >= 1) return hbar.toFixed(2);
  return hbar.toFixed(4);
}

/** Shorten an address: 0x1234...abcd */
export function shortAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/** Format a unix timestamp (seconds) to a locale string */
export function formatTimestamp(ts: bigint | number | string): string {
  const num = Number(ts);
  if (!num) return "Unknown";
  return new Date(num * 1000).toLocaleString();
}
