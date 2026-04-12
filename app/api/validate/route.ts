import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  const { word } = await request.json();

  if (!word || typeof word !== "string") {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 5,
      messages: [
        {
          role: "user",
          content: `Is "${word}" a valid English word? Reply only "yes" or "no".`,
        },
      ],
    });

    const verdict = (message.content[0] as { text: string }).text.toLowerCase().trim();
    return NextResponse.json({ valid: verdict.startsWith("yes") });
  } catch (err) {
    console.error("Anthropic validate error:", err);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
