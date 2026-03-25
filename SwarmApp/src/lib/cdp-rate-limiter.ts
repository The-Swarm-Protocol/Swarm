/**
 * CDP Rate Limiter — Sliding window per agent per capability.
 *
 * Primary: Upstash Redis (ZSET sliding window, shared across instances).
 * Fallback: in-memory Map (when Redis is not configured).
 */

import { getRedis } from "@/lib/redis";

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Key helpers ──────────────────────────────────────────────────────────────

const KEY_PREFIX = "rl:cdp:";

function redisKey(agentId: string, capabilityKey: string): string {
  return `${KEY_PREFIX}${agentId}:${capabilityKey}`;
}

function memKey(agentId: string, capabilityKey: string): string {
  return `${agentId}:${capabilityKey}`;
}

// ── In-memory fallback ───────────────────────────────────────────────────────

const usageWindows = new Map<string, number[]>();

function pruneOld(timestamps: number[], windowMs: number): number[] {
  const cutoff = Date.now() - windowMs;
  return timestamps.filter((t) => t > cutoff);
}

function fallbackCheck(
  agentId: string,
  capabilityKey: string,
  limits: RateLimits,
): RateLimitResult {
  const key = memKey(agentId, capabilityKey);
  const timestamps = usageWindows.get(key) || [];
  const now = Date.now();

  const lastMinute = timestamps.filter((t) => t > now - 60_000);
  if (lastMinute.length >= limits.maxPerMinute) {
    return { allowed: false, remaining: 0, resetAt: Math.min(...lastMinute) + 60_000 };
  }

  const lastHour = timestamps.filter((t) => t > now - 3_600_000);
  if (lastHour.length >= limits.maxPerHour) {
    return { allowed: false, remaining: 0, resetAt: Math.min(...lastHour) + 3_600_000 };
  }

  const lastDay = timestamps.filter((t) => t > now - 86_400_000);
  if (lastDay.length >= limits.maxPerDay) {
    return { allowed: false, remaining: 0, resetAt: Math.min(...lastDay) + 86_400_000 };
  }

  const remaining = Math.min(
    limits.maxPerMinute - lastMinute.length,
    limits.maxPerHour - lastHour.length,
    limits.maxPerDay - lastDay.length,
  );

  return { allowed: true, remaining, resetAt: 0 };
}

function fallbackRecord(agentId: string, capabilityKey: string): void {
  const key = memKey(agentId, capabilityKey);
  const timestamps = usageWindows.get(key) || [];
  timestamps.push(Date.now());
  usageWindows.set(key, pruneOld(timestamps, 86_400_000));
}

// ── Redis implementation ─────────────────────────────────────────────────────

async function redisCheck(
  agentId: string,
  capabilityKey: string,
  limits: RateLimits,
): Promise<RateLimitResult> {
  const redis = getRedis()!;
  const key = redisKey(agentId, capabilityKey);
  const now = Date.now();

  try {
    // Count entries in each window
    const pipe = redis.pipeline();
    pipe.zcount(key, now - 60_000, "+inf");    // last minute
    pipe.zcount(key, now - 3_600_000, "+inf"); // last hour
    pipe.zcount(key, now - 86_400_000, "+inf"); // last day

    const [minCount, hourCount, dayCount] = (await pipe.exec()) as number[];

    if (minCount >= limits.maxPerMinute) {
      // Get oldest in minute window for resetAt
      const oldest = await redis.zrange(key, now - 60_000, "+inf", { byScore: true, offset: 0, count: 1 });
      const resetAt = oldest.length > 0
        ? (await redis.zscore(key, oldest[0]) as number) + 60_000
        : now + 60_000;
      return { allowed: false, remaining: 0, resetAt };
    }

    if (hourCount >= limits.maxPerHour) {
      const oldest = await redis.zrange(key, now - 3_600_000, "+inf", { byScore: true, offset: 0, count: 1 });
      const resetAt = oldest.length > 0
        ? (await redis.zscore(key, oldest[0]) as number) + 3_600_000
        : now + 3_600_000;
      return { allowed: false, remaining: 0, resetAt };
    }

    if (dayCount >= limits.maxPerDay) {
      const oldest = await redis.zrange(key, now - 86_400_000, "+inf", { byScore: true, offset: 0, count: 1 });
      const resetAt = oldest.length > 0
        ? (await redis.zscore(key, oldest[0]) as number) + 86_400_000
        : now + 86_400_000;
      return { allowed: false, remaining: 0, resetAt };
    }

    const remaining = Math.min(
      limits.maxPerMinute - minCount,
      limits.maxPerHour - hourCount,
      limits.maxPerDay - dayCount,
    );

    return { allowed: true, remaining, resetAt: 0 };
  } catch (err) {
    console.warn("[cdp-rate-limiter] Redis error, falling back to in-memory:", err);
    return fallbackCheck(agentId, capabilityKey, limits);
  }
}

async function redisRecord(agentId: string, capabilityKey: string): Promise<void> {
  const redis = getRedis()!;
  const key = redisKey(agentId, capabilityKey);
  const now = Date.now();

  try {
    const pipe = redis.pipeline();
    // Add timestamped entry
    pipe.zadd(key, {
      score: now,
      member: `${now}:${Math.random().toString(36).slice(2, 8)}`,
    });
    // Remove entries older than 24h
    pipe.zremrangebyscore(key, 0, now - 86_400_000);
    // Expire key after 25h (safety net)
    pipe.expire(key, 90_000);
    await pipe.exec();
  } catch (err) {
    console.warn("[cdp-rate-limiter] Redis record error:", err);
    fallbackRecord(agentId, capabilityKey);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function checkRateLimit(
  agentId: string,
  capabilityKey: string,
  limits: RateLimits,
): Promise<RateLimitResult> {
  const redis = getRedis();
  if (redis) return redisCheck(agentId, capabilityKey, limits);
  return fallbackCheck(agentId, capabilityKey, limits);
}

export async function recordUsage(
  agentId: string,
  capabilityKey: string,
): Promise<void> {
  const redis = getRedis();
  if (redis) return redisRecord(agentId, capabilityKey);
  fallbackRecord(agentId, capabilityKey);
}

/** Reset rate limit counters for an agent (used in tests or admin override). */
export async function resetRateLimit(
  agentId: string,
  capabilityKey: string,
): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(redisKey(agentId, capabilityKey));
    } catch {
      // fall through
    }
  }
  usageWindows.delete(memKey(agentId, capabilityKey));
}
