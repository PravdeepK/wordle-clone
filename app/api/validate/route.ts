import { NextResponse } from "next/server";
import { rateLimit, clientIp } from "../../../lib/rateLimit";

export async function POST(request: Request) {
  const limit = rateLimit(`validate:${clientIp(request)}`, 1000, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { valid: false, error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const { word } = await request.json();

  if (!word || typeof word !== "string") {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`,
      { signal: AbortSignal.timeout(5000) }
    );
    return NextResponse.json({ valid: res.ok });
  } catch {
    // Network failure — fail open so valid words aren't blocked
    return NextResponse.json({ valid: true });
  }
}
