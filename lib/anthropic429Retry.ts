const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function isAnthropicRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const o = err as Record<string, unknown>;
  if (o.status === 429) return true;
  if (o.type === "rate_limit_error") return true;
  const nested = o.error as Record<string, unknown> | undefined;
  if (nested?.type === "rate_limit_error") return true;
  return false;
}

function retryAfterMs(err: unknown): number {
  if (!err || typeof err !== "object") return 1500;
  const headers = (err as { headers?: { get?: (n: string) => string | null } }).headers;
  const raw = headers?.get?.("retry-after") ?? headers?.get?.("Retry-After");
  if (raw) {
    const sec = Number.parseInt(raw, 10);
    if (!Number.isNaN(sec)) return Math.min(Math.max(sec * 1000, 500), 60_000);
  }
  return 1500;
}

/** Retries Anthropic calls when the API returns HTTP 429 (rate limit). */
export async function withAnthropic429Retries<T>(
  run: () => Promise<T>,
  maxAttempts = 5
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await run();
    } catch (err) {
      lastErr = err;
      if (!isAnthropicRateLimitError(err) || attempt === maxAttempts - 1) throw err;
      const base = retryAfterMs(err);
      await sleep(base + attempt * 400);
    }
  }
  throw lastErr;
}
