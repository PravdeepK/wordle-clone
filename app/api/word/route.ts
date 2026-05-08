import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { isAnthropicRateLimitError, withAnthropic429Retries } from "../../../lib/anthropic429Retry";
import { rateLimit, clientIp } from "../../../lib/rateLimit";
import * as Sentry from "@sentry/nextjs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0 });

const fallbacks: Record<number, string> = {
  3: "cat",
  4: "lamp",
  5: "stone",
  6: "planet",
  7: "blanket",
  8: "schedule",
  9: "important",
  10: "strawberry",
};

export async function POST(req: Request) {
  const limit = rateLimit(`word:${clientIp(req)}`, 500, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const { length = 5 } = await req.json();
  const fallback = fallbacks[length as number] ?? "stone";

  const letters = "abcdefghijklmnoprstuvwy";
  const seedLetter = letters[Math.floor(Math.random() * letters.length)];
  const categories = [
    "an everyday object",
    "a food or drink",
    "an animal",
    "a place or location",
    "an action verb",
    "a feeling or emotion",
    "something in nature",
    "a household item",
    "a profession",
    "a piece of clothing",
    "a tool",
    "a body part",
  ];
  const category = categories[Math.floor(Math.random() * categories.length)];

  try {
    const message = await withAnthropic429Retries(() =>
      client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 20,
        temperature: 1,
        messages: [
          {
            role: "user",
            content: `Give me one real, common English word that is exactly ${length} letters long, starts with the letter "${seedLetter}", and refers to ${category}. Avoid obscure words. Return only the lowercase word, nothing else.`,
          },
        ],
      })
    );

    let word = (message.content[0] as { text: string }).text
      .trim()
      .replace(/[^a-zA-Z]/g, "")
      .toLowerCase();

    if (word.length !== length) {
      word = fallback;
    }

    return NextResponse.json({ word });
  } catch (err) {
    if (!isAnthropicRateLimitError(err)) {
      Sentry.captureException(err);
    }
    return NextResponse.json({ word: fallback });
  }
}
