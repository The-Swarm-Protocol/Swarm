/**
 * CDP Rate Limiter — Sliding window per agent per capability
 *
 * In-memory rate limiter with sliding window counters.
 * Resets on cold starts (acceptable for serverless; Firestore-backed
 * durability can be added later if needed).
 */

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface RateLimits {
    maxPerMinute: number;
    maxPerHour: number;
    maxPerDay: number;
}

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
}

// ═══════════════════════════════════════════════════════════════
// In-memory store
// ═══════════════════════════════════════════════════════════════

/** Key: "agentId:capabilityKey", Value: array of timestamps (ms) */
const usageWindows = new Map<string, number[]>();

function getKey(agentId: string, capabilityKey: string): string {
    return `${agentId}:${capabilityKey}`;
}

function pruneOld(timestamps: number[], windowMs: number): number[] {
    const cutoff = Date.now() - windowMs;
    return timestamps.filter((t) => t > cutoff);
}

// ═══════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════

export function checkRateLimit(
    agentId: string,
    capabilityKey: string,
    limits: RateLimits,
): RateLimitResult {
    const key = getKey(agentId, capabilityKey);
    const timestamps = usageWindows.get(key) || [];
    const now = Date.now();

    // Check per-minute
    const lastMinute = timestamps.filter((t) => t > now - 60_000);
    if (lastMinute.length >= limits.maxPerMinute) {
        const oldestInWindow = Math.min(...lastMinute);
        return {
            allowed: false,
            remaining: 0,
            resetAt: oldestInWindow + 60_000,
        };
    }

    // Check per-hour
    const lastHour = timestamps.filter((t) => t > now - 3_600_000);
    if (lastHour.length >= limits.maxPerHour) {
        const oldestInWindow = Math.min(...lastHour);
        return {
            allowed: false,
            remaining: 0,
            resetAt: oldestInWindow + 3_600_000,
        };
    }

    // Check per-day
    const lastDay = timestamps.filter((t) => t > now - 86_400_000);
    if (lastDay.length >= limits.maxPerDay) {
        const oldestInWindow = Math.min(...lastDay);
        return {
            allowed: false,
            remaining: 0,
            resetAt: oldestInWindow + 86_400_000,
        };
    }

    // Calculate remaining (most restrictive)
    const remaining = Math.min(
        limits.maxPerMinute - lastMinute.length,
        limits.maxPerHour - lastHour.length,
        limits.maxPerDay - lastDay.length,
    );

    return { allowed: true, remaining, resetAt: 0 };
}

export function recordUsage(agentId: string, capabilityKey: string): void {
    const key = getKey(agentId, capabilityKey);
    const timestamps = usageWindows.get(key) || [];

    // Add current timestamp
    timestamps.push(Date.now());

    // Prune entries older than 24h to prevent unbounded growth
    const pruned = pruneOld(timestamps, 86_400_000);
    usageWindows.set(key, pruned);
}

/** Reset rate limit counters for an agent (used in tests or admin override) */
export function resetRateLimit(agentId: string, capabilityKey: string): void {
    const key = getKey(agentId, capabilityKey);
    usageWindows.delete(key);
}
