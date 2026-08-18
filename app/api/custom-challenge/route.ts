import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { rateLimit, clientIp } from "../../../lib/rateLimit";
import * as Sentry from "@sentry/nextjs";

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const ipLimit = await rateLimit(`custom-challenge:create:ip:${ip}`, 10, 60_000);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } }
    );
  }

  let body: { word?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const raw = typeof body.word === "string" ? body.word : "";
  const word = raw.trim().toUpperCase();
  if (word.length < 3 || word.length > 10 || !/^[A-Z]+$/.test(word)) {
    return NextResponse.json({ error: "Invalid word." }, { status: 400 });
  }

  try {
    const db = getFirestore(getAdminApp());
    const docRef = await db.collection("customChallenges").add({
      word,
      timestamp: new Date(),
    });
    return NextResponse.json({ id: docRef.id });
  } catch (e) {
    Sentry.captureException(e);
    return NextResponse.json({ error: "Could not create challenge." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const ip = clientIp(req);
  const ipLimit = await rateLimit(`custom-challenge:delete:ip:${ip}`, 30, 60_000);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } }
    );
  }

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id || !/^[A-Za-z0-9]{1,40}$/.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  try {
    const db = getFirestore(getAdminApp());
    await db.collection("customChallenges").doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    Sentry.captureException(e);
    return NextResponse.json({ error: "Could not delete challenge." }, { status: 500 });
  }
}
