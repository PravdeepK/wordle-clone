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

  const prompt = `Is "${clean}" a real English word that a typical speaker would recognize? Be very permissive: accept dictionary words (including all inflected forms — plurals like "cats", conjugations like "running"/"ran"/"swam", comparatives like "bigger", agent nouns like "librarian"/"runner"/"teacher", adverbs like "quickly", abstract nouns like "happiness"), common slang, internet terms, informal words, mild profanity, brand names in common usage, and well-known proper nouns. Only reject pure gibberish or random letter combinations like "qwxzt". Reply with only "yes" or "no".`;

  async function ask(): Promise<string> {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 5,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });
    return (message.content[0] as { text: string }).text.trim().toLowerCase();
  }

  try {
    let reply = await ask();
    if (reply.startsWith("no")) {
      const second = await ask();
      if (second.startsWith("yes")) reply = second;
    }
    if (reply.startsWith("yes")) return NextResponse.json({ valid: true });
    if (reply.startsWith("no")) return NextResponse.json({ valid: false });
    // Ambiguous response — fail open.
    return NextResponse.json({ valid: true });
  } catch {
    // Fail open so valid words aren't blocked on API errors
    return NextResponse.json({ valid: true });
  }
}
