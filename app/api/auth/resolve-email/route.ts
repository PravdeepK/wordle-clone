import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { rateLimit, clientIp } from "../../../../lib/rateLimit";
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

const NOT_FOUND = { error: "not_found" };

/**
 * Resolves a username to the email address its account signs in with, so the
 * client can call signInWithEmailAndPassword. Server-side so the `users`
 * collection never has to be publicly readable.
 *
 * Returns only the email — never the stored document.
 */
export async function POST(req: NextRequest) {
  const ipLimit = await rateLimit(`resolve-email:ip:${clientIp(req)}`, 10, 60_000);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } }
    );
  }

  let body: { identifier?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
  if (!identifier || identifier.length > 254) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  // An email is already what the caller needs; no lookup required.
  if (identifier.includes("@")) {
    return NextResponse.json({ email: identifier });
  }

  try {
    const db = getFirestore(getAdminApp());
    const snap = await db.collection("users").doc(identifier.toLowerCase()).get();
    const email = snap.exists ? snap.get("email") : null;
    if (typeof email !== "string" || !email) {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }
    return NextResponse.json({ email });
  } catch (e) {
    Sentry.captureException(e);
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }
}
