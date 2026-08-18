import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { Resend } from "resend";
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
  const ipLimit = await rateLimit(`verify:ip:${clientIp(req)}`, 5, 60_000);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } }
    );
  }

  const { email } = await req.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const emailLimit = await rateLimit(`verify:email:${email.toLowerCase()}`, 3, 60_000);
  if (!emailLimit.allowed) {
    return NextResponse.json(
      { error: "Verification email already sent. Please check your inbox." },
      { status: 429, headers: { "Retry-After": String(emailLimit.retryAfter) } }
    );
  }

  try {
    const app = getAdminApp();
    const adminAuth = getAuth(app);
    const verificationLink = await adminAuth.generateEmailVerificationLink(email);

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromAddress = process.env.RESEND_FROM_EMAIL ?? "noreply@yourdomain.com";

    const text = [
      "Welcome aboard!",
      "",
      "Thank you for signing up on my version of Wordle.",
      "",
      "Verify your email address by opening this link:",
      verificationLink,
      "",
      "If you didn't create an account, you can safely ignore this email.",
    ].join("\n");

    await resend.emails.send({
      from: fromAddress,
      to: email,
      replyTo: fromAddress,
      subject: "Verify your Wordle account",
      text,
      html: `
        <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6e6e6;">

          <!-- Header -->
          <div style="background:#6aaa64;padding:32px 24px;text-align:center;">
            <!-- Wordle tiles -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 12px;border-collapse:separate;border-spacing:3px;">
              <tr>
                ${["W","O","R","D","L","E"].map((l, i) => {
                  const colors = ["#6aaa64","#c9b458","#6aaa64","#6aaa64","#c9b458","#6aaa64"];
                  return `<td width="40" height="40" style="width:40px;height:40px;background:${colors[i]};border:2px solid rgba(255,255,255,0.4);border-radius:4px;font-size:18px;font-weight:700;color:#ffffff;text-align:center;vertical-align:middle;font-family:'Helvetica Neue',Arial,sans-serif;mso-line-height-rule:exactly;line-height:40px;">${l}</td>`;
                }).join("")}
              </tr>
            </table>
            <div style="font-size:13px;font-weight:600;color:rgba(255,255,255,0.85);letter-spacing:2px;text-transform:uppercase;">by Prav</div>
          </div>

          <!-- Body -->
          <div style="padding:36px 32px;">
            <h1 style="font-size:22px;font-weight:700;color:#1a1a1b;margin:0 0 12px;">Welcome aboard!</h1>
            <p style="font-size:15px;color:#4a4a4a;line-height:1.6;margin:0 0 8px;">
              Thank you for signing up on my version of Wordle!
            </p>
            <p style="font-size:15px;color:#4a4a4a;line-height:1.6;margin:0 0 28px;">
              Click the button below to verify your email address and activate your account. Once verified, you'll be able to log in and start guessing.
            </p>

            <div style="text-align:center;margin-bottom:28px;">
              <a href="${verificationLink}"
                 style="display:inline-block;padding:14px 36px;background:#6aaa64;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:16px;letter-spacing:0.5px;">
                Verify My Email
              </a>
            </div>

            <p style="font-size:13px;color:#787c7e;line-height:1.5;margin:0;">
              If the button doesn't work, copy and paste this link into your browser:<br/>
              <a href="${verificationLink}" style="color:#6aaa64;word-break:break-all;">${verificationLink}</a>
            </p>
          </div>

          <!-- Footer -->
          <div style="background:#f9f9f9;border-top:1px solid #e6e6e6;padding:20px 32px;text-align:center;">
            <p style="font-size:12px;color:#787c7e;margin:0;">
              If you didn't create an account, you can safely ignore this email.
            </p>
          </div>

        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const e = err as { message?: string; code?: string };
    Sentry.captureException(err);
    if (e?.message?.includes("TOO_MANY_ATTEMPTS_TRY_LATER")) {
      return NextResponse.json(
        { error: "Too many verification emails sent for this address. Please wait a few minutes and try again." },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: "Failed to send verification email." }, { status: 500 });
  }
}
