import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { Resend } from "resend";
import { rateLimit, clientIp } from "../../../lib/rateLimit";

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
  const ipLimit = rateLimit(`verify:ip:${clientIp(req)}`, 5, 60_000);
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

  const emailLimit = rateLimit(`verify:email:${email.toLowerCase()}`, 3, 60_000);
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

    await resend.emails.send({
      from: fromAddress,
      to: email,
      subject: "Verify your Wordle account",
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <meta name="color-scheme" content="light only">
          <meta name="supported-color-schemes" content="light only">
          <title>Verify your Wordle account</title>
          <style>
            :root { color-scheme: light only; supported-color-schemes: light only; }
            body { margin:0; padding:0; background:#f4f4f4 !important; }
            u + .body { background:#f4f4f4 !important; }
            /* Force light colors even in dark-mode clients */
            [data-ogsc] .tile-letter, [data-ogsb] .tile-letter { color:#ffffff !important; }
            [data-ogsc] .heading, [data-ogsb] .heading { color:#1a1a1b !important; }
            [data-ogsc] .body-text, [data-ogsb] .body-text { color:#4a4a4a !important; }
            [data-ogsc] .small-text, [data-ogsb] .small-text { color:#787c7e !important; }
            [data-ogsc] .card, [data-ogsb] .card { background:#ffffff !important; }
            [data-ogsc] .footer-bg, [data-ogsb] .footer-bg { background:#f9f9f9 !important; }
            [data-ogsc] .link-box, [data-ogsb] .link-box { background:#f4f4f4 !important; }
            @media (prefers-color-scheme: dark) {
              .card { background:#ffffff !important; }
              .heading { color:#1a1a1b !important; }
              .body-text { color:#4a4a4a !important; }
              .small-text { color:#787c7e !important; }
              .tile-letter { color:#ffffff !important; }
              .footer-bg { background:#f9f9f9 !important; }
              .link-box { background:#f4f4f4 !important; }
            }
          </style>
        </head>
        <body class="body" style="margin:0;padding:24px 12px;background:#f4f4f4;font-family:'Helvetica Neue',Arial,sans-serif;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" class="card" style="max-width:520px;width:100%;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6e6e6;">

            <!-- Header -->
            <tr>
              <td style="background:#6aaa64;padding:32px 24px;text-align:center;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 12px;">
                  <tr>
                    ${["W","O","R","D","L","E"].map((l, i) => {
                      const colors = ["#6aaa64","#c9b458","#6aaa64","#6aaa64","#c9b458","#6aaa64"];
                      return `<td class="tile-letter" style="width:40px;height:40px;background:${colors[i]};border:2px solid #ffffff;border-radius:4px;font-size:18px;font-weight:700;color:#ffffff;text-align:center;vertical-align:middle;font-family:'Helvetica Neue',Arial,sans-serif;mso-line-height-rule:exactly;line-height:40px;padding:0 4px;">${l}</td>`;
                    }).join("")}
                  </tr>
                </table>
                <div style="font-size:13px;font-weight:600;color:#ffffff;letter-spacing:2px;text-transform:uppercase;">by Prav</div>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:36px 32px;background:#ffffff;">
                <h1 class="heading" style="font-size:22px;font-weight:700;color:#1a1a1b;margin:0 0 12px;">Welcome aboard!</h1>
                <p class="body-text" style="font-size:15px;color:#4a4a4a;line-height:1.6;margin:0 0 8px;">
                  Thank you for signing up on my version of Wordle!
                </p>
                <p class="body-text" style="font-size:15px;color:#4a4a4a;line-height:1.6;margin:0 0 28px;">
                  Click the button below to verify your email address and activate your account. Once verified, you'll be able to log in and start guessing.
                </p>

                <div style="text-align:center;margin-bottom:28px;">
                  <a href="${verificationLink}"
                     style="display:inline-block;padding:14px 36px;background:#6aaa64;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:16px;letter-spacing:0.5px;">
                    Verify My Email
                  </a>
                </div>

                <p class="small-text" style="font-size:13px;color:#787c7e;line-height:1.5;margin:0 0 8px;">
                  Or copy and paste this link into your browser:
                </p>
                <div class="link-box" style="background:#f4f4f4;border:1px solid #e6e6e6;border-radius:6px;padding:10px 12px;">
                  <a href="${verificationLink}" style="color:#6aaa64;font-size:12px;font-family:'SF Mono',Menlo,Consolas,monospace;word-break:break-all;text-decoration:none;line-height:1.5;">${verificationLink}</a>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td class="footer-bg" style="background:#f9f9f9;border-top:1px solid #e6e6e6;padding:20px 32px;text-align:center;">
                <p class="small-text" style="font-size:12px;color:#787c7e;margin:0;">
                  If you didn't create an account, you can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("send-verification-email error:", e?.message);
    return NextResponse.json({ error: "Failed to send verification email." }, { status: 500 });
  }
}
