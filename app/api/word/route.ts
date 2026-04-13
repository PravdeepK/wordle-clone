import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { isAnthropicRateLimitError, withAnthropic429Retries } from "../../../lib/anthropic429Retry";

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
  const { length = 5 } = await req.json();
  const fallback = fallbacks[length as number] ?? "stone";

  try {
    const message = await withAnthropic429Retries(() =>
      client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 10,
        messages: [
          {
            role: "user",
            content: `Give me one real English word that is exactly ${length} letters long. Return only the lowercase word, nothing else.`,
          },
        ],
      })
    );

    let word = (message.content[0] as { text: string }).text
      .trim()
      .replace(/[^a-zA-Z]/g, "")
      .toLowerCase();

    if (word.length !== length) {
      console.warn(`Wrong length from Haiku: "${word}", using fallback`);
      word = fallback;
    }

    return NextResponse.json({ word });
  } catch (err) {
    if (isAnthropicRateLimitError(err)) {
      console.warn("[api/word] Anthropic rate limit after retries; using fallback.");
    } else {
      console.error("[api/word] Anthropic error:", err);
    }
    return NextResponse.json({ word: fallback });
  }
}
