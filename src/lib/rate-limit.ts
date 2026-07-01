import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  return "unknown";
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number; limit: number };

type Duration = `${number} s` | `${number} m` | `${number} h` | `${number} d`;

const ratelimitCache = new Map<string, Ratelimit>();

function readEnvInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function createRedis(): Redis {
  const url =
    process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    throw new Error(
      "Upstash Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    );
  }

  return new Redis({ url, token });
}

function formatWindowDuration(windowMs: number): Duration {
  if (windowMs >= 60_000 && windowMs % 60_000 === 0) {
    return `${windowMs / 60_000} m`;
  }
  return `${Math.max(1, Math.ceil(windowMs / 1000))} s`;
}

function getRatelimit(
  limit: number,
  windowMs: number,
  prefix: string,
): Ratelimit {
  const cacheKey = `${prefix}:${limit}:${windowMs}`;
  const cached = ratelimitCache.get(cacheKey);
  if (cached) return cached;

  const instance = new Ratelimit({
    redis: createRedis(),
    limiter: Ratelimit.fixedWindow(limit, formatWindowDuration(windowMs)),
    prefix,
    analytics: true,
  });

  ratelimitCache.set(cacheKey, instance);
  return instance;
}

export function isRateLimitConfigured(): boolean {
  const url =
    process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return Boolean(url && token);
}

/** Distributed rate limit via Upstash Redis (shared across all Vercel instances). */
export async function checkRateLimit(
  key: string,
  options?: {
    limit?: number;
    windowMs?: number;
    prefix?: string;
    limitEnv?: string;
    windowEnv?: string;
  },
): Promise<RateLimitResult> {
  const limit =
    options?.limit ??
    readEnvInt(options?.limitEnv ?? "ARCHITECT_RATE_LIMIT_MAX", 1);
  const windowMs =
    options?.windowMs ??
    readEnvInt(options?.windowEnv ?? "ARCHITECT_RATE_LIMIT_WINDOW_MS", 60_000);
  const prefix = options?.prefix ?? "porto:architect";

  if (limit <= 0) return { allowed: true };

  const ratelimit = getRatelimit(limit, windowMs, prefix);
  const result = await ratelimit.limit(key);

  if (result.success) {
    return { allowed: true };
  }

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((result.reset - Date.now()) / 1000),
  );

  return {
    allowed: false,
    retryAfterSeconds,
    limit: result.limit,
  };
}

/** Read remaining quota without consuming a slot. */
export async function peekRateLimit(
  key: string,
  options?: {
    limit?: number;
    windowMs?: number;
    prefix?: string;
    limitEnv?: string;
    windowEnv?: string;
  },
): Promise<{ remaining: number; reset: number }> {
  const limit =
    options?.limit ??
    readEnvInt(options?.limitEnv ?? "ARCHITECT_RATE_LIMIT_MAX", 1);
  const windowMs =
    options?.windowMs ??
    readEnvInt(options?.windowEnv ?? "ARCHITECT_RATE_LIMIT_WINDOW_MS", 60_000);
  const prefix = options?.prefix ?? "porto:architect";

  if (limit <= 0) {
    return { remaining: Number.POSITIVE_INFINITY, reset: Date.now() };
  }

  const ratelimit = getRatelimit(limit, windowMs, prefix);
  const result = await ratelimit.getRemaining(key);
  return { remaining: result.remaining, reset: result.reset };
}
