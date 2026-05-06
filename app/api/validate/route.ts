import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { isAnthropicRateLimitError, withAnthropic429Retries } from "../../../lib/anthropic429Retry";
import { rateLimit, clientIp } from "../../../lib/rateLimit";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0 });

export async function POST(request: Request) {
  const limit = rateLimit(`validate:${clientIp(request)}`, 60, 60_000);
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
    const message = await withAnthropic429Retries(() =>
      client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 5,
        messages: [
          {
            role: "user",
            content: `Is "${word}" a valid English word? Reply only "yes" or "no".`,
          },
        ],
      })
    );

    const verdict = (message.content[0] as { text: string }).text.toLowerCase().trim();
    return NextResponse.json({ valid: verdict.startsWith("yes") });
  } catch (err) {
    if (isAnthropicRateLimitError(err)) {
      console.warn("[api/validate] Anthropic rate limit after retries; rejecting guess.");
    } else {
      console.error("[api/validate] Anthropic error:", err);
    }
    return NextResponse.json({ valid: false });
  }
}
