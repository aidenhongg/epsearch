/**
 * In-memory sliding-window rate limiter for Vercel Edge Middleware.
 *
 * For production at scale, replace this with Vercel KV (Redis) or
 * Upstash @upstash/ratelimit. This in-memory version works correctly
 * on a single Edge location but resets on cold starts.
 *
 * Algorithm: sliding window counter per IP.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Periodically prune expired entries to prevent memory leaks
const PRUNE_INTERVAL = 60_000; // 1 minute
let lastPrune = Date.now();

function pruneExpired() {
  const now = Date.now();
  if (now - lastPrune < PRUNE_INTERVAL) return;
  lastPrune = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

export interface RateLimitConfig {
  /** Max requests allowed in the window. */
  maxRequests: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  /** Headers to attach to the response for client visibility. */
  headers: Record<string, string>;
}

export function rateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  pruneExpired();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    const resetAt = now + config.windowMs;
    store.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt,
      headers: {
        "X-RateLimit-Limit": String(config.maxRequests),
        "X-RateLimit-Remaining": String(config.maxRequests - 1),
        "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
      },
    };
  }

  entry.count++;

  const remaining = Math.max(0, config.maxRequests - entry.count);
  const allowed = entry.count <= config.maxRequests;

  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
    headers: {
      "X-RateLimit-Limit": String(config.maxRequests),
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
      ...(allowed ? {} : { "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)) }),
    },
  };
}
