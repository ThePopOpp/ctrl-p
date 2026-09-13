// Server-side delivery for the opportunity quick actions.
//
// Uses the same providers and environment variables as the rest of Ctrl+P:
// Twilio (texts, call lookups), SMTP via nodemailer (email), and Anthropic or
// OpenAI (AI drafts). Every function reports what the provider actually said —
// a rejected send comes back as a failure, never as "sent".

import Anthropic from "@anthropic-ai/sdk";
import nodemailer from "nodemailer";
import OpenAI from "openai";
import twilio from "twilio";

type Failure = { ok: false; status: number; error: string };

const env = (name: string) => process.env[name] || "";
const list = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

export function ownedNumbers(): string[] {
  const many = list(env("TWILIO_PHONE_NUMBERS"));
  if (many.length) return many;
  return env("TWILIO_PHONE_NUMBER") ? [env("TWILIO_PHONE_NUMBER")] : [];
}

/** Numbers allowed to send texts — matches /api/admin/communications/token. */
export function smsNumbers(): string[] {
  const configured = list(env("TWILIO_SMS_NUMBERS"));
  if (configured.length) return configured;
  const owned = ownedNumbers();
  return owned.length ? [owned[0]] : [];
}

/** E.164 for Twilio. Ten-digit numbers are treated as US numbers. */
export function toE164(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export async function sendSmsMessage(input: { to: string; from?: string | null; body: string }): Promise<{ ok: true; sid: string; status: string; to: string; from: string } | Failure> {
  const accountSid = env("TWILIO_ACCOUNT_SID");
  const authToken = env("TWILIO_AUTH_TOKEN");
  const numbers = smsNumbers().map(toE164);
  if (!accountSid || !authToken || !numbers.length) {
    return { ok: false, status: 501, error: "Texting isn't configured. TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and a Twilio number are required." };
  }
  const to = toE164(input.to);
  if (to.replace(/\D/g, "").length < 10) return { ok: false, status: 400, error: "Enter a valid mobile number." };
  const requested = toE164(input.from);
  const from = requested && numbers.includes(requested) ? requested : numbers[0];
  try {
    const message = await twilio(accountSid, authToken).messages.create({ from, to, body: input.body });
    return { ok: true, sid: message.sid, status: message.status, to, from };
  } catch (error) {
    return { ok: false, status: 502, error: error instanceof Error ? error.message : "Twilio rejected the message." };
  }
}

export async function sendEmailMessage(input: { to: string; subject: string; body: string }): Promise<{ ok: true; messageId: string | null; from: string } | Failure> {
  const missing = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"].filter((name) => !env(name));
  if (missing.length) return { ok: false, status: 501, error: `Email isn't configured (missing ${missing.join(", ")}).` };
  const transporter = nodemailer.createTransport({
    host: env("SMTP_HOST"),
    port: Number(env("SMTP_PORT") || 465),
    // Same default as /api/admin/messaging/send.
    secure: ["true", "1"].includes((env("SMTP_SECURE") || "true").toLowerCase()),
    auth: { user: env("SMTP_USER"), pass: env("SMTP_PASSWORD") },
  });
  const from = env("EMAIL_FROM") || env("SMTP_USER");
  try {
    const info = await transporter.sendMail({ from, replyTo: env("EMAIL_REPLY_TO") || from, to: input.to, subject: input.subject, text: input.body });
    return { ok: true, messageId: info.messageId ?? null, from };
  } catch (error) {
    return { ok: false, status: 502, error: error instanceof Error ? error.message : "The email server rejected the message." };
  }
}

export type CallOutcome = {
  status: string;
  durationSeconds: number;
  to: string | null;
  from: string | null;
  startTime: string | null;
  childSid: string | null;
};

/**
 * Look up a browser call in Twilio. The browser leg is the parent call; the
 * leg that actually rang the customer is its child, which carries the real
 * status and duration.
 */
export async function fetchCallOutcome(callSid: string): Promise<({ ok: true } & CallOutcome) | Failure> {
  const accountSid = env("TWILIO_ACCOUNT_SID");
  const authToken = env("TWILIO_AUTH_TOKEN");
  if (!accountSid || !authToken) return { ok: false, status: 501, error: "Twilio isn't configured." };
  try {
    const client = twilio(accountSid, authToken);
    const parent = await client.calls(callSid).fetch();
    const children = await client.calls.list({ parentCallSid: callSid, limit: 1 });
    const leg = children[0] ?? parent;
    const start = leg.startTime ?? parent.startTime;
    return {
      ok: true,
      status: leg.status,
      durationSeconds: Number(leg.duration || parent.duration || 0),
      to: leg.to || parent.to || null,
      from: leg.from || parent.from || null,
      startTime: start ? new Date(start).toISOString() : null,
      childSid: children[0]?.sid ?? null,
    };
  } catch (error) {
    return { ok: false, status: 502, error: error instanceof Error ? error.message : "Couldn't look up the call in Twilio." };
  }
}

export async function draftWithAi(system: string, prompt: string): Promise<{ ok: true; text: string; model: string } | Failure> {
  if (env("ANTHROPIC_API_KEY")) {
    const model = "claude-sonnet-4-6";
    try {
      const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
      const response = await client.messages.create({ model, max_tokens: 1200, system, messages: [{ role: "user", content: prompt }] });
      const text = response.content.find((part) => part.type === "text")?.text ?? "";
      return { ok: true, text: text.trim(), model };
    } catch (error) {
      return { ok: false, status: 502, error: error instanceof Error ? error.message : "The AI request failed." };
    }
  }
  if (env("OPENAI_API_KEY")) {
    const model = "gpt-4o-mini";
    try {
      const client = new OpenAI({ apiKey: env("OPENAI_API_KEY") });
      const response = await client.chat.completions.create({
        model,
        max_tokens: 1200,
        messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
      });
      return { ok: true, text: (response.choices[0]?.message?.content ?? "").trim(), model };
    } catch (error) {
      return { ok: false, status: 502, error: error instanceof Error ? error.message : "The AI request failed." };
    }
  }
  return { ok: false, status: 501, error: "AI isn't configured. Add ANTHROPIC_API_KEY or OPENAI_API_KEY." };
}

export async function transcribeAudio(file: Blob, filename: string): Promise<{ ok: true; text: string } | Failure> {
  const apiKey = env("OPENAI_API_KEY");
  if (!apiKey) return { ok: false, status: 501, error: "Transcription needs OPENAI_API_KEY." };
  const form = new FormData();
  form.append("file", file, filename);
  form.append("model", "whisper-1");
  form.append("response_format", "text");
  try {
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form });
    if (!response.ok) return { ok: false, status: 502, error: `Transcription failed: ${(await response.text()).slice(0, 200)}` };
    return { ok: true, text: (await response.text()).trim() };
  } catch (error) {
    return { ok: false, status: 502, error: error instanceof Error ? error.message : "Transcription failed." };
  }
}
