import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { rateLimit, clientIp } from "../../../lib/rateLimit";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0 });

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

  const clean = word.trim().toLowerCase().replace(/[^a-z]/g, "");

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 5,
      messages: [
        {
          role: "user",
          content: `Is "${clean}" something a typical English speaker would recognize as a word? Be permissive: accept dictionary words, plurals, conjugations, common slang, internet slang, informal terms, mild profanity, brand names that have entered common usage, and proper nouns people would know. Only reject pure gibberish or random letter combinations. Reply with only "yes" or "no".`,
        },
      ],
    });

    const reply = (message.content[0] as { text: string }).text.trim().toLowerCase();
    return NextResponse.json({ valid: reply.startsWith("yes") });
  } catch {
    // Fail open so valid words aren't blocked on API errors
    return NextResponse.json({ valid: true });
  }
}
