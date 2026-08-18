import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { rateLimit, clientIp } from "../../../lib/rateLimit";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_TOTAL_BYTES = 15 * 1024 * 1024; // 15MB total across all attachments
const MAX_FILES = 5;
const ALLOWED_PREFIXES = ["image/", "video/"];

function generateTicketId(): string {
  const now = new Date();
  const yy = String(now.getUTCFullYear()).slice(2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `WBP-${yy}${mm}${dd}-${rand}`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest) {
  const ipLimit = await rateLimit(`feedback:ip:${clientIp(req)}`, 5, 60_000);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many feedback submissions. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const identifier = String(form.get("identifier") ?? "").trim();
  const category = String(form.get("category") ?? "Bug").trim();
  const message = String(form.get("message") ?? "").trim();

  if (!identifier) {
    return NextResponse.json({ error: "Username or email is required." }, { status: 400 });
  }
  if (identifier.length > 200) {
    return NextResponse.json({ error: "Username or email is too long." }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "Please describe the issue." }, { status: 400 });
  }
  if (message.length > 5000) {
    return NextResponse.json({ error: "Message is too long (max 5000 characters)." }, { status: 400 });
  }

  const files = form.getAll("attachments").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Too many files (max ${MAX_FILES}).` },
      { status: 400 }
    );
  }

  let totalBytes = 0;
  for (const f of files) {
    totalBytes += f.size;
    if (!ALLOWED_PREFIXES.some((p) => f.type.startsWith(p))) {
      return NextResponse.json(
        { error: `Only images and videos are allowed (got ${f.type || "unknown type"}).` },
        { status: 400 }
      );
    }
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      { error: "Attachments exceed 15MB total. Please reduce file sizes." },
      { status: 413 }
    );
  }

  const attachments = await Promise.all(
    files.map(async (f) => ({
      filename: f.name || "attachment",
      content: Buffer.from(await f.arrayBuffer()),
    }))
  );

  const ticketId = generateTicketId();
  const submittedAt = new Date().toISOString();
  const ip = clientIp(req);
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  const html = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:620px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6e6e6;">
      <div style="background:#6aaa64;padding:24px;text-align:center;">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.85);font-weight:600;margin-bottom:4px;">Wordle by Prav · Feedback</div>
        <div style="font-size:20px;font-weight:700;color:#ffffff;">${escapeHtml(ticketId)}</div>
      </div>
      <div style="padding:28px 28px 12px;">
        <table style="width:100%;font-size:14px;color:#1a1a1b;border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:#787c7e;width:130px;">Category</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(category)}</td></tr>
          <tr><td style="padding:6px 0;color:#787c7e;">From</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(identifier)}</td></tr>
          <tr><td style="padding:6px 0;color:#787c7e;">Submitted</td><td style="padding:6px 0;">${escapeHtml(submittedAt)}</td></tr>
          <tr><td style="padding:6px 0;color:#787c7e;">Attachments</td><td style="padding:6px 0;">${files.length}</td></tr>
          <tr><td style="padding:6px 0;color:#787c7e;">IP</td><td style="padding:6px 0;font-family:monospace;font-size:12px;">${escapeHtml(ip)}</td></tr>
          <tr><td style="padding:6px 0;color:#787c7e;vertical-align:top;">User-Agent</td><td style="padding:6px 0;font-family:monospace;font-size:12px;color:#4a4a4a;">${escapeHtml(userAgent)}</td></tr>
        </table>
      </div>
      <div style="padding:0 28px 28px;">
        <div style="font-size:12px;font-weight:700;color:#787c7e;text-transform:uppercase;letter-spacing:1px;margin:16px 0 8px;">Message</div>
        <div style="background:#f9f9f9;border:1px solid #e6e6e6;border-radius:8px;padding:14px 16px;font-size:14px;line-height:1.55;color:#1a1a1b;white-space:pre-wrap;">${escapeHtml(message)}</div>
      </div>
    </div>
  `;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromAddress = process.env.RESEND_FROM_EMAIL ?? "noreply@yourdomain.com";
    const toAddress = process.env.FEEDBACK_TO_EMAIL ?? "pravdeepkk@gmail.com";

    await resend.emails.send({
      from: fromAddress,
      to: toAddress,
      replyTo: identifier.includes("@") ? identifier : undefined,
      subject: `[${ticketId}] ${category} — ${identifier}`,
      html,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    return NextResponse.json({ success: true, ticketId });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json(
      { error: "Failed to submit feedback. Please try again later." },
      { status: 500 }
    );
  }
}
