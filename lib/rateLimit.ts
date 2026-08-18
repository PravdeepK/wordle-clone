import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import * as Sentry from "@sentry/nextjs";

export type RateLimitResult = { allowed: boolean; retryAfter: number };

/* -------------------------------------------------------------------------- */
/* In-memory fallback                                                          */
/* -------------------------------------------------------------------------- */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/**
 * Per-instance limiter. Retained as a fallback only: it is lost on cold start
 * and not shared between serverless instances, so the effective limit is
 * `limit x instances`. Used when Upstash is not configured (local dev) or when
 * a Redis call fails.
 */
function memoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfter: 0 };
}

/* -------------------------------------------------------------------------- */
/* Upstash-backed limiter                                                      */
/* -------------------------------------------------------------------------- */

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

/** True when Upstash is configured. False locally unless you set the vars. */
export const isDurableRateLimitEnabled = Boolean(url && token);

const redis = isDurableRateLimitEnabled ? new Redis({ url: url!, token: token! }) : null;

// One Ratelimit instance per (limit, windowMs) pair. Constructing these is
// cheap but not free, and module scope survives between warm invocations.
const limiters = new Map<string, Ratelimit>();

function getLimiter(limit: number, windowMs: number): Ratelimit {
  const cacheKey = `${limit}:${windowMs}`;
  const existing = limiters.get(cacheKey);
  if (existing) return existing;

  const created = new Ratelimit({
    redis: redis!,
    // Sliding window matches the semantics the in-memory version approximated,
    // without the fixed-window burst at the boundary.
    limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
    prefix: "fakewordle:rl",
    // Per-instance LRU in front of Redis: lets an already-exhausted key be
    // rejected without a network round trip.
    ephemeralCache: new Map(),
    analytics: false,
  });
  limiters.set(cacheKey, created);
  return created;
}

/**
 * Sliding-window rate limit, durable across serverless instances and cold
 * starts when Upstash is configured.
 *
 * Failure behavior: **degrades to the in-memory limiter** if Redis errors or
 * is unconfigured. It does not fail fully open — a Redis outage drops
 * protection back to per-instance rather than removing it — and it does not
 * fail closed, so an Upstash incident cannot take the game down. Errors are
 * reported to Sentry. See CLAUDE.md §6.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (!redis) return memoryRateLimit(key, limit, windowMs);

  try {
    const { success, reset } = await getLimiter(limit, windowMs).limit(key);
    if (success) return { allowed: true, retryAfter: 0 };
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((reset - Date.now()) / 1000)),
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { scope: "rateLimit", degraded: "memory" } });
    return memoryRateLimit(key, limit, windowMs);
  }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
