import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { isAnthropicRateLimitError, withAnthropic429Retries } from "../../../lib/anthropic429Retry";
import { rateLimit, clientIp } from "../../../lib/rateLimit";
import * as Sentry from "@sentry/nextjs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0 });

const fallbackPools: Record<number, string[]> = {
  3: ["cat", "dog", "sun", "cup", "bag", "pen", "key", "map", "box", "fan"],
  4: ["lamp", "fork", "book", "ring", "boat", "rain", "tree", "shoe", "desk", "moon"],
  5: ["stone", "bread", "river", "chair", "cloud", "horse", "plant", "music", "knife", "candy", "tiger", "ocean", "watch", "sword", "piano"],
  6: ["planet", "rabbit", "pencil", "guitar", "window", "garden", "monkey", "castle", "forest", "bridge"],
  7: ["blanket", "kitchen", "diamond", "balloon", "rainbow", "biscuit", "library", "compass", "octopus", "trumpet"],
  8: ["schedule", "elephant", "mountain", "umbrella", "computer", "dinosaur", "hospital", "sandwich", "pancakes", "airplane"],
  9: ["important", "chocolate", "wonderful", "telephone", "butterfly", "newspaper", "spaghetti", "astronaut", "submarine", "lightning"],
  10: ["strawberry", "helicopter", "playground", "watermelon", "basketball", "skateboard", "toothbrush", "binoculars", "dictionary", "calculator"],
};

function pickFallback(length: number, recent: string[]): string {
  const pool = fallbackPools[length] ?? fallbackPools[5];
  const recentSet = new Set(recent.map((w) => w.toLowerCase()));
  const fresh = pool.filter((w) => !recentSet.has(w));
  const choices = fresh.length > 0 ? fresh : pool;
  return choices[Math.floor(Math.random() * choices.length)];
}

export async function POST(req: Request) {
  const limit = rateLimit(`word:${clientIp(req)}`, 500, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const body = await req.json();
  const length: number = body?.length ?? 5;
  const recentRaw: unknown = body?.recent;
  const recent: string[] = Array.isArray(recentRaw)
    ? recentRaw.filter((w): w is string => typeof w === "string").map((w) => w.toLowerCase()).slice(0, 30)
    : [];

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
    "a vehicle or means of transport",
    "a musical instrument",
    "a sport or game",
    "a plant, flower, or tree",
    "a weather phenomenon",
    "a color or shade",
    "a building or structure",
    "a part of the body of water (sea, lake, etc.) or geography",
    "a piece of furniture",
    "a kitchen item",
    "a school-related thing",
    "a holiday or celebration thing",
    "a mythical creature",
    "a planet, star, or space-related thing",
    "an article of jewelry",
    "an insect or small creature",
    "a sound or noise",
    "a material or substance",
  ];
  const category = categories[Math.floor(Math.random() * categories.length)];
  const nonce = Math.random().toString(36).slice(2, 8);

  const avoidClause =
    recent.length > 0
      ? ` Do not use any of these previously chosen words: ${recent.join(", ")}.`
      : "";

  try {
    const message = await withAnthropic429Retries(() =>
      client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 20,
        temperature: 1,
        messages: [
          {
            role: "user",
            content: `Pick one real, common English word that is exactly ${length} letters long, starts with the letter "${seedLetter}", and refers to ${category}. Be creative and varied — avoid the most stereotypical choice. Avoid obscure or archaic words.${avoidClause} (Random seed: ${nonce}.) Return only the lowercase word, nothing else.`,
          },
        ],
      })
    );

    let word = (message.content[0] as { text: string }).text
      .trim()
      .replace(/[^a-zA-Z]/g, "")
      .toLowerCase();

    const recentSet = new Set(recent);
    if (word.length !== length || recentSet.has(word)) {
      word = pickFallback(length, recent);
    }

    return NextResponse.json({ word });
  } catch (err) {
    if (!isAnthropicRateLimitError(err)) {
      Sentry.captureException(err);
    }
    return NextResponse.json({ word: pickFallback(length, recent) });
  }
}
