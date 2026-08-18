import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { rateLimit, clientIp } from "../../../../lib/rateLimit";
import { checkUsername } from "../../../../lib/reservedUsernames";
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

/**
 * Signup-time username availability check. Server-side so the `users`
 * collection stays private; returns a boolean and nothing else.
 */
export async function POST(req: NextRequest) {
  const ipLimit = rateLimit(`username-available:ip:${clientIp(req)}`, 20, 60_000);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } }
    );
  }

  let body: { username?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";

  // Reserved and malformed names are reported as unavailable rather than as a
  // lookup result, so the client renders one consistent message.
  const check = checkUsername(username);
  if (!check.ok) {
    return NextResponse.json({ available: false, reason: check.reason });
  }

  try {
    const db = getFirestore(getAdminApp());
    const snap = await db.collection("users").doc(username).get();
    return NextResponse.json({ available: !snap.exists });
  } catch (e) {
    Sentry.captureException(e);
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }
}
